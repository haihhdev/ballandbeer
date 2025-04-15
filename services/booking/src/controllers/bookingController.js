const Booking = require("../models/bookingModel");

exports.initializeBookingDay = async (req, res) => {
  const { fieldId, date } = req.body;

  const slots = Array.from({ length: 18 }, (_, i) => ({
    hour: i + 6,
    isBooked: false,
    userId: null,
  }));

  try {
    const booking = await Booking.create({ fieldId, date, slots });
    res.status(201).json(booking);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.bookSlot = async (req, res) => {
  const { fieldId, date, hours, userId } = req.body;

  try {
    const booking = await Booking.findOne({ fieldId, date });

    if (!booking) {
      return res.status(404).json({ error: "Booking for this date has not been initialized." });
    }

    const unavailableSlots = [];
    hours.forEach((hour) => {
      const slot = booking.slots.find((s) => s.hour === hour);
      if (!slot) {
        unavailableSlots.push({ hour, error: "Invalid time slot." });
      } else if (slot.isBooked) {
        unavailableSlots.push({ hour, error: "This slot has already been booked." });
      } else {
        slot.isBooked = true;
        slot.userId = userId;
      }
    });

    if (unavailableSlots.length > 0) {
      return res.status(400).json({
        error: "Some slots could not be booked.",
        unavailableSlots,
      });
    }

    await booking.save();
    res.json({ message: "Slots booked successfully", booking });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getBookingByDate = async (req, res) => {
  const { fieldId, date } = req.params;

  try {
    const booking = await Booking.findOne({ fieldId, date });

    if (!booking)
      return res.status(404).json({ error: "No booking data found for the selected date." });

    res.json(booking);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.bookSlotWithAuth = async (req, res) => {
  const { fieldId, date, hours } = req.body;
  const userId = req.userId;

  try {
    const booking = await Booking.findOne({ fieldId, date });

    if (!booking) {
      return res.status(404).json({ error: "Booking for this date has not been initialized." });
    }

    const unavailableSlots = [];
    hours.forEach((hour) => {
      const slot = booking.slots.find((s) => s.hour === hour);
      if (!slot) {
        unavailableSlots.push({ hour, error: "Invalid time slot." });
      } else if (slot.isBooked) {
        unavailableSlots.push({ hour, error: "This slot has already been booked." });
      } else {
        slot.isBooked = true;
        slot.userId = userId;
      }
    });

    if (unavailableSlots.length > 0) {
      return res.status(400).json({
        error: "Some slots could not be booked.",
        unavailableSlots,
      });
    }

    await booking.save();
    res.json({ message: "Slots booked successfully", booking });
  } catch (err) {
    res.status(500).json({ error: "Failed to book slots: " + err.message });
  }
};
