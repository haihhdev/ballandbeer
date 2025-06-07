import Link from "next/link";

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
              <Link href="#" className="hover:underline">
                Trang chủ
              </Link>
            </li>
            <li>
              <Link href="#" className="hover:underline">
                Đặt sân
              </Link>
            </li>
            <li>
              <Link href="#" className="hover:underline">
                Sản phẩm
              </Link>
            </li>
            <li>
              <Link href="#" className="hover:underline">
                Liên hệ
              </Link>
            </li>
          </ul>
        </div>
        {/* Dukungan */}
        <div>
          <div className="font-bold text-[#ffd600] mb-2">Support</div>
          <ul className="space-y-1 text-white/90">
            <li>
              <Link href="#" className="hover:underline">
                Hỗ trợ
              </Link>
            </li>
            <li>
              <Link href="#" className="hover:underline">
                Câu hỏi thường gặp
              </Link>
            </li>
            <li>
              <Link href="#" className="hover:underline">
                Chính sách bảo mật
              </Link>
            </li>
            <li>
              <Link href="#" className="hover:underline">
                Điều khoản & điều kiện
              </Link>
            </li>
          </ul>
        </div>
        {/* Destinasi Populer */}
        <div>
          <div className="font-bold text-[#ffd600] mb-2">Liên hệ</div>
          <ul className="space-y-1 text-white/90">
            <li>
              <Link href="#" className="hover:underline">
                Địa chỉ: 123 Đường Nguyễn Tất Thành, P. Bến Nghé, Q.1, TP.HCM
              </Link>
            </li>
            <li>
              <Link href="#" className="hover:underline">
                Số điện thoại: 0909090909
              </Link>
            </li>
            <li>
              <Link href="#" className="hover:underline">
                Email: ballandbeer@gmail.com
              </Link>
            </li>
            <li>
              Fanpage:{" "}
              <Link href="https://www.facebook.com/ballandbeer" className="hover:underline" target="_blank" rel="noopener noreferrer">
                Ball & Beer
              </Link>
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
