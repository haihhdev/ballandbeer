"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

function PaymentCallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState("loading");
  const [orderType, setOrderType] = useState(null); // "booking" hoặc "product"

  useEffect(() => {
    const processCallback = async () => {
      const success = searchParams.get("success");
      const orderId = searchParams.get("orderId");
      const message = searchParams.get("message");

      console.log("=== PAYMENT CALLBACK ===");
      console.log("success:", success);
      console.log("orderId:", orderId);
      console.log("message:", message);

      if (success === "true") {
        // Kiểm tra xem đây là thanh toán đặt sân hay mua hàng
        const pendingBooking = localStorage.getItem("pendingBooking");

        console.log("pendingBooking exists:", !!pendingBooking);
        console.log("pendingBooking value:", pendingBooking);

        if (pendingBooking) {
          // Đây là thanh toán đặt sân
          console.log(">>> Processing as BOOKING payment");
          setOrderType("booking");
          await handleBookingSuccess(pendingBooking);
        } else {
          // Đây là thanh toán mua hàng
          console.log(">>> Processing as PRODUCT payment");
          setOrderType("product");
          handleProductSuccess();
        }

        setStatus("success");

        // Chuyển về trang chủ sau 2 giây
        setTimeout(() => {
          router.push("/");
        }, 2000);
      } else {
        setStatus("failed");
        toast.error(message || "Thanh toán thất bại", {
          position: "top-right",
          autoClose: 3000,
        });
      }
    };

    processCallback();
  }, [searchParams, router]);

  // Xử lý khi thanh toán đặt sân thành công
  const handleBookingSuccess = async (pendingBookingStr) => {
    try {
      console.log("=== BOOKING SUCCESS HANDLER ===");
      console.log("Raw pendingBooking:", pendingBookingStr);

      const pendingBooking = JSON.parse(pendingBookingStr);
      const token = localStorage.getItem("token");

      console.log("Parsed pendingBooking:", pendingBooking);
      console.log("Token exists:", !!token);
      console.log("Bookings array:", pendingBooking.bookings);

      if (!token || !pendingBooking.bookings) {
        throw new Error("Missing booking data");
      }

      // Gọi API để thực sự đặt sân (lưu vào database)
      // Sau khi booking thành công, dữ liệu sẽ hiển thị trong /api/bookings/my-bookings
      const bookingPromises = pendingBooking.bookings.map((booking) => {
        console.log("Calling booking API for:", {
          fieldId: booking.fieldId,
          date: booking.dateForApi,
          hours: booking.hours,
        });
        return fetch("/api/bookings/book", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            fieldId: booking.fieldId,
            date: booking.dateForApi,
            hours: booking.hours,
          }),
        });
      });

      const responses = await Promise.all(bookingPromises);
      const results = await Promise.all(
        responses.map(async (res) => ({
          ok: res.ok,
          status: res.status,
          data: await res.json().catch((e) => ({ parseError: e.message })),
        }))
      );

      console.log("=== BOOKING API RESULTS ===");
      results.forEach((result, index) => {
        console.log(`Booking ${index + 1}:`, {
          ok: result.ok,
          status: result.status,
          data: result.data,
        });
      });

      const allSuccess = results.every((r) => r.ok);
      console.log("All bookings successful:", allSuccess);

      if (allSuccess) {
        // Booking đã được lưu vào database qua API
        // Profile sẽ load từ /api/bookings/my-bookings
        console.log("✅ Booking saved successfully!");
        toast.success("Đặt sân thành công!", {
          position: "top-right",
          autoClose: 3000,
        });
      } else {
        // Log lỗi chi tiết
        console.error("❌ Booking API errors:");
        results.forEach((r, i) => {
          if (!r.ok) {
            console.error(`  Booking ${i + 1} failed:`, r.data);
          }
        });
        toast.warning(
          "Thanh toán thành công nhưng có lỗi khi xác nhận đặt sân. Vui lòng liên hệ hỗ trợ.",
          {
            position: "top-right",
            autoClose: 5000,
          }
        );
      }

      // Xóa pending data
      localStorage.removeItem("pendingBooking");
      localStorage.removeItem("pendingBookingOrderId");
    } catch (error) {
      console.error("Error processing booking success:", error);
      toast.warning(
        "Thanh toán thành công nhưng có lỗi xử lý. Vui lòng liên hệ hỗ trợ.",
        {
          position: "top-right",
          autoClose: 5000,
        }
      );
      // Vẫn xóa pending data
      localStorage.removeItem("pendingBooking");
      localStorage.removeItem("pendingBookingOrderId");
    }
  };

  // Xử lý khi thanh toán mua hàng thành công
  const handleProductSuccess = () => {
    // Xóa pending order
    localStorage.removeItem("pendingOrder");
    localStorage.removeItem("pendingOrderId");

    toast.success("Thanh toán thành công!", {
      position: "top-right",
      autoClose: 3000,
    });
  };

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
              {orderType === "booking"
                ? "Đặt sân thành công!"
                : "Thanh toán thành công!"}
            </h2>
            <p className="text-gray-600 text-center">
              {orderType === "booking"
                ? "Đơn đặt sân của bạn đã được xác nhận và lưu vào lịch sử."
                : "Đơn hàng của bạn đã được xác nhận thanh toán thành công."}
            </p>
            <p className="text-sm text-gray-500">Đang chuyển về trang chủ...</p>
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
            <div className="flex gap-4 mt-4">
              <button
                onClick={() => router.push("/")}
                className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2 rounded-md"
              >
                Về trang chủ
              </button>
              <button
                onClick={() => router.back()}
                className="bg-[#f0932b] hover:bg-[#f0932b]/80 text-white px-6 py-2 rounded-md"
              >
                Thử lại
              </button>
            </div>
          </>
        )}
      </div>
      <ToastContainer />
    </div>
  );
}

export default function PaymentCallback() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <PaymentCallbackContent />
    </Suspense>
  );
}
