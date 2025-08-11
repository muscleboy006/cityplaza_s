require('dotenv').config();
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

// Тут укажи MongoDB _id пользователя:
const MONGO_USER_ID = '686dfe5618bcd6ecaa0e4d31';

const token = jwt.sign({ id: MONGO_USER_ID }, JWT_SECRET, { expiresIn: '30d' });

console.log('Ваш тестовый токен:');
console.log(token);