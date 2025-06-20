"use client";

import { usePathname } from "next/navigation";
import Navigation from "@/components/navigation";
import Navigation2 from "@/components/navigation2";
import Footer from "@/components/footer";

export default function ClientLayout({ children }) {
  const pathname = usePathname();

  return (
    <div
      className="relative bg-top bg-no-repeat w-full min-h-screen"
      style={{
        backgroundImage:
          pathname === "/" ? "url('/images/homebg.jpg')" : "none",
        backgroundSize: pathname === "/" ? "100% auto" : "unset",
      }}
    >
      {/* Conditional Navigation */}
      {pathname === "/" ? <Navigation /> : <Navigation2 />}

      {/* Main Content */}
      <main>{children}</main>

      {/* Footer */}
      <Footer />
    </div>
  );
} 