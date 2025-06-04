export default function Footer() {
  return (
    <footer className="bg-black/90 border-t-2 border-gray-800 text-white pt-8 pb-4">
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 items-start px-4">
        {/* Logo & Description */}
        <div className="flex flex-col items-center md:items-start text-center md:text-left">
          <img
            src="/images/B&B.png"
            alt="Ball & Beer"
            className="w-24 h-24 mb-2 object-contain rounded"
          />
          <div className="text-sm text-white/90 mb-2 mt-2">
            Cùng bạn kết nối đam mê bóng đá – dễ dàng đặt sân.
            <br />
            <span className="font-semibold">Ball & Beer</span>
          </div>
        </div>
        {/* Perusahaan */}
        <div>
          <div className="font-bold text-[#ffd600] mb-2">Quick Links</div>
          <ul className="space-y-1 text-white/90">
            <li>
              <a href="#" className="hover:underline">
                Trang chủ
              </a>
            </li>
            <li>
              <a href="#" className="hover:underline">
                Đặt sân
              </a>
            </li>
            <li>
              <a href="#" className="hover:underline">
                Sản phẩm
              </a>
            </li>
            <li>
              <a href="#" className="hover:underline">
                Liên hệ
              </a>
            </li>
          </ul>
        </div>
        {/* Dukungan */}
        <div>
          <div className="font-bold text-[#ffd600] mb-2">Support</div>
          <ul className="space-y-1 text-white/90">
            <li>
              <a href="#" className="hover:underline">
                Hỗ trợ
              </a>
            </li>
            <li>
              <a href="#" className="hover:underline">
                Câu hỏi thường gặp
              </a>
            </li>
            <li>
              <a href="#" className="hover:underline">
                Chính sách bảo mật
              </a>
            </li>
            <li>
              <a href="#" className="hover:underline">
                Điều khoản & điều kiện
              </a>
            </li>
          </ul>
        </div>
        {/* Destinasi Populer */}
        <div>
          <div className="font-bold text-[#ffd600] mb-2">Liên hệ</div>
          <ul className="space-y-1 text-white/90">
            <li>
              <a href="#" className="hover:underline">
                Địa chỉ: 123 Đường Nguyễn Tất Thành, P. Bến Nghé, Q.1, TP.HCM
              </a>
            </li>
            <li>
              <a href="#" className="hover:underline">
                Số điện thoại: 0909090909
              </a>
            </li>
            <li>
              <a href="#" className="hover:underline">
                Email: ballandbeer@gmail.com
              </a>
            </li>
            <li>
              <a href="#" className="hover:underline">
                Fanpage:{" "}
                <a href="https://www.facebook.com/ballandbeer">Ball & Beer</a>
              </a>
            </li>
          </ul>
        </div>
      </div>
      {/* Bottom bar */}
      <div className="border-t border-white/20 mt-6 pt-3 flex flex-col md:flex-row items-center justify-between max-w-5xl mx-auto px-4">
        <div className="text-white/80 text-sm mb-2 md:mb-0">
          © 2025 Ball & Beer. All Rights Reserved.
        </div>
        <div className="flex space-x-2">
          <img src="/icons/visa.svg" alt="Visa" className="h-6" />
          <img src="/icons/mastercard.svg" alt="Mastercard" className="h-6" />
          <img src="/icons/paypal.svg" alt="Paypal" className="h-6" />
        </div>
      </div>
    </footer>
  );
}
