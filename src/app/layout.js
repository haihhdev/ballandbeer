"use client";
import Link from "next/link";
import Navigation from "@/components/navigation";
import "./globals.css";

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body>
        <div
          className="relative bg-cover bg-center min-h-screen"
          style={{ backgroundImage: "url('../images/homebg.jpg')" }} // Replace with your image path
        >
          {/* Navigation */}
          <Navigation />

          {/* Main Content */}
          <main className="p-4">{children}</main>
        </div>
      </body>
    </html>
  );
}
