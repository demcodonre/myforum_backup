// scripts/migrateInviteCodes.js
const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

async function migrate() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const users = await User.find({ inviteCode: { $exists: false } });
  
  for (const user of users) {
    let unique = false;
    let code;
    
    while (!unique) {
      code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const exists = await User.findOne({ inviteCode: code });
      if (!exists) unique = true;
    }
    
    user.inviteCode = code;
    await user.save();
    console.log(`为用户 ${user.username} 生成邀请码: ${code}`);
  }
  
  console.log('迁移完成！');
  process.exit(0);
}

migrate().catch(err => {
  console.error('迁移失败:', err);
  process.exit(1);
});