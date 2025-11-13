const Booking = require("../models/bookingModel");
const axios = require("axios");

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
      return res
        .status(404)
        .json({ error: "Booking for this date has not been initialized." });
    }

    const unavailableSlots = [];
    hours.forEach((hour) => {
      const slot = booking.slots.find((s) => s.hour === hour);
      if (!slot) {
        unavailableSlots.push({ hour, error: "Invalid time slot." });
      } else if (slot.isBooked) {
        unavailableSlots.push({
          hour,
          error: "This slot has already been booked.",
        });
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
      return res
        .status(404)
        .json({ error: "No booking data found for the selected date." });

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
      return res
        .status(404)
        .json({ error: "Booking for this date has not been initialized." });
    }

    const unavailableSlots = [];
    hours.forEach((hour) => {
      const slot = booking.slots.find((s) => s.hour === hour);
      if (!slot) {
        unavailableSlots.push({ hour, error: "Invalid time slot." });
      } else if (slot.isBooked) {
        unavailableSlots.push({
          hour,
          error: "This slot has already been booked.",
        });
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

exports.getMyBookings = async (req, res) => {
  const userId = req.userId;

  try {
    // Tìm tất cả bookings có slots được đặt bởi user này
    const allBookings = await Booking.find({
      "slots.userId": userId,
      "slots.isBooked": true,
    });

    // Map fieldId sang tên sân và ảnh
    const fieldMap = {
      field1: { name: "Sân thường", image: "/images/san5.jpg", price: 100000 },
      field2: {
        name: "Sân tiêu chuẩn",
        image: "/images/san5.jpg",
        price: 200000,
      },
      field3: { name: "Sân VIP", image: "/images/san5.jpg", price: 400000 },
    };

    // Nhóm các slots theo booking (fieldId + date)
    const bookingMap = {};

    allBookings.forEach((booking) => {
      const key = `${booking.fieldId}-${booking.date}`;
      const fieldInfo = fieldMap[booking.fieldId] || {
        name: booking.fieldId,
        image: "/images/san5.jpg",
        price: 0,
      };

      // Lọc các slots của user này
      const userSlots = booking.slots.filter(
        (slot) => slot.userId === userId && slot.isBooked
      );

      if (userSlots.length > 0) {
        if (!bookingMap[key]) {
          bookingMap[key] = {
            fieldId: booking.fieldId,
            date: booking.date,
            courtName: fieldInfo.name,
            courtImage: fieldInfo.image,
            times: [],
            price: 0,
            createdAt: booking.createdAt,
            updatedAt: booking.updatedAt,
          };
        }

        // Thêm các giờ đã đặt
        userSlots.forEach((slot) => {
          const startHour = slot.hour;
          const endHour = startHour + 1;
          const timeRange = `${startHour}:00 - ${endHour}:00`;
          bookingMap[key].times.push(timeRange);
          bookingMap[key].price += fieldInfo.price;
        });
      }
    });

    // Chuyển đổi map thành array và sắp xếp theo thời gian tạo mới nhất
    const bookings = Object.values(bookingMap).sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt) : new Date(a.date);
      const dateB = b.createdAt ? new Date(b.createdAt) : new Date(b.date);
      return dateB - dateA; // Sắp xếp giảm dần (mới nhất trước)
    });

    res.json({
      success: true,
      data: bookings,
    });
  } catch (err) {
    console.error("Error fetching user bookings:", err);
    res.status(500).json({ error: "Failed to fetch bookings: " + err.message });
  }
};

// Get all bookings for admin
exports.getAllBookings = async (req, res) => {
  try {
    const profileServiceUrl =
      process.env.PROFILE_SERVICE_URL || "http://localhost:4004";

    // Tìm tất cả bookings có slots đã được đặt
    const allBookings = await Booking.find({
      "slots.isBooked": true,
    });

    // Map fieldId sang tên sân và giá
    const fieldMap = {
      field1: { name: "Sân thường", price: 100000 },
      field2: { name: "Sân tiêu chuẩn", price: 200000 },
      field3: { name: "Sân VIP", price: 400000 },
    };

    // Tạo map để lưu thông tin user
    const userCache = {};

    // Hàm lấy thông tin user
    const getUserInfo = async (userId) => {
      if (!userId) return null;
      if (userCache[userId]) return userCache[userId];

      try {
        const response = await axios.get(
          `${profileServiceUrl}/api/profile/id/${userId}`
        );
        if (response.data && response.data.data) {
          userCache[userId] = {
            id: userId,
            fullname: response.data.data.fullname || "Unknown",
            email: response.data.data.email || "",
            phone: response.data.data.phone || "",
          };
          return userCache[userId];
        }
      } catch (err) {
        console.error(`Error fetching user ${userId}:`, err.message);
      }
      return { id: userId, fullname: "Unknown", email: "", phone: "" };
    };

    // Tạo danh sách booking details
    const bookingDetails = [];

    for (const booking of allBookings) {
      const fieldInfo = fieldMap[booking.fieldId] || {
        name: booking.fieldId,
        price: 0,
      };

      // Nhóm slots theo userId
      const slotsByUser = {};
      booking.slots
        .filter((slot) => slot.isBooked && slot.userId)
        .forEach((slot) => {
          if (!slotsByUser[slot.userId]) {
            slotsByUser[slot.userId] = [];
          }
          slotsByUser[slot.userId].push(slot);
        });

      // Tạo booking detail cho mỗi user
      for (const [userId, slots] of Object.entries(slotsByUser)) {
        const userInfo = await getUserInfo(userId);
        const sortedSlots = slots.sort((a, b) => a.hour - b.hour);
        const timeSlots = sortedSlots.map(
          (slot) => `${slot.hour}:00 - ${slot.hour + 1}:00`
        );
        const duration = slots.length; // Số giờ
        const price = fieldInfo.price * duration;

        bookingDetails.push({
          bookingId: `${booking._id}-${userId}-${booking.date}`,
          userId: userId,
          customer: {
            name: userInfo.fullname,
            email: userInfo.email,
            phone: userInfo.phone,
          },
          fieldId: booking.fieldId,
          fieldName: fieldInfo.name,
          date: booking.date,
          timeSlots: timeSlots,
          duration: duration,
          price: price,
          status: "Completed", // Mặc định là completed vì đã được đặt
          createdAt: booking.createdAt,
          updatedAt: booking.updatedAt,
        });
      }
    }

    // Sắp xếp theo thời gian tạo mới nhất
    bookingDetails.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0);
      const dateB = new Date(b.createdAt || 0);
      return dateB - dateA;
    });

    res.json({
      success: true,
      data: bookingDetails,
    });
  } catch (err) {
    console.error("Error fetching all bookings:", err);
    res.status(500).json({ error: "Failed to fetch bookings: " + err.message });
  }
};

// Get booking statistics for admin
exports.getBookingStatistics = async (req, res) => {
  try {
    const profileServiceUrl =
      process.env.PROFILE_SERVICE_URL || "http://localhost:4004";

    // Tìm tất cả bookings có slots đã được đặt
    const allBookings = await Booking.find({
      "slots.isBooked": true,
    });

    const fieldMap = {
      field1: { name: "Sân thường", price: 100000 },
      field2: { name: "Sân tiêu chuẩn", price: 200000 },
      field3: { name: "Sân VIP", price: 400000 },
    };

    // Thống kê
    let totalBookings = 0;
    let totalRevenue = 0;
    const uniqueUsers = new Set();
    const fieldCounts = {};
    const timeSlotCounts = {};
    const revenueByDate = {};
    const revenueByWeek = {};
    const revenueByMonth = {};

    // Hàm tính tuần từ ngày
    const getWeekKey = (dateString) => {
      const date = new Date(dateString);
      const year = date.getFullYear();
      const oneJan = new Date(year, 0, 1);
      const numberOfDays = Math.floor((date - oneJan) / (24 * 60 * 60 * 1000));
      const week = Math.ceil((numberOfDays + oneJan.getDay() + 1) / 7);
      return `${year}-W${week}`;
    };

    // Hàm tính tháng từ ngày
    const getMonthKey = (dateString) => {
      const date = new Date(dateString);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
        2,
        "0"
      )}`;
    };

    for (const booking of allBookings) {
      const fieldInfo = fieldMap[booking.fieldId] || {
        name: booking.fieldId,
        price: 0,
      };

      // Đếm theo field
      if (!fieldCounts[booking.fieldId]) {
        fieldCounts[booking.fieldId] = { name: fieldInfo.name, count: 0 };
      }

      booking.slots
        .filter((slot) => slot.isBooked && slot.userId)
        .forEach((slot) => {
          totalBookings++;
          uniqueUsers.add(slot.userId);
          fieldCounts[booking.fieldId].count++;
          totalRevenue += fieldInfo.price;

          // Đếm theo time slot
          const timeSlot = `${slot.hour}:00-${slot.hour + 1}:00`;
          timeSlotCounts[timeSlot] = (timeSlotCounts[timeSlot] || 0) + 1;

          // Doanh thu theo ngày
          const dateKey = booking.date;
          if (!revenueByDate[dateKey]) {
            revenueByDate[dateKey] = 0;
          }
          revenueByDate[dateKey] += fieldInfo.price;

          // Doanh thu theo tuần
          const weekKey = getWeekKey(booking.date);
          if (!revenueByWeek[weekKey]) {
            revenueByWeek[weekKey] = 0;
          }
          revenueByWeek[weekKey] += fieldInfo.price;

          // Doanh thu theo tháng
          const monthKey = getMonthKey(booking.date);
          if (!revenueByMonth[monthKey]) {
            revenueByMonth[monthKey] = 0;
          }
          revenueByMonth[monthKey] += fieldInfo.price;
        });
    }

    // Tìm sân được đặt nhiều nhất
    const mostBookedField = Object.entries(fieldCounts).reduce(
      (max, [fieldId, data]) =>
        data.count > max.count ? { fieldId, ...data } : max,
      { fieldId: "", name: "N/A", count: 0 }
    );

    // Top 3 khung giờ được đặt nhiều nhất
    const top3TimeSlots = Object.entries(timeSlotCounts)
      .map(([timeSlot, count]) => ({ timeSlot, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    // Tính tổng doanh thu theo tuần (tuần hiện tại)
    const currentWeek = getWeekKey(new Date().toISOString().split("T")[0]);
    const weeklyRevenue = revenueByWeek[currentWeek] || 0;

    // Tính tổng doanh thu theo tháng (tháng hiện tại)
    const currentMonth = getMonthKey(new Date().toISOString().split("T")[0]);
    const monthlyRevenue = revenueByMonth[currentMonth] || 0;

    // Tính tỷ lệ đặt sân của 3 loại sân
    // Đảm bảo luôn có 3 loại sân trong kết quả
    const totalFieldBookings = Object.values(fieldCounts).reduce(
      (sum, field) => sum + field.count,
      0
    );

    // Tạo fieldBookingRates với đầy đủ 3 loại sân
    const allFields = [
      { fieldId: "field1", name: "Sân thường" },
      { fieldId: "field2", name: "Sân tiêu chuẩn" },
      { fieldId: "field3", name: "Sân VIP" },
    ];

    const fieldBookingRates = allFields.map((field) => {
      const fieldData = fieldCounts[field.fieldId] || { count: 0 };
      return {
        fieldId: field.fieldId,
        name: field.name,
        count: fieldData.count,
        rate:
          totalFieldBookings > 0
            ? (fieldData.count / totalFieldBookings) * 100
            : 0,
      };
    });

    // Debug: Log để kiểm tra (sau khi khai báo tất cả biến)
    console.log("timeSlotCounts:", timeSlotCounts);
    console.log("top3TimeSlots:", top3TimeSlots);
    console.log("fieldCounts:", fieldCounts);
    console.log("fieldBookingRates:", fieldBookingRates);

    res.json({
      success: true,
      data: {
        totalBookings,
        totalRevenue,
        totalCustomers: uniqueUsers.size,
        completionRate: 100, // Tất cả bookings đều completed
        cancellationRate: 0,
        mostBookedField: mostBookedField.name,
        mostBookedTimeSlot: top3TimeSlots[0]?.timeSlot || "N/A",
        weeklyRevenue,
        monthlyRevenue,
        top3TimeSlots: top3TimeSlots.map((item) => ({
          timeSlot: item.timeSlot,
          count: item.count,
        })),
        fieldBookingRates,
      },
    });
  } catch (err) {
    console.error("Error fetching booking statistics:", err);
    res
      .status(500)
      .json({ error: "Failed to fetch statistics: " + err.message });
  }
};
