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
 * 判断是否包含用户自身记录/陈述的强标记
 * 用于在疑问句中区分"咨询"和"带着数据提问"
 */
function hasSelfReportMarker(content) {
  if (!content) return false;
  const markers = [
    /我.*[吃喝跑走练称睡排记录做骑游].*[了过\.\s]/,
    /我.*(?:又|还|刚刚|刚才|才)[吃喝跑走练].*[了过]/,
    /今天[我]?.*[吃喝跑走练称睡排记录做骑游].*[了过\.\s]/,
    /(?:体重|体脂|BMI|腰围|腿围|臀围|胸围|臂围)\s*[是为：:]/,
    /(?:吃|喝|跑|走|练|睡|排)了\s*\d+/,
    /[吃喝跑走练].*[了过].*(?:半个|一个|一片|一碗|一杯|一根|一勺|一份|一点|一些|g|克|个|片|块|碗|杯|根|勺|只|条|颗|粒|把|瓣)/,
    /\d+\s*(?:克|g|公斤|kg|千米|km|公里|分钟|小时|步|千卡|卡|毫升|ml|杯|碗|个|根|片|只)/i
  ];
  return markers.some(re => re.test(content));
}

module.exports = {
  isQuestionContent,
  hasNegativeRecordIntent,
  hasSelfReportMarker
};
