"use client";
import React, { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function CommentSection() {
  const [inputValue, setInputValue] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [selectedRating, setSelectedRating] = useState(0);
  const [comments, setComments] = useState([]);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [editingComment, setEditingComment] = useState(null);
  const [showMoreOptions, setShowMoreOptions] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedEmoji, setSelectedEmoji] = useState("");
  const fileInputRef = useRef(null);
  const router = useRouter();
  const { id } = useParams();
  const [textareaRef, setTextareaRef] = useState(null);

  useEffect(() => {
    const loggedInStatus = localStorage.getItem("isLoggedIn");
    setIsLoggedIn(loggedInStatus === "true");
    fetchComments();
  }, [id]);

  const fetchComments = async () => {
    try {
      const response = await fetch(`http://localhost:4003/api/products/${id}/comments`);
      const data = await response.json();
      if (data && Array.isArray(data)) {
        setComments(data);
      }
    } catch (error) {
      console.error("Error fetching comments:", error);
    }
  };

  const handleImageSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast.error("Kích thước ảnh không được vượt quá 5MB!", { autoClose: 2000 });
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          // Tạo canvas để resize ảnh
          const canvas = document.createElement('canvas');
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
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // Chuyển đổi sang base64 với chất lượng 0.7 (70%)
          const resizedImage = canvas.toDataURL('image/jpeg', 0.7);
          
          // Chuyển base64 thành File object
          fetch(resizedImage)
            .then(res => res.blob())
            .then(blob => {
              const resizedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now()
              });
              setSelectedImage(resizedFile);
              setImagePreview(resizedImage);
            });
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleHeartClick = async (commentId) => {
    if (!isLoggedIn) {
      toast.warn("Bạn cần đăng nhập để thực hiện chức năng này!", { autoClose: 2000 });
      return;
    }

    try {
      const userToken = localStorage.getItem("token");
      const response = await fetch(`http://localhost:4003/api/comments/${commentId}/heart`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      if (response.ok) {
        fetchComments(); // Refresh comments to update heart count
      } else {
        toast.error("Có lỗi xảy ra khi thích bình luận!", { autoClose: 2000 });
      }
    } catch (error) {
      console.error("Error toggling heart:", error);
      toast.error("Có lỗi xảy ra khi thích bình luận!", { autoClose: 2000 });
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!isLoggedIn) {
      toast.warn("Bạn cần đăng nhập để thực hiện chức năng này!", { autoClose: 2000 });
      return;
    }

    try {
      const userToken = localStorage.getItem("token");
      const response = await fetch(`http://localhost:4003/api/comments/${commentId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      if (response.ok) {
        toast.success("Bình luận đã được xóa thành công!", { autoClose: 2000 });
        fetchComments();
      } else {
        toast.error("Có lỗi xảy ra khi xóa bình luận!", { autoClose: 2000 });
      }
    } catch (error) {
      console.error("Error deleting comment:", error);
      toast.error("Có lỗi xảy ra khi xóa bình luận!", { autoClose: 2000 });
    }
  };

  const handleEditComment = async (commentId, newContent, newRating) => {
    if (!isLoggedIn) {
      toast.warn("Bạn cần đăng nhập để thực hiện chức năng này!", { autoClose: 2000 });
      return;
    }

    try {
      const userToken = localStorage.getItem("token");
      const response = await fetch(`http://localhost:4003/api/comments/${commentId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({
          content: newContent,
          rating: newRating,
        }),
      });

      if (response.ok) {
        toast.success("Bình luận đã được chỉnh sửa thành công!", { autoClose: 2000 });
        setEditingComment(null);
        fetchComments();
      } else {
        toast.error("Có lỗi xảy ra khi chỉnh sửa bình luận!", { autoClose: 2000 });
      }
    } catch (error) {
      console.error("Error editing comment:", error);
      toast.error("Có lỗi xảy ra khi chỉnh sửa bình luận!", { autoClose: 2000 });
    }
  };

  const handleEmojiSelect = (emoji) => {
    if (textareaRef) {
      const start = textareaRef.selectionStart;
      const end = textareaRef.selectionEnd;
      const before = inputValue.slice(0, start);
      const after = inputValue.slice(end);
      setInputValue(before + emoji + after);
      setTimeout(() => {
        textareaRef.focus();
        textareaRef.selectionStart = textareaRef.selectionEnd = start + emoji.length;
      }, 0);
    } else {
      setInputValue(inputValue + emoji);
    }
    setShowEmojiPicker(false);
  };

  const handleSend = async () => {
    if (!isLoggedIn) {
      toast.warn("Bạn cần đăng nhập để thực hiện chức năng này!", { autoClose: 2000 });
      setTimeout(() => router.push("/login"), 2000);
      return;
    }

    if (selectedRating === 0) {
      toast.warn("Vui lòng chọn số sao đánh giá!", { autoClose: 2000 });
      return;
    }

    if (!inputValue.trim()) {
      toast.warn("Vui lòng nhập nội dung bình luận!", { autoClose: 2000 });
      return;
    }

    try {
      const userToken = localStorage.getItem("token");
      const commentData = {
        content: inputValue,
        rating: selectedRating
      };

      // Add image if exists
      if (selectedImage) {
        commentData.image = imagePreview; // Use the resized and compressed image
      }

      const response = await fetch(`http://localhost:4003/api/products/${id}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify(commentData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Có lỗi xảy ra khi đăng tải bình luận!');
      }

      const data = await response.json();
      toast.success("Bình luận đã được đăng tải thành công!", { autoClose: 2000 });
      setInputValue("");
      setSelectedRating(0);
      setSelectedImage(null);
      setImagePreview(null);
      setSelectedEmoji("");
      fetchComments();
    } catch (error) {
      console.error("Error sending comment:", error);
      toast.error(error.message || "Có lỗi xảy ra khi đăng tải bình luận!", { autoClose: 2000 });
    }
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
        <div className="mb-4">
          <label className="block text-[#5c3613] font-medium mb-2">Bạn sẽ cho sản phẩm này bao nhiêu sao?</label>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                className="text-2xl focus:outline-none"
                onMouseEnter={() => setHoveredRating(star)}
                onMouseLeave={() => setHoveredRating(0)}
                onClick={() => setSelectedRating(star)}
              >
                <span className={star <= (hoveredRating || selectedRating) ? "text-yellow-400" : "text-gray-300"}>
                  ★
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="relative">
          <textarea
            className="w-full bg-[#f8f7f4] resize-none outline-none text-[#5c3613] text-base min-h-[100px] max-h-[200px] border border-white rounded-lg p-4 pr-24 placeholder-[#5c3613]/50"
            placeholder="Để lại đánh giá của bạn ở đây nhé!"
            maxLength={1000}
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            ref={ref => setTextareaRef(ref)}
          />
          {selectedEmoji && (
            <span className="absolute bottom-2 left-4 text-2xl">{selectedEmoji}</span>
          )}
          <span className="absolute top-2 right-4 text-gray-400 text-xs">{inputValue.length} / 1000</span>
        </div>

        {/* Image upload + Send button ngang hàng */}
        <div className="flex items-center justify-between gap-4 mt-4">
          {/* Group left: attach + emote */}
          <div className="flex items-center gap-1">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageSelect}
              accept="image/*"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="relative flex items-center group px-0"
              style={{ color: '#5c3613' }}
            >
              <svg
                fill="currentColor"
                width="20"
                height="20"
                viewBox="0 0 35 35"
                className="w-5 h-5 transition-colors duration-200 text-inherit group-hover:text-[#f1c43e]"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M18,34.75A11.32,11.32,0,0,1,6.69,23.45V8A7.78,7.78,0,0,1,22.25,8V22.49a4.58,4.58,0,1,1-9.15,0V9.29a1.25,1.25,0,0,1,2.5,0v13.2a2.08,2.08,0,1,0,4.15,0V8A5.28,5.28,0,0,0,9.19,8V23.45A8.82,8.82,0,0,0,18,32.25c4.6,0,7.81-3.62,7.81-8.8V9.66a1.25,1.25,0,0,1,2.5,0V23.45C28.31,30,24,34.75,18,34.75Z"/>
              </svg>
              <span
                className="overflow-hidden whitespace-nowrap max-w-0 group-hover:max-w-xs group-hover:pl-2 transition-all duration-300 ease-in-out text-[#5c3613] group-hover:text-[#f1c43e]"
                style={{ display: 'inline-block' }}
              >
                Đính kèm ảnh
              </span>
            </button>
            {/* Emote button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowEmojiPicker((v) => !v)}
                className="relative flex items-center group px-0 ml-1"
                style={{ color: '#5c3613' }}
              >
                <svg
                  fill="currentColor"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  className="w-5 h-5 transition-colors duration-200 text-inherit group-hover:text-[#f1c43e]"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8zm-4-7a1 1 0 1 1 2 0 1 1 0 0 1-2 0zm6 0a1 1 0 1 1 2 0 1 1 0 0 1-2 0zm-6.293 2.707a1 1 0 0 1 1.414 0A5.978 5.978 0 0 0 12 17c1.657 0 3.156-.672 4.293-1.793a1 1 0 1 1 1.414 1.414A7.978 7.978 0 0 1 12 19a7.978 7.978 0 0 1-5.707-2.379 1 1 0 0 1 0-1.414z"/>
                </svg>
                <span
                  className="overflow-hidden whitespace-nowrap max-w-0 group-hover:max-w-xs group-hover:pl-2 transition-all duration-300 ease-in-out text-[#5c3613] group-hover:text-[#f1c43e]"
                  style={{ display: 'inline-block' }}
                >
                  Biểu cảm
                </span>
              </button>
              {showEmojiPicker && (
                <div className="absolute left-0 top-10 z-20 bg-white border rounded shadow p-2 flex gap-2">
                  {["😀","😂","😍","😢","😡","👍","👏","🎉","🥰","🤔"].map((emoji) => (
                    <button
                      key={emoji}
                      className="text-2xl hover:scale-125 transition-transform"
                      onClick={() => handleEmojiSelect(emoji)}
                      type="button"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          {imagePreview && (
            <div className="relative">
              <img
                src={imagePreview}
                alt="preview"
                className="h-20 w-20 object-cover rounded-lg"
              />
              <button
                type="button"
                onClick={() => {
                  setSelectedImage(null);
                  setImagePreview(null);
                }}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center"
              >
                ×
              </button>
            </div>
          )}
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
        {comments.map((c) => {
          let avatar = c.userId?.avatar || "/icons/user.svg";
          let fullname = c.userId?.fullname;
          let username = c.userId?.username;
          const displayName = fullname || username || "Người dùng";
          const myUserId = localStorage.getItem("userId");
          let commentUserId = c.userId?._id || c.userId;
          const isMyComment = myUserId && commentUserId && myUserId === commentUserId.toString();

          return (
            <div key={c._id} className="flex gap-4">
              <img src={avatar} alt="avatar" className="w-12 h-12 rounded-full object-cover" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">{displayName}</span>
                  <span className="text-gray-400 text-xs">{formatTime(c.createdAt)}</span>
                  {c.isEdited && (
                    <span className="text-gray-400 text-xs">(đã chỉnh sửa)</span>
                  )}
                  <span className="ml-2 flex items-center gap-0.5">
                    {[1,2,3,4,5].map((star) => (
                      <span
                        key={star}
                        className={star <= c.rating ? "text-yellow-400" : "text-gray-300"}
                      >
                        ★
                      </span>
                    ))}
                  </span>
                </div>
                {editingComment === c._id ? (
                  <div className="mt-2">
                    <textarea
                      className="w-full bg-[#f8f7f4] resize-none outline-none text-[#5c3613] text-base min-h-[100px] max-h-[200px] border border-white rounded-lg p-4"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      placeholder="Chỉnh sửa bình luận của bạn..."
                    />
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            className="text-2xl focus:outline-none"
                            onClick={() => setSelectedRating(star)}
                          >
                            <span className={star <= selectedRating ? "text-yellow-400" : "text-gray-300"}>
                              ★
                            </span>
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => handleEditComment(c._id, inputValue, selectedRating)}
                        className="ml-auto px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"
                      >
                        Lưu
                      </button>
                      <button
                        onClick={() => {
                          setEditingComment(null);
                          setInputValue("");
                          setSelectedRating(0);
                        }}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                      >
                        Hủy
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="mt-1 text-gray-800 text-base">{c.content}</div>
                    {c.image && (
                      <div className="mt-2">
                        <img
                          src={c.image}
                          alt="comment attachment"
                          className="max-h-48 rounded-lg object-cover"
                        />
                      </div>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-gray-500 text-sm">
                      <button
                        className="flex items-center gap-1"
                        onClick={() => handleHeartClick(c._id)}
                      >
                        <img
                          src={c.heartedBy?.includes(localStorage.getItem("userId")) ? "/icons/fullheart.svg" : "/icons/emptyheart.svg"}
                          alt="heart"
                          className="w-4 h-4"
                        />
                        <span>{c.hearts || 0}</span>
                      </button>
                      <button className="flex items-center gap-1">
                        <img src="/icons/reply.svg" alt="reply" className="w-4 h-4" />
                        <span>Trả lời</span>
                      </button>
                      {isMyComment && (
                        <div className="relative">
                          <button
                            onClick={() => setShowMoreOptions(showMoreOptions === c._id ? null : c._id)}
                            className="flex items-center gap-1"
                          >
                            <img src="/icons/more.svg" alt="more" className="w-4 h-4" />
                            <span>Thêm</span>
                          </button>
                          {showMoreOptions === c._id && (
                            <div className="absolute right-0 mt-1 w-32 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                              <button
                                onClick={() => {
                                  setEditingComment(c._id);
                                  setShowMoreOptions(null);
                                }}
                                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
                              >
                                Chỉnh sửa
                              </button>
                              <button
                                onClick={() => {
                                  handleDeleteComment(c._id);
                                  setShowMoreOptions(null);
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-gray-100"
                              >
                                Xóa
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatTime(timestamp) {
  const now = Date.now();
  const diff = now - new Date(timestamp).getTime();
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
