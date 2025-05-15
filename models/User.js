const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  balance: { type: Number, default: 0 },
  purchasedResources: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Resource' }],
  createdAt: { type: Date, default: Date.now }
});

userSchema.path('username').validate({
  validator: function (v) {
    return /^[a-zA-Z0-9_\-]{3,20}$/.test(v); 
  },
  message: '用户名包含非法字符'
});

// 密码加密中间件
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
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