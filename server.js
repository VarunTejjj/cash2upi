const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// MongoDB connection
mongoose.connect(
  'mongodb+srv://Varuntejjj:%40Akshu311@cash2upi.voiljlo.mongodb.net/cash2upi?retryWrites=true&w=majority&appName=cash2upi',
  { useNewUrlParser: true, useUnifiedTopology: true }
).then(() => {
  console.log('✅ Connected to MongoDB');
}).catch(err => {
  console.error('❌ MongoDB connection error:', err);
});

// Code schema
const codeSchema = new mongoose.Schema({
  code: String,
  amount: Number,
  used: Boolean,
  upi: String,
  redeemedAt: Date
});

const Code = mongoose.model('Code', codeSchema);

// Serve frontend pages
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/user', (req, res) => {
  res.sendFile(path.join(__dirname, 'user.html'));
});

// Home
app.get('/', (req, res) => {
  res.send('Welcome to the Cash2UPI backend!');
});

// Generate code
app.post('/admin/generate', async (req, res) => {
  const { amount } = req.body;
  if (!amount || isNaN(amount)) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  const code = uuidv4().split('-')[0];
  const newCode = new Code({ code, amount: parseInt(amount), used: false });
  await newCode.save();

  res.json({ code: newCode.code, amount: newCode.amount });
});

// List all codes
app.get('/admin/codes', async (req, res) => {
  const codes = await Code.find().sort({ _id: -1 });
  res.json(codes);
});

// Redeem code
app.post('/redeem', async (req, res) => {
  const { code, upi } = req.body;
  const found = await Code.findOne({ code });

  if (!found) return res.status(404).json({ error: 'Code not found' });
  if (found.used) return res.status(400).json({ error: 'Code already used' });

  found.used = true;
  found.upi = upi;
  found.redeemedAt = new Date();
  await found.save();

  setTimeout(() => {
    console.log(`✅ ₹${found.amount} sent to ${upi} for code ${code}`);
  }, 5000);

  res.json({ message: `₹${found.amount} will be sent to ${upi} shortly.` });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
