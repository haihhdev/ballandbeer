"use client";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function PaymentCallback() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    const success = searchParams.get("success");
    const orderId = searchParams.get("orderId");
    const message = searchParams.get("message");

    if (success === "true") {
      setStatus("success");

      // Xóa pending order từ localStorage
      localStorage.removeItem("pendingOrder");
      localStorage.removeItem("pendingOrderId");

      toast.success("Thanh toán thành công!", {
        position: "top-right",
        autoClose: 3000,
      });

      // Chuyển về trang profile sau 3 giây
      setTimeout(() => {
        router.push("/profile?tab=history");
      }, 3000);
    } else {
      setStatus("failed");
      toast.error(message || "Thanh toán thất bại", {
        position: "top-right",
        autoClose: 5000,
      });

      // Cho phép quay lại trang thanh toán
      setTimeout(() => {
        router.push("/paymentproduct");
      }, 5000);
    }
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f7f4] py-12 px-2">
      <div className="bg-white rounded-2xl shadow-2xl p-10 md:p-14 max-w-2xl w-full flex flex-col gap-8 border border-gray-200 items-center">
        {status === "loading" && (
          <>
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-[#f0932b]"></div>
            <h2 className="text-2xl font-bold text-[#5c3613]">
              Đang xử lý kết quả thanh toán...
            </h2>
          </>
        )}

        {status === "success" && (
          <>
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
              <svg
                className="w-12 h-12 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-green-600">
              Thanh toán thành công!
            </h2>
            <p className="text-gray-600 text-center">
              Đơn hàng của bạn đã được xác nhận thanh toán thành công.
            </p>
            <p className="text-sm text-gray-500">
              Đang chuyển về trang lịch sử đơn hàng...
            </p>
          </>
        )}

        {status === "failed" && (
          <>
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
              <svg
                className="w-12 h-12 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-red-600">
              Thanh toán thất bại
            </h2>
            <p className="text-gray-600 text-center">
              Có lỗi xảy ra trong quá trình thanh toán. Vui lòng thử lại.
            </p>
            <button
              onClick={() => router.push("/paymentproduct")}
              className="bg-[#f0932b] hover:bg-[#f0932b]/80 text-white px-6 py-2 rounded-md mt-4"
            >
              Quay lại trang thanh toán
            </button>
          </>
        )}
      </div>
      <ToastContainer />
    </div>
  );
}
