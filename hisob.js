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
app.use("/uploads", express.static("uploads"));

// Подключаем роут
app.use("/con", require('./routes/contractRoute'));
app.use('/acc', require('./routes/accrualRoute'))

//Elektr, suv, gas, tax
app.use('/elc', require('./routes/electrcyRoute'))
app.use('/suv', require('./routes/suvRoute'))
app.use('/gas', require('./routes/gasRoute'))
app.use('/tax', require('./routes/taxRoute'))
app.use('/man', require('./routes/mancomRoute'))

// Test routes
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the API.' });
});

const PORT = process.env.PORT || 7000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));