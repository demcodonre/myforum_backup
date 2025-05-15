const mongoose = require('mongoose');

const rechargeSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true, min: 10 },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  proofImage: { type: String }, 
  createdAt: { type: Date, default: Date.now },
  processedAt: Date, 
  rejectReason: String 
});

module.exports = mongoose.model('Recharge', rechargeSchema);