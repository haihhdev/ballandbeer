"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation"; // Import useRouter and usePathname

export default function Header() {
  const [dropdownOpen, setDropdownOpen] = useState(false); // For "Vi" dropdown
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false); // For profile dropdown
  const [isLoggedIn, setIsLoggedIn] = useState(false); // Track login status
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userProfile, setUserProfile] = useState({
    avatar: "",
    email: "",
    fullname: "",
  });
  const [isFetching, setIsFetching] = useState(false);
  const router = useRouter(); // Initialize router
  const pathname = usePathname();
  const [cartCount, setCartCount] = useState(0);
  const profileDropdownRef = useRef(null);
  const languageDropdownRef = useRef(null);
  const mobileMenuRef = useRef(null);

  // Check login status on component mount and when login status changes
  useEffect(() => {
    const checkLoginStatus = () => {
      const loggedInStatus = localStorage.getItem("isLoggedIn");
      if (loggedInStatus === "true") {
        setIsLoggedIn(true);
        // Fetch user info
        const userId = localStorage.getItem("userId");
        if (userId) {
          fetch(`/api/profile/id/${userId}`)
            .then((res) => res.json())
            .then((data) => {
              if (data && data.data) {
                setUserProfile({
                  avatar: data.data.avatar || "",
                  email: data.data.email || "",
                  fullname: data.data.fullname || "",
                });
              }
            })
            .catch((err) => console.error("Error fetching user profile:", err));
        }
      } else {
        setIsLoggedIn(false);
      }
    };

    // Check on mount
    checkLoginStatus();

    // Listen for login status changes
    window.addEventListener("loginStatusChanged", checkLoginStatus);

    return () => {
      window.removeEventListener("loginStatusChanged", checkLoginStatus);
    };
  }, []);

  // Fetch user info khi mở dropdown (nếu muốn luôn cập nhật mới)
  useEffect(() => {
    const fetchUserProfile = async () => {
      setIsFetching(true);
      try {
        const userId = localStorage.getItem("userId");
        if (!userId) return;
        const res = await fetch(`/api/profile/id/${userId}`);
        const data = await res.json();
        if (data && data.data) {
          setUserProfile({
            avatar: data.data.avatar || "",
            email: data.data.email || "",
            fullname: data.data.fullname || "",
          });
        }
      } catch (err) {
        // Xử lý lỗi nếu cần
      } finally {
        setIsFetching(false);
      }
    };

    if (profileDropdownOpen && isLoggedIn) {
      fetchUserProfile();
    }
  }, [profileDropdownOpen, isLoggedIn]);

  useEffect(() => {
    const updateCartCount = () => {
      const count = parseInt(localStorage.getItem("cartCount")) || 0;
      setCartCount(count);
    };
    updateCartCount();
    window.addEventListener("storage", updateCartCount);
    window.addEventListener("cartCountUpdated", updateCartCount);
    return () => {
      window.removeEventListener("storage", updateCartCount);
      window.removeEventListener("cartCountUpdated", updateCartCount);
    };
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        profileDropdownRef.current &&
        !profileDropdownRef.current.contains(event.target)
      ) {
        setProfileDropdownOpen(false);
      }
    };

    if (profileDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [profileDropdownOpen]);

  // Close dropdown when scrolling
  useEffect(() => {
    const handleScroll = () => {
      if (profileDropdownOpen) {
        setProfileDropdownOpen(false);
      }
      if (dropdownOpen) {
        setDropdownOpen(false);
      }
    };

    if (profileDropdownOpen || dropdownOpen) {
      window.addEventListener("scroll", handleScroll);
    }

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [profileDropdownOpen, dropdownOpen]);

  // Close language dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        languageDropdownRef.current &&
        !languageDropdownRef.current.contains(event.target)
      ) {
        setDropdownOpen(false);
      }
    };

    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownOpen]);

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
    localStorage.setItem("cartCount", "0"); // Reset cart count

    // Trigger events to update other components
    window.dispatchEvent(new Event("loginStatusChanged"));
    window.dispatchEvent(new Event("cartCountUpdated"));

    setMobileMenuOpen(false);
    router.push("/");
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  return (
    <header className="">
      {/* Navigation */}
      <div className="top-0 left-0 w-full bg-[#f8f7f4] drop-shadow-md z-50">
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

          {/* Desktop Auth/Profile Section */}
          <div className="hidden md:flex items-center md:order-2 space-x-3 rtl:space-x-reverse">
            {isLoggedIn ? (
              <div
                ref={profileDropdownRef}
                className="relative flex items-center space-x-4 rtl:space-x-reverse z-[9999]"
              >
                {/* Cart Button */}
                <Link href="/shoppingcart">
                  <button className="relative flex items-center object-cover justify-center w-12 h-12 rounded-full bg-gray-100 hover:bg-gray-200 shadow-md transition-all">
                    <img
                      src="/images/giohang.png"
                      alt="Cart"
                      className="w-8 h-8 object-cover"
                    />
                    {/* Badge for cart item count */}
                    <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-[#fff] text-xs font-bold rounded-full flex items-center justify-center">
                      {cartCount}
                    </span>
                  </button>
                </Link>
                {/* Profile Avatar */}
                <div
                  className="w-12 h-12 rounded-full overflow-hidden cursor-pointer border-2 border-gray-300 z-50 hover:border-[#f09627] transition-all"
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                >
                  <img
                    src={userProfile.avatar || "/images/avt.png"}
                    alt="Profile Avatar"
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Profile Dropdown Menu */}
                {profileDropdownOpen && (
                  <div
                    className="absolute top-16 right-0 w-64 bg-white rounded-lg shadow-xl border border-gray-200 z-[99999]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="p-4 border-b border-gray-200">
                      <h3 className="text-sm font-semibold text-[#5c3613]">
                        {userProfile.fullname || "Họ và Tên"}
                      </h3>
                      <span className="text-xs text-[#5c3613]">
                        {userProfile.email || "j97@gmail.com"}
                      </span>
                    </div>
                    <ul className="py-2">
                      <li>
                        <a
                          href="/profile"
                          className="flex items-center px-4 py-2 text-sm text-[#5c3613] hover:bg-gray-100"
                        >
                          <img
                            src="/images/avt.svg"
                            alt="My Profile"
                            className="w-4 h-4 mr-2"
                          />
                          Tài khoản của tôi
                        </a>
                      </li>
                      <li>
                        <a
                          href="#"
                          className="flex items-center px-4 py-2 text-sm text-[#5c3613] hover:bg-gray-100"
                        >
                          <img
                            src="/images/setting.svg"
                            alt="Settings"
                            className="w-4 h-4 mr-2"
                          />
                          Cài đặt
                        </a>
                      </li>
                      <li>
                        <a
                          href="#"
                          className="flex items-center px-4 py-2 text-sm text-[#5c3613] hover:bg-gray-100"
                        >
                          <img
                            src="/images/help.svg"
                            alt="Help"
                            className="w-4 h-4 mr-2"
                          />
                          Trợ giúp
                        </a>
                      </li>
                      <li>
                        <button
                          onClick={handleLogout}
                          className="flex items-center px-4 py-2 text-sm text-red-800 hover:bg-gray-100 w-full text-left"
                        >
                          <img
                            src="/images/logout.svg"
                            alt="Logout"
                            className="w-4 h-4 mr-2"
                          />
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
                  <button className="border-2 border-transparent text-[#f8f7f4] bg-[#f09627] hover:text-[#5c3613] font-medium py-2 px-4 rounded-full shadow-lg hover:bg-[#f1c43e] hover:scale-105 hover:shadow-[0_0_15px_rgba(240,150,39,0.5)] transition-all duration-300">
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

          {/* Hamburger Menu Button (Mobile Only) */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="md:hidden flex flex-col gap-1.5 cursor-pointer z-50 p-2 rounded-lg hover:bg-[#f09627]/10 active:scale-95 transition-all duration-200 text-[#5c3613]"
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
              {/* Language Dropdown */}
              <li ref={languageDropdownRef} className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center space-x-2 p-4 rounded-sm bg-transparent md:text-[#5c3613] hover:bg-gray-50/30"
                >
                  <img
                    src="/images/FlagVN.png"
                    alt="Vietnam Flag"
                    className="h-5 auto"
                  />
                  <span>Vi🔻</span>
                </button>
                {dropdownOpen && (
                  <ul className="absolute left-0 mt-2 w-40 bg-white border border-gray-100 rounded-lg shadow-lg z-50">
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
                  className={`block p-4 bg-transparent relative text-[#5c3613] hover:text-[#f09627] after:content-[''] after:absolute after:bottom-0 after:h-0.5 after:bg-[#f09627] after:transition-all after:duration-300 ${
                    pathname === "/"
                      ? "after:w-full after:left-0 text-[#f09627] font-semibold"
                      : "after:w-0 after:left-1/2 hover:after:w-full hover:after:left-0"
                  }`}
                >
                  Trang chủ
                </Link>
              </li>
              <li>
                <Link
                  href="/booking"
                  className={`block p-4 bg-transparent relative text-[#5c3613] hover:text-[#f09627] after:content-[''] after:absolute after:bottom-0 after:h-0.5 after:bg-[#f09627] after:transition-all after:duration-300 ${
                    pathname === "/booking"
                      ? "after:w-full after:left-0 text-[#f09627] font-semibold"
                      : "after:w-0 after:left-1/2 hover:after:w-full hover:after:left-0"
                  }`}
                >
                  Đặt sân
                </Link>
              </li>
              <li>
                <Link
                  href="/products"
                  className={`block p-4 bg-transparent relative text-[#5c3613] hover:text-[#f09627] after:content-[''] after:absolute after:bottom-0 after:h-0.5 after:bg-[#f09627] after:transition-all after:duration-300 ${
                    pathname === "/products"
                      ? "after:w-full after:left-0 text-[#f09627] font-semibold"
                      : "after:w-0 after:left-1/2 hover:after:w-full hover:after:left-0"
                  }`}
                >
                  Sản phẩm
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className={`block p-4 bg-transparent relative text-[#5c3613] hover:text-[#f09627] after:content-[''] after:absolute after:bottom-0 after:h-0.5 after:bg-[#f09627] after:transition-all after:duration-300 ${
                    pathname === "/contact"
                      ? "after:w-full after:left-0 text-[#f09627] font-semibold"
                      : "after:w-0 after:left-1/2 hover:after:w-full hover:after:left-0"
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
              className={`flex items-center px-4 py-3.5 rounded-xl transition-all font-medium min-h-[52px] text-base active:scale-98 ${
                pathname === "/"
                  ? "bg-[#f09627]/10 text-[#f09627] font-semibold"
                  : "text-[#5c3613] hover:bg-[#f09627]/10 hover:text-[#f09627]"
              }`}
            >
              Trang chủ
            </Link>
            <Link
              href="/booking"
              onClick={closeMobileMenu}
              className={`flex items-center px-4 py-3.5 rounded-xl transition-all font-medium min-h-[52px] text-base active:scale-98 ${
                pathname === "/booking"
                  ? "bg-[#f09627]/10 text-[#f09627] font-semibold"
                  : "text-[#5c3613] hover:bg-[#f09627]/10 hover:text-[#f09627]"
              }`}
            >
              Đặt sân
            </Link>
            <Link
              href="/products"
              onClick={closeMobileMenu}
              className={`flex items-center px-4 py-3.5 rounded-xl transition-all font-medium min-h-[52px] text-base active:scale-98 ${
                pathname === "/products"
                  ? "bg-[#f09627]/10 text-[#f09627] font-semibold"
                  : "text-[#5c3613] hover:bg-[#f09627]/10 hover:text-[#f09627]"
              }`}
            >
              Sản phẩm
            </Link>
            <Link
              href="/contact"
              onClick={closeMobileMenu}
              className={`flex items-center px-4 py-3.5 rounded-xl transition-all font-medium min-h-[52px] text-base active:scale-98 ${
                pathname === "/contact"
                  ? "bg-[#f09627]/10 text-[#f09627] font-semibold"
                  : "text-[#5c3613] hover:bg-[#f09627]/10 hover:text-[#f09627]"
              }`}
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

          {/* Auth Buttons / Profile for Mobile */}
          <div className="space-y-4 border-t border-gray-200 pt-5">
            {isLoggedIn ? (
              <>
                {/* Cart Button for Mobile */}
                <Link href="/shoppingcart" onClick={closeMobileMenu}>
                  <button className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-gray-100 to-gray-50 text-[#5c3613] font-semibold py-3.5 px-4 rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all min-h-[52px] border-2 border-gray-200 my-2">
                    <img
                      src="/images/giohang.png"
                      alt="Cart"
                      className="w-6 h-6"
                    />
                    <span>Giỏ hàng ({cartCount})</span>
                  </button>
                </Link>

                {/* Profile Button for Mobile */}
                <Link href="/profile" onClick={closeMobileMenu}>
                  <button className="w-full bg-gradient-to-r from-[#f09627] to-[#f1c43e] text-white font-semibold py-3.5 px-4 rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all min-h-[52px] my-2">
                    Hồ sơ của tôi
                  </button>
                </Link>

                {/* Logout Button */}
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
