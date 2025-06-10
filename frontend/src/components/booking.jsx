"use client";
import { useRef } from "react";

export default function Booking() {
  const leftVideoRef = useRef(null);
  const rightVideoRef = useRef(null);

  // Play video on hover, pause on mouse leave
  const handleMouseEnter = (ref) => ref.current && ref.current.play();
  const handleMouseLeave = (ref) => ref.current && ref.current.pause();

  return (
    <div className="grid grid-cols-2 h-screen w-screen bg-black relative overflow-hidden">
      {/* Left Video */}
      <div
        className="relative group cursor-pointer"
        onMouseEnter={() => handleMouseEnter(leftVideoRef)}
        onMouseLeave={() => handleMouseLeave(leftVideoRef)}
      >
        <video
          ref={leftVideoRef}
          src="/videos/cr7.mp4"
          className="w-full h-full object-cover"
          loop
          muted
          preload="auto"
          playsInline
        />
        {/* Overlay */}
        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition duration-300" />
        {/* Text & Button */}
        <div className="absolute bottom-20 left-0 w-full text-center z-10">
          <div className="text-white text-3xl md:text-4xl font-serif font-bold mb-4 drop-shadow-lg">
            Sân 7
          </div>
          <a
            href="/bookinginfo?field=san7"
            className="inline-block px-6 py-2 border border-white rounded-md text-white text-lg font-semibold hover:bg-white hover:text-black transition"
          >
            Đặt sân
          </a>
        </div>
      </div>

      {/* Right Video */}
      <div
        className="relative group cursor-pointer"
        onMouseEnter={() => handleMouseEnter(rightVideoRef)}
        onMouseLeave={() => handleMouseLeave(rightVideoRef)}
      >
        <video
          ref={rightVideoRef}
          src="/videos/messi.mp4"
          className="w-full h-full object-cover"
          loop
          muted
          preload="auto"
          playsInline
        />
        {/* Overlay */}
        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition duration-300" />
        {/* Text & Button */}
        <div className="absolute bottom-20 left-0 w-full text-center z-10">
          <div className="text-white text-3xl md:text-4xl font-serif font-bold mb-4 drop-shadow-lg">
            Sân 5
          </div>
          <a
            href="/bookinginfo?field=san5"
            className="inline-block px-6 py-2 border border-white rounded-md text-white text-lg font-semibold hover:bg-white hover:text-black transition"
          >
            Đặt sân
          </a>
        </div>
      </div>

      {/* Center Logo/Text */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none text-center">
        <span className="text-white text-6xl md:text-8xl font-serif font-bold opacity-90 leading-none">
          B&B
        </span>
      </div>
    </div>
  );
}
