const express = require('express');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files (like HTML, CSS, JS) from the current folder
app.use(express.static(__dirname));

// Serve admin and user HTML pages
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/user', (req, res) => {
  res.sendFile(path.join(__dirname, 'user.html'));
});

// Optional homepage
app.get('/', (req, res) => {
  res.send('Welcome to the Cash2UPI backend!');
});

// In-memory code storage
let codes = [];

// ✅ Admin: Generate a code
app.post('/admin/generate', (req, res) => {
  const { amount } = req.body;
  if (!amount || isNaN(amount)) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  const code = uuidv4().split('-')[0];
  codes.push({ code, amount: parseInt(amount), used: false });
  res.json({ code, amount });
});

// ✅ Admin: View all codes
app.get('/admin/codes', (req, res) => {
  res.json(codes);
});

// ✅ User: Redeem a code
app.post('/redeem', (req, res) => {
  const { code, upi } = req.body;
  const found = codes.find(c => c.code === code);

  if (!found) return res.status(404).json({ error: 'Code not found' });
  if (found.used) return res.status(400).json({ error: 'Code already used' });

  found.used = true;
  found.upi = upi;
  found.redeemedAt = new Date();

  setTimeout(() => {
    console.log(`✅ ₹${found.amount} sent to ${upi} for code ${code}`);
  }, 5000);

  res.json({ message: `₹${found.amount} will be sent to ${upi} shortly.` });
});

// ✅ Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Backend running on http://localhost:${PORT}`);
});
