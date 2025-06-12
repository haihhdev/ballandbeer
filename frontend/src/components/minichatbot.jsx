"use client";
import { useState, useRef, useEffect } from "react";
import { toast } from "react-toastify";

export default function MiniChatBot() {
  const [show, setShow] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [isAppearing, setIsAppearing] = useState(false);
  const [showMiniAvatar, setShowMiniAvatar] = useState(false);
  const initialMessages = [
    { from: "bot", text: "Chào mừng bạn đến với Ball and Beer! Tôi là BnBBot, trợ lý AI hỗ trợ bạn về các thông tin và dịch vụ của chúng tôi." }
  ];
  const [messages, setMessages] = useState(initialMessages);
  const options = [
    "Thông tin về Ball and Beer",
    "Chương trình khuyến mãi",
  ];
  const [input, setInput] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [promptData, setPromptData] = useState("");
  const inputRef = useRef(null);
  const chatBodyRef = useRef(null);
  const emojiList = ["😀","😂","😍","😡","👍","🤔"];
  const [typingBot, setTypingBot] = useState("");

  // Load prompt data when component mounts
  useEffect(() => {
    const loadPromptData = async () => {
      try {
        const response = await fetch('/data/prompt.txt');
        const text = await response.text();
        setPromptData(text);
        console.log("Prompt loaded:", text);
      } catch (error) {
        console.error('Error loading prompt data:', error);
        toast.error('Chức năng AI đang bảo trì, vui lòng thử lại sau.');
      }
    };
    loadPromptData();
  }, []);

  // Ẩn options nếu đã có ít nhất 1 message từ user
  const hasUserMessage = messages.some(m => m.from === 'user');

  // Scroll xuống dưới cùng khi có tin nhắn mới hoặc khi bot đang typing
  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
    }
  }, [messages, typingBot]);

  // Hiệu ứng zoom khi mở/đóng chat
  useEffect(() => {
    if (show) {
      setIsVisible(true);
      setTimeout(() => setIsAppearing(true), 10);
      setTimeout(() => setShowMiniAvatar(false), 150);
    } else {
      setIsAppearing(false);
      setShowMiniAvatar(true);
      const timeout = setTimeout(() => setIsVisible(false), 300);
      return () => clearTimeout(timeout);
    }
  }, [show]);

  const handleSend = async () => {
    if (input.trim() === "") return;
    
    const userMessage = input.trim();
    setMessages(prev => [...prev, { from: "user", text: userMessage }]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.NEXT_PUBLIC_GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          messages: [
            {
              role: "system",
              content: `Bạn là trợ lý ảo của cửa hàng Ball and Beer. Hãy trả lời dựa trên thông tin sau: ${promptData}`
            },
            {
              role: "user",
              content: userMessage
            }
          ],
          model: "meta-llama/llama-4-scout-17b-16e-instruct",
          temperature: 0.7,
          max_tokens: 500
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error?.message || 'Failed to get response from AI');
      }

      const data = await response.json();
      const botResponse = data.choices[0].message.content;
      // Hiệu ứng typing từng ký tự
      let i = 0;
      setTypingBot(botResponse[0] || "");
      i = 1;
      const typeInterval = setInterval(() => {
        setTypingBot(prev => prev + botResponse[i]);
        i++;
        if (i >= botResponse.length) {
          clearInterval(typeInterval);
          setMessages(prev => [...prev, { from: "bot", text: botResponse }]);
          setTypingBot("");
        }
      }, 30);
    } catch (error) {
      console.error("Error:", error);
      toast.error(error.message || "Có lỗi xảy ra khi gửi tin nhắn!");
      // Thêm tin nhắn lỗi vào chat
      setMessages(prev => [...prev, { 
        from: "bot", 
        text: "Xin lỗi, tôi đang gặp một số vấn đề kỹ thuật. Vui lòng thử lại sau." 
      }]);
      setTypingBot("");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmojiSelect = (emoji) => {
    const input = inputRef.current;
    if (input) {
      const start = input.selectionStart;
      const end = input.selectionEnd;
      const before = input.value.slice(0, start);
      const after = input.value.slice(end);
      setInput(before + emoji + after);
      setTimeout(() => {
        input.focus();
        input.selectionStart = input.selectionEnd = start + emoji.length;
      }, 0);
    } else {
      setInput(input + emoji);
    }
    setShowEmojiPicker(false);
  };

  const handleResetChat = () => {
    setMessages(initialMessages);
  };

  return (
    <>
      {/* Mini avatar button khi chat bị ẩn */}
      {(showMiniAvatar || !show) && (
        <button
          className={`fixed bottom-6 right-6 z-50 bg-[#f09627] rounded-full p-1 shadow-lg border-2 border-white flex items-center justify-center w-18 h-18 transition-all duration-300
            ${show ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'} bounce-up-on-hover`}
          onClick={() => setShow(true)}
          type="button"
          style={{ transitionProperty: 'opacity, transform' }}
        >
          <img src="/images/bbbotavatar.jpg" alt="bot" className="w-16 h-16 rounded-full object-cover" />
          <style jsx>{`
            @keyframes bounce-up {
              0%, 100% { transform: translateY(0); animation-timing-function: cubic-bezier(0.8,0,1,1); }
              50% { transform: translateY(-25%); animation-timing-function: cubic-bezier(0,0,0.2,1); }
            }
            .bounce-up-on-hover:hover {
              animation: bounce-up 1s infinite;
            }
          `}</style>
        </button>
      )}
      {/* Khung chat chính */}
      {isVisible && (
        <div
          className="fixed bottom-6 right-6 z-50 w-80 max-h-[450px] bg-white rounded-2xl shadow-lg flex flex-col overflow-hidden border border-gray-200 transition-all duration-300 ease-in-out"
          style={{
            transform: isAppearing ? 'scale(1)' : 'scale(0.75)',
            opacity: isAppearing ? 1 : 0,
            pointerEvents: show ? 'auto' : 'none',
            transformOrigin: 'bottom right',
          }}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-[#f09627] to-[#f1c43e] flex items-center px-4 py-3">
            <div className="bg-white rounded-full p-1 mr-3 flex items-center justify-center w-10 h-10">
              <img src="/images/bbbotavatar.jpg" alt="bot" className="w-9 h-9 rounded-full object-cover" />
            </div>
            <span className="text-white font-bold text-lg flex-1">BnBBot</span>
            {/* Reset button */}
            <button
              onClick={handleResetChat}
              className="text-white text-xl font-bold mr-2 hover:text-[#5c3613] transition"
              title="Khởi động lại chat"
              type="button"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12a7.5 7.5 0 111.7 4.7" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 8v4h4" />
              </svg>
            </button>
            <button
              onClick={() => setShow(false)}
              className="text-white text-xl font-bold hover:text-[#5c3613] transition"
              title="Đóng"
              type="button"
            >
              ×
            </button>
          </div>
          {/* Chat body */}
          <div className="flex-1 px-4 py-3 overflow-y-auto" ref={chatBodyRef}>
            {messages.map((msg, idx) => (
              <div key={idx} className={`mb-3 ${msg.from === "bot" ? "" : "text-right"}`}>
                <div className={`inline-block px-3 py-2 rounded-lg ${msg.from === "bot" ? "bg-[#f8f7f4] text-[#5c3613]" : "bg-[#f09627] text-white"}`}>
                  {msg.from === 'bot'
                    ? msg.text.split('\n').map((line, i, arr) => (
                        <span key={i}>
                          {line}
                          {i < arr.length - 1 && <br />}
                        </span>
                      ))
                    : msg.text}
                </div>
              </div>
            ))}
            {typingBot && (
              <div className="mb-3">
                <div className="inline-block px-3 py-2 rounded-lg bg-[#f8f7f4] text-[#5c3613]">
                  {typingBot.split('\n').map((line, i, arr) => (
                    <span key={i}>
                      {line}
                      {i < arr.length - 1 && <br />}
                    </span>
                  ))}
                  <span className="animate-pulse">|</span>
                </div>
              </div>
            )}
            {/* Options: chỉ hiện nếu chưa có message từ user */}
            {!hasUserMessage && (
              <div className="flex flex-col gap-2 mt-2">
                {options.map(opt => (
                  <button
                    key={opt}
                    className="border border-[#f1c43e] text-[#5c3613] rounded-lg px-3 py-2 text-left hover:bg-[#f1c43e]/10 transition"
                    onClick={() => setMessages([...messages, { from: "user", text: opt }])}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Input */}
          <div className="border-t px-3 py-2 bg-gray-50 flex items-center gap-2">
            <div className="relative flex-1 flex items-center">
              {/* Input + Emoji group with dynamic width */}
              <div
                className={`flex items-center bg-white rounded-lg border border-gray-300 transition-all duration-300 ease-in-out
                  ${input.trim() ? 'w-[calc(100%-44px)]' : 'w-full'}`}
                style={{ minHeight: '40px' }}
              >
                <input
                  type="text"
                  placeholder="Nhắn tin cho BnBBot..."
                  className="flex-1 px-3 py-2 bg-transparent text-sm outline-none border-0 focus:ring-0 focus:border-none transition-all duration-300"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
                  ref={inputRef}
                />
                {/* Emoji icon inside input group */}
                <button
                  className="mx-2 text-gray-400 hover:text-[#5c3613] transition-colors duration-200"
                  title="Emoji"
                  tabIndex={-1}
                  type="button"
                  onClick={() => setShowEmojiPicker(v => !v)}
                  style={{ flexShrink: 0 }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.556 0 8.25-3.694 8.25-8.25S16.556 3.75 12 3.75 3.75 7.444 3.75 12s3.694 8.25 8.25 8.25z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.5 10.75h.008v.008H15.5v-.008zm-7 0h.008v.008H8.5v-.008zm.75 3.5a3.75 3.75 0 006 0" />
                  </svg>
                </button>
                {showEmojiPicker && (
                  <div className="absolute z-20 bottom-10 right-0 bg-white border rounded shadow p-2 flex gap-1">
                    {emojiList.map((emoji) => (
                      <button
                        key={emoji}
                        className="text-xl hover:scale-125 transition-transform"
                        onClick={() => handleEmojiSelect(emoji)}
                        type="button"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Send icon button, only show if input has text */}
              <button
                className={`absolute right-0 top-1/2 -translate-y-1/2 flex items-center justify-center px-2 py-1 rounded transition-all duration-300
                  ${input.trim() ? 'opacity-100 translate-x-0 pointer-events-auto' : 'opacity-0 translate-x-4 pointer-events-none'}
                  bg-transparent hover:bg-[#f1c43e]/20 group`}
                type="button"
                onClick={handleSend}
                tabIndex={input.trim() ? 0 : -1}
                style={{ boxShadow: '0 1px 4px 0 rgba(0,0,0,0.03)' }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="currentColor"
                  viewBox="0 0 32 32"
                  className="w-5 h-5 text-[#f1c43e] group-hover:text-[#f09627] transition-colors duration-200"
                >
                  <path d="M28.11,13.32,2.13,2.1,7.44,14.85a3.05,3.05,0,0,1,0,2.3L2.13,29.88l26-11a3,3,0,0,0,0-5.51ZM27.31,17,5.87,26.12l3.41-8.2A4.42,4.42,0,0,0,9.56,17H20V15H9.56a4.42,4.42,0,0,0-.28-.92L5.87,5.9l21.45,9.25a1,1,0,0,1,.6.92A1,1,0,0,1,27.31,17Z"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
