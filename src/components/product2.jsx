"use client";
import { useState } from "react";

export default function Product2() {
  const categories = [
    "Tất cả",
    "Đồ ăn & Thức uống",
    "Quần áo",
    "Giày",
    "Phụ kiện",
  ];

  const products = [
    {
      id: 1,
      name: "Áo bóng đá J97",
      price: "500,000 VND",
      quantity: 10,
      category: "Quần áo",
      image: "/images/quanao.jpg",
    },
    {
      id: 2,
      name: "Giày thể thao Nike",
      price: "300,000 VND",
      quantity: 5,
      category: "Giày",
      image: "/images/giay.webp",
    },
    {
      id: 3,
      name: "Giày thể thao Adidas",
      price: "700,000 VND",
      quantity: 8,
      category: "Giày",
      image: "/images/giay2.webp",
    },
    {
      id: 4,
      name: "Nước ngọt Revive",
      price: "400,000 VND",
      quantity: 12,
      category: "Đồ ăn & Thức uống",
      image: "/images/revive.jpg",
    },
    {
      id: 5,
      name: "Lays snack",
      price: "600,000 VND",
      quantity: 7,
      category: "Đồ ăn & Thức uống",
      image: "/images/snack_lays.webp",
    },
    {
      id: 6,
      name: "Nước ngọt Sting",
      price: "550,000 VND",
      quantity: 3,
      category: "Đồ ăn & Thức uống",
      image: "/images/sting.jpg",
    },
    {
      id: 7,
      name: "Tất bóng đá",
      price: "550,000 VND",
      quantity: 3,
      category: "Phụ kiện",
      image: "/images/tat.webp",
    },
    {
      id: 8,
      name: "Găng tay thủ môn",
      price: "550,000 VND",
      quantity: 3,
      category: "Phụ kiện",
      image: "/images/gangtay.jpg",
    },
    {
      id: 9,
      name: "Ao bóng đá CR7",
      price: "550,000 VND",
      quantity: 1,
      category: "Quần áo",
      image: "/images/aoanh7.jpg",
    },
  ];

  const [selectedCategory, setSelectedCategory] = useState("Tất cả");

  const filteredProducts =
    selectedCategory === "Tất cả"
      ? products
      : products.filter((product) => product.category === selectedCategory);

  return (
    <div className="p-4 mb-[35vh]">
      {/* Categories and Search Form Container */}
      <div className="flex flex-wrap items-center justify-evenly py-4 md:py-8">
        {/* Categories Buttons */}
        <div className="flex items-center flex-wrap gap-3">
          {categories.map((category, index) => (
            <button
              key={index}
              type="button"
              onClick={() => setSelectedCategory(category)}
              className={`text-gray-900 border border-white hover:border-green-500  rounded-full text-base font-medium px-5 py-2.5 text-center dark:text-white dark:focus:ring-gray-800 ${
                selectedCategory === category
                  ? "bg-green-500 text-white border-2 border-green-600"
                  : ""
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Search Form */}
        <form className="flex-grow max-w-md">
          <label
            htmlFor="default-search"
            className="mb-2 text-sm font-medium text-gray-900 sr-only dark:text-white"
          >
            Search
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <svg
                className="w-4 h-4 text-gray-500 dark:text-gray-400"
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 20 20"
              >
                <path
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="m19 19-4-4m0-7A7 7 0 1 1 1 8a7 7 0 0 1 14 0Z"
                />
              </svg>
            </div>
            <input
              type="search"
              id="default-search"
              className="block w-full p-4 pl-10 text-sm text-gray-900 border border-gray-300 rounded-lg bg-gray-50 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
              placeholder="Search products..."
              required
            />
            <button
              type="submit"
              className="text-white absolute right-2.5 bottom-2.5 bg-green-500 hover:bg-green-700 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-4 py-2 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800"
            >
              Search
            </button>
          </div>
        </form>
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {filteredProducts.map((product) => (
          <div key={product.id} className="text-left">
            <img
              className="h-120 w-full object-cover rounded-lg"
              src={product.image}
              alt={product.name}
            />
            <div className="mt-2">
              <h3 className="text-lg font-bold">{product.name}</h3>
              <p className="text-gray-700">Giá: {product.price}</p>
              <p className="text-gray-500">
                Sản phẩm còn lại: {product.quantity}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
