const express = require("express");
const bookingRoutes = require("./routes/bookingRoutes");

const app = express();
app.use(express.json());
app.use("/api/bookings", bookingRoutes);

app.get("/", (req, res) => {
  res.send("Booking Service is running.");
});

module.exports = app;
