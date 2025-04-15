const app = require('./app');
const connectDB = require('./config/db');
const PORT = process.env.PORT || 6001;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Product service running on port ${PORT}`);
  });
});
