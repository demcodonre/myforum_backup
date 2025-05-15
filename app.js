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

// 会话配置
app.use(session({
  secret: process.env.SESSION_SECRET,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    collectionName: 'sessions',
    ttl: 14 * 24 * 60 * 60,
    autoRemove: 'native' 
  }),
  resave: true,  
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax', 
    maxAge: 24 * 60 * 60 * 1000
  }
}));

app.use(express.static(path.join(__dirname, 'public')));

// 文件上传配置
app.use(fileUpload({
  limits: { fileSize: 20 * 1024 * 1024 },
  useTempFiles: true,
  tempFileDir: path.join(__dirname, 'temp'),
  createParentPath: true,
  abortOnLimit: true 
}));

// 模板引擎配置
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 全局变量注入
app.use((req, res, next) => {
  res.locals = {
    user: req.session.user || null,
    currentPath: req.path,
    isDev: process.env.NODE_ENV === 'development' 
  };
  next();
});

// 管理员中间件
app.use('/admin', (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).render('error', { 
      title: '未授权',
      message: '请先登录' 
    });
  }
  next();
});

// 路由配置
app.use('/admin', adminRoutes);
app.use('/recharge', rechargeRoutes);

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
  req.session.captcha = captcha.text.toLowerCase();
  res.type('svg')
     .set('Cache-Control', 'no-store, no-cache')
     .send(captcha.data);
});

app.post('/verify-captcha', (req, res) => {
  
  if (req.body.captcha?.toLowerCase() === req.session.captcha?.toLowerCase()) {
    res.send('验证成功');
  } else {
    res.status(400).send('验证码错误');
  }
});

// 主路由
app.use('/', require('./routes/auth'));

app.use((err, req, res, next) => {
  // 错误日志记录
  console.error(`[${new Date().toISOString()}] 错误:`, {
    path: req.path,
    method: req.method,
    status: err.status || 500,
    message: err.message,
    stack: res.locals.isDev ? err.stack : undefined, 
    session: req.sessionID
  });

  // 错误响应数据
  const errorData = {
    title: err.title || '服务器错误',
    message: err.message || '服务器发生错误',
    status: err.status || 500,
    user: res.locals.user,         
    isDev: res.locals.isDev,       
    error: res.locals.isDev ? err : null, 
    path: req.path,
    timestamp: new Date().toISOString()
  };

  // 响应处理
  if (req.accepts('html')) {
    res.status(errorData.status).render('error', errorData);
  } else {
    res.json({
      error: {
        message: errorData.message,
        ...(res.locals.isDev && { details: err.stack }) 
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