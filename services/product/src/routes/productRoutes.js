const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const upload = require('../middleware/upload');

// RESTful routes with explicit /products prefix
router.get('/products', productController.getAllProducts);
router.get('/products/category/:category', productController.getProductsByCategory);
router.get('/products/:id', productController.getProductById);
router.post('/products', upload.single('image'), productController.createProduct);
router.put('/products/:id', productController.updateProduct);
router.delete('/products/:id', productController.deleteProduct);

module.exports = router;