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

  const handleTouchStart = (e) => {
    setMouseDownAt(e.touches[0].clientX);
  };

  const handleTouchMove = (e) => {
    if (mouseDownAt === 0) return;

    const mouseDelta = mouseDownAt - e.touches[0].clientX;
    const maxDelta = window.innerWidth;
    let nextPercentage = prevPercentage + (mouseDelta / maxDelta) * -100;

    nextPercentage = Math.max(Math.min(nextPercentage, 0), -75);
    setPercentage(nextPercentage);

    const track = trackRef.current;
    track.style.transform = `translate(${nextPercentage}%, -50%)`;

    Array.from(track.getElementsByClassName("image")).forEach((image) => {
      image.style.objectPosition = `${100 + nextPercentage}% 50%`;
    });
  };

  const handleTouchEnd = () => {
    setMouseDownAt(0);
    setPrevPercentage(percentage);
  };

  const images = [
    "/images/gal_book.jpg",
    "/images/gal_clothes.jpg",
    "/images/gal_boots.jpg",
    "/images/gal_food.jpg",
  ];

  return (
    <div
      id="gallery"
      className="xl:h-screen lg:h-screen h-[36rem] w-screen overflow-hidden relative p-4 box-border xl:pt-4 select-none"
      style={{ background: "linear-gradient(to right, #000000, #4a4a4a)" }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div
        ref={trackRef}
        className="absolute flex gap-4 xl:gap-12 left-[2rem] xl:left-1/4 top-1/2 transform -translate-y-1/2 lg:mt-20 xl:mt-0"
        style={{ transform: "translate(0%, -50%)" }}
      >
        {images.map((src, index) => {
          const buttonTexts = ["ĐẶT SÂN", "QUẦN ÁO", "GIÀY", "ĐẶT MÓN"];
          const buttonLinks = [
            "/booking",
            "/products",
            "/products",
            "/products",
          ];

          return (
            <div
              key={index}
              className="relative w-[80vmin] h-[56vmin] group user-select-none select-none xl:pt-1 mb-[10vh] xl:mb-0"
              onContextMenu={(e) => e.preventDefault()}
            >
              <img
                src={src}
                alt={`Image ${index + 1}`}
                className="image w-[80vmin] h-[56vmin] object-cover object-[100%_50%] cursor-pointer transition-transform duration-300 user-select-none mt-[4rem]" // Prevent image selection
                draggable="false"
                onDragStart={(e) => e.preventDefault()}
              />
              <a
                href={buttonLinks[index]}
                className="relative bottom-[4rem] left-[2rem] bg-transparent border font-semibold border-[#f8f7f4] text-[#f8f7f4] px-3 py-2 xl:px-6 xl:py-4 text-sm transition-colors duration-300 hover:bg-[#f8f7f4] hover:text-[#5c3613] active:bg-[#f8f7f4] active:text-[#5c3613] select-none"
              >
                XEM THÊM
              </a>
              <div className="absolute top-[5rem] left-[2rem] z-10 text-[#f8f7f4] font-semibold text-4xl xl:text-5xl xl:mt-2 tracking-tight drop-shadow-lg select-none">
                {buttonTexts[index]}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
