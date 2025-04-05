"use client";
import { useState } from "react";

export default function Booking() {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <div className="grid grid-cols-2 gap-6 h-screen mb-[35vh] relative">
      {/* Centered Text */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-white text-6xl font-bold">B&B</span>
      </div>

      {/* Left Button */}
      <button
        className="relative w-full h-full bg-cover bg-center hover:opacity-80 hover:scale-105 p-4 transition-transform duration-300"
        style={{ backgroundImage: "url('/images/san7.webp')" }}
      >
        <div className="absolute bottom-16 inset-x-0 text-center text-white text-4xl font-bold">
          Sân 5
        </div>
      </button>

      {/* Right Button */}
      <button
        className="relative w-full h-full bg-cover bg-center hover:opacity-80 hover:scale-105 p-4 transition-transform duration-300"
        style={{ backgroundImage: "url('/images/san5.jpg')" }}
      >
        <div className="absolute bottom-16 inset-x-0 text-center text-white text-4xl font-bold">
          Sân 7
        </div>
      </button>
    </div>
  );
}
