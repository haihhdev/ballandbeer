"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Kiểm tra nếu người dùng đã đăng nhập
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      router.push("/"); // Chuyển hướng đến trang chính nếu đã đăng nhập
    }
  }, [router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("http://localhost:4000/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || "Đăng nhập thất bại. Vui lòng thử lại."
        );
      }

      const data = await response.json();
      console.log("Login API response:", data);
      if (data.data && data.data._id) {
        localStorage.setItem("userId", data.data._id);
        console.log("userId saved to localStorage:", data.data._id);
        // Lưu thông tin user cho navigation
        localStorage.setItem(
          "userProfile",
          JSON.stringify({
            avatar: data.data.avatar || "",
            email: data.data.email || "",
            username: data.data.username || "",
          })
        );
      } else {
        console.log("userId not found in API response");
      }

      // Lưu token và trạng thái đăng nhập vào localStorage
      localStorage.setItem("token", data.token);
      localStorage.setItem("isLoggedIn", "true");

      // Chuyển hướng đến trang chính
      router.push("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="bg-[url(/images/beerbg.jpg)] bg-center bg-blend-darken bg-black/30 bg-no-repeat bg-cover pt-8 dark:bg-gray-900">
      <div className="py-8 px-8 mx-auto max-w-screen-xl lg:py-16 grid lg:grid-cols-2 gap-4 lg:gap-8">
        {/* Right Section */}
        <div>
          <div className="w-full lg:max-w-xl p-8 space-y-8 sm:p-8 bg-white/20 rounded-lg backdrop-blur-[2px] shadow-xl/30 xl:ml-32 xl:mb-24">
            <h2 className="text-2xl text-center font-bold text-[#f09627] dark:text-white">
              Đăng nhập tài khoản
            </h2>
            <div className="flex justify-center">
              <button
                type="submit"
                className="w-full px-5 py-3 font-medium text-[#000] bg-[#f8f7f4] hover:text-[#5c3613] hover:bg-[#f1c43e] hover:scale-105 hover:shadow-[0_0_15px_rgba(240,150,39,0.5)] transition-all duration-200 rounded-md flex items-center justify-center gap-2"
              >
                <img src="/icons/google.svg" alt="google" className="h-5 w-5" />
                <span>Đăng nhập với Google</span>
              </button>
            </div>
            <h2 className="text-xl text-center font-bold text-[#f09627] dark:text-white">
              hoặc
            </h2>
            <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
              {error && (
                <div className="text-red-500 text-sm font-medium">{error}</div>
              )}
              <div>
                <input
                  type="text"
                  name="username"
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="bg-transparent border-b-2 border-b-[#fde290] text-white text-sm block w-full p-2.5 focus:outline-none focus:border-[#f1c43e]"
                  placeholder="Tên đăng nhập"
                  required
                />
              </div>
              <div>
                <input
                  type="password"
                  name="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-transparent border-b-2 border-b-[#fde290] text-white text-sm block w-full p-2.5 focus:outline-none focus:border-[#f1c43e]"
                  placeholder="Mật khẩu"
                  required
                />
              </div>
              <div className="flex items-start">
                <a
                  href="#"
                  className="ms-auto text-sm font-medium hover:text-[#f1c43e] text-[#f09627] hover:underline"
                >
                  Quên mật khẩu?
                </a>
              </div>
              <button
                type="submit"
                className="w-full px-4 py-2 text-base font-medium text-center text-[#f8f7f4] bg-[#f09627] hover:text-[#5c3613] hover:bg-[#f1c43e] hover:scale-105  hover:shadow-[0_0_15px_rgba(240,150,39,0.5)] transition-all duration-300 rounded "
                disabled={loading}
              >
                {loading ? "Đang xử lý..." : "Đăng nhập"}
              </button>
              <div className="text-sm font-medium text-gray-50 dark:text-white">
                Chưa đăng kí?{" "}
                <a
                  href="/register"
                  onClick={(e) => {
                    e.preventDefault();
                    router.push("/register");
                  }}
                  className="text-[#f09627] hover:text-[#f1c43e] hover:underline dark:text-blue-500"
                >
                  Tạo tài khoản
                </a>
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
