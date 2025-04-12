"use client";
import { useState } from "react";
import Link from "next/link";

export default function Header() {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <header className="relative bg-cover bg-center h-screen">
      {/* Centered Text */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center text-white h-full px-4">
        <h1 className="text-4xl md:text-6xl font-bold mb-4">
          TRANG WEB ĐẶT SÂN HÀNG ĐẦU VIỆT NAM
        </h1>
        <p className="text-lg md:text-xl mb-6">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do
          eiusmod tempor incididunt ut labore et dolore magna aliqua.
        </p>
        <button className="bg-gradient-to-r from-green-400 to-lime-400 text-white font-medium py-2 px-4 rounded hover:from-green-500 hover:to-lime-500 hover:shadow-xl hover:scale-105 transition-transform duration-300">
          Xem thêm
        </button>
      </div>

      {/* Navigation */}
      <div className="absolute top-0 left-0 w-full z-20">
        <div className="max-w-screen-xl flex flex-wrap items-center justify-between mx-auto p-4">
          {/* Logo */}
          <a
            href="/"
            className="flex items-center space-x-3 rtl:space-x-reverse -ml-32"
          >
            <img
              src="/images/B&B.png"
              className="h-16 md:h-20 lg:h-24"
              alt="Logo"
            />
          </a>
          <div className="flex items-center md:order-2 space-x-3 rtl:space-x-reverse ">
            <Link href="/register">
              <button className="border-2 bg-transparent text-white font-medium py-2 px-4 rounded-full shadow-lg hover:bg-gray-50/30 hover:scale-105 transition-transform duration-300">
                Đăng ký
              </button>
            </Link>
            <Link href="/login">
              <button className="bg-gradient-to-r from-green-400 to-lime-400 text-white font-medium py-2 px-4 rounded-full shadow-lg hover:from-green-500 hover:to-lime-500 hover:scale-105 transition-transform duration-300">
                Đăng nhập
              </button>
            </Link>
          </div>

          {/* Navigation Links */}
          <div
            className="items-center justify-between hidden w-full md:flex md:w-auto md:order-1"
            id="navbar-user"
          >
            <ul className="flex flex-col font-medium p-4 md:p-0 mt-4 border border-gray-100 rounded-lg bg-gray-50/50 md:space-x-8 rtl:space-x-reverse md:flex-row md:mt-0 md:border-0 md:bg-transparent dark:bg-gray-800/50 md:dark:bg-transparent dark:border-gray-700">
              {/* Dropdown */}
              <li className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center space-x-2 p-4 rounded-sm bg-transparent md:text-gray-50 hover:bg-gray-50/30"
                >
                  <img
                    src="/images/flagVN.png"
                    alt="Vietnam Flag"
                    className="h-5 auto"
                  />
                  <span>Vi🔻</span>
                </button>
                {dropdownOpen && (
                  <ul className="absolute left-0 mt-2 w-40 bg-white border border-gray-100 rounded-lg shadow-lg dark:bg-gray-800 dark:border-gray-700">
                    <li>
                      <a
                        href="/option1"
                        className="block px-4 py-2 text-sm text-gray-950 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                      >
                        Tiếng Việt
                      </a>
                    </li>
                    <li>
                      <a
                        href="/option2"
                        className="block px-4 py-2 text-sm text-gray-950 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                      >
                        Tiếng Anh
                      </a>
                    </li>
                  </ul>
                )}
              </li>

              {/* Home Link */}
              <li>
                <Link
                  href="/"
                  className="block p-4 rounded-sm bg-transparent md:text-gray-50 md: hover:bg-gray-50/30 "
                >
                  Trang chủ
                </Link>
              </li>
              <li>
                <Link
                  href="/booking"
                  className="block p-4 rounded-sm bg-transparent md:text-gray-50 md: hover:bg-gray-50/30 "
                >
                  Đặt sân
                </Link>
              </li>
              <li>
                <Link
                  href="/products"
                  className="block p-4 rounded-sm bg-transparent md:text-gray-50 md: hover:bg-gray-50/30 "
                >
                  Sản phẩm
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="block p-4 rounded-sm bg-transparent md:text-gray-50 md: hover:bg-gray-50/30 "
                >
                  Liên hệ
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </header>
  );
}
