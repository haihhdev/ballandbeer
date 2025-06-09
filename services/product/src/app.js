const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const productRoutes = require("./routes/productRoutes");
const commentRoutes = require("./routes/commentRoutes");

require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use("/api", productRoutes);
app.use("/api", commentRoutes);

module.exports = app;
