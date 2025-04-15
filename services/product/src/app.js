const express = require('express');
const productRoutes = require('./routes/product.routes');
require('dotenv').config();

const app = express();

app.use(express.json());
app.use('/api/products', productRoutes);

module.exports = app;
