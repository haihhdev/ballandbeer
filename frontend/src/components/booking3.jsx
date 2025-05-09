"use client";
import { useState, useEffect } from "react";

export default function BookingTable({ selectedDate }) {
  const timeSlots = [
    "6:00",
    "7:00",
    "8:00",
    "9:00",
    "10:00",
    "11:00",
    "12:00",
    "1:00",
    "2:00",
    "3:00",
  ];
  const courts = [
    { id: 1, name: "Sân 1", image: "/images/san5.jpg" },
    { id: 2, name: "Sân 2", image: "/images/san5.jpg" },
    { id: 3, name: "Sân 3", image: "/images/san5.jpg" },
  ];

  const [bookedSlots, setBookedSlots] = useState([]);
  const [selectedSlots, setSelectedSlots] = useState([]);

  // Fetch booked slots when the selected date changes
  useEffect(() => {
    if (selectedDate) {
      fetchBookedSlots(selectedDate);
    }
  }, [selectedDate]);

  // Fetch booked slots from the API
  const fetchBookedSlots = async (date) => {
    try {
      const response = await fetch(
        `http://localhost:5000/api/bookings/field1/${date}`
      );
      if (response.ok) {
        const data = await response.json();
        setBookedSlots(data.slots);
      } else {
        console.error("Failed to fetch booked slots");
      }
    } catch (error) {
      console.error("Error fetching booked slots:", error);
    }
  };

  // Book a specific slot
  const bookSlot = async (courtId, time) => {
    try {
      const response = await fetch("http://localhost:5000/api/bookings/book", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fieldId: "field1",
          date: selectedDate,
          hour: parseInt(time.split(":")[0]),
        }),
      });

      if (response.ok) {
        console.log("Slot booked successfully");
        fetchBookedSlots(selectedDate); // Refresh booked slots
      } else {
        const errorData = await response.json();
        console.error("Error booking slot:", errorData.error);
      }
    } catch (error) {
      console.error("Failed to book slot:", error);
    }
  };

  // Toggle slot selection
  const toggleSlot = (courtId, time) => {
    const slot = `${courtId}-${time}`;
    setSelectedSlots((prev) =>
      prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot]
    );
  };

  // Submit selected slots to the API
  const handleSubmit = async () => {
    try {
      const requests = selectedSlots.map((slot) => {
        const [courtId, time] = slot.split("-");
        return fetch("http://localhost:5000/api/bookings/book", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fieldId: "field1",
            date: selectedDate,
            hour: parseInt(time.split(":")[0]),
          }),
        });
      });

      const responses = await Promise.all(requests);
      const failedRequests = responses.filter((res) => !res.ok);

      if (failedRequests.length === 0) {
        console.log("All slots booked successfully");
        setSelectedSlots([]); // Clear selected slots
        fetchBookedSlots(selectedDate); // Refresh booked slots
      } else {
        console.error("Some slots could not be booked");
      }
    } catch (error) {
      console.error("Failed to submit booking:", error);
    }
  };

  const totalPrice = selectedSlots.length * 100000;

  return (
    <div className="p-4 bg-green-700 text-white mb-[35vh]">
      <h1 className="text-lg text-3xl font-bold mb-4">Đặt lịch sân</h1>
      <div className="overflow-x-auto">
        <div className="grid grid-cols-[150px_repeat(10,_1fr)] border border-gray-300">
          {/* Time Header */}
          <div className="bg-blue-100 text-center text-gray-950 font-bold border border-gray-300">
            Courts
          </div>
          {timeSlots.map((time, index) => (
            <div
              key={index}
              className="bg-blue-100 text-center text-gray-950 font-bold border border-gray-300"
            >
              {time}
            </div>
          ))}

          {/* Court Rows */}
          {courts.map((court) => (
            <>
              {/* Court Photo */}
              <div
                key={court.id}
                className="bg-green-700 text-center border border-gray-300 flex flex-col items-center"
              >
                <img
                  src={court.image}
                  alt={court.name}
                  className="w-full h-auto object-cover mb-2"
                />
                <span>{court.name}</span>
              </div>
              {/* Time Slots */}
              {timeSlots.map((time, index) => (
                <div
                  key={`${court.id}-${index}`}
                  className={`border border-gray-300 text-center cursor-pointer ${
                    bookedSlots.some(
                      (slot) =>
                        slot.hour === parseInt(time.split(":")[0]) &&
                        slot.isBooked
                    )
                      ? "bg-gray-500 cursor-not-allowed"
                      : selectedSlots.includes(`${court.id}-${time}`)
                      ? "bg-yellow-500"
                      : "bg-white"
                  }`}
                  onClick={() =>
                    !bookedSlots.some(
                      (slot) =>
                        slot.hour === parseInt(time.split(":")[0]) &&
                        slot.isBooked
                    ) && toggleSlot(court.id, time)
                  }
                ></div>
              ))}
            </>
          ))}
        </div>
      </div>

      {/* Total Booking Time and Price */}
      {selectedSlots.length > 0 && (
        <div className="mt-4 p-4 bg-white text-black rounded shadow">
          <h2 className="text-lg font-bold mb-2">Thông tin đặt sân</h2>
          <p>
            <span className="font-bold">Tổng thời gian đặt:</span>{" "}
            {selectedSlots.length} giờ
          </p>
          <p>
            <span className="font-bold">Tổng giá:</span>{" "}
            {totalPrice.toLocaleString()} VND
          </p>
        </div>
      )}
      {/* Submit Button */}
      <div className="mt-12 flex justify-end">
        <button
          onClick={handleSubmit}
          className="bg-yellow-500 text-2xl text-white px-4 py-2 w-full rounded shadow hover:bg-yellow-600"
        >
          Đặt sân
        </button>
      </div>
    </div>
  );
}
