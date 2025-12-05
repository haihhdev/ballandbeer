const express = require("express");
const router = express.Router();
const bookingController = require("../controllers/bookingController");
const {
  authenticateToken,
  requireAdmin,
} = require("../middlewares/authMiddleware");

router.post("/init", bookingController.initializeBookingDay);
router.post("/book", authenticateToken, bookingController.bookSlotWithAuth);
router.get("/my-bookings", authenticateToken, bookingController.getMyBookings);
router.get(
  "/all",
  authenticateToken,
  requireAdmin,
  bookingController.getAllBookings
);
router.get(
  "/statistics",
  authenticateToken,
  requireAdmin,
  bookingController.getBookingStatistics
);
router.get("/:fieldId/:date", bookingController.getBookingByDate);

module.exports = router;
