const mongoose = require('mongoose');
const analyzeTitles = require('../utils/analyzeTitles');

const resourceSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, enum: ['anime', 'comic', 'game', 'video'] },
  images: [{ type: String }],
  content: { type: String, required: true },
  price: { type: Number, default: 1 },
  views: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

resourceSchema.statics.getPopularKeywords = async function(minCount = 5) {
  const titles = await this.find().distinct('title');
  
  // 获取原始标题进行分析
  const rawResults = analyzeTitles(titles);
  
  // 二次处理：提取最长的公共前缀
  const processedResults = rawResults.map(item => {
    // 示例：如果原始标题是"小x大王 (1)"等，这里会返回"小x大王"
    const baseTitle = item.text.replace(/[^a-zA-Z\u4e00-\u9fa5]/g, '');
    return {
      text: baseTitle,
      count: item.count
    };
  });
  
  // 去重并重新统计
  const finalMap = {};
  processedResults.forEach(item => {
    finalMap[item.text] = (finalMap[item.text] || 0) + item.count;
  });
  
  return Object.entries(finalMap)
    .map(([text, count]) => ({ text, count }))
    .sort((a, b) => b.count - a.count);
};

module.exports = mongoose.model('Resource', resourceSchema);