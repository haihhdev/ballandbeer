"use client";
import "./globals.css";
import ClientLayout from "@/components/ClientLayout";

export const metadata = {
  title: "Ball and Beer",
  description: "Đặt sân bóng và mua đồ thể thao online",
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body className="w-100% h-100% m-0 p-0 overflow-x-hidden">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
