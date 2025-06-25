const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const mongoose = require('mongoose');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

app.use(session({
  secret: 'cash2upi_secret',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Set to true only if using HTTPS
}));

// MongoDB connect
mongoose.connect('mongodb+srv://Varuntejjj:%40Akshu311@cash2upi.voiljlo.mongodb.net/cash2upi?retryWrites=true&w=majority&appName=cash2upi', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

// Code Schema
const Code = mongoose.model('Code', new mongoose.Schema({
  code: String,
  amount: Number,
  used: Boolean,
  upi: String,
  redeemedAt: Date
}));

// 🔐 Admin Auth Middleware
const checkAuth = (req, res, next) => {
  if (req.session && req.session.loggedIn) {
    next();
  } else {
    res.redirect('/login');
  }
};

// Serve login + protected admin
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (username === 'admin' && password === '@Akshu311') {
    req.session.user = { role: 'admin' };
    return res.redirect('/admin');
  }

  const vendor = await Vendor.findOne({ vendorId: username, password });
  if (vendor) {
    req.session.user = { role: 'vendor', id: vendor.vendorId };
    return res.redirect('/vendor');
  }

  return res.send('❌ Invalid credentials');
});

app.get('/admin', checkAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/user', (req, res) => {
  res.sendFile(path.join(__dirname, 'user.html'));
});

app.get('/', (req, res) => {
  res.send('✅ Cash2UPI backend is live');
});

// 🔐 Admin: Generate Code
app.post('/admin/generate', checkAuth, async (req, res) => {
  const { amount } = req.body;
  if (!amount || isNaN(amount)) return res.status(400).json({ error: 'Invalid amount' });

  const code = uuidv4().split('-')[0];
  const entry = new Code({ code, amount: parseInt(amount), used: false });
  await entry.save();

  res.json({ code, amount: entry.amount });
});

// 🔐 Admin: View Codes
app.get('/admin/codes', checkAuth, async (req, res) => {
  const codes = await Code.find().sort({ _id: -1 });
  res.json(codes);
});

// 🔁 Telegram Alert on Redeem (No email)
async function sendAlerts(code, upi, amount) {
  const telegramToken = '7595288502:AAG2LN5dsdtqGhQbGRq3JAyJv5Ydfqp5rVs';
  const chatId = '6772999071';
  const telegramMsg = `✅ ₹${amount} redeemed by ${upi} using code ${code}`;
  
  await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: telegramMsg })
  });
}

// 🔁 Redeem Code
app.post('/redeem', async (req, res) => {
  const { code, upi } = req.body;
  const found = await Code.findOne({ code });

  if (!found) return res.status(404).json({ error: 'Code not found' });
  if (found.used) return res.status(400).json({ error: 'Code already used' });

  found.used = true;
  found.upi = upi;
  found.redeemedAt = new Date();
  await found.save();

  // Send Telegram & Email alerts
  await sendAlerts(found.code, upi, found.amount);

  setTimeout(() => {
    console.log(`✅ ₹${found.amount} sent to ${upi} for code ${code}`);
  }, 5000);

  res.json({ message: `₹${found.amount} will be sent to ${upi} shortly.` });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));

app.post('/cashbot', (req, res) => {
  const prompt = req.body.prompt.toLowerCase().trim();

  // Greetings
  if (['hi', 'hello', 'hey'].includes(prompt)) {
    return res.json({ reply: 'Hi! How can I help you today?' });
  }

  // Help detection
  if (prompt.includes('help')) {
    return res.json({ reply: 'Sure! What kind of help do you need? You can ask about redeeming, UPI issues, or time it takes.' });
  }

  // Known questions
  const replies = {
    'how to redeem': 'To redeem, enter your code and UPI on the user page and click "Redeem". You’ll get your money shortly.',
    'i entered wrong upi': 'Please contact support with the correct UPI and code. We’ll help you resolve it.',
    'how long does it take': 'Redemptions are usually processed within a few minutes after submitting.',
    'is cash2upi safe': 'Yes, Cash2UPI is safe and secured. All redemptions are handled by our system and verified by admin.'
  };

  const found = Object.keys(replies).find(key => prompt.includes(key));
  if (found) {
    return res.json({ reply: replies[found] });
  }

  // Fallback
  res.json({ reply: "🤖 Sorry, I can't help with that. Try asking something related to redeeming, UPI, or timing." });
});

const Vendor = mongoose.model('Vendor', new mongoose.Schema({
  vendorId: String,
  password: String,
  balance: Number
}));

app.get('/vendor', (req, res) => {
  if (!req.session.user || req.session.user.role !== 'vendor') {
    return res.redirect('/login');
  }
  res.sendFile(path.join(__dirname, 'vendor.html'));
});

app.get('/admin', (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.redirect('/login');
  }
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.post('/admin/add-balance', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const { vendorId, amount } = req.body;
  const vendor = await Vendor.findOne({ vendorId });
  if (!vendor) return res.status(404).json({ error: 'Vendor not found' });

  vendor.balance += parseInt(amount);
  await vendor.save();

  res.json({ message: `₹${amount} added to ${vendorId}` });
});

app.post('/vendor/generate', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'vendor') {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const { amount } = req.body;
  const vendor = await Vendor.findOne({ vendorId: req.session.user.id });
  if (!vendor || vendor.balance < amount) {
    return res.status(400).json({ error: 'Insufficient balance' });
  }

  const code = uuidv4().split('-')[0];
  const newCode = new Code({ code, amount, used: false });
  await newCode.save();

  vendor.balance -= amount;
  await vendor.save();

  res.json({ code, remainingBalance: vendor.balance });
});

async function initVendors() {
  const count = await Vendor.countDocuments();
  if (count === 0) {
    await Vendor.insertMany([
      { vendorId: 'vendor1', password: 'vendr@123', balance: 0 },
      { vendorId: 'vendor2', password: 'vendr@234', balance: 0 },
      { vendorId: 'vendor3', password: 'vendr@345', balance: 0 }
    ]);
    console.log("✅ Vendors inserted.");
  }
}
initVendors();
