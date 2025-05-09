"use client";
import React, { useState, useEffect, useRef } from "react";

export default function Booking() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return `${String(today.getDate()).padStart(2, "0")}/${String(
      today.getMonth() + 1
    ).padStart(2, "0")}/${today.getFullYear()}`;
  });
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [bookedSlots, setBookedSlots] = useState({});
  const [selectedSlots, setSelectedSlots] = useState([]);
  const daysContainerRef = useRef(null);

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
    { id: "field1", name: "Sân 1", image: "/images/san5.jpg" },
    { id: "field2", name: "Sân 2", image: "/images/san5.jpg" },
    { id: "field3", name: "Sân 3", image: "/images/san5.jpg" },
  ];

  // Initialize booking fields for today's date when component mounts
  useEffect(() => {
    const today = new Date();
    const formattedDate = `${String(today.getDate()).padStart(2, "0")}/${String(
      today.getMonth() + 1
    ).padStart(2, "0")}/${today.getFullYear()}`;
    const date = formattedDate.split("/").reverse().join("-");
    initBookingFields(date);
    courts.forEach((court) => fetchBookedSlots(date, court.id));
  }, []);

  // Fetch booked slots when the selected date changes
  useEffect(() => {
    if (selectedDate) {
      const date = selectedDate.split("/").reverse().join("-"); // Convert to YYYY-MM-DD
      courts.forEach((court) => fetchBookedSlots(date, court.id));
    }
  }, [selectedDate]);

  // Fetch booked slots from the API
  const fetchBookedSlots = async (date, fieldId) => {
    try {
      const response = await fetch(
        `http://localhost:5000/api/bookings/${fieldId}/${date}`,
        {
          method: "GET",
        }
      );
      if (response.ok) {
        const data = await response.json();
        setBookedSlots((prev) => ({
          ...prev,
          [fieldId]: data.slots || [],
        }));
      } else {
        console.error(`Failed to fetch booked slots for ${fieldId}`);
      }
    } catch (error) {
      console.error(`Error fetching booked slots for ${fieldId}:`, error);
    }
  };

  // Initialize booking fields for the selected date
  const initBookingFields = async (date) => {
    try {
      const requests = courts.map((court) =>
        fetch("http://localhost:5000/api/bookings/init", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fieldId: court.id,
            date: date,
          }),
        })
      );

      const responses = await Promise.all(requests);
      responses.forEach(async (response, index) => {
        if (!response.ok) {
          const errorData = await response.json();
          if (errorData.error && errorData.error.includes("duplicate key")) {
            console.warn(
              `Booking field for ${courts[index].id} on this date is already initialized.`
            );
          } else {
            console.error(
              `Failed to initialize booking field for ${courts[index].id}:`,
              errorData
            );
          }
        }
      });
    } catch (error) {
      console.error("Error initializing booking fields:", error);
    }
  };

  // Toggle slot selection
  const toggleSlot = (fieldId, time) => {
    const slot = `${fieldId}-${time}`;
    setSelectedSlots((prev) =>
      prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot]
    );
  };

  // Submit selected slots to the API
  const handleSubmit = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        alert("Bạn cần đăng nhập để thực hiện thao tác này.");
        window.location.href = "/login";
        return;
      }

      const date = selectedDate.split("/").reverse().join("-");

      const requests = selectedSlots
        .map((slot) => {
          const [fieldId, time] = slot.split("-");
          const hour = time ? parseInt(time.split(":")[0]) : null;

          if (!hour && hour !== 0) {
            console.warn(`Invalid slot format: ${slot}`);
            return null;
          }

          console.log("Booking slot:", { fieldId, date, hours: [hour] });

          return fetch("http://localhost:5000/api/bookings/book", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              fieldId: fieldId,
              date: date,
              hours: [hour], // Gửi mảng hours thay vì một giá trị duy nhất
            }),
          });
        })
        .filter((req) => req !== null); // Loại bỏ null

      const responses = await Promise.all(requests);
      const failedRequests = await Promise.all(
        responses.map(async (res) => (res.ok ? null : await res.json()))
      );

      const failedSlots = failedRequests.filter((res) => res !== null);

      if (failedSlots.length === 0) {
        setSelectedSlots([]);
        courts.forEach((court) => fetchBookedSlots(date, court.id));
      } else {
        console.error("Failed to book the following slots:", failedSlots);
        alert(
          `Failed to book the following slots:\n${failedSlots
            .map(
              (slot) =>
                `Hour: ${slot?.hour ?? "N/A"}, Error: ${
                  slot?.error ?? "Unknown"
                }`
            )
            .join("\n")}`
        );
      }
    } catch (error) {
      console.error("Failed to submit booking:", error);
    }
  };
  const totalPrice = selectedSlots.length * 100000;

  const handleDateSelection = async (formattedDate) => {
    setSelectedDate(formattedDate);
    setIsCalendarOpen(false);

    const date = formattedDate.split("/").reverse().join("-");

    await initBookingFields(date); // Initialize booking fields
    courts.forEach((court) => fetchBookedSlots(date, court.id)); // Fetch booked slots
  };

  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const daysContainer = daysContainerRef.current;
    if (!daysContainer) return;

    daysContainer.innerHTML = "";

    for (let i = 0; i < firstDayOfMonth; i++) {
      const emptyDiv = document.createElement("div");
      daysContainer.appendChild(emptyDiv);
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const dayDiv = document.createElement("div");
      dayDiv.className =
        "flex items-center justify-center cursor-pointer w-[40px] h-[40px] text-dark-3 dark:text-dark-6 rounded-full hover:bg-green-500 hover:text-white";

      const [selectedDay, selectedMonth, selectedYear] = selectedDate
        ? selectedDate.split("/").map(Number)
        : [];
      if (
        selectedDay === i &&
        selectedMonth === month + 1 &&
        selectedYear === year
      ) {
        dayDiv.classList.add("bg-green-500", "text-white");
      }

      dayDiv.textContent = i;
      dayDiv.addEventListener("click", () => {
        const formattedDate = `${String(i).padStart(2, "0")}/${String(
          month + 1
        ).padStart(2, "0")}/${year}`;
        handleDateSelection(formattedDate);
      });

      daysContainer.appendChild(dayDiv);
    }
  };

  const handlePrevMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() - 1);
    setCurrentDate(newDate);
  };

  const handleNextMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + 1);
    setCurrentDate(newDate);
  };

  useEffect(() => {
    if (isCalendarOpen) {
      renderCalendar();
    }
  }, [currentDate, isCalendarOpen]);

  return (
    <div className="p-4 bg-green-700 text-green mb-[35vh]">
      <h1 className="text-lg text-3xl font-bold mb-4">Đặt lịch sân</h1>

      {/* Date Picker */}
      <div className="mb-6 flex justify-end">
        <div className="relative w-1/4">
          <input
            id="datepicker"
            type="text"
            placeholder="Chọn ngày"
            className="w-full rounded-lg border border-stroke bg-green-100 py-2.5 pl-[50px] pr-8 text-dark-2 text-2xl outline-none transition focus:border-primary"
            value={selectedDate || ""}
            readOnly
            onClick={() => setIsCalendarOpen(!isCalendarOpen)}
          />
          <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-xl">
            📅
          </span>
        </div>
        {isCalendarOpen && (
          <div
            id="datepicker-container"
            className="shadow-datepicker absolute mt-2 rounded-xl border border-stroke bg-white pt-5"
          >
            <div className="flex items-center justify-between px-5">
              <button
                id="prevMonth"
                className="rounded-md px-2 py-2 text-dark hover:bg-green-500 hover:text-white"
                onClick={handlePrevMonth}
              >
                Prev
              </button>
              <div
                id="currentMonth"
                className="text-lg font-medium text-dark-3"
              >
                {currentDate.toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })}
              </div>
              <button
                id="nextMonth"
                className="rounded-md px-2 py-2 text-dark hover:bg-green-500 hover:text-white"
                onClick={handleNextMonth}
              >
                Next
              </button>
            </div>

            <div
              id="days-of-week"
              className="mb-4 mt-6 grid grid-cols-7 gap-2 px-5"
            >
              <div className="text-center text-sm font-medium text-green-500">
                Sun
              </div>
              <div className="text-center text-sm font-medium text-green-500">
                Mon
              </div>
              <div className="text-center text-sm font-medium text-green-500">
                Tue
              </div>
              <div className="text-center text-sm font-medium text-green-500">
                Wed
              </div>
              <div className="text-center text-sm font-medium text-green-500">
                Thu
              </div>
              <div className="text-center text-sm font-medium text-green-500">
                Fri
              </div>
              <div className="text-center text-sm font-medium text-green-500">
                Sat
              </div>
            </div>

            <div
              ref={daysContainerRef}
              id="days-container"
              className="mt-2 grid grid-cols-7 gap-2 px-5"
            >
              {/* Days will be rendered here */}
            </div>
          </div>
        )}
      </div>

      {/* Booking Table */}
      <div className="overflow-x-auto">
        <div className="grid grid-cols-[150px_repeat(10,_1fr)] border border-gray-300">
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

          {courts.map((court) => (
            <React.Fragment key={court.id}>
              <div className="bg-green-700 text-center border border-gray-300 flex flex-col items-center">
                <img
                  src={court.image}
                  alt={court.name}
                  className="w-full h-auto object-cover mb-2"
                />
                <span>{court.name}</span>
              </div>
              {timeSlots.map((time, index) => (
                <div
                  key={`${court.id}-${index}`}
                  className={`border border-gray-300 text-center cursor-pointer ${
                    (bookedSlots[court.id] || []).some(
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
                    !(bookedSlots[court.id] || []).some(
                      (slot) =>
                        slot.hour === parseInt(time.split(":")[0]) &&
                        slot.isBooked
                    ) && toggleSlot(court.id, time)
                  }
                ></div>
              ))}
            </React.Fragment>
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
