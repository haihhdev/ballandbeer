"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

export default function Header() {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  // Check login status on component mount and when login status changes
  useEffect(() => {
    const checkLoginStatus = () => {
      const loggedInStatus = localStorage.getItem("isLoggedIn");
      setIsLoggedIn(loggedInStatus === "true");
    };

    // Check on mount
    checkLoginStatus();

    // Listen for login status changes
    window.addEventListener("loginStatusChanged", checkLoginStatus);
    
    return () => {
      window.removeEventListener("loginStatusChanged", checkLoginStatus);
    };
  }, []);

  // Add scroll event listener
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      setIsScrolled(scrollPosition > 0);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleLogout = () => {
    setIsLoggedIn(false);
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("token");
    localStorage.removeItem("userId");
    localStorage.removeItem("userData");
    localStorage.removeItem("userProfile");
    localStorage.removeItem("pendingOrderId");
    localStorage.setItem("cartCount", "0");
    
    // Trigger events to update other components
    window.dispatchEvent(new Event("loginStatusChanged"));
    window.dispatchEvent(new Event("cartCountUpdated"));
  };

  return (
    <header className="relative h-screen overflow-hidden">
      {/* Video Background */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute top-0 left-0 w-full h-full object-cover"
      >
        <source src="/videos/Football.mp4" type="video/mp4" />
      </video>

      {/* Centered Text */}
      <div className="relative z-20 flex flex-col items-center justify-center text-center text-[#f8f7f4] h-full px-4">
        <h1 className="text-5xl  font-bold mb-4">
          Nền tảng đặt sân & mua sắm thể thao hàng đầu Việt Nam
        </h1>
        <p className="text-lg md:text-xl mb-6">
          Đặt sân nhanh, mua đồ chất, đốt cháy đam mê bóng đá ngay hôm nay!
        </p>
        <button
          onClick={() => {
            const navHeight = 72; // chiều cao navigation sticky (px)
            const gallery = document.getElementById("gallery");
            if (gallery) {
              const y =
                gallery.getBoundingClientRect().top +
                window.pageYOffset -
                navHeight -
                24; // cách ra 24px
              window.scrollTo({ top: y, behavior: "smooth" });
            }
          }}
          className="bg-[#a45d08] text-white font-medium py-2 px-4 rounded-full shadow-lg hover:bg-[#f09627] hover:text-[#5c3613] hover:scale-105 hover:shadow-[0_0_15px_rgba(240,150,39,0.5)] transition-all duration-300"
        >
          Xem thêm
        </button>
      </div>

      {/* Navigation */}
      <div
        className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${
          isScrolled ? "bg-[#f8f7f4] shadow-md" : "bg-transparent"
        }`}
      >
        <div className="max-w-screen-xl flex flex-wrap items-center justify-between mx-auto p-2">
          {/* Logo */}
          <a
            href="/"
            className="flex items-center space-x-3 rtl:space-x-reverse -ml-16"
          >
            <img
              src="/images/B&B.png"
              className="h-12 md:h-16 lg:h-20"
              alt="Logo"
            />
          </a>
          <div className="flex items-center md:order-2 space-x-3 rtl:space-x-reverse">
            {isLoggedIn ? (
              <>
                <Link href="/profile">
                  <button
                    className={`border-2 ${
                      isScrolled
                        ? "border-[#5c3613] text-[#5c3613]"
                        : "border-transparent text-[#f8f7f4] bg-[#f09627]"
                    } font-medium py-2 px-4 rounded-full shadow-lg hover:bg-[#a45d08] hover:scale-105 hover:text-[#f8f7f4] hover:shadow-[0_0_15px_rgba(240,150,39,0.5)] transition-all duration-300`}
                  >
                    Hồ sơ
                  </button>
                </Link>
                <button
                  onClick={handleLogout}
                  className={`border-2 ${
                    isScrolled
                      ? "border-[#5c3613] text-[#5c3613]"
                      : "border-transparent text-[#f8f7f4] bg-[#f09627]"
                  } font-medium py-2 px-4 rounded-full shadow-lg hover:bg-[#a45d08] hover:scale-105 hover:text-[#f8f7f4] hover:shadow-[0_0_15px_rgba(240,150,39,0.5)] transition-all duration-300`}
                >
                  Đăng xuất
                </button>
              </>
            ) : (
              <>
                <Link href="/register">
                  <button
                    className={`border-2 ${
                      isScrolled
                        ? "border-[#5c3613] text-[#5c3613] hover:text-[#f8f7f4]"
                        : "border-transparent text-[#f8f7f4] bg-[#f09627] hover:text-[#5c3613]"
                    } font-medium py-2 px-4 rounded-full shadow-lg hover:bg-[#f1c43e] hover:scale-105 hover:shadow-[0_0_15px_rgba(240,150,39,0.5)] transition-all duration-300`}
                  >
                    Đăng ký
                  </button>
                </Link>
                <Link href="/login">
                  <button className="bg-[#a45d08] text-white font-medium py-2 px-4 rounded-full shadow-lg hover:bg-[#f09627] hover:text-[#5c3613] hover:scale-105 hover:shadow-[0_0_15px_rgba(240,150,39,0.5)] transition-all duration-300">
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
            <ul className="flex flex-col font-medium p-4 md:p-0 mt-4 border border-gray-100 rounded-lg bg-gray-50/50 md:space-x-8 rtl:space-x-reverse md:flex-row md:mt-0 md:border-0 md:bg-transparent">
              {/* Dropdown */}
              <li className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className={`flex items-center space-x-2 p-4 rounded-sm bg-transparent ${
                    isScrolled ? "text-[#5c3613]" : "text-[#f8f7f4]"
                  } hover:bg-gray-50/30  transition-all duration-300`}
                >
                  <img
                    src="/images/FlagVN.png"
                    alt="Vietnam Flag"
                    className="h-5 auto"
                  />
                  <span>Vi🔻</span>
                </button>
                {dropdownOpen && (
                  <ul className="absolute left-0 mt-2 w-40 bg-white border border-gray-100 rounded-lg shadow-lg ">
                    <li>
                      <a
                        href="/option1"
                        className="block px-4 py-2 text-sm text-gray-950 hover:bg-gray-100"
                      >
                        Tiếng Việt
                      </a>
                    </li>
                    <li>
                      <a
                        href="/option2"
                        className="block px-4 py-2 text-sm text-gray-950 hover:bg-gray-100"
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
                  className={`block p-4 bg-transparent relative ${
                    isScrolled
                      ? "text-[#f09627] after:content-[''] after:absolute after:bottom-0 after:h-0.5 after:bg-[#f09627] after:transition-all after:duration-300 after:w-full after:left-0"
                      : "text-[#f8f7f4] hover:bg-gray-50/30 transition-all duration-200"
                  }`}
                >
                  Trang chủ
                </Link>
              </li>
              <li>
                <Link
                  href="/booking"
                  className={`block p-4 bg-transparent relative ${
                    isScrolled
                      ? "text-[#5c3613] after:content-[''] after:absolute after:bottom-0 after:left-1/2 after:w-0 after:h-0.5 after:bg-[#5c3613] after:transition-all after:duration-300 hover:after:w-full hover:after:left-0"
                      : "text-[#f8f7f4] hover:bg-gray-50/30 transition-all duration-200"
                  }`}
                >
                  Đặt sân
                </Link>
              </li>
              <li>
                <Link
                  href="/products"
                  className={`block p-4 bg-transparent relative ${
                    isScrolled
                      ? "text-[#5c3613] after:content-[''] after:absolute after:bottom-0 after:left-1/2 after:w-0 after:h-0.5 after:bg-[#5c3613] after:transition-all after:duration-300 hover:after:w-full hover:after:left-0"
                      : "text-[#f8f7f4] hover:bg-gray-50/30 transition-all duration-200"
                  }`}
                >
                  Sản phẩm
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className={`block p-4 bg-transparent relative ${
                    isScrolled
                      ? "text-[#5c3613] after:content-[''] after:absolute after:bottom-0 after:left-1/2 after:w-0 after:h-0.5 after:bg-[#5c3613] after:transition-all after:duration-300 hover:after:w-full hover:after:left-0"
                      : "text-[#f8f7f4] hover:bg-gray-50/30 transition-all duration-200"
                  }`}
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
