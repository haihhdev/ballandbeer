const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const profileRoutes = require('./routes/profileRoutes');
app.use('/api/profile', profileRoutes);

// Connect Mongo
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

const PORT = process.env.PORT || 7000;
app.listen(PORT, () => {
  console.log(`User Profile service running on port ${PORT}`);
});
