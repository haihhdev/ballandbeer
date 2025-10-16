const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { authenticateToken, requireAdmin } = require('../middleware/authMiddleware');

// Public routes
router.get('/products', productController.getAllProducts);
router.get('/products/:id', productController.getProductById);

// Admin only routes
router.post('/products', authenticateToken, requireAdmin, productController.createProduct);
router.put('/products/:id', authenticateToken, requireAdmin, productController.updateProduct);
router.delete('/products/:id', authenticateToken, requireAdmin, productController.deleteProduct);

module.exports = router;