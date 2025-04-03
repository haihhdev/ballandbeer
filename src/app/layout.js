"use client";
import Link from "next/link";
import Navigation from "@/components/navigation";
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

          {/* Main Content */}
          <main className="p-4">{children}</main>
        </div>
      </body>
    </html>
  );
}
