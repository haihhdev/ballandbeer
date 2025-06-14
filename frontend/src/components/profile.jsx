"use client";
import { useState, useEffect, useRef } from "react"; // Thêm useEffect và useRef
import Link from "next/link";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useSearchParams } from "next/navigation";

export default function Profile() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") || "accountDetails";
  const [activeTab, setActiveTab] = useState(initialTab);
  const [orderHistory, setOrderHistory] = useState([]); // State để lưu lịch sử đơn hàng
  const [bookingHistory, setBookingHistory] = useState([]); // Thêm state cho lịch sử đặt sân
  const [user, setUser] = useState({
    email: "",
    username: "",
    fullname: "",
    phone: "",
    facebook: "",
    address: "",
    avatar: "",
  });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const fileInputRef = useRef(null);

  // Add date formatting function
  const formatDate = (dateString) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "-";

    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");

    return `${day}/${month}/${year} ${hours}:${minutes}`;
  };

  // Thêm hàm fetch chi tiết sản phẩm
  const fetchProductDetail = async (productId) => {
    try {
      const res = await fetch(
        `http://localhost:4003/api/products/${productId}`
      );
      if (!res.ok) return null;
      const data = await res.json();
      return data;
    } catch (err) {
      return null;
    }
  };

  useEffect(() => {
    // Lấy userId từ localStorage (giả định đã lưu sau khi login)
    const userId = localStorage.getItem("userId");
    console.log("userId from localStorage:", userId);
    if (userId) {
      // Fetch user profile
      fetch(`http://localhost:4004/api/profile/id/${userId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data && data.data) {
            setUser({
              email: data.data.email || "",
              username: data.data.username || "",
              fullname: data.data.fullname || "",
              phone: data.data.phone || "",
              facebook: data.data.facebook || "",
              address: data.data.address || "",
              avatar: data.data.avatar || "",
            });
            // Lưu vào localStorage để navigation dùng
            localStorage.setItem(
              "userProfile",
              JSON.stringify({
                avatar: data.data.avatar || "",
                email: data.data.email || "",
                fullname: data.data.fullname || "",
              })
            );
          }
          setLoading(false);
        })
        .catch(() => setLoading(false));

      // Fetch orders from order service
      const token = localStorage.getItem("token");
      fetch("http://localhost:4002/api/orders/my-orders", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
        .then((res) => res.json())
        .then(async (data) => {
          let orders = [];
          if (data && data.data && Array.isArray(data.data)) {
            orders = data.data.filter(
              (order) =>
                order.status === "complete" || order.status === "completed"
            );
          }
          // Fetch chi tiết ảnh cho từng sản phẩm trong từng order
          const ordersWithImages = await Promise.all(
            orders.map(async (order) => {
              const productsWithImages = await Promise.all(
                order.products.map(async (item) => {
                  const productDetail = await fetchProductDetail(
                    item.productId || item.id
                  );
                  return {
                    ...item,
                    image: productDetail
                      ? `https://raw.githubusercontent.com/haihhdev/ballandbeer-image/refs/heads/main/Ballandbeeritem/${productDetail.image}`
                      : "/icons/no-image.png",
                    name: productDetail ? productDetail.name : item.name,
                  };
                })
              );
              return { ...order, products: productsWithImages };
            })
          );
          setOrderHistory(ordersWithImages);
        })
        .catch((error) => {
          console.error("Error fetching orders:", error);
          setOrderHistory([]);
        });
    } else {
      setLoading(false);
    }
  }, []);

  const handleClearHistory = () => {
    // Xóa lịch sử đơn hàng khỏi localStorage
    localStorage.removeItem("orderHistory");
    setOrderHistory([]); // Cập nhật state để làm mới giao diện
  };

  const handleClearBookingHistory = () => {
    localStorage.removeItem("bookingHistory");
    setBookingHistory([]);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setUser((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setMessage("");
    const userId = localStorage.getItem("userId");
    if (!userId) {
      toast.error("Không tìm thấy userId!");
      setMessage("Không tìm thấy userId!");
      return;
    }
    try {
      const res = await fetch(
        `http://localhost:4004/api/profile/id/${userId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(user),
        }
      );
      const data = await res.json();
      if (res.ok) {
        toast.success("Cập nhật thành công!");
        setMessage("Cập nhật thành công!");
        // Cập nhật lại localStorage
        localStorage.setItem(
          "userProfile",
          JSON.stringify({
            ...user,
            fullname: user.fullname || "",
          })
        );
      } else {
        toast.error(data.message || "Cập nhật thất bại!");
        setMessage(data.message || "Cập nhật thất bại!");
      }
    } catch (err) {
      toast.error("Có lỗi xảy ra!");
      setMessage("Có lỗi xảy ra!");
    }
  };

  // Xử lý upload avatar
  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Kiểm tra kích thước file (giới hạn 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Kích thước ảnh không được vượt quá 5MB!");
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          // Tạo canvas để resize ảnh
          const canvas = document.createElement("canvas");
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          let width = img.width;
          let height = img.height;

          // Tính toán kích thước mới giữ nguyên tỷ lệ
          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);

          // Chuyển đổi sang base64 với chất lượng 0.7 (70%)
          const resizedImage = canvas.toDataURL("image/jpeg", 0.7);
          setUser((prev) => ({ ...prev, avatar: resizedImage }));
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAvatarClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="flex flex-col md:flex-row bg-[url('/images/contactbg.png')] bg-cover bg-center bg-gray-100 min-h-screen p-6">
      <ToastContainer />
      {/* Sidebar */}
      <div className="w-full md:w-1/4 bg-white rounded-lg shadow-md p-4">
        <div className="flex flex-col items-center">
          <img
            src={user.avatar || "/icons/user.svg"}
            alt="Profile Avatar"
            className="w-24 h-24 object-cover rounded-full mb-4 cursor-pointer"
            onClick={handleAvatarClick}
          />
          <input
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            ref={fileInputRef}
            style={{ display: "none" }}
          />
          <h2 className="text-lg text-[#5c3613] font-semibold">
            {user.fullname || "Họ và Tên"}
          </h2>
        </div>
        <ul className="mt-6 space-y-4">
          <li>
            <button
              onClick={() => setActiveTab("history")}
              className={`flex items-center w-full px-4 py-2 text-sm font-medium rounded-lg ${
                activeTab === "history"
                  ? "bg-[#f1c43e] text-[#5c3613]"
                  : "text-gray-700 hover:bg-gray-200"
              }`}
            >
              <i className="fa fa-shopping-cart mr-2"></i> Lịch sử đơn hàng
            </button>
          </li>
          <li>
            <button
              onClick={() => setActiveTab("bookingHistory")}
              className={`flex items-center w-full px-4 py-2 text-sm font-medium rounded-lg ${
                activeTab === "bookingHistory"
                  ? "bg-[#f1c43e] text-[#5c3613]"
                  : "text-gray-700 hover:bg-gray-200"
              }`}
            >
              <i className="fa fa-calendar mr-2"></i> Lịch sử đặt sân
            </button>
          </li>
          <li>
            <button
              onClick={() => setActiveTab("accountDetails")}
              className={`flex items-center w-full px-4 py-2 text-sm font-medium rounded-lg ${
                activeTab === "accountDetails"
                  ? "bg-[#f1c43e] text-[#5c3613]"
                  : "text-gray-700 hover:bg-gray-200"
              }`}
            >
              <i className="fa fa-user mr-2"></i> Tài khoản
            </button>
          </li>
          <li>
            <button
              onClick={() => setActiveTab("changePassword")}
              className={`flex items-center w-full px-4 py-2 text-sm font-medium rounded-lg ${
                activeTab === "changePassword"
                  ? "bg-[#f1c43e] text-[#5c3613]"
                  : "text-gray-700 hover:bg-gray-200"
              }`}
            >
              <i className="fa fa-key mr-2"></i> Đổi mật khẩu
            </button>
          </li>
          <li>
            <Link href="/login">
              <button
                onClick={() => setActiveTab("logout")}
                className={`flex items-center w-full px-4 py-2 text-sm font-medium rounded-lg ${
                  activeTab === "logout"
                    ? "bg-[#f1c43e] text-[#5c3613]"
                    : "text-gray-700 hover:bg-gray-200"
                }`}
              >
                <i className="fa fa-sign-out mr-2"></i> Đăng xuất
              </button>
            </Link>
          </li>
        </ul>
      </div>

      {/* Content */}
      <div className="w-full md:w-3/4 bg-white rounded-lg shadow-md p-6 mt-6 md:mt-0 md:ml-6">
        {activeTab === "accountDetails" && (
          <div>
            <h2 className="text-xl text-[#5c3613] font-semibold mb-4">
              Tài khoản của tôi
            </h2>
            {loading ? (
              <p>Đang tải thông tin...</p>
            ) : (
              <form className="space-y-4" onSubmit={handleSave}>
                <div>
                  <label className="block text-sm font-medium text-[#5c3613]">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    className="w-full text-[#5c3613] mt-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    value={user.email}
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#5c3613]">
                    Tên đăng nhập
                  </label>
                  <input
                    type="text"
                    name="username"
                    className="w-full text-[#5c3613] mt-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-gray-100"
                    value={user.username}
                    disabled
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#5c3613]">
                    Họ Và Tên
                  </label>
                  <input
                    type="text"
                    name="fullname"
                    className="w-full text-[#5c3613] mt-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    value={user.fullname}
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#5c3613]">
                    Số điện thoại
                  </label>
                  <input
                    type="phone"
                    name="phone"
                    className="w-full text-[#5c3613] mt-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    value={user.phone}
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#5c3613]">
                    Facebook
                  </label>
                  <input
                    type="url"
                    name="facebook"
                    className="w-full text-[#5c3613] mt-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    value={user.facebook}
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#5c3613]">
                    Địa chỉ
                  </label>
                  <input
                    type="text"
                    name="address"
                    className="w-full text-[#5c3613] mt-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    value={user.address}
                    onChange={handleChange}
                  />
                </div>
                {/* Save Info Button */}
                <div className="flex justify-end ">
                  <button
                    type="submit"
                    className=" bg-[#f09627] hover:text-[#5c3613] hover:bg-[#f1c43e] hover:scale-105  hover:shadow-[0_0_15px_rgba(240,150,39,0.5)] transition-all duration-200 rounded py-2 px-8  text-[#5c3613] font-medium  shadow-md"
                  >
                    Lưu
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
        {activeTab === "history" && (
          <div>
            <h2 className="text-xl text-[#5c3613] font-semibold mb-4">
              Lịch sử đơn hàng
            </h2>
            {orderHistory.length === 0 ? (
              <p>Chưa có đơn hàng nào.</p>
            ) : (
              <div>
                <ul className="space-y-4">
                  {orderHistory.map((order, index) => (
                    <li
                      key={index}
                      className="border-b-2 border-[#5c3613] pb-4"
                    >
                      <div className="text-[#5c3613]">
                        <div className="mb-2">
                          <span className="font-semibold">Mã đơn hàng:</span>{" "}
                          {order._id}
                        </div>
                        <div className="mb-2">
                          <span className="font-semibold">Ngày đặt:</span>{" "}
                          {formatDate(order.createdAt)}
                        </div>
                        <div className="mb-2">
                          <span className="font-semibold">Trạng thái:</span>{" "}
                          {order.status === "complete"
                            ? "Đã thanh toán"
                            : order.status}
                        </div>
                        {order.products && Array.isArray(order.products) ? (
                          <div>
                            {order.products.map((item, idx) => (
                              <div key={idx} className="flex items-center mb-2">
                                <img
                                  src={item.image}
                                  alt={item.name}
                                  className="w-12 h-12 object-cover rounded mr-2"
                                />
                                <div>
                                  <p className="text-sm font-semibold">
                                    {item.name}
                                  </p>
                                  <p className="text-xs">
                                    Số lượng: {item.quantity}
                                  </p>
                                  <p className="text-xs">
                                    Đơn giá: {item.price.toLocaleString()} VND
                                  </p>
                                  <p className="text-xs text-red-500">
                                    Thành tiền:{" "}
                                    {(
                                      item.price * item.quantity
                                    ).toLocaleString()}{" "}
                                    VND
                                  </p>
                                </div>
                              </div>
                            ))}
                            <div className="font-bold text-right text-[#f09627]">
                              Tổng tiền: {order.totalAmount.toLocaleString()}{" "}
                              VND
                            </div>
                          </div>
                        ) : (
                          <p>Không có thông tin sản phẩm</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {activeTab === "bookingHistory" && (
          <div>
            <h2 className="text-xl text-[#5c3613] font-semibold mb-4">
              Lịch sử đặt sân
            </h2>
            {bookingHistory.length === 0 ? (
              <p>Chưa có lịch sử đặt sân nào.</p>
            ) : (
              <div>
                <ul className="space-y-4">
                  {bookingHistory.map((booking, index) => {
                    if (!booking || typeof booking !== "object") return null;
                    return (
                      <li
                        key={index}
                        className="border-b-2 border-[#5c3613] pb-4"
                      >
                        <div className="flex items-center text-[#5c3613]">
                          <img
                            src={booking.courtImage || "/images/san5.jpg"}
                            alt={booking.courtName || "Sân bóng"}
                            className="w-16 h-16 object-cover rounded mr-4"
                          />
                          <div>
                            <p className="text-sm font-semibold">
                              {booking.courtName || "Sân bóng"}
                            </p>
                            <p className="text-sm">
                              Ngày: {booking.date || "-"}
                            </p>
                            <p className="text-sm">
                              Khung giờ:{" "}
                              {Array.isArray(booking.times)
                                ? booking.times.join(", ")
                                : booking.time || "-"}
                            </p>
                            <p className="text-sm">
                              Tổng tiền:{" "}
                              {booking.price
                                ? booking.price.toLocaleString()
                                : typeof booking.totalPrice === "number"
                                ? booking.totalPrice.toLocaleString()
                                : "-"}{" "}
                              VND
                            </p>
                            <p className="text-sm text-gray-500">
                              Trạng thái: {booking.status || "Đã thanh toán"}
                            </p>
                            <p className="text-sm text-gray-500">
                              Ngày thanh toán: {booking.paymentDate || "-"}
                            </p>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <button
                  onClick={handleClearBookingHistory}
                  className="mt-4 bg-red-500 text-white py-2 px-4 rounded-md hover:bg-red-700"
                >
                  Xóa lịch sử đặt sân
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === "changePassword" && (
          <div>
            <h2 className="text-xl text-[#5c3613] font-semibold mb-4 ">
              Đổi mật khẩu
            </h2>
            <form className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#5c3613]">
                  Mật khẩu hiện tại
                </label>
                <input
                  type="password"
                  className="w-full mt-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  defaultValue="********"
                />
              </div>
              <div className=" gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#5c3613]">
                    Mật khẩu mới
                  </label>
                  <input
                    type="password"
                    className="w-full mt-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    defaultValue="********"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#5c3613]">
                  Xác nhận mật khẩu mới
                </label>
                <input
                  type="password"
                  className="w-full mt-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  defaultValue="********"
                />
              </div>

              {/* Save Info Button */}
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="text-[#f8f7f4] bg-[#f09627] hover:text-[#5c3613] hover:bg-[#f1c43e] hover:scale-105  hover:shadow-[0_0_15px_rgba(240,150,39,0.5)] transition-all duration-300 rounded py-2 px-8 font-medium  shadow-md"
                >
                  Lưu mật khẩu
                </button>
              </div>
            </form>
          </div>
        )}
        {activeTab === "logout" && <div></div>}
      </div>
    </div>
  );
}
