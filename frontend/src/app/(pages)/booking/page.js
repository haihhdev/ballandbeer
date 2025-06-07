"use client";
import Booking from "@/components/booking";
import { useEffect, useRef } from "react";

export default function BookingPage() {
  const bookingRef = useRef(null);

  useEffect(() => {
    if (bookingRef.current) {
      bookingRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  return (
    <div>
      {/* Booking Section */}
      <div ref={bookingRef}>
        <Booking />
      </div>
    </div>
  );
}
