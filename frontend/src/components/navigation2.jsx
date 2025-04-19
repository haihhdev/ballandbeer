"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation"; // Import useRouter

export default function Header() {
  const [dropdownOpen, setDropdownOpen] = useState(false); // For "Vi" dropdown
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false); // For profile dropdown
  const [isLoggedIn, setIsLoggedIn] = useState(false); // Track login status
  const router = useRouter(); // Initialize router

  // Check login status on component mount
  useEffect(() => {
    const loggedInStatus = localStorage.getItem("isLoggedIn");
    if (loggedInStatus === "true") {
      setIsLoggedIn(true);
    }
  }, []);

  const handleLogout = () => {
    setIsLoggedIn(false); // Update state to reflect logout
    localStorage.removeItem("isLoggedIn"); // Remove login status
    localStorage.removeItem("token"); // Remove token if stored
    router.push("/"); // Redirect to the homepage
  };

  return (
    <header className="">
      {/* Navigation */}
      <div className="top-0 left-0 w-full bg-gradient-to-b from-gray-950 to-blue-900">
        <div className="max-w-screen-xl flex flex-wrap items-center justify-between mx-auto p-4">
          {/* Logo */}
          <a href="/" className="flex items-center space-x-3 rtl:space-x-reverse -ml-32">
            <img src="/images/B&B.png" className="h-16 md:h-20 lg:h-24" alt="Logo" />
          </a>
          <div className="flex items-center md:order-2 space-x-3 rtl:space-x-reverse">
            {isLoggedIn ? (
              <div className="relative">
                {/* Profile Avatar */}
                <div
                  className="w-12 h-12 rounded-full overflow-hidden cursor-pointer border-2 border-gray-300"
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                >
                  <img
                    src="/images/avt.png"
                    alt="Profile Avatar"
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Profile Dropdown Menu */}
                {profileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg z-10">
                    <div className="p-4 border-b border-gray-200">
                      <h3 className="text-sm font-semibold text-gray-900">Someone Famous</h3>
                      <span className="text-xs text-gray-500">j97@gmail.com</span>
                    </div>
                    <ul className="py-2">
                      <li>
                        <a
                          href="/profile"
                          className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          <img src="/images/avt.svg" alt="My Profile" className="w-4 h-4 mr-2" />
                          Tài khoản của tôi
                        </a>
                      </li>
                      <li>
                        <a
                          href="#"
                          className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          <img src="/images/setting.svg" alt="Settings" className="w-4 h-4 mr-2" />
                          Cài đặt
                        </a>
                      </li>
                      <li>
                        <a
                          href="#"
                          className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          <img src="/images/help.svg" alt="Help" className="w-4 h-4 mr-2" />
                          Trợ giúp
                        </a>
                      </li>
                      <li>
                        <button
                          onClick={handleLogout} // Call handleLogout on click
                          className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                        >
                          <img src="/images/logout.svg" alt="Logout" className="w-4 h-4 mr-2" />
                          Đăng xuất
                        </button>
                      </li>
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link href="/register">
                  <button className="border-2 bg-transparent text-white font-medium py-2 px-4 rounded-full shadow-lg hover:bg-gray-50/30 hover:scale-105 transition-transform duration-300">
                    Đăng ký
                  </button>
                </Link>
                <Link href="/login">
                  <button
                    className="bg-gradient-to-r from-green-400 to-lime-400 text-white font-medium py-2 px-4 rounded-full shadow-lg hover:from-green-500 hover:to-lime-500 hover:scale-105 transition-transform duration-300"
                  >
                    Đăng nhập
                  </button>
                </Link>
              </>
            )}
          </div>

          {/* Navigation Links */}
          <div
            className="items-center justify-between hidden w-full md:flex md:w-auto md:order-1"
            id="navbar-user"
          >
            <ul className="flex flex-col font-medium p-4 md:p-0 mt-4 border border-gray-100 rounded-lg bg-gray-50/50 md:space-x-8 rtl:space-x-reverse md:flex-row md:mt-0 md:border-0 md:bg-transparent dark:bg-gray-800/50 md:dark:bg-transparent dark:border-gray-700">
              {/* Language Dropdown */}
              <li className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center space-x-2 p-4 rounded-sm bg-transparent md:text-gray-50 hover:bg-gray-50/30"
                >
                  <img src="/images/flagVN.png" alt="Vietnam Flag" className="h-5 auto" />
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