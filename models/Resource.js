const mongoose = require('mongoose');

const resourceSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, enum: ['anime', 'comic', 'game', 'video'] },
  images: [{ type: String }],
  content: { type: String, required: true },
  price: { type: Number, default: 1 },
  views: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});


module.exports = mongoose.model('Resource', resourceSchema);