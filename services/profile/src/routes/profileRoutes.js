const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');

router.get('/id/:id', profileController.getProfile);
router.put('/id/:id', profileController.updateProfile);

module.exports = router;
