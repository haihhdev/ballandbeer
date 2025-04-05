import Booking from "@/components/booking";
import Booking3 from "@/components/booking3";
import Booking2 from "@/components/booking2";

export default function Home() {
  return (
    <div>
      {/* Booking Section */}
      <Booking />
      {/* Booking2 Section */}
      <Booking2 />

      {/* Booking3 Section */}
      <Booking3 />
    </div>
  );
}
