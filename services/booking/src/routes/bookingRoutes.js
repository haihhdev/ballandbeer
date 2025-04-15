const express = require("express");
const router = express.Router();
const bookingController = require("../controllers/bookingController");
const authenticateToken = require("../middlewares/authMiddleware");

router.post("/init", bookingController.initializeBookingDay);
router.post("/book", authenticateToken, bookingController.bookSlotWithAuth);
router.get("/:fieldId/:date", bookingController.getBookingByDate);

module.exports = router;