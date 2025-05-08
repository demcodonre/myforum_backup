const express = require('express');
const router = express.Router();
const Recharge = require('../models/Recharge');
const User = require('../models/User');
const path = require('path');
const fs = require('fs');

// 确保上传目录存在
const uploadDir = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// 提交充值申请
router.post('/', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false, message: '请先登录' });
    }

    try {
        const { amount } = req.body;
        if (!amount || amount < 10 || amount > 200) {
            return res.json({ success: false, message: '充值金额需在10-200元之间' });
        }

        // 创建充值记录
        const recharge = new Recharge({
            userId: req.session.user.id,
            amount: amount,
            status: 'pending'
        });
        await recharge.save();

        res.json({ 
            success: true, 
            message: '充值申请已提交，请等待管理员审核',
            orderId: recharge._id
        });
    } catch (err) {
        console.error('充值错误:', err);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

// 上传支付凭证
router.post('/upload-proof', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false, message: '请先登录' });
    }

    try {
        if (!req.files || !req.files.proof) {
            return res.status(400).json({ success: false, message: '请上传支付凭证' });
        }

        const proof = req.files.proof;
        const ext = path.extname(proof.name);
        const fileName = `proof_${Date.now()}${ext}`;
        const filePath = path.join(uploadDir, fileName);

        await proof.mv(filePath);

        // 更新充值记录
        await Recharge.findOneAndUpdate(
            { userId: req.session.user.id, status: 'pending' },
            { proofImage: `/uploads/${fileName}` }
        );

        res.json({ 
            success: true, 
            message: '支付凭证已上传，请等待管理员审核'
        });
    } catch (err) {
        console.error('上传凭证错误:', err);
        res.status(500).json({ success: false, message: '上传凭证失败' });
    }
});

// 获取待审核充值列表
router.get('/admin/recharges', async (req, res) => {
    try {
        const pendingRecharges = await Recharge.find({ status: 'pending' })
            .populate('userId', 'username email');
        res.render('admin/recharges', { recharges: pendingRecharges });
    } catch (err) {
        res.status(500).json({ error: '获取充值列表失败' });
    }
});

// 审核通过路由
router.post('/approve', async (req, res) => {
    try {
      const { orderId } = req.body;
      
      // 验证管理员权限
      if (req.query.adminKey !== process.env.ADMIN_SECRET_KEY) {
        return res.status(403).json({ 
          success: false,
          message: '无权访问'
        });
      }
  
      const recharge = await Recharge.findByIdAndUpdate(orderId, {
        status: 'approved',
        processedAt: new Date()
      }).populate('userId');
      
      if (!recharge) {
        return res.status(404).json({ 
          success: false, 
          message: '未找到该订单' 
        });
      }
      
      const user = await User.findByIdAndUpdate(recharge.userId._id, {
        $inc: { balance: recharge.amount }
      }, { new: true });
      
      res.json({ 
        success: true, 
        newBalance: user.balance 
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
  
  // 审核拒绝路由
  router.post('/reject', async (req, res) => {
    try {
      const { orderId, reason } = req.body;
      
      // 验证管理员权限
      if (req.query.adminKey !== process.env.ADMIN_SECRET_KEY) {
        return res.status(403).json({ 
          success: false,
          message: '无权访问'
        });
      }
  
      await Recharge.findByIdAndUpdate(orderId, {
        status: 'rejected',
        processedAt: new Date(),
        rejectReason: reason || '未提供原因'
      });
      
      res.json({ success: true });
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