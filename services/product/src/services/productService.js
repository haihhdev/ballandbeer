const Product = require('../models/productModel');

const getAll = () => Product.find();
const getByCategory = (category) => Product.find({ category });
const getById = (id) => Product.findById(id);
const create = (data) => Product.create(data);
const update = (id, data) => Product.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true });
const remove = (id) => Product.findByIdAndDelete(id);

module.exports = { getAll, getByCategory, getById, create, update, remove };