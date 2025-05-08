require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const svgCaptcha = require('svg-captcha');
const path = require('path');
const cors = require('cors');
const app = express();
const rechargeRoutes = require('./routes/recharge');
const adminRoutes = require('./routes/admin');
const fileUpload = require('express-fileupload');
const MongoStore = require('connect-mongo');


// 环境变量检查
console.log('[启动] 当前环境:', process.env.NODE_ENV || 'development');

// 数据库连接
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/my-forum')
  .then(() => console.log(' MongoDB 已连接'))
  .catch(err => {
    console.error(' MongoDB 连接失败:', err);
    process.exit(1);
  });

// 中间件配置
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// 增强版会话配置
app.use(session({
  secret: process.env.SESSION_SECRET,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    collectionName: 'sessions',
    ttl: 14 * 24 * 60 * 60 // = 14天
  }),
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24小时
  }
}));

// 文件上传配置
app.use(fileUpload({
  limits: { fileSize: 5 * 1024 * 1024 },
  useTempFiles: true,
  tempFileDir: path.join(__dirname, 'temp'),
  createParentPath: true,
  abortOnLimit: true // 超过大小限制直接拒绝
}));

// 模板引擎配置
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 全局变量注入
app.use((req, res, next) => {
  res.locals = {
    user: req.session.user || null,
    currentPath: req.path,
    isDev: process.env.NODE_ENV === 'development' // 全局可用
  };
  next();
});

// 增强版管理员区域保护中间件
app.use('/admin', (req, res, next) => {
  // 确保 req.query 存在
  req.query = req.query || {};
  
  // 从URL参数或请求体中获取adminKey
  const adminKey = req.query.adminKey || req.body?.adminKey;

  // 方式1：通过密钥验证
  if (adminKey === process.env.ADMIN_SECRET_KEY) {
    return next();
  }

  // 方式2：通过会话验证
  if (req.session.user?.isAdmin) {
    return next();
  }

  // 两种方式都未通过
  res.status(403).render('error', {
    title: '权限不足',
    message: '您需要管理员权限才能访问此页面',
    status: 403,
    user: req.session.user || null,
    isDev: process.env.NODE_ENV === 'development'
  });
});

// 路由配置
app.use('/recharge', rechargeRoutes);
app.use('/admin', adminRoutes);

// 验证码路由
app.get('/captcha', (req, res) => {
  const captcha = svgCaptcha.create({
    size: 4,
    noise: 2,
    color: true,
    background: '#f8f9fa',
    width: 120,
    height: 40,
    fontSize: 50
  });
  console.log('生成的验证码:', captcha.text); 
  req.session.captcha = captcha.text.toLowerCase();
  res.type('svg')
     .set('Cache-Control', 'no-store, no-cache')
     .send(captcha.data);
});

app.post('/verify-captcha', (req, res) => {
  console.log('提交的验证码:', req.body.captcha);
  console.log('会话中的验证码:', req.session.captcha);
  console.log('当前会话ID:', req.sessionID);
  
  if (req.body.captcha?.toLowerCase() === req.session.captcha?.toLowerCase()) {
    res.send('验证成功');
  } else {
    res.status(400).send('验证码错误');
  }
});

// 主路由
app.use('/', require('./routes/auth'));

// 增强版错误处理中间件
app.use((err, req, res, next) => {
  const isDev = process.env.NODE_ENV === 'development';
  
  // 错误日志记录
  console.error(`[${new Date().toISOString()}] 错误:`, {
    path: req.path,
    method: req.method,
    status: err.status || 500,
    message: err.message,
    stack: isDev ? err.stack : undefined,
    session: req.sessionID
  });

  // 确保关键变量存在
  const errorData = {
    title: err.title || '服务器错误',
    message: err.message || '服务器发生错误',
    status: err.status || 500,
    error: isDev ? err : null,
    isDev,
    user: req.session.user || null,
    path: req.path,
    timestamp: new Date().toISOString()
  };

  // 根据请求类型响应
  if (req.accepts('html')) {
    res.status(errorData.status).render('error', errorData);
  } else {
    res.status(errorData.status).json({
      error: {
        message: errorData.message,
        ...(isDev && { details: err.stack })
      }
    });
  }
});

// 404处理
app.use((req, res) => {
  res.status(404).render('404', {
    title: '页面未找到',
    message: `路径 ${req.path} 不存在`,
    user: res.locals.user
  });
});

// 服务器启动
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(` 服务器已启动：http://localhost:${PORT}`);
  console.log(`  运行模式: ${process.env.NODE_ENV || 'development'}`);
  console.log(` Session Secret: ${process.env.SESSION_SECRET ? '已设置' : '未设置'}`);
  console.log(` Admin 保护: ${process.env.ADMIN_SECRET_KEY ? '已启用' : '未配置'}`);
});

process.on('unhandledRejection', (err) => {
  console.error('未处理的Promise拒绝:', err);
});

module.exports = app;