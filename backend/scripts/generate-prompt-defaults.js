/**
 * 一次性脚本：从现有代码中提取 AI Prompt，生成 src/config/promptDefaults.js
 * 将代码中的 JS 模板变量替换为 {{placeholder}}，方便 Prompt 管理服务统一渲染。
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function readLines(file, start, end) {
  const lines = fs.readFileSync(path.join(root, file), 'utf-8').split('\n');
  return lines.slice(start - 1, end).join('\n');
}

function stripDeclaration(content) {
  return content.replace(/^\s*const\s+\w+\s*=\s*`/, '').replace(/`;\s*$/, '');
}

const extractedSections = [
  { key: 'main_agent', file: 'src/services/agents/mainAgent.js', start: 12, end: 154 },
  { key: 'helper_agent', file: 'src/services/agents/helperAgent.js', start: 11, end: 135 },
  { key: 'precipitation_agent', file: 'src/services/agents/precipitationAgent.js', start: 414, end: 631 },
  { key: 'recipe_extraction', file: 'src/services/agents/partnerAssetAgent.js', start: 8, end: 42 },
  { key: 'method_extraction', file: 'src/services/agents/partnerAssetAgent.js', start: 121, end: 139 },
  { key: 'diary_system', file: 'src/controllers/aiController.js', start: 155, end: 179 }
];

const manualSections = {
  diary_user: `请根据以下数据生成今日减肥日记：
{{data_context}}

如果某项数据为空或缺失，请在对应章节中明确说明"未记录"，不要编造数据。`,

  monthly_diary: `请根据以下用户{{month}}月的减肥数据，生成一段温暖、治愈、口语化的月度减肥日记（200-300字），像闺蜜在日记本里写的那样，总结这个月的努力和进步，给予鼓励，不要出现"AI"、"机器人"字样。

用户：{{nickname}}
月份：{{month}}
饮食记录：{{diet_rows}}
运动记录：{{exercise_rows}}
体重记录：{{weight_rows}}
目标：{{target}}`,

  plateau_analysis: `请根据以下用户最近 {{days}} 天的数据，判断是否存在平台期（体重连续波动小于0.5kg 或连续上升），并给出2-3条具体、可执行的建议。语气温暖，不要制造焦虑。

体重记录（kg）：{{weights}}
每日饮食（kcal）：{{nutrition}}
每日运动（分钟/千卡）：{{exercises}}
目标：{{target}}`
};

const allKeys = [
  ...extractedSections.map(s => s.key),
  ...Object.keys(manualSections)
];

const contents = {};
for (const s of extractedSections) {
  contents[s.key] = stripDeclaration(readLines(s.file, s.start, s.end));
}
for (const [key, content] of Object.entries(manualSections)) {
  contents[key] = content;
}

let out = '/**\n * AI Prompt 默认内容（首次启动时写入 ai_prompts 表）\n */\n\nmodule.exports = {\n';
for (const key of allKeys) {
  const content = contents[key];
  out += `  '${key}': \`${content.replace(/`/g, '\\`').replace(/\\\$/g, '$')}\`,\n\n`;
}
out += '};\n';

fs.writeFileSync(path.join(root, 'src/config/promptDefaults.js'), out);
console.log('src/config/promptDefaults.js generated');
