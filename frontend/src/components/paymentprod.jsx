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
    bankCode: "VNBANK", // VNPay bank code for VCB
    type: "vnpay",
  },
  {
    key: "bidv",
    label: "BIDV",
    logo: "/images/bidv.png",
    bank: "Ngân hàng TMCP Đầu tư và Phát triển Việt Nam",
    bankCode: "BIDV", // VNPay bank code for BIDV
    type: "vnpay",
  },
];

// Không cần QR URL nữa vì sẽ redirect đến VNPay

export default function PaymentQR() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const amount = searchParams.get("amount") || "0";
  const date = searchParams.get("date") || "";
  const time = searchParams.get("time") || "";
  const courtName = searchParams.get("courtName") || "";
  const courtImage = searchParams.get("courtImage") || "/images/san5.jpg";

  const [selected, setSelected] = useState(PAYMENT_METHODS[0]);
  const [loading, setLoading] = useState(false);

  // Update amount when URL changes
  useEffect(() => {
    // Amount được lấy từ URL params
  }, [amount]);

  const handlePayment = async () => {
    setLoading(true);
    try {
      const orderId = localStorage.getItem("pendingOrderId");
      const userToken = localStorage.getItem("token");

      if (!orderId || !userToken) {
        toast.error("Không tìm thấy thông tin đơn hàng", {
          position: "top-right",
          autoClose: 3000,
        });
        setLoading(false);
        return;
      }

      // Gọi API để tạo payment URL từ VNPay
      const response = await fetch("/api/payment/create-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({
          orderId: orderId,
          bankCode: selected.bankCode,
        }),
      });

      const data = await response.json();

      if (data.success && data.paymentUrl) {
        // Redirect đến VNPay để thanh toán
        window.location.href = data.paymentUrl;
      } else {
        toast.error(data.message || "Không thể tạo link thanh toán", {
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
        {/* Bank/Wallet buttons - TOP */}
        <h2 className="text-2xl font-bold text-[#5c3613]">
          Chọn phương thức thanh toán
        </h2>
        <div className="flex items-center gap-6 mb-2 justify-center">
          {PAYMENT_METHODS.map((method) => (
            <button
              key={method.key}
              onClick={() => setSelected({ ...method, amount: amount })}
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
              <span className="font-semibold">Số tiền:</span>{" "}
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
                Sau khi thanh toán thành công, bạn sẽ được chuyển về trang xác
                nhận.
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
