"use client";
import { useSearchParams, useRouter } from "next/navigation"; // Import useSearchParams and useRouter
import { useEffect, useState } from "react";

export default function Checkout() {
  const router = useRouter();
  const searchParams = useSearchParams(); // Lấy query parameters
  const name = searchParams.get("name");
  const price = searchParams.get("price");
  const image = `https://raw.githubusercontent.com/haihhdev/ballandbeer-image/refs/heads/main/Ballandbeeritem/${searchParams.get(
    "image"
  )}`;
  const quantity = searchParams.get("quantity"); // Lấy số lượng
  const totalPrice = searchParams.get("totalPrice"); // Lấy tổng tiền
  const [order, setOrder] = useState({ items: [], totalPrice: 0, date: "" });

  useEffect(() => {
    const pending = JSON.parse(localStorage.getItem("pendingOrder") || "{}");
    setOrder({
      items: pending.items || [],
      totalPrice: pending.totalPrice || 0,
      date: pending.date || "",
    });
  }, []);

  const handlePlaceOrder = () => {
    // Không lưu vào lịch sử ở đây nữa, chỉ chuyển sang paymentproduct
    router.push(`/paymentproduct?amount=${order.totalPrice}`);
  };

  return (
    <div className="p-4 bg-[#fff] mb-[30vh]">
      {/* Address Section */}
      <div className="bg-white p-4 rounded shadow mb-4 border border-[#f09627]">
        <div className="flex justify-between items-center">
          <div className="text-[#5c3613]">
            <h2 className="text-lg font-bold">Địa Chỉ Nhận Hàng</h2>
            <p className="text-sm">
              <span className="font-semibold">Hoàng Hải</span> (+84) 39218xxxx
            </p>
            <p className="text-sm">
              Công sau kí túc xá khu B ĐHQG, khu phố 6, Phường Linh Trung, Thành
              Phố Thủ Đức, TP. Hồ Chí Minh
            </p>
          </div>
          <button className="text-[#f8f7f4] bg-[#f09627] hover:text-[#5c3613] hover:bg-[#f1c43e] hover:scale-105  hover:shadow-[0_0_15px_rgba(240,150,39,0.5)] transition-all duration-200 py-2 px-4 rounded-md">
            Thay Đổi
          </button>
        </div>
      </div>

      {/* Product Section */}
      <div className="bg-white p-4 rounded shadow mb-4 border border-[#f09627]">
        <h2 className="text-lg font-bold mb-2 text-[#5c3613]">Sản phẩm</h2>
        {order.items.length === 0 ? (
          <p>Không có sản phẩm nào trong đơn hàng.</p>
        ) : (
          <div>
            {order.items.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center border-b-[#f09627] border-b pb-4 mb-4"
              >
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-20 h-full object-cover rounded mr-4"
                />
                <div className="flex justify-between items-center w-full text-[#5c3613]">
                  <div>
                    <p className="text-sm font-semibold">{item.name}</p>
                    <p className="text-sm text-gray-500">Loại: 1</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">Đơn giá</p>
                    <p className="text-sm">{item.price.toLocaleString()} ₫</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold">Số lượng</p>
                    <p className="text-sm">{item.quantity}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold">Thành tiền</p>
                    <p className="text-sm text-red-500">
                      {(item.price * item.quantity).toLocaleString()} ₫
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Total Section */}
      <div className="bg-white p-4 rounded shadow border border-[#f09627]">
        <div className="flex justify-between items-center">
          <p className="text-lg font-bold text-[#5c3613]">Tổng số tiền:</p>
          <p className="text-lg font-bold text-red-500">
            {order.totalPrice.toLocaleString()} ₫
          </p>
        </div>
        <button
          onClick={handlePlaceOrder}
          className="w-full text-[#f8f7f4] bg-[#f09627] hover:text-[#5c3613] hover:bg-[#f1c43e]  hover:shadow-[0_0_15px_rgba(240,150,39,0.5)] transition-all duration-200 py-2 mt-4 rounded font-semibold"
        >
          Đặt Hàng
        </button>
      </div>
    </div>
  );
}
