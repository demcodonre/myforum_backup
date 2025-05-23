const express = require('express');
const User = require('../models/User');
const Resource = require('../models/Resource');
const router = express.Router();

// 登录中间件
const requireLogin = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
};

// 验证码中间件
const validateCaptcha = (req, res, next) => {
  if (!req.session.captcha || !req.body.captcha ||
    req.body.captcha.toLowerCase() !== req.session.captcha.toLowerCase()) {
    return res.status(400).render(req.path.includes('login') ? 'login' : 'register', {
      error: '验证码错误',
      ...(req.path.includes('register') && {
        username: req.body.username,
        email: req.body.email
      })
    });
  }
  delete req.session.captcha;
  next();
};

// 首页路由
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 14;
    const sortBy = req.query.sort || 'createdAt'; 
    const sortOptions = {};
    if (sortBy === 'views') {
      sortOptions.views = -1; 
    } else {
      sortOptions.createdAt = -1; 
    }
    sortOptions._id = -1; 

    const [resources, total] = await Promise.all([
      Resource.find()
        .sort(sortOptions)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Resource.estimatedDocumentCount()
    ]);

    const totalPages = Math.ceil(total / limit);
    const keywords = await Resource.getPopularKeywords();

    res.render('home', {
      user: req.session.user || null,
      resources,
      pagination: {
        page,
        totalPages,
        hasPrev: page > 1,
        hasNext: page < totalPages,
        prevPage: page > 1 ? page - 1 : null,
        nextPage: page < totalPages ? page + 1 : null
      },
      currentSort: sortBy,
      keywords: keywords.slice(0, 100)
    });
  } catch (err) {
    console.error('首页路由错误:', err);
    res.status(500).render('error', {
      title: '服务器错误',
      message: '加载页面时出现问题，请稍后再试',
      user: req.session.user || null
    });
  }
});

// 登录页面
router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('login');
});

// 登录处理
router.post('/login', validateCaptcha, async (req, res, next) => {
  const { username, password } = req.body;
  if (!username?.trim() || !password?.trim()) {
    return res.status(400).render('login', {
      error: '用户名和密码不能为空或空白字符',
      username: username?.trim() || '',
      captcha: req.session.captcha
    });
  }

  try {
    const user = await User.findOne({ username }).select('+password');

    if (!user) {
      return res.status(401).render('login', {
        error: '用户名或密码错误',
        username: '',
        captcha: req.session.captcha
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      user.loginAttempts = (user.loginAttempts || 0) + 1;
      await user.save();

      return res.status(401).render('login', {
        error: '用户名或密码错误',
        username: '',
        captcha: req.session.captcha
      });
    }

    req.session.regenerate(async (err) => {
      if (err) {
        console.error('会话再生失败:', err);
        return next(err);
      }

      try {
        req.session.user = {
          id: user._id,
          username: user.username,
          email: user.email,
          balance: user.balance,
          isAdmin: !!user.isAdmin,
          lastLogin: new Date()
        };

        user.loginAttempts = 0;
        user.lastLogin = new Date();
        await user.save();

        const redirectPath = req.session.user.isAdmin ? '/admin' : '/';
        res.redirect(redirectPath);

      } catch (saveErr) {
        console.error('用户数据保存失败:', saveErr);
        next(saveErr);
      }
    });

  } catch (err) {
    console.error('登录处理错误:', {
      error: err,
      username,
      ip: req.ip,
      timestamp: new Date()
    });

    const error = new Error('登录处理失败');
    error.status = 500;
    error.originalError = err;
    next(error);
  }
});

// 注册页面
router.get('/register', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('register');
});

// 注册处理
router.post('/register', validateCaptcha, async (req, res) => {
  try {
    const { username, email, password, confirmPassword, inviteCode } = req.body; 
    
    const inviteCodeToUse = inviteCode?.trim() || null;
    
    if (password !== confirmPassword) {
      return res.status(400).render('register', {
        error: '两次输入的密码不一致',
        username,
        email,
        inviteCode: inviteCodeToUse 
      });
    }

    const invitedBy = inviteCodeToUse ? await User.findOne({ inviteCode: inviteCodeToUse }) : null;
    
    if (inviteCodeToUse && !invitedBy) {
      return res.status(400).render('register', {
        error: '邀请码无效',
        username,
        email,
        inviteCode: inviteCodeToUse
      });
    }

    const user = new User({ 
      username, 
      password, 
      email,
      invitedBy: invitedBy?._id 
    });

    await user.save();

    req.session.user = {
      id: user._id,
      username: user.username,
      email: user.email,
      balance: user.balance,
      inviteCode: user.inviteCode
    };

    res.redirect('/');
  } catch (err) {
    console.error('注册失败:', err.message);
    let errorMsg = '注册失败';
    if (err.code === 11000) {
      errorMsg = err.message.includes('email') ? '邮箱已被注册' : '用户名已存在';
    }
    res.status(400).render('register', {
      error: errorMsg,
      username: req.body.username,
      email: req.body.email,
      inviteCode: req.body.inviteCode 
    });
  }
});


// 个人中心
router.get('/profile', requireLogin, async (req, res) => {
  try {
    const freshUser = await User.findById(req.session.user.id)
      .select('inviteCode purchasedResources') 
      .populate('purchasedResources', 'title _id')
      .lean();

    req.session.user = { 
      ...req.session.user, 
      inviteCode: freshUser.inviteCode 
    };
    await req.session.save();

    res.render('profile', {
      user: {
        ...req.session.user,
        purchasedResources: freshUser.purchasedResources || []
      }
    });
  } catch (err) {
    console.error('加载个人中心失败:', err);
    res.status(500).render('error', { message: '加载失败' });
  }
});

// 注销
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('注销失败:', err);
      return res.status(500).send('注销失败');
    }
    res.redirect('/login');
  });
});

// 资源详情页
router.get('/resources/:id', async (req, res) => {
  try {
    const resource = await Resource.findByIdAndUpdate(
      req.params.id,
      { $inc: { views: 1 } },
      { new: true }
    );

    if (!resource) return res.status(404).send('资源不存在');

    let hasPurchased = false;
    if (req.session.user) {
      const user = await User.findById(req.session.user.id);
      hasPurchased = user.purchasedResources?.includes(resource._id);
    }

    res.render('resource', {
      resource,
      user: req.session.user || null,
      hasPurchased,
      content: hasPurchased ? resource.content : null
    });
  } catch (err) {
    res.status(500).send('服务器错误');
  }
});

// 购买资源
router.post('/resources/purchase', requireLogin, async (req, res) => {
  try {
    const { resourceId } = req.body;
    const resource = await Resource.findById(resourceId);
    const user = await User.findById(req.session.user.id);

    if (user.purchasedResources?.includes(resourceId)) {
      return res.json({ success: true, alreadyPurchased: true });
    }

    if (user.balance < resource.price) {
      return res.json({
        success: false,
        message: `余额不足，需要${resource.price}元，请前往个人中心充值`
      });
    }

    user.balance -= resource.price;
    user.purchasedResources = user.purchasedResources || [];
    user.purchasedResources.push(resourceId);
    await user.save();

    req.session.user.balance = user.balance;

    res.json({
      success: true,
      newBalance: user.balance,
      content: resource.content
    });
  } catch (err) {
    res.status(500).json({ success: false, message: '购买失败' });
  }
});

// 分类页面
router.get('/category/:type', async (req, res) => {
  try {
    const category = req.params.type;
    const page = parseInt(req.query.page) || 1;
    const limit = 14;
    const sortBy = req.query.sort || 'createdAt'; 
    const sortOptions = {};
    if (sortBy === 'views') {
      sortOptions.views = -1; 
    } else {
      sortOptions.createdAt = -1; 
    }
    sortOptions._id = -1; 

    const [resources, total, recentUpdates] = await Promise.all([
      Resource.find({ category })
        .sort(sortOptions)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Resource.countDocuments({ category }),
      Resource.find({ category })
        .sort({ createdAt: -1 })
        .limit(14)
        .select('title createdAt')
        .lean()
    ]);

    const totalPages = Math.ceil(total / limit);
    const keywords = await Resource.getPopularKeywords();

    res.render('category', {
      user: req.session.user || null,
      category,
      resources,
      recentUpdates,
      pagination: {
        page,
        totalPages,
        hasPrev: page > 1,
        hasNext: page < totalPages
      },
      currentSort: sortBy,
      keywords: keywords.slice(0, 100)
    });
  } catch (err) {
    console.error('分类页错误:', err);
    res.status(500).render('error', {
      title: '服务器错误',
      message: '加载分类失败',
      error: process.env.NODE_ENV === 'development' ? err : null
    });
  }
});

// 搜索页面
router.get('/search', async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) return res.redirect('/');

    const page = parseInt(req.query.page) || 1;
    const limit = 14;
    const sortBy = req.query.sort || 'createdAt'; 

    const searchQuery = {
      $or: [
        { title: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } }
      ]
    };
    const sortOptions = { [sortBy]: -1, _id: -1 }; 

    const [results, total] = await Promise.all([
      Resource.find(searchQuery)
        .sort(sortOptions)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Resource.countDocuments(searchQuery)
    ]);

    const totalPages = Math.ceil(total / limit);
    const keywords = await Resource.getPopularKeywords();

    res.render('search', {
      user: req.session.user || null,
      query,
      results,
      isEmpty: results.length === 0,
      pagination: {
        page,
        totalPages,
        hasPrev: page > 1,
        hasNext: page < totalPages
      },
      currentSort: sortBy,
      keywords: keywords.slice(0, 100)
    });
  } catch (err) {
    res.status(500).render('error', {
      message: '搜索失败',
      error: err.message
    });
  }
});

// API路由
router.get('/api/recent-updates', async (req, res) => {
  try {
    const updates = await Resource.find()
      .sort({ createdAt: -1 })
      .limit(7)
      .select('title createdAt');
    res.json(updates);
  } catch (err) {
    res.status(500).json({ error: '获取更新失败' });
  }
});

router.get('/api/resources/:category', async (req, res) => {
  try {
    const resources = await Resource.find({ category: req.params.category })
      .sort({ createdAt: -1 }) 
      .limit(14);
    res.json(resources);
  } catch (err) {
    res.status(500).json({ error: '获取资源失败' });
  }
});

// 获取高频词API
router.get('/api/popular-keywords', async (req, res) => {
  try {
    const keywords = await Resource.getPopularKeywords();
    res.json(keywords);
  } catch (err) {
    console.error('获取高频词失败:', err);
    res.status(500).json({ error: '获取高频词失败' });
  }
});

module.exports = router;