export default function Footer() {
  return (
    <footer className="bg-black text-white py-8 -mt-[40vh] relative z-50">
      <div className="max-w-screen-lg mx-auto text-center">
        {/* Title */}
        <h1 className="text-2xl font-bold mb-4">Ball & Beer</h1>

        {/* Description */}
        <p className="text-gray-400 mb-6">
          Kết nối đam mê bóng đá và những phút giây thư giãn bên ly bia mát
          lạnh. Đặt sân dễ dàng, tận hưởng không gian sôi động cùng bạn bè!
        </p>

        {/* Social Media Icons */}
        <div className="flex justify-center space-x-4 mb-6">
          <a href="#" className="hover:opacity-80">
            <img
              src="/images/fb.jpg" // Replace with the correct path to your Facebook icon
              alt="Facebook"
              className="h-8 w-8 rounded-full"
            />
          </a>
          <a href="#" className="hover:opacity-80">
            <img
              src="/images/gg.png" // Replace with the correct path to your Google icon
              alt="Google"
              className="h-8 w-8 rounded-full"
            />
          </a>
          <a href="#" className="hover:opacity-80">
            <img
              src="/images/in.jpg" // Replace with the correct path to your LinkedIn icon
              alt="LinkedIn"
              className="h-8 w-8 rounded-full"
            />
          </a>
          <a href="#" className="text-gray-400 hover:text-white">
            <i className="fab fa-twitter"></i>
          </a>
          <a href="#" className="text-gray-400 hover:text-white">
            <i className="fab fa-youtube"></i>
          </a>
        </div>

        {/* Copyright and Links */}
        <div className="border-t border-gray-700 pt-4">
          <p className="text-gray-400 text-sm">
            Copyright ©2025{" "}
            <a href="#" className="text-blue-400 hover:underline">
              Ball&Beerdeveloper
            </a>
          </p>
          <div className="flex justify-center space-x-4 mt-2">
            <a href="#" className="text-gray-400 hover:text-white">
              Home
            </a>
            <a href="#" className="text-gray-400 hover:text-white">
              About
            </a>
            <a href="#" className="text-gray-400 hover:text-white">
              Contact
            </a>
            <a href="#" className="text-gray-400 hover:text-white">
              Blog
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
