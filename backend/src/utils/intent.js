/**
 * 用户意图识别工具
 * 用于判断消息是否为疑问句、否定/犹豫意图等，避免误沉淀记录。
 */

/**
 * 判断是否为疑问句/咨询句
 */
function isQuestionContent(content) {
  if (!content) return false;
  const text = content.trim();
  if (/[?？]$/.test(text)) return true;
  // 注意："呢" 常用于感叹/陈述句（如"围度小了很多呢！"），不作为疑问句判断依据
  return /(吗|行不行|可不可以|可以吗|怎么办|咋办|咋整|为什么|怎么|如何|是否|是不是|能不能|多久|多少|什么样|哪些|哪个)\s*[?？]?/.test(text);
}

/**
 * 判断是否包含否定/犹豫/未发生等不宜直接记录的意图
 * 例如：不想吃、不吃了、没吃、不要吃、吃不下、懒得动
 */
function hasNegativeRecordIntent(content) {
  if (!content) return false;
  const text = content;
  const patterns = [
    /不想[吃喝了][了\s]?/,
    /不想运[动了]?/,
    /不想练[了]?/,
    /不想走[了]?/,
    /不想跑[了]?/,
    /不想动[了]?/,
    /不爱[动练走跑][了]?/,
    /不[吃喝]了?[吧呀呢]?/,
    /不[运练走跑][了\s]?/,
    /没[吃喝][过\s]?/,
    /没[运练走跑][过\s]?/,
    /不要[吃喝了]/,
    /吃不[下了]/,
    /喝不[下了]/,
    /懒得[吃练动走跑][了]?/,
    /不愿[吃练动走跑][了]?/
  ];
  return patterns.some(re => re.test(text));
}

/**
 * 判断文本中是否存在「肯定式」的动作完成标记
 * 动作动词（吃/喝/跑/走/练等）后接「了/过」时，若该动词处于否定小句
 * （动词前紧邻 不/没/别/未/勿/莫，且中间没有标点隔断），则视为"否定动作"，不计入。
 * 典型修复："我今晚不吃饭了"、"晚饭不吃了" 中的 "吃…了" 是否定，不算自我报告；
 *          "我中午没吃米饭，吃了一碗面" 中第二个 "吃了" 是肯定，仍算自我报告。
 */
function hasAffirmativeActionMarker(content) {
  if (!content) return false;
  const text = String(content);
  // 按标点分句，逐句判断是否含"动词+了/过"的肯定动作
  // "今晚不吃饭了，吃了一个苹果" → 分为["今晚不吃饭了","吃了一个苹果"]
  // 第二句含"吃了"且无否定词 → 肯定句
  const clauses = text.split(/[，,。；;！!？?]/);
  for (const clause of clauses) {
    const trimmed = clause.trim();
    // 检测该小句是否含"动词+了/过"
    const verbMatch = trimmed.match(/([吃喝跑走练称睡排做骑游])([了过])/);
    if (!verbMatch) continue;
    // 检测该小句是否含否定词——含则跳过（"不吃饭了"是否定）
    if (/不|没|别|未|勿|莫/.test(trimmed.slice(0, trimmed.indexOf(verbMatch[0])))) continue;
    return true;
  }
  // 无标点分隔时，用原逻辑检测（整句只有一个"吃了"且无否定词）
  if (!/[，,。；;！!？?]/.test(text)) {
    const re = /([吃喝跑走练称睡排做骑游])([了过])/g;
    let m;
    let negSkipCount = 0;
    let totalVerbCount = 0;
    while ((m = re.exec(text)) !== null) {
      totalVerbCount++;
      const before = text.slice(Math.max(0, m.index - 4), m.index);
      if (/[不没别未勿莫][^，,。；;！!？?\s]{0,3}$/.test(before)) {
        negSkipCount++;
        continue;
      }
      return true;
    }
    // 如果有多个动词但都被否定小句覆盖，检查最后一个动词后面是否有具体食物/运动量词
    // "不吃饭了吃了一个苹果" → 第二个"吃了"后跟"一个" → 肯定句
    if (totalVerbCount > 1 && negSkipCount > 0) {
      // 重新匹配所有动词，取最后一个
      const re2 = /([吃喝跑走练称睡排做骑游])([了过])/g;
      let lastMatch = null;
      let m2;
      while ((m2 = re2.exec(text)) !== null) { lastMatch = m2; }
      if (lastMatch) {
        const after = text.slice(lastMatch.index + lastMatch[0].length, lastMatch.index + lastMatch[0].length + 8);
        if (/[一二两三四五六七八九十半\d]?(?:个|份|碗|杯|根|片|只|块|盘|袋|包|克|g|毫升|ml|公里|km|分钟|小时|下|次|组|层|步)/.test(after)) {
          return true;
        }
      }
    }
    // 如果只有一个动词且被判定否定，但动词后面跟着食物/运动量词，说明是肯定句
    // "不吃饭了吃了一个苹果" → exec 只匹配到否定句中的"吃了"，
    // 但如果文本后面还有"...一个苹果"等量词+食物，说明有第二个肯定动作
    if (totalVerbCount === negSkipCount && negSkipCount > 0) {
      // 取最后一个"了"后面的内容
      const lastIdx = text.lastIndexOf('了');
      if (lastIdx >= 0) {
        const afterLast = text.slice(lastIdx + 1, lastIdx + 10);
        if (/[一二两三四五六七八九十半\d]?(?:个|份|碗|杯|根|片|只|块|盘|袋|包|克|g|毫升|ml|公里|km|分钟|小时|下|次|组|层|步)/.test(afterLast)) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * 判断是否包含用户自身记录/陈述的强标记
 * 用于在疑问句中区分"咨询"和"带着数据提问"
 */
function hasSelfReportMarker(content) {
  if (!content) return false;
  // 含未来时间词时不算自我报告（"明天跑步5公里"不是已发生的记录）
  if (/明天|后天|下周|下个月|改天|稍后|下次|以后|将要/.test(content)) return false;
  // 动作完成类标记统一走「肯定式」判断，避免"不吃饭了"被误判为"吃了饭"
  if (hasAffirmativeActionMarker(content)) return true;
  const markers = [
    /(?:体重|体脂|BMI|腰围|腿围|臀围|胸围|臂围)\s*[是为：:]/,
    /\d+\s*(?:克|g|公斤|kg|千米|km|公里|分钟|小时|步|千卡|卡|毫升|ml|杯|碗|个|根|片|只)/i
  ];
  return markers.some(re => re.test(content));
}

/**
 * 判断是否为未来计划、愿望或假设，不宜沉淀为已发生行为
 * 例如：那我明天液断、想喝个奶茶呢、如果明天吃这个
 */
function hasFutureOrIntentionIntent(content) {
  if (!content) return false;
  const text = String(content).trim();
  // 明确未来时间词
  if (/明天|后天|下周|下个月|改天|等会儿|稍后|下次|以后|将要/.test(text)) return true;
  // 表达计划/打算/愿望，且以语气词结尾
  if (/[准备打算计划要].*[呢吧啊~～]/.test(text) && !/[了过][呢吧啊~～]?$/.test(text)) return true;
  if (/^(我想|想[吃喝]|想个|想试试|想问问)/.test(text) && /[呢吧啊~～]$/.test(text)) return true;
  // 条件/假设
  if (/如果|假如|要是|的话/.test(text)) return true;
  return false;
}

module.exports = {
  isQuestionContent,
  hasNegativeRecordIntent,
  hasSelfReportMarker,
  hasFutureOrIntentionIntent,
  hasAffirmativeActionMarker
};
