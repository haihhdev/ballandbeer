"use client";

export default function Register() {
  return (
    <section className="bg-[url(/images/logbg.jpg)] bg-center bg-blend-darken bg-black/30 bg-no-repeat bg-cover pt-8 dark:bg-gray-900 mb-[30vh]">
      <div className="flex items-center justify-center min-h-screen px-6 py-8 mx-auto">
        <div className="w-full lg:max-w-xl p-8 space-y-8 sm:p-8 bg-white/20 rounded-lg backdrop-blur-[2px] shadow-xl/30">
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-gray-50/80 md:text-2xl dark:text-white text-center">
            ⚽Tạo tài khoản🍺
          </h1>
          <form className="space-y-4 md:space-y-6" action="#">
            <div>
              <input
                type="email"
                name="email"
                id="email"
                className="bg-transparent border-b-2 border-b-green-200 text-white text-sm block w-full p-2.5 focus:outline-none focus:border-green-300"
                placeholder="Email"
                required
              />
            </div>
            <div>
              <input
                type="text"
                name="username"
                id="username"
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
                className="bg-transparent border-b-2 border-b-green-200 text-white text-sm block w-full p-2.5 focus:outline-none focus:border-green-300"
                placeholder="Mật khẩu"
                required
              />
            </div>
            <div>
              <input
                type="password"
                name="confirm-password"
                id="confirm-password"
                className="bg-transparent border-b-2 border-b-green-200 text-white text-sm block w-full p-2.5 focus:outline-none focus:border-green-300"
                placeholder="Nhập lại mật khẩu"
                required
              />
            </div>
            <div className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  id="terms"
                  aria-describedby="terms"
                  type="checkbox"
                  className="w-4 h-4 bg-transparent border-b-green-200 accent-green-300"
                  required
                />
              </div>
              <div className="ml-3 text-sm">
                <label
                  htmlFor="terms"
                  className="font-light text-gray-500 font-bold text-white/80"
                >
                  Tôi đồng ý{" "}
                  <a
                    className="font-medium text-emerald-400 hover:text-lime-500 hover:underline"
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
                className="w-full px-[28vh] py-3 text-base font-medium text-center text-white bg-green-500 py-2 px-4 rounded-md hover:bg-green-700 focus:ring-4 focus:ring-blue-300 sm:w-auto"
              >
                Tạo tài khoản
              </button>
            </div>
            <p className="text-sm font-light text-gray-50 dark:text-white">
              Đã có tài khoản?{" "}
              <a
                href="#"
                className="text-emerald-400 hover:text-lime-500 hover:underline dark:text-blue-500"
              >
                Đăng nhập tại đây
              </a>
            </p>
          </form>
        </div>
      </div>
    </section>
  );
}
