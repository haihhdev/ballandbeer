const express = require('express');
const router = express.Router();
const { register, login, changePassword } = require('../controllers/authController'); // Thêm changePassword
const authenticateToken = require('../middlewares/authMiddleware');

router.post('/register', register);
router.post('/login', login);
router.post('/change-password', authenticateToken, changePassword);

module.exports = router;