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
    "UX/ UI design",
    "Web design",
    "Design system",
    "Graphic design",
    "Other",
  ];

  return (
    <div className="min-h-screen bg-[#c9730a] flex items-center justify-center py-8 px-2">
      <div className="w-full max-w-6xl flex flex-col md:flex-row gap-8">
        {/* Left */}
        <div className="flex-1 flex flex-col justify-center text-white px-4">
          <h1 className="text-4xl md:text-5xl font-bold mb-8 leading-tight">
            Đặt sân – Mua sắm – Trải nghiệm
            <span className="text-[#f1c43e]"> tuyệt vời</span>
            <br />
            cùng chúng tôi.
          </h1>
          <div className="flex items-center mb-4 text-[#f1c43e]">
            <span className="inline-block w-6 h-6 bg-[#f1c43e] rounded mr-3"></span>
            <span className="text-white text-lg">andreaDesign@gmail.com</span>
          </div>
          <div className="flex items-center mb-4 text-[#f1c43e]">
            <span className="inline-block w-6 h-6 bg-[#f1c43e] rounded mr-3"></span>
            <span className="text-white text-lg">+34 123 456 789</span>
          </div>
          <div className="flex items-center mb-8 text-[#f1c43e]">
            <span className="inline-block w-6 h-6 bg-[#f1c43e] rounded mr-3"></span>
            <span className="text-white text-lg">123 Street 487 House</span>
          </div>
          <div className="flex space-x-6 mt-4 text-[#f1c43e] text-2xl">
            <a href="#">
              <span className="inline-block w-6 h-6 bg-[#f1c43e] rounded"></span>
            </a>
            <a href="#">
              <span className="inline-block w-6 h-6 bg-[#f1c43e] rounded"></span>
            </a>
            <a href="#">
              <span className="inline-block w-6 h-6 bg-[#f1c43e] rounded"></span>
            </a>
          </div>
        </div>
        {/* Right */}
        <div className="flex-1 bg-white rounded-2xl shadow-lg p-8 max-w-xl mx-auto">
          <div className="mb-4 font-semibold text-[#5c3613]">
            I'm interested in:
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
                Your name
              </label>
              <input
                type="text"
                className="w-full border-0 border-b-2 border-[#f1c43e] focus:ring-0 focus:border-[#f1c43e] text-[#0d3d4b] placeholder-gray-400 py-2"
                placeholder="Enter your name..."
              />
            </div>
            <div>
              <input
                type="email"
                className="w-full border-0 border-b border-gray-300 focus:ring-0 focus:border-[#2ec4b6] text-[#0d3d4b] placeholder-gray-400 py-2"
                placeholder="email@gmail.com"
              />
            </div>
            <div>
              <textarea
                className="w-full border border-gray-300 rounded-lg focus:ring-0 focus:border-[#2ec4b6] text-[#0d3d4b] placeholder-gray-400 py-2 px-3 min-h-[90px]"
                placeholder="Your message"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-[#5c3613] text-white rounded-full py-3 text-lg font-semibold mt-2 hover:bg-[#f1c43e] transition"
            >
              Send message
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
