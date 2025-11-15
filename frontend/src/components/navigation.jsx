"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";

export default function Header() {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef(null);

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

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [mobileMenuOpen]);

  // Close mobile menu on ESC key
  useEffect(() => {
    const handleEscKey = (e) => {
      if (e.key === "Escape" && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleEscKey);
    return () => window.removeEventListener("keydown", handleEscKey);
  }, [mobileMenuOpen]);

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(e.target) &&
        mobileMenuOpen
      ) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [mobileMenuOpen]);

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
    setMobileMenuOpen(false);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
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
        <h1 className="text-3xl md:text-5xl font-bold mb-4">
          Nền tảng đặt sân & mua sắm thể thao hàng đầu Việt Nam
        </h1>
        <p className="text-base md:text-lg lg:text-xl mb-6">
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
          className="bg-[#a45d08] text-white font-medium py-2 px-3 md:py-2 md:px-4 rounded-full shadow-lg hover:bg-[#f09627] hover:text-[#5c3613] hover:scale-105 hover:shadow-[0_0_15px_rgba(240,150,39,0.5)] transition-all duration-300"
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
        <div className="max-w-screen-xl flex flex-wrap items-center justify-between mx-auto p-2 px-4 md:px-2">
          {/* Logo */}
          <a
            href="/"
            className="flex items-center space-x-3 rtl:space-x-reverse ml-2 md:-ml-16"
          >
            <img
              src="/images/B&B.png"
              className="h-12 md:h-16 lg:h-20"
              alt="Logo"
            />
          </a>

          {/* Desktop Auth Buttons */}
          <div className="hidden md:flex items-center md:order-2 space-x-3 rtl:space-x-reverse">
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

          {/* Hamburger Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className={`md:hidden flex flex-col gap-1.5 cursor-pointer z-50 p-2 rounded-lg hover:bg-white/10 active:scale-95 transition-all duration-200 ${
              isScrolled
                ? "text-[#5c3613] hover:bg-[#f09627]/10"
                : "text-[#f8f7f4]"
            }`}
            aria-label="Open menu"
          >
            <span className="w-7 h-0.5 bg-current transition-all duration-300"></span>
            <span className="w-7 h-0.5 bg-current transition-all duration-300"></span>
            <span className="w-7 h-0.5 bg-current transition-all duration-300"></span>
          </button>

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

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[60] md:hidden transition-opacity duration-300"
          onClick={closeMobileMenu}
        />
      )}

      {/* Mobile Menu Slide-in */}
      <div
        ref={mobileMenuRef}
        className={`fixed top-0 right-0 h-full w-80 max-w-[85vw] bg-white shadow-xl z-[70] transform transition-transform duration-300 ease-in-out ${
          mobileMenuOpen ? "translate-x-0" : "translate-x-full"
        } md:hidden overflow-y-auto`}
      >
        {/* Mobile Menu Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <img src="/images/B&B.png" className="h-12" alt="Logo" />
          <button
            onClick={closeMobileMenu}
            className="text-[#5c3613] hover:text-[#f09627] transition-colors"
            aria-label="Close menu"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Mobile Menu Content */}
        <div className="p-5">
          {/* Navigation Links */}
          <nav className="space-y-1 mb-6">
            <Link
              href="/"
              onClick={closeMobileMenu}
              className="flex items-center px-4 py-3.5 text-[#5c3613] hover:bg-[#f09627]/10 hover:text-[#f09627] rounded-xl transition-all font-medium min-h-[52px] text-base active:scale-98"
            >
              Trang chủ
            </Link>
            <Link
              href="/booking"
              onClick={closeMobileMenu}
              className="flex items-center px-4 py-3.5 text-[#5c3613] hover:bg-[#f09627]/10 hover:text-[#f09627] rounded-xl transition-all font-medium min-h-[52px] text-base active:scale-98"
            >
              Đặt sân
            </Link>
            <Link
              href="/products"
              onClick={closeMobileMenu}
              className="flex items-center px-4 py-3.5 text-[#5c3613] hover:bg-[#f09627]/10 hover:text-[#f09627] rounded-xl transition-all font-medium min-h-[52px] text-base active:scale-98"
            >
              Sản phẩm
            </Link>
            <Link
              href="/contact"
              onClick={closeMobileMenu}
              className="flex items-center px-4 py-3.5 text-[#5c3613] hover:bg-[#f09627]/10 hover:text-[#f09627] rounded-xl transition-all font-medium min-h-[52px] text-base active:scale-98"
            >
              Liên hệ
            </Link>
          </nav>

          {/* Language Selector */}
          <div className="mb-6 border-t border-gray-200 pt-5">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center justify-between w-full px-4 py-3.5 text-[#5c3613] hover:bg-gray-50 rounded-xl transition-all min-h-[52px] font-medium"
            >
              <div className="flex items-center space-x-3">
                <img
                  src="/images/FlagVN.png"
                  alt="Vietnam Flag"
                  className="h-6 w-auto"
                />
                <span>Tiếng Việt</span>
              </div>
              <svg
                className={`w-5 h-5 transition-transform duration-200 ${
                  dropdownOpen ? "rotate-180" : ""
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
            {dropdownOpen && (
              <div className="mt-2 ml-4 space-y-1 pl-4 border-l-2 border-[#f09627]/30">
                <a
                  href="/option1"
                  className="block px-4 py-3 text-sm text-[#5c3613] hover:bg-gray-100 rounded-lg transition-all"
                  onClick={closeMobileMenu}
                >
                  Tiếng Việt
                </a>
                <a
                  href="/option2"
                  className="block px-4 py-3 text-sm text-[#5c3613] hover:bg-gray-100 rounded-lg transition-all"
                  onClick={closeMobileMenu}
                >
                  English
                </a>
              </div>
            )}
          </div>

          {/* Auth Buttons / Profile */}
          <div className="space-y-10 border-t border-gray-200 pt-5">
            {isLoggedIn ? (
              <>
                <Link href="/profile" onClick={closeMobileMenu}>
                  <button className="w-full bg-gradient-to-r from-[#f09627] to-[#f1c43e] text-white font-semibold py-3.5 px-4 rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all min-h-[52px] my-2">
                    Hồ sơ của tôi
                  </button>
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full border-2 border-[#5c3613] text-[#5c3613] font-semibold py-3.5 px-4 rounded-xl shadow-lg hover:bg-[#5c3613] hover:text-white hover:scale-[1.02] active:scale-[0.98] transition-all min-h-[52px] my-2"
                >
                  Đăng xuất
                </button>
              </>
            ) : (
              <>
                <Link href="/register" onClick={closeMobileMenu}>
                  <button className="w-full bg-gradient-to-r from-[#f09627] to-[#f1c43e] text-white font-semibold py-3.5 px-4 rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all min-h-[52px] my-2">
                    Đăng ký
                  </button>
                </Link>
                <Link href="/login" onClick={closeMobileMenu}>
                  <button className="w-full bg-[#5c3613] text-white font-semibold py-3.5 px-4 rounded-xl shadow-lg hover:bg-[#a45d08] hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all min-h-[52px] my-2">
                    Đăng nhập
                  </button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
