"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const comments = [
  {
    id: 1,
    avatar: "/images/khach.jpg",
    name: "Đức Hải",
    time: Date.now() - 3 * 60 * 60 * 1000, // 3 giờ trước
    rating: 5,
    content: "Giày đẹp còn bền nữa, yêu quá shop ơi!",
    hearts: 0,
    replies: 0,
  },
  {
    id: 2,
    avatar: "/images/cr7.jpeg",
    name: "7 Chuồn",
    time: Date.now() - 2 * 24 * 60 * 60 * 1000, // 2 ngày trước
    rating: 3,
    content: "Giày thế này làm sao thắng được Sa tị đây",
    hearts: 1,
    replies: 1,
  },
];

function formatTime(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;
  const month = 30 * day;
  const year = 365 * day;

  if (diff < hour) {
    const m = Math.max(1, Math.floor(diff / minute));
    return `${m} phút trước`;
  } else if (diff < day) {
    const h = Math.floor(diff / hour);
    return `${h} giờ trước`;
  } else if (diff < week) {
    const d = Math.floor(diff / day);
    return `${d} ngày trước`;
  } else if (diff < month) {
    const w = Math.floor(diff / week);
    return `${w} tuần trước`;
  } else if (diff < year) {
    const mo = Math.floor(diff / month);
    return `${mo} tháng trước`;
  } else {
    const y = Math.floor(diff / year);
    return `${y} năm trước`;
  }
}

export default function CommentSection() {
  const [inputValue, setInputValue] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const loggedInStatus = localStorage.getItem("isLoggedIn");
    setIsLoggedIn(loggedInStatus === "true");
  }, []);

  const handleSend = () => {
    if (!isLoggedIn) {
      toast.warn("Bạn cần đăng nhập để thực hiện chức năng này!", { autoClose: 2000 });
      setTimeout(() => router.push("/login"), 2000);
      return;
    }
    // Xử lý gửi bình luận ở đây nếu đã đăng nhập
  };

  return (
    <div className="bg-white min-h-screen py-6 px-2 sm:px-8">
      <ToastContainer />
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <img src="/icons/comment.svg" alt="comment" className="w-6 h-6" />
        <span className="text-xl font-bold">Bình luận ({comments.length})</span>
      </div>
      {!isLoggedIn && (
        <p className="text-gray-500 text-sm mb-4">
          Vui lòng <a href="/login" className="text-yellow-600 font-medium underline hover:text-yellow-700">đăng nhập</a> để tham gia bình luận.
        </p>
      )}

      {/* Comment input */}
      <div className="bg-[#f1c43e]/30 rounded-2xl p-4 mb-6">
        <div className="relative">
          <textarea
            className="w-full bg-[#f8f7f4] resize-none outline-none text-[#5c3613] text-base min-h-[100px] max-h-[200px] border border-white rounded-lg p-4 pr-24 placeholder-[#5c3613]/50"
            placeholder="Để lại đánh giá của bạn ở đây nhé!"
            maxLength={1000}
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
          />
          <span className="absolute top-2 right-4 text-gray-400 text-xs">{inputValue.length} / 1000</span>
        </div>
        <div className="flex justify-end mt-4">
          <button
            className="flex items-center gap-1 bg-transparent text-[#a45d08] hover:text-[#f1c43e] px-4 py-1 rounded font-semibold text-lg"
            onClick={handleSend}
          >
            Gửi
            <svg
              className="w-5 h-5"
              fill="currentColor"
              viewBox="0 0 32 32"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M28.11,13.32,2.13,2.1,7.44,14.85a3.05,3.05,0,0,1,0,2.3L2.13,29.88l26-11a3,3,0,0,0,0-5.51ZM27.31,17,5.87,26.12l3.41-8.2A4.42,4.42,0,0,0,9.56,17H20V15H9.56a4.42,4.42,0,0,0-.28-.92L5.87,5.9l21.45,9.25a1,1,0,0,1,.6.92A1,1,0,0,1,27.31,17Z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Comment list */}
      <div className="space-y-8">
        {comments.map((c) => (
          <div key={c.id} className="flex gap-4">
            <img src={c.avatar} alt="avatar" className="w-12 h-12 rounded-full object-cover" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900">{c.name}</span>
                <span className="text-gray-400 text-xs">{formatTime(c.time)}</span>
                <span className="ml-2 flex items-center gap-0.5">
                  {[1,2,3,4,5].map((star) => (
                    <img
                      key={star}
                      src={star <= c.rating ? "/icons/fullstar.svg" : "/icons/emptystar.svg"}
                      alt="star"
                      className="w-4 h-4"
                    />
                  ))}
                </span>
              </div>
              <div className="mt-1 text-gray-800 text-base">{c.content}</div>
              <div className="flex items-center gap-4 mt-2 text-gray-500 text-sm">
                <button className="flex items-center gap-1">
                  <img
                    src={c.hearts === 0 ? "/icons/emptyheart.svg" : "/icons/fullheart.svg"}
                    alt="heart"
                    className="w-4 h-4"
                  />
                  <span>{c.hearts}</span>
                </button>
                <button className="flex items-center gap-1">
                  <img src="/icons/reply.svg" alt="reply" className="w-4 h-4" />
                  <span>Trả lời</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
