const express = require("express");
const bookingRoutes = require("./routes/bookingRoutes");
const cors = require("cors");

const app = express();

// Sử dụng CORS trước khi khai báo các route
app.use(cors());
app.use(express.json());
app.use("/api/bookings", bookingRoutes);

app.get("/", (req, res) => {
  res.send("Booking Service is running.");
});

module.exports = app;
