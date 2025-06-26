const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const mongoose = require('mongoose');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
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
  cookie: { secure: false }
}));

// MongoDB connection
mongoose.connect('mongodb+srv://Varuntejjj:%40Akshu311@cash2upi.voiljlo.mongodb.net/cash2upi?retryWrites=true&w=majority&appName=cash2upi', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

// Code schema
const Code = mongoose.model('Code', new mongoose.Schema({
  code: String,
  amount: Number,
  used: Boolean,
  upi: String,
  redeemedAt: Date
}));

// Login routes
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (username === 'admin' && password === '@Akshu311') {
    req.session.user = { role: 'admin' };
    return res.redirect('/admin');
  }

  return res.send('❌ Invalid credentials');
});

// Admin-only page
app.get('/admin', (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.redirect('/login');
  }
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Public user page
app.get('/user', (req, res) => {
  res.sendFile(path.join(__dirname, 'user.html'));
});

// Root route
app.get('/', (req, res) => {
  res.send('✅ Cash2UPI backend is live');
});

// Generate code (admin only)
app.post('/admin/generate', async (req, res) => {
  const { amount } = req.body;
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  if (!amount || isNaN(amount)) return res.status(400).json({ error: 'Invalid amount' });

  const code = uuidv4().split('-')[0];
  const entry = new Code({ code, amount: parseInt(amount), used: false });
  await entry.save();

  res.json({ code, amount: entry.amount });
});

// Get all codes (admin only)
app.get('/admin/codes', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  const codes = await Code.find().sort({ _id: -1 });
  res.json(codes);
});

// Telegram alert function
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

// Redeem code
app.post('/redeem', async (req, res) => {
  const { code, upi } = req.body;
  const found = await Code.findOne({ code });

  if (!found) return res.status(404).json({ error: 'Code not found' });
  if (found.used) return res.status(400).json({ error: 'Code already used' });

  try {
    const payout = await sendRazorpayPayout(upi, found.amount, code);

    if (payout && payout.status === 'processed') {
      found.used = true;
      found.upi = upi;
      found.redeemedAt = new Date();
      await found.save();

      // Telegram alert
      await sendAlerts(code, upi, found.amount);

      return res.json({ message: `✅ ₹${found.amount} sent to ${upi} successfully.` });
    } else {
      return res.status(500).json({ error: 'Payout failed. Please try again later.' });
    }
  } catch (err) {
    console.error('❌ Razorpay payout error:', err?.response?.data || err.message);
    return res.status(500).json({ error: 'Payout request failed. Please check UPI ID or try again.' });
  }
});

// CashBot route
app.post('/cashbot', (req, res) => {
  const prompt = req.body.prompt.toLowerCase().trim();

  if (['hi', 'hello', 'hey'].includes(prompt)) {
    return res.json({ reply: 'Hi! How can I help you today?' });
  }

  if (prompt.includes('help')) {
    return res.json({ reply: 'Sure! What kind of help do you need? You can ask about redeeming, UPI issues, or time it takes.' });
  }

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

  res.json({ reply: "🤖 Sorry, I can't help with that. Try asking something related to redeeming, UPI, or timing." });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));

const axios = require('axios');

async function sendRazorpayPayout(upi, amount, code) {
  const payoutResponse = await axios.post(
    'https://api.razorpay.com/v1/payouts',
    {
      account_number: "2323230000000001",
      fund_account: {
        account_type: "vpa",
        vpa: { address: upi },
        contact: {
          name: "Cash2UPI User",
          type: "customer",
          email: "user@example.com",
          contact: "9999999999"
        }
      },
      amount: amount * 100, // Razorpay uses paise
      currency: "INR",
      mode: "UPI",
      purpose: "payout",
      queue_if_low_balance: true,
      reference_id: `redeem_${code}`
    },
    {
      auth: {
        username: 'rzp_test_2Sqbi6juDaLSoL',
        password: 'rVdcvQfNzOvoOgE7AV1kIYEl'
      },
      headers: { 'Content-Type': 'application/json' }
    }
  );

  return payoutResponse.data;
}
