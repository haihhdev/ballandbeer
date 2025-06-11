"use client";
import { motion } from "framer-motion";

export default function AboutUs3() {
  return (
    <motion.section
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8 }}
      className="bg-[#fff] py-12 px-4"
    >
      <div className="max-w-5xl mx-auto">
        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <h2 className="text-5xl  font-bold text-[#5c3613] text-center mb-2">
            Khách Hàng Nói Gì Về B&B?
          </h2>
          <p className="text-xl text-gray-600 text-center mb-10">
            Từ siêu sao sân cỏ đến sinh viên và nghệ sĩ – ai cũng chọn B&B để
            thỏa đam mê bóng đá.
          </p>
        </motion.div>
        {/* Testimonials */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          {/* Card 1 */}
          <div className="bg-[#f8f7f4] rounded-xl shadow-md p-6 flex flex-col h-full">
            <div className="text-gray-800 italic mb-6">
              “Mình thường xuyên đặt sân cho anh em chơi và cũng hay mua áo đấu,
              giày bóng đá trên Ballandbeer. Giao hàng nhanh, hàng đẹp, sân thì
              đặt phát là có liền, không phải gọi điện linh tinh. Một nền tảng
              tiện lợi, đúng với người bận rộn như mình.”
            </div>
            <div className="flex items-center mt-auto">
              <img
                src="/images/j97.jpg"
                alt="Jack-J97"
                className="w-12 h-12 rounded-full mr-4 object-cover"
              />
              <div>
                <div className="font-bold text-[#5c3613]">Jack-J97</div>
                <div className="text-gray-400 text-sm">
                  Ca sĩ liêm, kiêm khách hàng thân thiết của B&B
                </div>
              </div>
            </div>
          </div>
          {/* Card 2 */}
          <div className="bg-[#f8f7f4] rounded-xl shadow-md p-6 flex flex-col h-full">
            <div className="text-gray-800 italic mb-6">
              “Lịch trình của tôi rất bận rộn, nhưng với Ballandbeer, việc đặt
              sân trở nên cực kỳ nhanh chóng và dễ dàng. Giao diện đơn giản, sân
              chất lượng, tôi có thể tập luyện mỗi khi rảnh rỗi mà không cần gọi
              điện hay chờ đợi. Một nền tảng xứng đáng với đẳng cấp chuyên
              nghiệp!”
            </div>
            <div className="flex items-center mt-auto">
              {/* Icon */}
              <img
                src="/images/cr7.jpeg"
                alt="Cristiano Ronaldo"
                className="w-12 h-12 rounded-full mr-4 object-cover"
              />
              <div>
                <div className="font-bold text-[#5c3613]">
                  Cristiano Ronaldo
                </div>
                <div className="text-gray-400 text-sm">
                  Cầu thủ chuyên nghiệp & người yêu trải nghiệm hoàn hảo
                </div>
              </div>
            </div>
          </div>
          {/* Card 3 */}
          <div className="bg-[#f8f7f4] rounded-xl shadow-md p-6 flex flex-col h-full">
            <div className="text-gray-800 italic mb-6">
              “Là sinh viên, mình thường chơi bóng sau giờ học để giải tỏa
              stress. Trước đây tìm sân rất mệt, nhưng từ khi biết đến
              Ballandbeer, mình chỉ cần vài click là có sân, thanh toán online
              luôn. Giá cả minh bạch, sân uy tín, rất phù hợp với sinh viên tụi
              mình!”
            </div>
            <div className="flex items-center mt-auto">
              <img
                src="/images/khach.jpg"
                alt="Khách hàng"
                className="w-12 h-12 rounded-full mr-4 object-cover"
              />
              <div>
                <div className="font-bold text-[#5c3613]">Chu Đức Hải</div>
                <div className="text-gray-400 text-sm">
                  Sinh viên Trường Đại học Công nghệ Thông tin – ĐHQG TP.HCM
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.section>
  );
}
