"use client";

export default function AboutUs() {
  return (
    <section className="bg-white py-12 px-6 text-black">
      <div className="max-w-screen-lg mx-auto flex flex-col items-center">
        {/* Title Section */}
        <h1 className="text-3xl md:text-6xl font-bold mb-4 text-center">
          Ball & Beer
        </h1>
        <p className="text-2xl md:text-2xl font-bold italic mb-4 text-center">
          “Uống càng say, đá càng bay!”
        </p>
        {/* Content Section */}
        <div className="flex flex-col md:flex-row items-center">
          {/* Left Section: Logo */}
          <div className="flex-shrink-0 mb-6 md:mb-0 md:mr-8">
            <img
              src="/images/B&BlogoMono.png" // Replace with the path to your logo
              alt="Ball & Beer Logo"
              className="h-100 w-auto"
            />
          </div>

          {/* Right Section: Text */}
          <div>
            <p className="text-xl text-gray-700 font-sans text-justify leading-relaxed">
              Chúng tôi mang đến một trải nghiệm trọn vẹn cho anh em đam mê thể
              thao: đặt sân nhanh chóng, mua sắm đồ đá bóng chất lượng và cùng
              nhau tận hưởng không khí bóng đá đỉnh cao bên những ly bia sảng
              khoái.
              <br />
              <br />
              Dù bạn cần một sân đấu để cháy hết mình hay muốn sắm ngay bộ giày,
              áo đấu chất lượng, Ball & Beer đều sẵn sàng phục vụ. Với hệ thống
              đặt sân tiện lợi, sản phẩm đa dạng, và cộng đồng đam mê bóng đá,
              chúng tôi giúp bạn tận hưởng môn thể thao vua theo cách trọn vẹn
              nhất.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
