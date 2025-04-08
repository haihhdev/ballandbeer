"use client";

import { useState } from "react";

export default function ProductView() {
  const [selectedImage, setSelectedImage] = useState("/images/gal_boots.jpg"); // Default large image
  const [selectedColor, setSelectedColor] = useState("green"); // Default selected color

  const handleThumbnailClick = (image) => {
    setSelectedImage(image);
  };

  const handleColorSelect = (color) => {
    setSelectedColor(color);
  };

  return (
    <div className="bg-green-50 text-black p-6 mb-[32vh]">
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-20">
        {/* Product Image Section */}
        <div className="flex flex-col items-center">
          <img
            src={selectedImage}
            alt="Selected Product"
            className="w-full max-w-md object-cover"
          />
          <div className="flex space-x-4 mt-4">
            {/* Thumbnail Images */}
            {[
              "/images/gal_boots.jpg",
              "/images/gal_clothes.jpg",
              "/images/gal_food.jpg",
              "/images/gal_yard.jpg",
            ].map((image, index) => (
              <img
                key={index}
                src={image}
                alt={`Thumbnail ${index + 1}`}
                className="w-16 h-16 border border-gray-700 rounded cursor-pointer"
                onClick={() => handleThumbnailClick(image)}
              />
            ))}
          </div>
        </div>

        {/* Product Details Section */}
        <div>
          <h1 className="text-2xl font-bold">Tên sản phẩm.</h1>
          <div className="flex items-center mt-2">
            <span className="text-yellow-400 text-lg">★★★★★</span>
            <span className="ml-2 text-sm">(345 Lượt đánh giá.)</span>
          </div>
          <p className="text-3xl font-semibold mt-4">499.000vnđ</p>

          {/* Buttons */}
          <div className="flex space-x-4 mt-6">
            <button
              id="cartBtn"
              className="rounded-lg px-5 py-2.5 border-2 border-green-600 text-black font-medium hover:bg-green-500 hover:text-white hover:scale-105 transition-transform"
            >
              🛒 Thêm vào giỏ hàng
            </button>

            <button
              id="buyBtn"
              className="rounded-lg bg-green-200 px-5 py-2.5 text-base font-medium text-black hover:bg-green-500 hover:text-white hover:scale-105 transition-transform"
            >
              Mua ngay
            </button>
          </div>

          {/* Quantity Selector */}
          <div className="flex items-center mt-4">
            <span className="mr-2">Quantity</span>
            <input
              type="number"
              min="1"
              defaultValue="1"
              className="w-16 p-2 border border-gray-700 bg-gray-100 rounded text-black"
            />
          </div>

          {/* Color Options */}
          <div className="mt-6">
            <h3 className="font-semibold">Colour</h3>
            <div className="flex space-x-4 mt-2">
              {["green", "pink", "gray", "blue"].map((color) => (
                <button
                  key={color}
                  className={`w-8 h-8 rounded-full border ${
                    selectedColor === color
                      ? "border-2 border-green-600 scale-115"
                      : "border-gray-700"
                  } bg-${color}-500`}
                  onClick={() => handleColorSelect(color)}
                ></button>
              ))}
            </div>
          </div>

          {/* Description Section */}
          <div className="mt-6">
            <h3 className="font-semibold">Description</h3>
            <p className="text-sm text-gray-400 mt-2">
              Đây là mô tả sản phẩm. Mô tả cung cấp thông tin chi tiết về sản phẩm, bao gồm chất liệu, kích thước, và các tính năng nổi bật. Mô tả này giúp khách hàng hiểu rõ hơn về sản phẩm trước khi quyết định mua hàng.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}