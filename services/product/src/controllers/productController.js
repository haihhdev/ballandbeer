const productService = require('../services/productService');

exports.getAllProducts = async (req, res) => {
  const products = await productService.getAll();
  res.json(products);
};

exports.getProductsByCategory = async (req, res) => {
  const { category } = req.params;
  const products = await productService.getByCategory(category);
  res.json(products);
};

exports.getProductById = async (req, res) => { // Thêm controller này
  const { id } = req.params;
  try {
    const product = await productService.getById(id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createProduct = async (req, res) => {
  const newProduct = await productService.create(req.body);
  res.status(201).json(newProduct);
};

exports.updateProduct = async (req, res) => {
  try {
    const updated = await productService.update(req.params.id, req.body);
    if (!updated) return res.status(404).json({ message: 'Product not found' });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteProduct = async (req, res) => {
  const deleted = await productService.remove(req.params.id);
  if (!deleted) return res.status(404).json({ message: 'Not found' });
  res.json({ message: 'Deleted successfully' });
};