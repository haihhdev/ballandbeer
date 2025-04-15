const productService = require('../services/productService');

exports.getAllProducts = async (req, res) => {
  const products = await productService.getAll();
  res.json(products);
};

exports.getProductById = async (req, res) => {
  const product = await productService.getById(req.params.id);
  if (!product) return res.status(404).json({ message: 'Not found' });
  res.json(product);
};

exports.createProduct = async (req, res) => {
  const newProduct = await productService.create(req.body);
  res.status(201).json(newProduct);
};

exports.updateProduct = async (req, res) => {
  const updated = await productService.update(req.params.id, req.body);
  if (!updated) return res.status(404).json({ message: 'Not found' });
  res.json(updated);
};

exports.deleteProduct = async (req, res) => {
  const deleted = await productService.remove(req.params.id);
  if (!deleted) return res.status(404).json({ message: 'Not found' });
  res.json({ message: 'Deleted successfully' });
};
