"use client";
import { useState, useRef } from "react";

export default function ImageTrack() {
  const trackRef = useRef(null);
  const [mouseDownAt, setMouseDownAt] = useState(0);
  const [prevPercentage, setPrevPercentage] = useState(0);
  const [percentage, setPercentage] = useState(0);

  const handleMouseDown = (e) => {
    setMouseDownAt(e.clientX);
  };

  const handleMouseMove = (e) => {
    if (mouseDownAt === 0) return;

    const mouseDelta = mouseDownAt - e.clientX;
    const maxDelta = window.innerWidth;
    let nextPercentage = prevPercentage + (mouseDelta / maxDelta) * -100;

    nextPercentage = Math.max(Math.min(nextPercentage, 0), -80);
    setPercentage(nextPercentage);

    const track = trackRef.current;
    track.style.transform = `translate(${nextPercentage}%, -50%)`;

    Array.from(track.getElementsByClassName("image")).forEach((image) => {
      image.style.objectPosition = `${100 + nextPercentage}% 50%`;
    });
  };

  const handleMouseUp = () => {
    setMouseDownAt(0);
    setPrevPercentage(percentage);
  };

  const images = [
    "/images/gal_yard.jpg",
    "/images/gal_clothes.jpg",
    "/images/gal_boots.jpg",
    "/images/gal_food.jpg",
  ];

  return (
    <div
      className="h-screen w-screen bg-black overflow-hidden relative mt-8 p-4 box-border"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div
        ref={trackRef}
        className="absolute flex gap-12 left-1/3 top-1/2 transform -translate-y-1/2 justify-center"
        style={{ transform: "translate(0%, -50%)" }}
      >
        {images.map((src, index) => {
          const buttonTexts = ["Đặt Sân", "Quần Áo", "Giày", "Đặt Món"];
          const buttonLinks = [
            "/booking",
            "/products",
            "/products",
            "/products",
          ];

          return (
            <div
              key={index}
              className="relative w-[80vmin] h-[56vmin] group user-select-none"
              onContextMenu={(e) => e.preventDefault()}
            >
              <img
                src={src}
                alt={`Image ${index + 1}`}
                className="image w-[80vmin] h-[56vmin] object-cover object-[100%_50%] cursor-pointer transition-transform duration-300 group-hover:scale-110 user-select-none mt-[10vh]" // Prevent image selection
                draggable="false"
                onDragStart={(e) => e.preventDefault()}
              />
              <a
                href={buttonLinks[index]}
                className="relative bottom-16 left-120 bg-transparent border border-white text-white px-4 py-2 text-sm transition-colors duration-300 hover:bg-white hover:text-black group-hover:scale-125 rounded-sm scale-110"
              >
                {buttonTexts[index]}
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}
