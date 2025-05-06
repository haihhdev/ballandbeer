"use client";
import { useEffect, useRef } from "react";
import Link from 'next/link';

export default function NotFound() {
  const jackRef = useRef(null);

  useEffect(() => {
    if (jackRef.current) {
      jackRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  return (
    <div
      ref={jackRef}
      className="jack flex flex-col items-center justify-center min-h-screen text-white mb-[30vh]"
      style={{
        backgroundImage: "url('/images/bg404.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="relative w-full h-[40vh] flex items-center justify-center bg-cover bg-center">
        <h1 className="text-9xl font-bold text-white drop-shadow-lg font-serif">
          40
          <span className="text-yellow-300 animate-pulse drop-shadow-[0_0_10px_rgba(255,255,0,0.8)]">
            4
          </span>
        </h1>
      </div>
      <h2 className="text-3xl mt-4">Trang không còn tồn tại</h2>
      <p className="text-lg mt-2 text-gray-400">
        Nghe nói trang này từng vui vẻ lắm...
      </p>
      <p className="text-lg mt-2 text-gray-400">
        Cho đến ngày nó phát hiện mình không có bố lẫn không có tình yêu.
      </p>
      <Link
        href="/"
        className="mt-6 px-6 py-3 border-2 border-white bg-transparent text-white rounded-lg hover:bg-gray-50 hover:text-gray-900 hover:scale-110 transition"
      >
        Về trang chủ nè 🐧
      </Link>
    </div>
  );
}