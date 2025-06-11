"use client";
import { motion } from "framer-motion";

export default function AboutUs() {
  return (
    <motion.section className="bg-[#f8f7f4] py-12 px-4 text-black -mt-[34vh] z-10 relative">
      <div className="max-w-6xl mx-auto">
        {/* Title Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <h2 className="text-5xl font-bold text-[#5c3613] text-center mb-2">
            Vì Sao Chọn Ball & Beer?
          </h2>
          <p className="text-gray-700 text-2xl text-center mb-8">
            Đặt sân dễ dàng, mua đồ thể thao nhanh chóng, dịch vụ tận tâm.
          </p>
        </motion.div>
        {/* Content Section */}
        <motion.div
          className="flex flex-col md:flex-row md:items-start md:space-x-10"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          {/* Left: Image */}
          <div className="md:w-1/2 w-full mb-6 md:mb-0 flex justify-center">
            <img
              src="/images/field.jpg"
              alt="Football Field"
              className="rounded-xl shadow-lg object-cover w-full max-w-md h-[75vh]"
            />
          </div>
          {/* Right: Reasons */}
          <div className="md:w-1/2 w-full flex flex-col space-y-6">
            {/* 1 */}
            <div className="flex items-start space-x-3">
              <img
                src="/icons/medal.svg"
                alt="medal"
                className="w-7 h-7 mt-1"
              />
              <div>
                <div className="font-bold text-[#5c3613] text-xl">
                  Sân Chuẩn Chất Lượng
                </div>
                <div className="text-gray-700 text-xl">
                  Các sân bóng trên hệ thống Ballandbeer đều đạt tiêu chuẩn với
                  mặt cỏ nhân tạo cao cấp, kích thước đúng chuẩn, và hệ thống
                  thoát nước tối ưu – sẵn sàng cho mọi trận cầu.
                </div>
              </div>
            </div>
            {/* 2 */}
            <div className="flex items-start space-x-3">
              <img
                src="/icons/shield.svg"
                alt="shield"
                className="w-7 h-7 mt-1"
              />
              <div>
                <div className="font-bold text-[#5c3613] text-xl">
                  An Toàn Là Trên Hết
                </div>
                <div className="text-gray-700 text-xl">
                  Chúng tôi hợp tác với các sân bóng được bảo trì định kỳ, đảm
                  bảo trì định kỳ, đảm bảo hệ thống chiếu sáng và môi trường thi
                  đấu an toàn cho người chơi.
                </div>
              </div>
            </div>
            {/* 3 */}
            <div className="flex items-start space-x-3">
              <img
                src="/icons/clock.svg"
                alt="clock"
                className="w-7 h-7 mt-1"
              />
              <div>
                <div className="font-bold text-[#5c3613] text-xl">
                  Đặt Sân Nhanh Chóng
                </div>
                <div className="text-gray-700 text-xl">
                  Trải nghiệm nền tảng đặt sân trực tuyến thông minh – xem lịch
                  trống theo thời gian thực, thanh toán linh hoạt và xác nhận
                  chỉ trong vài bước.
                </div>
              </div>
            </div>
            {/* 4 */}
            <div className="flex items-start space-x-3">
              <img
                src="/icons/headphone.svg"
                alt="clock"
                className="w-7 h-7 mt-1"
              />
              <div>
                <div className="font-bold text-[#5c3613] text-xl">
                  Hỗ Trợ 24/7
                </div>
                <div className="text-gray-700 text-xl">
                  Đội ngũ chăm sóc khách hàng luôn sẵn sàng hỗ trợ mọi thắc mắc
                  liên quan đến đặt sân, dịch vụ kèm theo hoặc nhu cầu đặc biệt
                  – bất kể thời gian nào.
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.section>
  );
}
