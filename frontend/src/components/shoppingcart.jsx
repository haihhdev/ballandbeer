"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation"; // Import useRouter
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function ShoppingCart() {
  const [cartItems, setCartItems] = useState([]);
  const router = useRouter(); // Khởi tạo router

  useEffect(() => {
    const fetchCart = async () => {
      const userToken = localStorage.getItem("token");
      if (!userToken) return;

      // Lấy tất cả order của user
      const ordersRes = await fetch("/api/orders/my-orders", {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      const ordersData = await ordersRes.json();
      const pendingOrder = ordersData.data.find(
        (order) => order.status === "pending"
      );

      if (!pendingOrder) {
        setCartItems([]);
        localStorage.removeItem("pendingOrderId");
        localStorage.setItem("cartCount", "0");
        window.dispatchEvent(new Event("cartCountUpdated"));
        return;
      }
      localStorage.setItem("pendingOrderId", pendingOrder._id); // Lưu orderId vào localStorage

      // Lấy toàn bộ sản phẩm để map productId sang thông tin chi tiết
      const productsRes = await fetch("/api/products");
      const productsData = await productsRes.json();

      // Check if pending order has products
      if (!pendingOrder.products || pendingOrder.products.length === 0) {
        setCartItems([]);
        localStorage.setItem("cartCount", "0");
        window.dispatchEvent(new Event("cartCountUpdated"));
        return;
      }

      // Map productId sang thông tin sản phẩm
      const cartWithDetails = pendingOrder.products.map((item) => {
        const product = productsData.find((p) => p._id === item.productId);
        return {
          id: item.productId,
          name: product?.name || "Không tìm thấy",
          price: product?.price || 0,
          image: product?.image
            ? `https://raw.githubusercontent.com/haihhdev/ballandbeer-image/refs/heads/main/Ballandbeeritem/${product.image}`
            : "/images/missing.png",
          quantity: item.quantity,
        };
      });

      setCartItems(cartWithDetails);
      localStorage.setItem("cartCount", cartWithDetails.length.toString());
      window.dispatchEvent(new Event("cartCountUpdated"));
    };

    fetchCart();
  }, []);

  // Lưu orderId pending để dùng khi xóa sản phẩm
  const [pendingOrderId, setPendingOrderId] = useState(null);
  useEffect(() => {
    const userToken = localStorage.getItem("token");
    if (!userToken) return;
    fetch("/api/orders/my-orders", {
      headers: { Authorization: `Bearer ${userToken}` },
    })
      .then((res) => res.json())
      .then((ordersData) => {
        const pendingOrder = ordersData.data.find(
          (order) => order.status === "pending"
        );
        if (pendingOrder) {
          setPendingOrderId(pendingOrder._id);
          localStorage.setItem("pendingOrderId", pendingOrder._id); // Lưu orderId vào localStorage
        }
      });
  }, []);

  const handleRemoveItem = async (id) => {
    // Xóa sản phẩm khỏi order pending trên server
    const userToken = localStorage.getItem("token");
    if (!userToken || !pendingOrderId) return;
    // Lấy lại order pending
    const ordersRes = await fetch("/api/orders/my-orders", {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const ordersData = await ordersRes.json();
    const pendingOrder = ordersData.data.find(
      (order) => order.status === "pending"
    );
    if (!pendingOrder) return;
    const updatedProducts = pendingOrder.products.filter(
      (item) => item.productId !== id
    );
    await fetch(`/api/orders/${pendingOrderId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({ products: updatedProducts, status: "pending" }),
    });
    // Cập nhật lại cartItems
    if (updatedProducts.length === 0) {
      setCartItems([]);
      localStorage.setItem("cartCount", "0");
      window.dispatchEvent(new Event("cartCountUpdated"));
      return;
    }

    const productsRes = await fetch("/api/products");
    const productsData = await productsRes.json();
    const cartWithDetails = updatedProducts.map((item) => {
      const product = productsData.find((p) => p._id === item.productId);
      return {
        id: item.productId,
        name: product?.name || "Không tìm thấy",
        price: product?.price || 0,
        image: product?.image
          ? `https://raw.githubusercontent.com/haihhdev/ballandbeer-image/refs/heads/main/Ballandbeeritem/${product.image}`
          : "/images/missing.png",
        quantity: item.quantity,
      };
    });
    setCartItems(cartWithDetails);
    localStorage.setItem("cartCount", cartWithDetails.length.toString());
    window.dispatchEvent(new Event("cartCountUpdated"));
  };

  const handleCheckout = () => {
    if (cartItems.length === 0) {
      toast.warning("Giỏ hàng trống!", {
        position: "top-right",
        autoClose: 2000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      return;
    }
    // Lưu toàn bộ cartItems vào localStorage
    localStorage.setItem(
      "pendingOrder",
      JSON.stringify({
        items: cartItems,
        totalPrice: cartItems.reduce(
          (total, item) => total + item.price * item.quantity,
          0
        ),
        date: new Date().toLocaleString(),
      })
    );
    router.push("/checkout");
  };

  return (
    <div className="p-2 sm:p-4 md:p-6 bg-[#fff] mb-16 sm:mb-20 md:mb-[30vh]">
      <ToastContainer />
      <div className="bg-white shadow-md rounded-lg p-3 sm:p-4 md:p-6 border border-[#f09627]">
        {/* Desktop/Tablet Table View - Hidden on mobile */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-[#5c3613]">
            <thead>
              <tr className="border-b border-[#f09627]">
                <th className="py-2 text-sm lg:text-base">Sản Phẩm</th>
                <th className="py-2 text-sm lg:text-base">Đơn Giá</th>
                <th className="py-2 text-sm lg:text-base">Số Lượng</th>
                <th className="py-2 text-sm lg:text-base">Số Tiền</th>
                <th className="py-2 text-sm lg:text-base">Thao Tác</th>
              </tr>
            </thead>
            <tbody>
              {cartItems.map((item) => (
                <tr key={item.id} className="border-b border-[#f09627]">
                  <td className="py-4 flex items-center">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-12 h-12 lg:w-16 lg:h-16 object-cover rounded-md mr-3 lg:mr-4"
                    />
                    <div>
                      <p className="font-bold text-sm lg:text-base">
                        {item.name}
                      </p>
                    </div>
                  </td>
                  <td className="py-4 text-sm lg:text-base">
                    {item.price.toLocaleString()}₫
                  </td>
                  <td className="py-4 text-sm lg:text-base">{item.quantity}</td>
                  <td className="py-4 text-red-500 font-bold text-sm lg:text-base">
                    {(item.price * item.quantity).toLocaleString()}₫
                  </td>
                  <td className="py-4">
                    <button
                      onClick={() => handleRemoveItem(item.id)}
                      className="text-red-500 hover:underline items-center text-sm lg:text-base"
                    >
                      Xóa
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View - Visible only on mobile */}
        <div className="block md:hidden space-y-4">
          {cartItems.map((item) => (
            <div
              key={item.id}
              className="border border-[#f09627] rounded-lg p-3 bg-white shadow-sm"
            >
              <div className="flex items-start gap-3 mb-3">
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-20 h-20 object-cover rounded-md flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[#5c3613] text-sm mb-2 line-clamp-2">
                    {item.name}
                  </p>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Đơn giá:</span>
                      <span className="text-[#5c3613] font-semibold">
                        {item.price.toLocaleString()}₫
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Số lượng:</span>
                      <span className="text-[#5c3613] font-semibold">
                        {item.quantity}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Tổng:</span>
                      <span className="text-red-500 font-bold">
                        {(item.price * item.quantity).toLocaleString()}₫
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleRemoveItem(item.id)}
                className="w-full text-red-500 hover:bg-red-50 py-2 rounded-md text-sm font-medium transition-colors duration-200"
              >
                Xóa sản phẩm
              </button>
            </div>
          ))}
        </div>

        {/* Summary and Checkout Section */}
        <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="w-full sm:w-auto">
            <p className="text-gray-600 text-sm sm:text-base">
              Tổng cộng ({cartItems.length} Sản phẩm):{" "}
              <span className="text-red-500 font-bold text-base sm:text-lg block sm:inline mt-1 sm:mt-0">
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
            onClick={handleCheckout}
            className="w-full sm:w-auto text-[#f8f7f4] bg-[#f09627] hover:text-[#5c3613] hover:bg-[#f1c43e] hover:scale-105 hover:shadow-[0_0_15px_rgba(240,150,39,0.5)] transition-all duration-300 px-6 py-3 sm:py-2 rounded-md text-base sm:text-base font-semibold"
          >
            Mua Hàng
          </button>
        </div>
      </div>
    </div>
  );
}
