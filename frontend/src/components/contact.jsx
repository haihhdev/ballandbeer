"use client";
import { useState } from "react";

export default function Contact() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    comment: "",
    agree: false,
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Form submitted:", formData);
  };

  return (
    <div className="flex flex-wrap md:flex-row gap-8 p-8 justify-evenly mb-[30vh]">
      {/* Left Section */}
      <div>
        <h2 className="text-4xl font-bold mb-4 ">Liên hệ với chúng tôi</h2>
        <div className="mb-4 flex items-center">
          <img
            src="/images/address.png"
            alt="Phone Icon"
            className="w-auto h-6 mr-2"
          />
          <div>
            <p className="font-semibold">Địa chỉ</p>
            <p>403, Port Washington Road, Canada.</p>
          </div>
        </div>

        <div className="mb-4 flex items-center">
          <img
            src="/images/phone.jpg"
            alt="Phone Icon"
            className="w-auto h-6 mr-2"
          />
          <div>
            <p className="font-semibold">Chi tiết liên hệ</p>
            <p>+1 800-525-54-589</p>
          </div>
        </div>
        <div className="mb-4 flex items-center">
          <img
            src="/images/mail.jpg"
            alt="Phone Icon"
            className="w-auto h-6 mr-2"
          />
          <div>
            <p className="font-semibold">Email</p>
            <p>info@wdesignkit.com</p>
          </div>
        </div>
        <div>
          <div className="flex gap-4 mt-2">
            <p className="font-semibold">Theo dõi chúng tôi:</p>
            <a href="#" aria-label="Facebook">
              <img src="/images/fb.svg" alt="Facebook" className="w-6 h-6" />
            </a>
            <a href="#" aria-label="Instagram">
              <img src="/images/ig.svg" alt="Instagram" className="w-6 h-6" />
            </a>
            <a href="#" aria-label="Linkedin">
              <img src="/images/in.png" alt="Linkedin" className="w-6 h-6" />
            </a>
          </div>
        </div>
      </div>

      {/* Right Section */}
      <div className="flex-1 bg-gray-100 p-6 rounded-lg shadow-md max-w-1/3">
        <h3 className="text-xl font-semibold mb-4 ">
          Để lại thông tin của bạn.
        </h3>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="text"
            name="name"
            placeholder="Tên của bạn"
            value={formData.name}
            onChange={handleChange}
            className="p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            type="email"
            name="email"
            placeholder="Địa chỉ email"
            value={formData.email}
            onChange={handleChange}
            className="p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <textarea
            name="comment"
            placeholder="Bình luận"
            value={formData.comment}
            onChange={handleChange}
            rows="4"
            className="p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              name="agree"
              checked={formData.agree}
              onChange={handleChange}
              className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
            />
            <label className="text-sm">
              Bạn đồng ý với{" "}
              <a href="#" className="text-indigo-600 underline">
                chính sách bảo mật
              </a>{" "}
              của chúng tôi.
            </label>
          </div>
          <button
            type="submit"
            className="bg-gradient-to-r from-green-400 to-lime-400 py-3 px-6 rounded-md hover:from-green-500 hover:to-lime-500 transition"
          >
            Gửi tin nhắn →
          </button>
        </form>
      </div>
    </div>
  );
}
