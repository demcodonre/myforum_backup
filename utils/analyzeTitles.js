const analyzeTitles = (titles) => {
  // 去除数字和括号内容
  const cleanedTitles = titles.map(title => 
    title.replace(/[0-9]|\([^)]*\)/g, '').trim()
  );

  // 统计频率
  const titleMap = {};
  cleanedTitles.forEach(title => {
    if (title.length >= 2) { 
      titleMap[title] = (titleMap[title] || 0) + 1;
    }
  });

  // 提取5次以上
  const popularTitles = Object.entries(titleMap)
    .filter(([_, count]) => count >= 5)
    .sort((a, b) => b[1] - a[1]) 
    .map(([text, count]) => ({ text, count }));

  return popularTitles;
};

module.exports = analyzeTitles;