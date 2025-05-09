"use client";
import { useState } from "react";
import { useRouter } from "next/navigation"; // Import useRouter

export default function Booking() {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const router = useRouter(); // Initialize useRouter

  const handleNavigation = (fieldType) => {
    router.push(`/bookinginfo?field=${fieldType}`); // Navigate with query parameter
  };

  return (
    <div className="grid grid-cols-2 gap-6 h-screen mb-[35vh] relative mt-[4vh]">
      {/* Left Button */}
      <button
        className="relative w-full h-full bg-cover bg-center hover:opacity-80 hover:scale-105 p-4 transition-transform duration-300"
        style={{ backgroundImage: "url('/images/san7.webp')" }}
        onClick={() => handleNavigation("san5")} // Navigate to bookinginfo with field=san5
      >
        <div className="absolute bottom-16 inset-x-0 text-center text-white text-4xl font-bold">
          Sân 5
        </div>
      </button>

      {/* Right Button */}
      <button
        className="relative w-full h-full bg-cover bg-center hover:opacity-80 hover:scale-105 p-4 transition-transform duration-300"
        style={{ backgroundImage: "url('/images/san5.jpg')" }}
        onClick={() => handleNavigation("san7")} // Navigate to bookinginfo with field=san7
      >
        <div className="absolute bottom-16 inset-x-0 text-center text-white text-4xl font-bold">
          Sân 7
        </div>
      </button>
    </div>
  );
}
