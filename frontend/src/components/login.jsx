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
      const response = await fetch("/authen/api/auth/login", {
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
      console.log("Login successful:", data);

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
    <section className="bg-[url(/images/logbg.jpg)] bg-center bg-blend-darken bg-black/30 bg-no-repeat bg-cover pt-8 dark:bg-gray-900 mb-[30vh]">
      <div className="py-8 px-4 mx-auto max-w-screen-xl lg:py-16 grid lg:grid-cols-2 gap-8 lg:gap-16">
        {/* Left Section */}
        <div className="flex flex-col justify-center">
          <h1 className="mb-4 text-4xl font-mono font-bold tracking-tight leading-none text-yellow-400 md:text-5xl lg:text-6xl dark:text-white drop-shadow-[0_2px_50px_rgba(1,1,1,1)]">
            Chúng tôi đầu tư vào trải nghiệm thể thao của bạn
          </h1>
          <p className="mb-6 text-lg font-normal text-gray-50 lg:text-xl dark:text-gray-400">
            Tại Ball & Beer, chúng tôi tập trung vào việc kết nối cộng đồng yêu
            thể thao, mang đến giải pháp đặt sân nhanh chóng, tiện lợi và cung
            cấp những sản phẩm chất lượng, giúp nâng tầm trải nghiệm bóng đá của
            bạn mỗi ngày.
          </p>
        </div>

        {/* Right Section */}
        <div>
          <div className="w-full lg:max-w-xl p-8 space-y-8 sm:p-8 bg-white/20 rounded-lg backdrop-blur-[2px] shadow-xl/30">
            <h2 className="text-3xl font-bold text-white/80 dark:text-white">
              Đăng nhập tài khoản
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
                  className="bg-transparent border-b-2 border-b-green-200 text-white text-sm block w-full p-2.5 focus:outline-none focus:border-green-300"
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
                  className="bg-transparent border-b-2 border-b-green-200 text-white text-sm block w-full p-2.5 focus:outline-none focus:border-green-300"
                  placeholder="Mật khẩu"
                  required
                />
              </div>
              <div className="flex items-start">
                <a
                  href="#"
                  className="ms-auto text-sm font-medium hover:text-lime-500 text-emerald-400 hover:underline"
                >
                  Quên mật khẩu?
                </a>
              </div>
              <button
                type="submit"
                className="w-full px-5 py-3 text-base font-medium text-center text-white bg-green-500 py-2 px-4 rounded-md hover:bg-green-700 focus:ring-4 focus:ring-blue-300 sm:w-auto"
                disabled={loading}
              >
                {loading ? "Đang xử lý..." : "Đăng nhập"}
              </button>
              <div className="text-sm font-medium text-gray-50 dark:text-white">
                Chưa đăng kí?{" "}
                <a
                  href="#"
                  className="text-emerald-400 hover:text-lime-500 hover:underline dark:text-blue-500"
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
