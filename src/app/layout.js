"use client";
import Link from "next/link";
import Navigation from "@/components/navigation";
import AboutUs from "@/components/aboutus";
import Footer from "@/components/footer"; // Corrected import for AboutUs
import "./globals.css";

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body>
        <div
          className="relative bg-top bg-no-repeat w-full min-h-screen"
          style={{
            backgroundImage: "url('/images/homebg.jpg')",
            backgroundSize: "100% auto",
          }}
        >
          {/* Navigation */}
          <Navigation />

          {/* About Us Section */}
          <AboutUs />

          {/* Footer Us Section */}
          <Footer />
          {/* Main Content */}
          <main className="p-4">{children}</main>
        </div>
      </body>
    </html>
  );
}
