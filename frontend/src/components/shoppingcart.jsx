"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation"; // Import useRouter

export default function ShoppingCart() {
  const [cartItems, setCartItems] = useState([]);
  const router = useRouter(); // Khởi tạo router

  useEffect(() => {
    // Lấy giỏ hàng từ localStorage
    const cart = JSON.parse(localStorage.getItem("cart")) || [];
    setCartItems(cart);
  }, []);

  const handleRemoveItem = (id) => {
    const updatedCart = cartItems.filter((item) => item.id !== id);
    setCartItems(updatedCart);
    localStorage.setItem("cart", JSON.stringify(updatedCart)); // Cập nhật localStorage
  };

  const handleCheckout = () => {
    // Lưu thông tin giỏ hàng vào localStorage (hoặc có thể dùng context/api)
    localStorage.setItem("checkoutCart", JSON.stringify(cartItems));
    // Điều hướng tới trang Checkout
    router.push("/checkout");
  };

  return (
    <div className="p-4 bg-gray-100 mb-[50vh]">
      <h1 className="text-2xl font-bold mb-4">Giỏ Hàng</h1>
      <div className="bg-white shadow-md rounded-lg p-4">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b">
              <th className="py-2">Sản Phẩm</th>
              <th className="py-2">Đơn Giá</th>
              <th className="py-2">Số Lượng</th>
              <th className="py-2">Số Tiền</th>
              <th className="py-2">Thao Tác</th>
            </tr>
          </thead>
          <tbody>
            {cartItems.map((item) => (
              <tr key={item.id} className="border-b">
                <td className="py-4 flex items-center">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-16 h-16 object-cover rounded-md mr-4"
                  />
                  <div>
                    <p className="font-bold">{item.name}</p>
                  </div>
                </td>
                <td className="py-4">{item.price.toLocaleString()}₫</td>
                <td className="py-4">{item.quantity}</td>
                <td className="py-4 text-red-500 font-bold">
                  {(item.price * item.quantity).toLocaleString()}₫
                </td>
                <td className="py-4">
                  <button
                    onClick={() => handleRemoveItem(item.id)}
                    className="text-red-500 hover:underline items-center"
                  >
                    Xóa
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 flex justify-between items-center">
          <div>
            <p className="text-gray-500">
              Tổng cộng ({cartItems.length} Sản phẩm):{" "}
              <span className="text-red-500 font-bold">
                {cartItems
                  .reduce(
                    (total, item) => total + item.price * item.quantity,
                    0
                  )
                  .toLocaleString()}
                ₫
              </span>
            </p>
          </div>
          <button
            onClick={handleCheckout} // Gọi hàm handleCheckout
            className="bg-red-500 text-white px-6 py-2 rounded-md hover:bg-red-600"
          >
            Mua Hàng
          </button>
        </div>
      </div>
    </div>
  );
}
