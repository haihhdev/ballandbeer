"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation"; // Import useRouter

export default function ShoppingCart() {
  const [cartItems, setCartItems] = useState([]);
  const router = useRouter(); // Khởi tạo router

  useEffect(() => {
    const fetchCart = async () => {
      const userToken = localStorage.getItem("token");
      if (!userToken) return;

      // Lấy tất cả order của user
      const ordersRes = await fetch("http://localhost:4002/api/orders/my-orders", {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      const ordersData = await ordersRes.json();
      const pendingOrder = ordersData.data.find(order => order.status === "pending");

      if (!pendingOrder) {
        setCartItems([]);
        return;
      }

      // Lấy toàn bộ sản phẩm để map productId sang thông tin chi tiết
      const productsRes = await fetch("http://localhost:4003/api/products");
      const productsData = await productsRes.json();

      // Map productId sang thông tin sản phẩm
      const cartWithDetails = pendingOrder.products.map(item => {
        const product = productsData.find(p => p._id === item.productId);
        return {
          id: item.productId,
          name: product?.name || "Không tìm thấy",
          price: product?.price || 0,
          image: product?.image || "/images/default.jpg",
          quantity: item.quantity,
        };
      });

      setCartItems(cartWithDetails);
    };

    fetchCart();
  }, []);

  // Lưu orderId pending để dùng khi xóa sản phẩm
  const [pendingOrderId, setPendingOrderId] = useState(null);
  useEffect(() => {
    const userToken = localStorage.getItem("token");
    if (!userToken) return;
    fetch("http://localhost:4002/api/orders/my-orders", {
      headers: { Authorization: `Bearer ${userToken}` },
    })
      .then(res => res.json())
      .then(ordersData => {
        const pendingOrder = ordersData.data.find(order => order.status === "pending");
        if (pendingOrder) setPendingOrderId(pendingOrder._id);
      });
  }, []);

  const handleRemoveItem = async (id) => {
    // Xóa sản phẩm khỏi order pending trên server
    const userToken = localStorage.getItem("token");
    if (!userToken || !pendingOrderId) return;
    // Lấy lại order pending
    const ordersRes = await fetch("http://localhost:4002/api/orders/my-orders", {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const ordersData = await ordersRes.json();
    const pendingOrder = ordersData.data.find(order => order.status === "pending");
    if (!pendingOrder) return;
    const updatedProducts = pendingOrder.products.filter(item => item.productId !== id);
    await fetch(`http://localhost:4002/api/orders/${pendingOrderId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({ products: updatedProducts, status: "pending" })
    });
    // Cập nhật lại cartItems
    const productsRes = await fetch("http://localhost:4003/api/products");
    const productsData = await productsRes.json();
    const cartWithDetails = updatedProducts.map(item => {
      const product = productsData.find(p => p._id === item.productId);
      return {
        id: item.productId,
        name: product?.name || "Không tìm thấy",
        price: product?.price || 0,
        image: product?.image || "/images/default.jpg",
        quantity: item.quantity,
      };
    });
    setCartItems(cartWithDetails);
  };

  const handleCheckout = () => {
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
