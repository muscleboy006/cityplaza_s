const express = require('express');
const router = express.Router()
const { authMiddleware } = require('../middleware/auth');
const {
    authTelegram,
    userProfile,
    verify,
    authTelegramInitData
} = require('../controllers/userController')

router.post('/auth/telegram', authTelegram)
router.post('/auth/telegram-initdata', authTelegramInitData);
router.get('/user/profile', authMiddleware, userProfile)
router.get('/verify', authMiddleware, verify)

module.exports = router;