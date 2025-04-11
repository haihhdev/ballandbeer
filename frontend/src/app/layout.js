"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Navigation from "@/components/navigation";
import Navigation2 from "@/components/navigation2";
import Footer from "@/components/footer";
import "./globals.css";

export default function RootLayout({ children }) {
  const pathname = usePathname();

  return (
    <html lang="vi">
      <body className="w-100% h-100% m-0 p-0 overflow-x-hidden">
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
      </body>
    </html>
  );
}
