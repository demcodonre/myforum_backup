const express = require('express');
const router = express.Router();
const Recharge = require('../models/Recharge');
const User = require('../models/User');
const path = require('path');
const fs = require('fs');

// 上传目录
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


module.exports = router;