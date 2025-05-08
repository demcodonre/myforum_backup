const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Recharge = require('../models/Recharge');
const Resource = require('../models/Resource');
const User = require('../models/User');
const path = require('path');
const fs = require('fs');

// 管理员验证中间件
const isAdmin = (req, res, next) => {
  // 从查询参数、请求体或会话中获取adminKey
  const adminKey = req.query.adminKey || req.body.adminKey;
  
  if (adminKey === process.env.ADMIN_SECRET_KEY) {
    return next();
  }

  if (req.session.user?.isAdmin) {
    return next();
  }

  res.status(403).render('error', {
    title: '权限不足',
    message: '您需要管理员权限才能访问此页面',
    status: 403,
    user: req.session.user || null,
    isDev: process.env.NODE_ENV === 'development'
  });
};

// 资源添加页面 (GET 路由 - 新增)
router.get('/add-resource', isAdmin, (req, res) => {
  res.render('admin/add-resource', {
    user: req.session.user,
    categories: ['anime', 'comic', 'game', 'video'],
    adminKey: req.query.adminKey // 传递adminKey到视图
  });
});

// 处理资源提交 (POST 路由)
router.post('/add-resource', isAdmin, async (req, res) => {
  try {
    const { title, description, category, price, content } = req.body;

    // 验证输入
    if (!title || !category || isNaN(price) || price < 0) {
      return res.status(400).json({
        success: false,
        message: '标题、分类必填，价格需为有效数字'
      });
    }

    // 处理图片上传
    const images = [];
    if (req.files && req.files['images']) {
      const files = Array.isArray(req.files['images']) 
        ? req.files['images'] 
        : [req.files['images']];

      const uploadDir = path.join(__dirname, '../public/uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      for (let i = 0; i < Math.min(files.length, 5); i++) {
        const file = files[i];
        const ext = path.extname(file.name).toLowerCase();

        if (!['.jpg', '.jpeg', '.png', '.gif'].includes(ext)) {
          return res.status(400).json({
            success: false,
            message: '仅支持JPG/PNG/GIF图片格式'
          });
        }

        const fileName = `res_${Date.now()}_${i}${ext}`;
        const filePath = path.join(uploadDir, fileName);
        await file.mv(filePath);
        images.push(`/uploads/${fileName}`);
      }
    }

    // 创建资源
    const resource = await Resource.create({
      title,
      description: description || '',
      category,
      images,
      content: content || '',
      price: Number(price),
      views: 0
    });

    res.json({
      success: true,
      message: '资源添加成功',
      resourceId: resource._id
    });
  } catch (err) {
    console.error('添加资源错误:', err);
    
    let errorMsg = '服务器错误';
    if (err.code === 11000) errorMsg = '资源标题已存在';

    res.status(500).json({
      success: false,
      message: errorMsg,
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// 充值审核页面
router.get('/recharges', isAdmin, async (req, res) => {
  try {
    const pendingRecharges = await Recharge.find({ status: 'pending' })
      .populate('userId', 'username email')
      .sort({ createdAt: -1 });

    res.render('admin/recharges', {
      recharges: pendingRecharges,
      user: req.session.user,
      adminKey: process.env.NODE_ENV === 'development' 
        ? process.env.ADMIN_SECRET_KEY 
        : null
    });
  } catch (err) {
    console.error('获取充值列表失败:', err);
    res.status(500).render('error', {
      title: '服务器错误',
      message: '获取充值列表失败',
      error: err,
      user: req.session.user || null
    });
  }
});

// 审核通过
router.post('/recharge/approve', isAdmin, async (req, res) => {
  try {
    const { orderId } = req.body;
    const recharge = await Recharge.findByIdAndUpdate(
      orderId,
      { status: 'approved', processedAt: new Date() },
      { new: true }
    ).populate('userId');

    if (!recharge) {
      return res.status(404).json({ success: false, message: '未找到该订单' });
    }

    const user = await User.findByIdAndUpdate(
      recharge.userId._id,
      { $inc: { balance: recharge.amount } },
      { new: true }
    );

    res.json({
      success: true,
      newBalance: user.balance,
      processedAt: recharge.processedAt
    });
  } catch (err) {
    console.error('审核通过错误:', err);
    res.status(500).json({
      success: false,
      message: '审核失败',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// 审核拒绝
router.post('/recharge/reject', isAdmin, async (req, res) => {
  try {
    const { orderId, reason } = req.body;
    if (!orderId) {
      return res.status(400).json({ success: false, message: '订单ID不能为空' });
    }

    const updated = await Recharge.findByIdAndUpdate(
      orderId,
      {
        status: 'rejected',
        processedAt: new Date(),
        rejectReason: reason || '未提供原因'
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: '未找到该订单' });
    }

    res.json({ success: true, processedAt: updated.processedAt });
  } catch (err) {
    console.error('审核拒绝错误:', err);
    res.status(500).json({
      success: false,
      message: '操作失败',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

module.exports = router;