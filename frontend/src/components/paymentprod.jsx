"use client";
import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const PAYMENT_METHODS = [
  {
    key: "momo",
    label: "MOMO",
    logo: "/images/momo.webp",
    bank: "Ví MoMo",
    bankCode: "momo",
    account: "0900000000",
    owner: "NGUYEN VAN A",
    content: "BALLANDBEER_PRODUCT",
    type: "wallet",
  },
  {
    key: "vcb",
    label: "Vietcombank",
    logo: "/images/vcb.png",
    bank: "Ngân hàng TMCP Ngoại thương Việt Nam",
    bankCode: "vcb",
    account: "100000000000000",
    owner: "NGUYEN VAN A",
    content: "BALLANDBEER_PRODUCT",
    type: "bank",
  },
  {
    key: "vietinbank",
    label: "Vietinbank",
    logo: "/images/vietinbank.png",
    bank: "Ngân hàng TMCP Công thương Việt Nam",
    bankCode: "vietinbank",
    account: "0000000000000000",
    owner: "NGUYEN VAN A",
    content: "BALLANDBEER_PRODUCT",
    type: "bank",
  },
];

function getQRUrl(method) {
  if (method.type === "bank") {
    // Sử dụng VietQR
    return `https://img.vietqr.io/image/${method.bankCode}-${
      method.account
    }-compact2.png?amount=${method.amount}&addInfo=${encodeURIComponent(
      method.content
    )}&accountName=${encodeURIComponent(method.owner)}`;
  } else {
    // Sử dụng qrserver cho ví điện tử
    const text = `Chuyen ${method.amount} VND toi ${method.owner} (${method.account}) voi noi dung: ${method.content}`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
      text
    )}`;
  }
}

export default function PaymentQR() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const amount = searchParams.get("amount") || "0";
  const date = searchParams.get("date") || "";
  const time = searchParams.get("time") || "";
  const courtName = searchParams.get("courtName") || "";
  const courtImage = searchParams.get("courtImage") || "/images/san5.jpg";

  const [selected, setSelected] = useState({
    ...PAYMENT_METHODS[0],
    amount: amount,
  });

  // Update amount when URL changes
  useEffect(() => {
    setSelected((prev) => ({
      ...prev,
      amount: amount,
    }));
  }, [amount]);

  const handlePaymentSuccess = async () => {
    // Get pending order from localStorage
    const pendingOrder = JSON.parse(
      localStorage.getItem("pendingOrder") || "{}"
    );

    // Gửi API cập nhật trạng thái đơn hàng
    const orderId = localStorage.getItem("pendingOrderId");
    const userToken = localStorage.getItem("token");
    if (orderId && userToken) {
      await fetch(`http://localhost:4002/api/orders/${orderId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({ status: "complete" }),
      });
    }

    // Get existing order history
    const orderHistory = JSON.parse(localStorage.getItem("orderHistory")) || [];

    // Add new order to history
    if (pendingOrder && (pendingOrder.items || []).length > 0) {
      orderHistory.unshift({
        ...pendingOrder,
        status: "Đã thanh toán",
        paymentDate: new Date().toLocaleDateString("vi-VN"),
      });
      localStorage.setItem("orderHistory", JSON.stringify(orderHistory));
      localStorage.removeItem("pendingOrder");
    }

    toast.success("Thanh toán thành công", {
      position: "top-right",
      autoClose: 5000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
    });
    setTimeout(() => {
      router.push("/profile?tab=history");
    }, 2000);
  };

  const qrUrl = getQRUrl(selected);

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
        {/* QR + Transfer info row */}
        <div className="flex flex-col md:flex-row gap-10 items-start justify-center w-full">
          {/* QR Code */}
          <div className="flex-shrink-0 flex items-center justify-center w-full md:w-auto">
            <div className="border border-[#f0932b] rounded-xl bg-white flex items-center justify-center w-72 h-72 md:w-80 md:h-80">
              <img
                src={qrUrl}
                alt="QR Code"
                className="w-60 h-60 md:w-72 md:h-72 object-contain"
              />
            </div>
          </div>
          {/* Transfer info */}
          <div className="flex-1 w-full self-start">
            <div className="bg-gray-50 rounded-xl p-6 border border-[#f0932b] mb-4">
              <div className="font-bold text-gray-700 text-xl mb-2">
                THÔNG TIN CHUYỂN KHOẢN
              </div>
              <div className="text-lg text-gray-700 mb-1">
                <span className="font-semibold">Ngân hàng:</span>{" "}
                {selected.bank}
              </div>
              <div className="text-lg text-gray-700 mb-1">
                <span className="font-semibold">Số tài khoản:</span>{" "}
                {selected.account}
              </div>
              <div className="text-lg text-gray-700 mb-1">
                <span className="font-semibold">Chủ tài khoản:</span>{" "}
                {selected.owner}
              </div>
              <div className="text-lg text-gray-700 mb-1">
                <span className="font-semibold">Số tiền:</span>{" "}
                <span className="text-red-600 font-bold text-xl">
                  {Number(selected.amount).toLocaleString()}đ
                </span>
              </div>
              <div className="text-lg text-gray-700 mb-1 flex items-center">
                <span className="font-semibold">Nội dung thanh toán:</span>
                <span className="ml-3 bg-[#f6f6f6] border border-red-400 text-red-600 px-3 py-1 rounded font-mono font-bold text-lg">
                  {selected.content}
                </span>
              </div>
            </div>
            <div className="text-base text-gray-500 mt-2">
              Vui lòng chuyển khoản đúng nội dung{" "}
              <span className="font-bold text-blue-700">
                {selected.content}
              </span>
              , để chúng tôi kích hoạt đơn hàng
            </div>
            <button
              className="bg-[#f0932b] hover:bg-[#f0932b]/80 text-white px-4 py-2 rounded-md mt-4 w-full"
              onClick={handlePaymentSuccess}
            >
              Xác nhận thanh toán
            </button>
          </div>
        </div>
      </div>
      <ToastContainer />
    </div>
  );
}
