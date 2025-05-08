require('dotenv').config();
const mongoose = require('mongoose');
const Resource = require('./models/Resource');
const User = require('./models/User');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

// 测试资源数据
const testResources = [
 
];
  
// const testUsers = [
//   {
//     username: 'adminname',
//     password: 'Qwer1234', // 生产环境请改用复杂密码
//     email: 'admin@example.com',
//     balance: 500,
//     isAdmin: true // 关键字段
//   }
// ];


async function seedDatabase() {
  try {
    // 1. 连接数据库
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/myforum');
    console.log(' MongoDB connected');

    // 2. 清空现有数据（如果指定了 --clean 参数）
    if (process.argv.includes('--clean')) {
      await Resource.deleteMany({});
      await User.deleteMany({});
      console.log(' 清空所有集合数据');
    }

    // 3. 检查是否已有数据（如果没指定 --force 参数）
    const resourceCount = await Resource.countDocuments();
    const userCount = await User.countDocuments();
    
    if ((resourceCount > 0 || userCount > 0) && !process.argv.includes('--force')) {
      console.log('ℹ 数据库已有数据，跳过插入（使用 --force 强制覆盖）');
      return;
    }

    // 4. 加密用户密码并插入用户数据
    const usersToInsert = await Promise.all(
      testUsers.map(async (user) => {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(user.password, salt);
        return { ...user, password: hashedPassword };
      })
    );
    
    const userResult = await User.insertMany(usersToInsert);
    console.log(` 成功插入 ${userResult.length} 条用户数据`);

    // 5. 插入资源数据
    const resourceResult = await Resource.insertMany(testResources);
    console.log(` 成功插入 ${resourceResult.length} 条资源数据`);

    // 6. 创建必要的目录
    const imageDir = path.join(__dirname, 'public/images');
    if (!fs.existsSync(imageDir)) {
      fs.mkdirSync(imageDir, { recursive: true });
      console.log(' 创建图片目录');
    }

    // 7. 创建种子内容目录（如果不存在）
    const seedContentDir = path.join(__dirname, 'seed-content');
    if (!fs.existsSync(seedContentDir)) {
      fs.mkdirSync(seedContentDir, { recursive: true });
      console.log(' 创建种子内容目录');
      
      // 写入示例内容文件
      fs.writeFileSync(path.join(seedContentDir, 'anime.txt'), '这里是鬼灭之刃的详细内容...');
      fs.writeFileSync(path.join(seedContentDir, 'aot.txt'), '这里是进击的巨人的详细内容...');
    }

  } catch (err) {
    console.error(' 种子数据插入失败:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
}

seedDatabase();