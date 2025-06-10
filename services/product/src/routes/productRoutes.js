const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

// RESTful routes with explicit /products prefix
router.get('/products', productController.getAllProducts);
router.get('/products/:id', productController.getProductById);
router.post('/products', productController.createProduct);
router.put('/products/:id', productController.updateProduct);
router.delete('/products/:id', productController.deleteProduct);

module.exports = router;