"use client";
import { useState } from "react";

export default function Contact() {
  const [selected, setSelected] = useState("UX/ UI design");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    message: "",
  });

  const tags = [
    "Công việc",
    "Hàng hoá",
    "Đặt chỗ",
    "Phản ánh thái độ nhân viên",
    "Cơ sở vật chất",
    "Thanh toán khi nhận hàng",
    "Khác",
  ];

  return (
    <div className="min-h-screen bg-[url('/images/contactbg.png')] bg-cover bg-center flex items-center justify-center py-8 px-2">
      <div className="w-full max-w-6xl flex flex-col md:flex-row gap-8">
        {/* Left */}
        <div className="flex-1 flex flex-col justify-center text-[#5c3613] px-4">
          <h1 className="text-4xl md:text-5xl font-bold mb-8 leading-tight">
            Đặt sân – Mua sắm – Trải nghiệm
            <span className="text-[#f1c43e]"> tuyệt vời</span>
            <br />
            cùng chúng tôi.
          </h1>
          <div className="flex items-center mb-4 text-[#f1c43e]">
            <img src="/icons/mail.svg" alt="email" className="w-6 h-6 mr-3" />
            <span className="text-[#5c3613] text-lg">
              ballandbeer@gmail.com
            </span>
          </div>
          <div className="flex items-center mb-4 text-[#f1c43e]">
            <img src="/icons/phone.svg" alt="phone" className="w-6 h-6 mr-3" />
            <span className="text-[#5c3613] text-lg">+84 909 090 909</span>
          </div>
          <div className="flex items-center mb-8 text-[#f1c43e]">
            <img
              src="/icons/address.svg"
              alt="address"
              className="w-6 h-6 mr-3"
            />
            <span className="text-[#5c3613] text-lg">
              Tòa nhà Bitexco, Hồ Chí Minh
            </span>
          </div>
          <div className="flex space-x-6 mt-4 text-[#f1c43e] text-2xl">
            <a href="#">
              <img
                src="/icons/facebook.svg"
                alt="facebook"
                className="w-8 h-8"
              />
            </a>
            <a href="#">
              <img src="/icons/github.svg" alt="github" className="w-8 h-8" />
            </a>
            <a href="#">
              <img src="/icons/youtube.svg" alt="youtube" className="w-8 h-8" />
            </a>
          </div>
        </div>
        {/* Right */}
        <div className="flex-1 bg-white rounded-2xl shadow-lg p-8 max-w-xl mx-auto">
          <div className="mb-4 font-semibold text-[#5c3613]">
            Tôi có quan tâm đến:
          </div>
          <div className="flex flex-wrap gap-3 mb-6">
            {tags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setSelected(tag)}
                className={`px-4 py-2 rounded-full border transition-all ${
                  selected === tag
                    ? "bg-[#f1c43e] text-white border-[#f1c43e]"
                    : "border-[#5c3613] text-[#5c3613] bg-white hover:bg-[#f1c43e]/30"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
          <form className="space-y-6">
            <div>
              <label className="block text-[#5c3613] font-semibold mb-1">
                Tên của bạn
              </label>
              <input
                type="text"
                className="w-full border-0 border-b-2 border-[#f1c43e] focus:ring-0 focus:border-[#f1c43e] text-[#0d3d4b] placeholder-gray-400 py-2"
                placeholder="Nhập tên của bạn..."
              />
            </div>
            <div>
              <input
                type="email"
                className="w-full border-0 border-b-2 border-[#f1c43e] focus:ring-0 focus:border-[#2ec4b6] text-[#0d3d4b] placeholder-gray-400 py-2"
                placeholder="Nhập email của bạn..."
              />
            </div>
            <div>
              <textarea
                className="w-full border border-gray-300 rounded-lg focus:ring-0 focus:border-[#2ec4b6] text-[#0d3d4b] placeholder-gray-400 py-2 px-3 min-h-[90px]"
                placeholder="Nhập tin nhắn của bạn..."
              />
            </div>
            <button
              type="submit"
              className="w-full bg-[#5c3613] text-white rounded-full py-3 text-lg font-semibold mt-2 hover:bg-[#f1c43e] transition"
            >
              Gửi tin nhắn
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
