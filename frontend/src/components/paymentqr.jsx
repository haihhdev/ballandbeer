"use client";
import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const PAYMENT_METHODS = [
  {
    key: "vcb",
    label: "Vietcombank",
    logo: "/images/vcb.png",
    bank: "Ngân hàng TMCP Ngoại thương Việt Nam",
    bankCode: "VNBANK",
    type: "vnpay",
  },
  {
    key: "bidv",
    label: "BIDV",
    logo: "/images/bidv.png",
    bank: "Ngân hàng TMCP Đầu tư và Phát triển Việt Nam",
    bankCode: "BIDV",
    type: "vnpay",
  },
];

export default function PaymentQR() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const amount = searchParams.get("amount") || "0";

  const [selected, setSelected] = useState(PAYMENT_METHODS[0]);
  const [loading, setLoading] = useState(false);
  const [bookingInfo, setBookingInfo] = useState(null);

  // Load booking info từ localStorage
  useEffect(() => {
    const pending = localStorage.getItem("pendingBooking");
    if (pending) {
      try {
        const data = JSON.parse(pending);
        setBookingInfo(data);
      } catch (e) {
        console.error("Error parsing pendingBooking:", e);
      }
    }
  }, []);

  const handlePayment = async () => {
    setLoading(true);
    try {
      const userToken = localStorage.getItem("token");
      const pendingBooking = localStorage.getItem("pendingBooking");

      if (!userToken) {
        toast.error("Vui lòng đăng nhập để thanh toán", {
          position: "top-right",
          autoClose: 3000,
        });
        setLoading(false);
        return;
      }

      if (!pendingBooking) {
        toast.error("Không tìm thấy thông tin đặt sân", {
          position: "top-right",
          autoClose: 3000,
        });
        setLoading(false);
        return;
      }

      const bookingData = JSON.parse(pendingBooking);

      // Bước 1: Tạo booking order
      const orderResponse = await fetch("/api/orders/booking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({
          bookings: bookingData.bookings,
          totalPrice: bookingData.totalPrice,
        }),
      });

      const orderData = await orderResponse.json();

      if (!orderResponse.ok || !orderData.success) {
        toast.error(orderData.message || "Không thể tạo đơn đặt sân", {
          position: "top-right",
          autoClose: 3000,
        });
        setLoading(false);
        return;
      }

      // Lưu orderId để dùng sau
      localStorage.setItem("pendingBookingOrderId", orderData.orderId);

      // Bước 2: Tạo payment URL từ VNPay
      const paymentResponse = await fetch("/api/payment/create-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({
          orderId: orderData.orderId,
          bankCode: selected.bankCode,
        }),
      });

      const paymentData = await paymentResponse.json();

      if (paymentData.success && paymentData.paymentUrl) {
        // Redirect đến VNPay để thanh toán
        window.location.href = paymentData.paymentUrl;
      } else {
        toast.error(paymentData.message || "Không thể tạo link thanh toán", {
          position: "top-right",
          autoClose: 3000,
        });
        setLoading(false);
      }
    } catch (error) {
      console.error("Error creating payment:", error);
      toast.error("Có lỗi xảy ra khi tạo thanh toán", {
        position: "top-right",
        autoClose: 3000,
      });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f7f4] py-12 px-2">
      <div className="bg-white rounded-2xl shadow-2xl p-10 md:p-14 max-w-4xl w-full flex flex-col gap-8 border border-gray-200">
        {/* Bank buttons */}
        <h2 className="text-2xl font-bold text-[#5c3613]">
          Chọn phương thức thanh toán
        </h2>
        <div className="flex items-center gap-6 mb-2 justify-center">
          {PAYMENT_METHODS.map((method) => (
            <button
              key={method.key}
              onClick={() => setSelected(method)}
              className={`h-12 p-2 border rounded-lg flex items-center justify-center transition-all duration-200 focus:outline-none
                ${
                  selected.key === method.key
                    ? "border-[#f0932b] shadow-lg bg-[#fff7e6]"
                    : "border-[#f0932b]/40 bg-white hover:scale-105 hover:shadow-md"
                }
              `}
              title={method.label}
              type="button"
            >
              <img
                src={method.logo}
                alt={method.label}
                className="h-8 w-auto"
              />
            </button>
          ))}
        </div>

        {/* Booking Info */}
        {bookingInfo && bookingInfo.bookings && (
          <div className="bg-green-50 rounded-xl p-4 border border-green-200">
            <div className="font-bold text-green-800 text-lg mb-3">
              🏸 THÔNG TIN ĐẶT SÂN
            </div>
            {bookingInfo.bookings.map((booking, index) => (
              <div key={index} className="mb-2 text-gray-700">
                <div>
                  <span className="font-semibold">Sân:</span>{" "}
                  {booking.courtName}
                </div>
                <div>
                  <span className="font-semibold">Ngày:</span> {booking.date}
                </div>
                <div>
                  <span className="font-semibold">Giờ:</span>{" "}
                  {booking.times?.join(", ")}
                </div>
                <div>
                  <span className="font-semibold">Giá:</span>{" "}
                  <span className="text-red-600 font-bold">
                    {Number(booking.price).toLocaleString()}đ
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Payment Info */}
        <div className="flex flex-col gap-6 items-center justify-center w-full">
          <div className="bg-gray-50 rounded-xl p-6 border border-[#f0932b] w-full">
            <div className="font-bold text-gray-700 text-xl mb-4 text-center">
              THÔNG TIN THANH TOÁN
            </div>
            <div className="text-lg text-gray-700 mb-3">
              <span className="font-semibold">Phương thức:</span>{" "}
              <span className="text-[#f0932b] font-bold">{selected.label}</span>
            </div>
            <div className="text-lg text-gray-700 mb-3">
              <span className="font-semibold">Tổng tiền:</span>{" "}
              <span className="text-red-600 font-bold text-xl">
                {Number(amount).toLocaleString()}đ
              </span>
            </div>
            <div className="text-base text-gray-500 mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="font-semibold text-blue-800 mb-1">
                ⚠️ Lưu ý quan trọng:
              </p>
              <p className="text-sm">
                Bạn sẽ được chuyển đến trang thanh toán VNPay Sandbox. Đây là
                môi trường test, không sử dụng tiền thật.
              </p>
              <p className="text-sm mt-2">
                Sau khi thanh toán thành công, đơn đặt sân sẽ được lưu vào lịch
                sử và bạn sẽ được chuyển về trang chủ.
              </p>
            </div>
          </div>
          <button
            className="bg-[#f0932b] hover:bg-[#f0932b]/80 text-white px-8 py-3 rounded-md w-full text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handlePayment}
            disabled={loading}
          >
            {loading ? "Đang xử lý..." : "Thanh toán qua VNPay"}
          </button>
        </div>
      </div>
      <ToastContainer />
    </div>
  );
}
