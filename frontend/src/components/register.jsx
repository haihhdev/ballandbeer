"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function Register() {
  const [form, setForm] = useState({
    email: "",
    username: "",
    password: "",
    confirmPassword: "",
    terms: false,
  });
  const router = useRouter();

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      toast.error("Mật khẩu không khớp!");
      return;
    }
    if (!form.terms) {
      toast.error("Bạn phải đồng ý điều khoản!");
      return;
    }
    try {
      const res = await fetch("http://localhost:4000/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          username: form.username,
        }),
      });
      const data = await res.json();
      if (data.message === "User registered successfully") {
        toast.success("Đăng ký thành công!");
        setTimeout(() => {
          router.push("/login");
        }, 1500);
      } else {
        toast.error(data.message || "Đăng ký thất bại!");
      }
    } catch (err) {
      image.png;
      toast.error("Có lỗi xảy ra!");
    }
  };

  return (
    <section className="bg-[url(/images/beerbg.jpg)] bg-center bg-blend-darken bg-black/30 bg-no-repeat bg-cover pt-8 dark:bg-gray-900">
      <div className="flex items-center justify-center min-h-screen px-8 py-8 mx-auto xl:-ml-[50vh]">
        <div className="w-full lg:max-w-xl p-8 space-y-8 sm:p-8 bg-white/20 rounded-lg backdrop-blur-[2px] shadow-xl/30 mb-24">
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-[#f09627]  dark:text-white text-center">
            Tạo tài khoản
          </h1>
          <form className="space-y-4 md:space-y-6" onSubmit={handleSubmit}>
            <div>
              <input
                type="email"
                name="email"
                id="email"
                className="bg-transparent border-b-2 border-b-[#fde290] text-white text-sm block w-full p-2.5 focus:outline-none focus:border-[#f1c43e]"
                placeholder="Email"
                required
                value={form.email}
                onChange={handleChange}
              />
            </div>
            <div>
              <input
                type="text"
                name="username"
                id="username"
                className="bg-transparent border-b-2 border-b-[#fde290] text-white text-sm block w-full p-2.5 focus:outline-none focus:border-[#f1c43e]"
                placeholder="Tên đăng nhập"
                required
                value={form.username}
                onChange={handleChange}
              />
            </div>
            <div>
              <input
                type="password"
                name="password"
                id="password"
                className="bg-transparent border-b-2 border-b-[#fde290] text-white text-sm block w-full p-2.5 focus:outline-none focus:border-[#f1c43e]"
                placeholder="Mật khẩu"
                required
                value={form.password}
                onChange={handleChange}
              />
            </div>
            <div>
              <input
                type="password"
                name="confirmPassword"
                id="confirm-password"
                className="bg-transparent border-b-2 border-b-[#fde290] text-white text-sm block w-full p-2.5 focus:outline-none focus:border-[#f1c43e]"
                placeholder="Nhập lại mật khẩu"
                required
                value={form.confirmPassword}
                onChange={handleChange}
              />
            </div>
            <div className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  id="terms"
                  name="terms"
                  aria-describedby="terms"
                  type="checkbox"
                  className="w-4 h-4 bg-transparent border-b-green-200 accent-green-300"
                  required
                  checked={form.terms}
                  onChange={handleChange}
                />
              </div>
              <div className="ml-3 text-sm">
                <label
                  htmlFor="terms"
                  className="font-light text-gray-500 font-bold text-white/80"
                >
                  Tôi đồng ý{" "}
                  <a
                    className="font-medium text-[#f09627] hover:text-[#f1c43e] hover:underline"
                    href="#"
                  >
                    Điều khoản và điều kiện
                  </a>
                </label>
              </div>
            </div>
            <div className="flex justify-center">
              <button
                type="submit"
                className="w-full text-base font-medium text-center text-[#f8f7f4] bg-[#f09627] hover:text-[#5c3613] hover:bg-[#f1c43e] hover:scale-105  hover:shadow-[0_0_15px_rgba(240,150,39,0.5)] transition-all duration-300 py-2 px-4 rounded-md focus:ring-4 focus:ring-blue-300 "
              >
                Tạo tài khoản
              </button>
            </div>
            <p className="text-sm font-light text-gray-50 dark:text-white">
              Đã có tài khoản?{" "}
              <a
                href="/login"
                onClick={(e) => {
                  e.preventDefault();
                  router.push("/login");
                }}
                className="text-[#f09627] hover:text-[#f1c43e] hover:underline dark:text-blue-500"
              >
                Đăng nhập tại đây
              </a>
            </p>
          </form>
          <ToastContainer position="top-center" autoClose={2000} />
        </div>
      </div>
    </section>
  );
}
