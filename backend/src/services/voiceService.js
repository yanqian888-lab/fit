/**
 * 语音服务：ASR / TTS  provider 封装
 * 默认未配置 provider 时返回空/占位，需运营方配置 OPENAI_API_KEY 后启用。
 */
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');

const provider = process.env.VOICE_PROVIDER || '';
const openaiKey = process.env.OPENAI_API_KEY || '';
const openaiBaseURL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';

let openai = null;
if (provider === 'openai' && openaiKey) {
  openai = new OpenAI({ apiKey: openaiKey, baseURL: openaiBaseURL });
}

function isEnabled() {
  return !!openai;
}

async function transcribe(filePath) {
  if (!openai) {
    return { text: '', error: '语音输入未配置 ASR 服务' };
  }

  try {
    const res = await openai.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: 'whisper-1',
      language: 'zh'
    });
    return { text: res.text || '' };
  } catch (err) {
    console.error('[VoiceService] ASR 失败:', err.message);
    return { text: '', error: '语音识别失败，请重试' };
  }
}

async function tts(text) {
  if (!openai) {
    return { url: '', error: '语音输出未配置 TTS 服务' };
  }

  try {
    const mp3 = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'alloy',
      input: text
    });
    const buffer = Buffer.from(await mp3.arrayBuffer());
    const fileName = `tts_${Date.now()}.mp3`;
    const uploadDir = path.join(__dirname, '../../public/uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    const filePath = path.join(uploadDir, fileName);
    fs.writeFileSync(filePath, buffer);
    return { url: `/static/uploads/${fileName}` };
  } catch (err) {
    console.error('[VoiceService] TTS 失败:', err.message);
    return { url: '', error: '语音合成失败，请重试' };
  }
}

module.exports = {
  isEnabled,
  transcribe,
  tts
};
