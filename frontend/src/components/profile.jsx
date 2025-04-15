"use client";
import { useState } from "react";
import Link from "next/link";

export default function Profile() {
  const [activeTab, setActiveTab] = useState("accountDetails");

  return (
    <div className="flex flex-col md:flex-row bg-gray-100 min-h-screen p-6 mb-[30vh]">
      {/* Sidebar */}
      <div className="w-full md:w-1/4 bg-white rounded-lg shadow-md p-4">
        <div className="flex flex-col items-center">
          <img
            src="/images/j97.jpg"
            alt="Profile Avatar"
            className="w-24 h-24 object-cover rounded-full mb-4"
          />
          <h2 className="text-lg font-semibold">J97</h2>
        </div>
        <ul className="mt-6 space-y-4">
          <li>
            <button
              onClick={() => setActiveTab("history")}
              className={`flex items-center w-full px-4 py-2 text-sm font-medium rounded-lg ${
                activeTab === "history"
                  ? "bg-blue-800 text-white"
                  : "text-gray-700 hover:bg-gray-200"
              }`}
            >
              <i className="fa fa-home mr-2"></i> Lịch sử đơn hàng
            </button>
          </li>
          <li>
            <button
              onClick={() => setActiveTab("accountDetails")}
              className={`flex items-center w-full px-4 py-2 text-sm font-medium rounded-lg ${
                activeTab === "accountDetails"
                  ? "bg-blue-800 text-white"
                  : "text-gray-700 hover:bg-gray-200"
              }`}
            >
              <i className="fa fa-user mr-2"></i> Tài khoản
            </button>
          </li>
          <li>
            <button
              onClick={() => setActiveTab("changePassword")}
              className={`flex items-center w-full px-4 py-2 text-sm font-medium rounded-lg ${
                activeTab === "changePassword"
                  ? "bg-blue-800 text-white"
                  : "text-gray-700 hover:bg-gray-200"
              }`}
            >
              <i className="fa fa-key mr-2"></i> Đổi mật khẩu
            </button>
          </li>
          <li>
            <Link href="/login">
              <button
                onClick={() => setActiveTab("logout")}
                className={`flex items-center w-full px-4 py-2 text-sm font-medium rounded-lg ${
                  activeTab === "logout"
                    ? "bg-blue-800 text-white"
                    : "text-gray-700 hover:bg-gray-200"
                }`}
              >
                <i className="fa fa-sign-out mr-2"></i> Đăng xuất
              </button>
            </Link>
          </li>
        </ul>
      </div>

      {/* Content */}
      <div className="w-full md:w-3/4 bg-white rounded-lg shadow-md p-6 mt-6 md:mt-0 md:ml-6">
        {activeTab === "accountDetails" && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Tài khoản của tôi</h2>
            <form className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  type="email"
                  className="w-full mt-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  defaultValue="support@profilepress.net"
                />
              </div>
              <div className=" gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Họ Và Tên
                  </label>
                  <input
                    type="text"
                    className="w-full mt-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    defaultValue="John"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Số điện thoại
                </label>
                <input
                  type="phone"
                  className="w-full mt-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  defaultValue="0123 456 789"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Facebook
                </label>
                <input
                  type="url"
                  className="w-full mt-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  defaultValue="https://www.facebook.com/profilepress"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Địa chỉ
                </label>
                <input
                  type="address"
                  className="w-full mt-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  defaultValue="123 Main St, City, Country"
                />
              </div>
              {/* Save Info Button */}
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="bg-green-500 py-2 px-8 rounded-md hover:bg-green-700 text-white font-medium  shadow-md"
                >
                  Lưu
                </button>
              </div>
            </form>
          </div>
        )}
        {activeTab === "history" && (
          <div>
            <h2 className="text-xl font-semibold">Lịch sử đơn hàng</h2>
            <p>Welcome to your dashboard!</p>
          </div>
        )}
        {activeTab === "changePassword" && (
          <div>
            <h2 className="text-xl font-semibold mb-4 ">Đổi mật khẩu</h2>
            <form className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Mật khẩu hiện tại
                </label>
                <input
                  type="password"
                  className="w-full mt-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  defaultValue="********"
                />
              </div>
              <div className=" gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Mật khẩu mới
                  </label>
                  <input
                    type="password"
                    className="w-full mt-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    defaultValue="********"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Xác nhận mật khẩu mới
                </label>
                <input
                  type="password"
                  className="w-full mt-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  defaultValue="********"
                />
              </div>

              {/* Save Info Button */}
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="bg-green-500 py-2 px-4 rounded-md hover:bg-green-700 text-white font-medium  shadow-md"
                >
                  Lưu mật khẩu
                </button>
              </div>
            </form>
          </div>
        )}
        {activeTab === "logout" && <div></div>}
      </div>
    </div>
  );
}
