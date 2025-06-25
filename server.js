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

app.post('/login', (req, res) => {
  const { password } = req.body;
  if (password === '@Akshu311') {
    req.session.loggedIn = true;
    res.redirect('/admin');
  } else {
    res.send('❌ Incorrect password');
  }
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

app.post('/cashbot', async (req, res) => {
  const prompt = req.body.prompt;
  const systemPrompt = `
You are CashBot, a helpful assistant for a UPI redeem service called Cash2UPI.
Answer questions like:
- How to redeem a code?
- What happens if a user enters wrong UPI?
- How long does it take to get the money?
- Is Cash2UPI safe?
Be helpful and polite.
`;

  try {
    const result = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer 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',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt }
        ]
      })
    });

    const json = await result.json();
    const reply = json.choices[0].message.content;
    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.json({ reply: '❌ CashBot failed to respond. Please try again later.' });
  }
});
