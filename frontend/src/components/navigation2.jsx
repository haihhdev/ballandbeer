"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation"; // Import useRouter and usePathname
import Portal from "./Portal";

export default function Header() {
  const [dropdownOpen, setDropdownOpen] = useState(false); // For "Vi" dropdown
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false); // For profile dropdown
  const [isLoggedIn, setIsLoggedIn] = useState(false); // Track login status
  const [userProfile, setUserProfile] = useState({
    avatar: "",
    email: "",
    fullname: "",
  });
  const [isFetching, setIsFetching] = useState(false);
  const router = useRouter(); // Initialize router
  const pathname = usePathname();
  const [cartCount, setCartCount] = useState(0);

  // Check login status on component mount
  useEffect(() => {
    const loggedInStatus = localStorage.getItem("isLoggedIn");
    if (loggedInStatus === "true") {
      setIsLoggedIn(true);
      // Fetch user info ngay khi login thành công
      const userId = localStorage.getItem("userId");
      if (userId) {
        fetch(`http://localhost:4004/api/profile/id/${userId}`)
          .then((res) => res.json())
          .then((data) => {
            if (data && data.data) {
              setUserProfile({
                avatar: data.data.avatar || "",
                email: data.data.email || "",
                fullname: data.data.fullname || "",
              });
            }
          });
      }
    }
  }, []);

  // Fetch user info khi mở dropdown (nếu muốn luôn cập nhật mới)
  useEffect(() => {
    const fetchUserProfile = async () => {
      setIsFetching(true);
      try {
        const userId = localStorage.getItem("userId");
        if (!userId) return;
        const res = await fetch(
          `http://localhost:4004/api/profile/id/${userId}`
        );
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

  const handleLogout = () => {
    setIsLoggedIn(false); // Update state to reflect logout
    localStorage.removeItem("isLoggedIn"); // Remove login status
    localStorage.removeItem("token"); // Remove token if stored
    router.push("/"); // Redirect to the homepage
  };

  return (
    <header className="">
      {/* Navigation */}
      <div className="top-0 left-0 w-full bg-[#f8f7f4] drop-shadow-md z-50">
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
              <div className="relative flex items-center space-x-4 rtl:space-x-reverse z-[9999]">
                {/* Cart Button */}
                <Link href="/shoppingcart">
                  <button className="relative flex items-center object-cover justify-center w-12 h-12 rounded-full bg-gray-100 hover:bg-gray-200 shadow-md">
                    <img
                      src="/images/giohang.png"
                      alt="Cart"
                      className="w-8 h-6\8 object-cover"
                    />
                    {/* Optional: Badge for cart item count */}
                    <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-[#fff] text-xs font-bold rounded-full flex items-center justify-center">
                      {cartCount}
                    </span>
                  </button>
                </Link>
                {/* Profile Avatar */}
                <div
                  className="w-12 h-12 rounded-full overflow-hidden cursor-pointer border-2 border-gray-300 z-50"
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
                  <Portal>
                    <div className="fixed top-[5.5rem] right-30 w-64 bg-white rounded-lg shadow-lg z-[99999]">
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
                  </Portal>
                )}
              </div>
            ) : (
              <>
                <Link href="/register">
                  <button
                    className={`border-2 ${"border-transparent text-[#f8f7f4] bg-[#f09627] hover:text-[#5c3613]"} font-medium py-2 px-4 rounded-full shadow-lg hover:bg-[#f1c43e] hover:scale-105  hover:shadow-[0_0_15px_rgba(240,150,39,0.5)] transition-all duration-300`}
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
            <ul className="flex flex-col font-medium p-4 md:p-0 mt-4 border border-gray-100 rounded-lg bg-gray-50/50 md:space-x-8 rtl:space-x-reverse md:flex-row md:mt-0 md:border-0 md:bg-transparent dark:bg-gray-800/50 md:dark:bg-transparent dark:border-gray-700">
              {/* Language Dropdown */}
              <li className="relative">
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
    </header>
  );
}
