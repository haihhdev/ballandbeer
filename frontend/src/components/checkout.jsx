"use client";
import { useSearchParams } from "next/navigation"; // Import useSearchParams

export default function Checkout() {
  const searchParams = useSearchParams(); // Lấy query parameters
  const name = searchParams.get("name");
  const price = searchParams.get("price");
  const image = searchParams.get("image");
  const quantity = searchParams.get("quantity"); // Lấy số lượng
  const totalPrice = searchParams.get("totalPrice"); // Lấy tổng tiền

  return (
    <div className="p-4 bg-gray-100 mb-[35vh]">
      {/* Address Section */}
      <div className="bg-white p-4 rounded shadow mb-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold">Địa Chỉ Nhận Hàng</h2>
            <p className="text-sm">
              <span className="font-semibold">Hoàng Hải</span> (+84) 39218xxxx
            </p>
            <p className="text-sm">
              Công sau kí túc xá khu B ĐHQG, khu phố 6, Phường Linh Trung, Thành
              Phố Thủ Đức, TP. Hồ Chí Minh
            </p>
          </div>
          <button className="text-white bg-green-500 py-2 px-4 rounded-md hover:bg-green-700">
            Thay Đổi
          </button>
        </div>
      </div>

      {/* Product Section */}
      <div className="bg-white p-4 rounded shadow mb-4">
        <h2 className="text-lg font-bold mb-2">Sản phẩm</h2>
        <div className="flex items-center border-b pb-4 mb-4">
          <img
            src={image}
            alt={name}
            className="w-20 h-full object-cover rounded mr-4"
          />
          <div className="flex justify-between items-center w-full">
            <div>
              <p className="text-sm font-semibold">{name}</p>
              <p className="text-sm text-gray-500">Loại: 1</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold">Đơn giá</p>
              <p className="text-sm">{price} VND</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold">Số lượng</p>
              <p className="text-sm">{quantity}</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold">Thành tiền</p>
              <p className="text-sm">{totalPrice} VND</p>
            </div>
          </div>
        </div>
      </div>

      {/* Total Section */}
      <div className="bg-white p-4 rounded shadow">
        <div className="flex justify-between items-center">
          <p className="text-lg font-bold">Tổng số tiền:</p>
          <p className="text-lg font-bold text-red-500">{totalPrice} VND</p>
        </div>
        <button className="w-full bg-red-500 text-white py-2 mt-4 rounded font-semibold hover:bg-red-700">
          Đặt Hàng
        </button>
      </div>
    </div>
  );
}
