const express = require('express');
require('dotenv').config();
const cors = require('cors');
const initDB = require('./config/db')

initDB()

require('./config/db');

const app = express();

// CORS setup
app.use(cors({
  origin: ['http://localhost:5173', 'https://cityplaza.netlify.app'],
  credentials: true
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/tg', require('./routes/auth'));
// Подключаем роут
app.use("/con", require('./routes/contractRoute'));
app.use('/acc', require('./routes/accrualRoute'))

// Test routes
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the API.' });
});

const PORT = process.env.PORT || 7000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));