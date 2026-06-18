/**
 * 聊天控制器
 * 核心：接收用户消息，调用主协调 Agent，异步沉淀信息
 */
const { db } = require('../db');
const { success, error } = require('../utils/response');
const mainAgent = require('../services/agents/mainAgent');
const precipitationAgent = require('../services/agents/precipitationAgent');
const helperAgent = require('../services/agents/helperAgent');

/**
 * 发送消息
 */
async function sendMessage(req, res) {
  const userId = req.userId;
  const { content, content_type = 'text' } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json(error('消息内容不能为空', 400));
  }

  try {
    // 获取用户信息和搭子信息
    const user = db.prepare(`
      SELECT u.*, p.current_weight, p.target_weight, p.dietary_taboos, p.preferences
      FROM users u
      LEFT JOIN user_profiles p ON u.id = p.user_id
      WHERE u.id = ?
    `).get(userId);

    const partner = db.prepare('SELECT * FROM partners WHERE user_id = ?').get(userId);

    // 保存用户消息
    const insertUserMsg = db.prepare(`
      INSERT INTO chat_messages (user_id, role, content, content_type, mode)
      VALUES (?, 'user', ?, ?, ?)
    `);
    const userMessageId = insertUserMsg.run(userId, content, content_type, partner.mode).lastInsertRowid;

    // 获取最近历史消息
    const history = db.prepare(`
      SELECT role, content, mode FROM chat_messages
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 20
    `).all(userId).reverse();

    // 调用主协调 Agent
    const agentResult = await mainAgent.callMainAgent(content, history, user, partner);

    let finalReply = agentResult.reply;
    let precipitationInfo = null;
    let helperInfo = null;

    // 执行工具调用
    if (agentResult.toolCalls && agentResult.toolCalls.length > 0) {
      const toolResults = await mainAgent.executeToolCalls(
        agentResult.toolCalls,
        userId,
        content,
        user
      );

      for (const result of toolResults) {
        if (result.name === 'call_allround_helper' && result.answer) {
          helperInfo = result.answer;
          // 把专业回答追加到搭子回复中
          finalReply = finalReply ? `${finalReply} ${result.answer}` : result.answer;
        }
        if (result.name === 'call_precipitation' && result.extracted) {
          precipitationInfo = {
            type: result.type,
            confidence: result.confidence,
            status: result.status === 1 ? 'confirmed' : 'pending'
          };
        }
      }
    }

    // 无论主协调是否调用沉淀工具，都异步调用信息沉淀 Agent
    // 这是核心差异化能力：聊天即记录
    if (!precipitationInfo) {
      precipitationAgent.callPrecipitationAgent(content, userId, userMessageId)
        .then(result => {
          if (result.extracted) {
            // 更新用户消息的沉淀状态
            const status = result.status === 1 ? 1 : 2;
            db.prepare('UPDATE chat_messages SET precipitation_status = ?, precipitation_id = ? WHERE id = ?')
              .run(status, result.precipitation_id, userMessageId);
          }
        })
        .catch(err => console.error('异步沉淀失败:', err));
    } else {
      // 已经有沉淀结果，更新状态
      const status = precipitationInfo.status === 'confirmed' ? 1 : 2;
      const precipRecord = db.prepare('SELECT id FROM precipitation_records WHERE chat_id = ? ORDER BY id DESC LIMIT 1').get(userMessageId);
      db.prepare('UPDATE chat_messages SET precipitation_status = ?, precipitation_id = ? WHERE id = ?')
        .run(status, precipRecord ? precipRecord.id : null, userMessageId);
    }

    // 保存搭子回复
    const insertPartnerMsg = db.prepare(`
      INSERT INTO chat_messages (user_id, role, content, content_type, mode)
      VALUES (?, 'partner', ?, 'text', ?)
    `);
    const partnerMessageId = insertPartnerMsg.run(userId, finalReply || '嗯嗯，我在听～', partner.mode).lastInsertRowid;

    return res.json(success({
      user_message: {
        id: userMessageId,
        role: 'user',
        content,
        content_type,
        created_at: new Date().toISOString(),
        precipitation_status: precipitationInfo ? (precipitationInfo.status === 'confirmed' ? 1 : 2) : 0
      },
      partner_message: {
        id: partnerMessageId,
        role: 'partner',
        content: finalReply || '嗯嗯，我在听～',
        content_type: 'text',
        created_at: new Date().toISOString(),
        precipitation_status: 0
      },
      precipitation_info: precipitationInfo,
      helper_info: helperInfo
    }));
  } catch (err) {
    console.error('发送消息失败:', err);
    return res.status(500).json(error('发送消息失败', 500));
  }
}

/**
 * 获取聊天记录
 */
function getMessages(req, res) {
  const userId = req.userId;
  const page = parseInt(req.query.page) || 1;
  const size = parseInt(req.query.size) || 20;
  const offset = (page - 1) * size;

  const list = db.prepare(`
    SELECT id, role, content, content_type, precipitation_status, precipitation_id, mode, created_at
    FROM chat_messages
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(userId, size, offset);

  const total = db.prepare('SELECT COUNT(*) as count FROM chat_messages WHERE user_id = ?').get(userId).count;

  return res.json(success({
    list: list.reverse(),
    pagination: {
      page,
      size,
      total,
      has_more: total > page * size
    }
  }));
}

/**
 * 确认待确认沉淀
 */
function confirmPrecipitation(req, res) {
  const userId = req.userId;
  const { precipitation_id, confirmed, modified_data } = req.body;

  if (!precipitation_id) {
    return res.status(400).json(error('缺少沉淀 ID', 400));
  }

  const record = db.prepare('SELECT * FROM precipitation_records WHERE id = ? AND user_id = ?').get(precipitation_id, userId);
  if (!record) {
    return res.status(404).json(error('沉淀记录不存在', 404));
  }

  if (confirmed) {
    // 更新沉淀记录为已确认
    db.prepare('UPDATE precipitation_records SET status = 1, extracted_data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(modified_data ? JSON.stringify(modified_data) : record.extracted_data, precipitation_id);

    // 同步到业务表
    const result = {
      type: record.type,
      sub_type: record.sub_type,
      extracted_data: modified_data || JSON.parse(record.extracted_data || '{}'),
      tags: record.tags ? JSON.parse(record.tags) : null
    };
    precipitationAgent.syncToBusinessTable(userId, precipitation_id, result, record.content);

    // 更新聊天消息状态
    if (record.chat_id) {
      db.prepare('UPDATE chat_messages SET precipitation_status = 1 WHERE id = ?').run(record.chat_id);
    }

    return res.json(success(null, '已确认记录'));
  } else {
    // 拒绝沉淀
    db.prepare('UPDATE precipitation_records SET status = 2, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(precipitation_id);
    if (record.chat_id) {
      db.prepare('UPDATE chat_messages SET precipitation_status = 3 WHERE id = ?').run(record.chat_id);
    }
    return res.json(success(null, '已忽略记录'));
  }
}

module.exports = {
  sendMessage,
  getMessages,
  confirmPrecipitation
};
