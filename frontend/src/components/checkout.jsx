"use client";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function Checkout() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [order, setOrder] = useState({ items: [], totalPrice: 0, date: "" });

  // State cho địa chỉ
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [address, setAddress] = useState({
    fullname: "",
    phone: "",
    address: "",
  });
  const [tempAddress, setTempAddress] = useState({
    fullname: "",
    phone: "",
    address: "",
  });

  // Load order và user profile
  useEffect(() => {
    // Load order từ localStorage
    const pending = JSON.parse(localStorage.getItem("pendingOrder") || "{}");
    setOrder({
      items: pending.items || [],
      totalPrice: pending.totalPrice || 0,
      date: pending.date || "",
    });

    // Load địa chỉ từ user profile
    const userId = localStorage.getItem("userId");
    if (userId) {
      fetch(`/api/profile/id/${userId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data && data.data) {
            const userAddress = {
              fullname: data.data.fullname || "",
              phone: data.data.phone || "",
              address: data.data.address || "",
            };
            setAddress(userAddress);
            setTempAddress(userAddress);
          }
        })
        .catch((err) => console.error("Error loading profile:", err));
    }

    // Hoặc load từ localStorage nếu đã lưu trước đó
    const savedAddress = localStorage.getItem("checkoutAddress");
    if (savedAddress) {
      const parsed = JSON.parse(savedAddress);
      setAddress(parsed);
      setTempAddress(parsed);
    }
  }, []);

  const handleEditAddress = () => {
    setTempAddress({ ...address });
    setIsEditingAddress(true);
  };

  const handleSaveAddress = () => {
    // Validate họ tên
    if (!tempAddress.fullname.trim()) {
      toast.error("Vui lòng nhập họ tên người nhận");
      return;
    }
    if (tempAddress.fullname.trim().length < 2) {
      toast.error("Họ tên phải có ít nhất 2 ký tự");
      return;
    }
    if (tempAddress.fullname.trim().length > 100) {
      toast.error("Họ tên không được vượt quá 100 ký tự");
      return;
    }

    // Validate số điện thoại
    if (!tempAddress.phone.trim()) {
      toast.error("Vui lòng nhập số điện thoại");
      return;
    }
    const phoneRegex = /^[0-9]{10,11}$/;
    const cleanPhone = tempAddress.phone.replace(/\s/g, "");
    if (!phoneRegex.test(cleanPhone)) {
      toast.error("Số điện thoại không hợp lệ (phải có 10-11 chữ số)");
      return;
    }

    // Validate địa chỉ
    if (!tempAddress.address.trim()) {
      toast.error("Vui lòng nhập địa chỉ giao hàng");
      return;
    }
    if (tempAddress.address.trim().length < 10) {
      toast.error("Địa chỉ phải có ít nhất 10 ký tự");
      return;
    }
    if (tempAddress.address.trim().length > 500) {
      toast.error("Địa chỉ không được vượt quá 500 ký tự");
      return;
    }

    setAddress({ ...tempAddress });
    localStorage.setItem("checkoutAddress", JSON.stringify(tempAddress));
    setIsEditingAddress(false);
    toast.success("Đã lưu địa chỉ giao hàng");
  };

  const handleCancelEdit = () => {
    setTempAddress({ ...address });
    setIsEditingAddress(false);
  };

  const handlePlaceOrder = () => {
    if (!address.fullname || !address.phone || !address.address) {
      toast.error("Vui lòng nhập đầy đủ thông tin địa chỉ giao hàng");
      return;
    }
    router.push(`/paymentproduct?amount=${order.totalPrice}`);
  };

  return (
    <div className="p-4 bg-[#fff] mb-[30vh]">
      <ToastContainer />

      {/* Address Section */}
      <div className="bg-white p-4 rounded shadow mb-4 border border-[#f09627]">
        <div className="flex justify-between items-start">
          <div className="text-[#5c3613] flex-1">
            <h2 className="text-lg font-bold mb-2">📍 Địa Chỉ Nhận Hàng</h2>

            {!isEditingAddress ? (
              // Hiển thị địa chỉ
              <div>
                {address.fullname && address.phone ? (
                  <>
                    <p className="text-sm">
                      <span className="font-semibold">{address.fullname}</span>{" "}
                      <span className="text-gray-600">| {address.phone}</span>
                    </p>
                    <p className="text-sm mt-1">
                      {address.address || "Chưa có địa chỉ"}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-gray-500 italic">
                    Chưa có thông tin địa chỉ. Vui lòng thêm địa chỉ giao hàng.
                  </p>
                )}
              </div>
            ) : (
              // Form chỉnh sửa địa chỉ
              <div className="space-y-3 mt-2">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Họ và tên <span className="text-red-500">*</span>
                    <span className="text-gray-400 text-xs ml-2">
                      (2-100 ký tự)
                    </span>
                  </label>
                  <input
                    type="text"
                    value={tempAddress.fullname}
                    onChange={(e) =>
                      setTempAddress({
                        ...tempAddress,
                        fullname: e.target.value,
                      })
                    }
                    maxLength={100}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f09627] focus:border-[#f09627] outline-none"
                    placeholder="Ví dụ: Nguyễn Văn A"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Số điện thoại <span className="text-red-500">*</span>
                    <span className="text-gray-400 text-xs ml-2">
                      (10-11 số)
                    </span>
                  </label>
                  <input
                    type="tel"
                    value={tempAddress.phone}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9]/g, "");
                      setTempAddress({ ...tempAddress, phone: value });
                    }}
                    maxLength={11}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f09627] focus:border-[#f09627] outline-none"
                    placeholder="Ví dụ: 0912345678"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Địa chỉ chi tiết <span className="text-red-500">*</span>
                    <span className="text-gray-400 text-xs ml-2">
                      (tối thiểu 10 ký tự)
                    </span>
                  </label>
                  <textarea
                    value={tempAddress.address}
                    onChange={(e) =>
                      setTempAddress({
                        ...tempAddress,
                        address: e.target.value,
                      })
                    }
                    maxLength={500}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f09627] focus:border-[#f09627] outline-none resize-none"
                    placeholder="Ví dụ: 123 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP.HCM"
                  />
                  <div className="text-right text-xs text-gray-400 mt-1">
                    {tempAddress.address.length}/500 ký tự
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleSaveAddress}
                    className="bg-[#f09627] hover:bg-[#f1c43e] text-white hover:text-[#5c3613] px-4 py-2 rounded-lg font-medium transition-all duration-200"
                  >
                    Lưu địa chỉ
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium transition-all duration-200"
                  >
                    Hủy
                  </button>
                </div>
              </div>
            )}
          </div>

          {!isEditingAddress && (
            <button
              onClick={handleEditAddress}
              className="text-[#f8f7f4] bg-[#f09627] hover:text-[#5c3613] hover:bg-[#f1c43e] hover:scale-105 hover:shadow-[0_0_15px_rgba(240,150,39,0.5)] transition-all duration-200 py-2 px-4 rounded-md ml-4"
            >
              Thay Đổi
            </button>
          )}
        </div>
      </div>

      {/* Product Section */}
      <div className="bg-white p-4 rounded shadow mb-4 border border-[#f09627]">
        <h2 className="text-lg font-bold mb-2 text-[#5c3613]">🛒 Sản phẩm</h2>
        {order.items.length === 0 ? (
          <p className="text-gray-500">Không có sản phẩm nào trong đơn hàng.</p>
        ) : (
          <div>
            {order.items.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center border-b-[#f09627] border-b pb-4 mb-4 last:border-b-0 last:mb-0 last:pb-0"
              >
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-20 h-20 object-cover rounded mr-4"
                />
                <div className="flex justify-between items-center w-full text-[#5c3613]">
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{item.name}</p>
                    <p className="text-sm text-gray-500">Loại: 1</p>
                  </div>
                  <div className="text-right px-4">
                    <p className="text-xs text-gray-500">Đơn giá</p>
                    <p className="text-sm font-medium">
                      {item.price.toLocaleString()} ₫
                    </p>
                  </div>
                  <div className="text-center px-4">
                    <p className="text-xs text-gray-500">Số lượng</p>
                    <p className="text-sm font-medium">{item.quantity}</p>
                  </div>
                  <div className="text-right px-2">
                    <p className="text-xs text-gray-500">Thành tiền</p>
                    <p className="text-sm font-bold text-red-500">
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
          disabled={order.items.length === 0}
          className="w-full text-[#f8f7f4] bg-[#f09627] hover:text-[#5c3613] hover:bg-[#f1c43e] hover:shadow-[0_0_15px_rgba(240,150,39,0.5)] transition-all duration-200 py-3 mt-4 rounded-lg font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Đặt Hàng
        </button>
      </div>
    </div>
  );
}
