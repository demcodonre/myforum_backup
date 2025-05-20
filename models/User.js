const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  balance: { type: Number, default: 0 },
  purchasedResources: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Resource' }],
  inviteCode: { type: String, unique: true }, 
  invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, 
  successfulInvites: { type: Number, default: 0 }, 
  createdAt: { type: Date, default: Date.now }
});

userSchema.path('username').validate({
  validator: function (v) {
    return /^[a-zA-Z0-9_\-]{3,20}$/.test(v); 
  },
  message: '用户名包含非法字符'
});

// 密码加密与邀请码中间件
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    // 密码加密
    if (this.isModified('password')) {
      const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(this.password, salt);
    }
    
    // 生成邀请码
    if (!this.inviteCode) {
      let unique = false;
      let code;
      while (!unique) {
        code = Math.random().toString(36).substring(2, 8).toUpperCase();
        const exists = await this.constructor.findOne({ inviteCode: code });
        if (!exists) unique = true;
      }
      this.inviteCode = code;
    }
    
    next();
  } catch (err) {
    next(err);
  }
});

// 密码验证方法
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);