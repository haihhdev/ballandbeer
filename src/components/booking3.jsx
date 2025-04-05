"use client";
import { useState } from "react";

export default function BookingTable() {
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

  const [selectedSlots, setSelectedSlots] = useState([]);

  const toggleSlot = (courtId, time) => {
    const slot = `${courtId}-${time}`;
    setSelectedSlots((prev) =>
      prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot]
    );
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
                    selectedSlots.includes(`${court.id}-${time}`)
                      ? "bg-yellow-500"
                      : "bg-white"
                  }`}
                  onClick={() => toggleSlot(court.id, time)}
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
      {/* Continue Button */}
      <div className="mt-12 flex justify-end">
        <button className="bg-yellow-500 text-2xl text-white px-4 py-2 w-full rounded shadow hover:bg-yellow-600">
          Tiếp tục
        </button>
      </div>
    </div>
  );
}
