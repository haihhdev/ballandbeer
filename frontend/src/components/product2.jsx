"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation"; // Import useRouter

export default function Product2() {
  const router = useRouter(); // Initialize useRouter
  const categories = [
    "Tất cả",
    "Đồ ăn & Thức uống",
    "Quần áo",
    "Giày",
    "Phụ kiện",
  ];

  const [products, setProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("Tất cả");
  const [loading, setLoading] = useState(true);

  // Fetch products from API
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await fetch("http://localhost:4003/api/products");
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        // Check if data is an array
        if (!Array.isArray(data)) {
          console.error('Received non-array data:', data);
          setProducts([]);
          setLoading(false);
          return;
        }

        const formattedProducts = data.map((item) => ({
          id: item._id,
          name: item.name,
          price: `${item.price.toLocaleString()} VND`,
          quantity: item.quantity,
          category: convertCategory(item.category),
          image: item.image || "/images/default.jpg",
        }));

        setProducts(formattedProducts);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching products:", error);
        setProducts([]);
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  // Function to convert category names if needed
  const convertCategory = (category) => {
    const categoryMap = {
      shoes: "Giày",
      accessory: "Phụ kiện",
      jersey: "Quần áo",
      other: "Đồ ăn & Thức uống",
    };
    return categoryMap[category] || category;
  };

  const filteredProducts =
    selectedCategory === "Tất cả"
      ? products
      : products.filter((product) => product.category === selectedCategory);

  return (
    <div className="p-4  bg-white">
      {/* Categories and Search Form Container */}
      <div className="flex flex-wrap items-center justify-evenly py-4 md:py-8">
        {/* Categories Buttons */}
        <div className="flex items-center flex-wrap gap-3">
          {categories.map((category, index) => (
            <button
              key={index}
              type="button"
              onClick={() => setSelectedCategory(category)}
              className={`text-[#5c3613] border border-white hover:border-[#f1c43e]  rounded-full text-base font-medium px-5 py-2.5 text-center dark:text-white dark:focus:ring-gray-800 ${
                selectedCategory === category
                  ? "bg-[#f1c43e] text-[#5c3613] border-2 border-[#f1c43e]"
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
            className="mb-2 text-sm font-medium text-[#5c3613] sr-only dark:text-white"
          >
            Search
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <svg
                className="w-4 h-4 text-[#5c3613] dark:text-gray-400"
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
              className="block w-full p-4 pl-10 text-sm text-[#5c3613] border border-gray-300 rounded-lg bg-gray-50 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
              placeholder="Search products..."
              required
            />
            <button
              type="submit"
              className="text-[#5c3613] absolute right-2.5 bottom-2.5 bg-[#f1c43e] hover:bg-[#f09627] focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-4 py-2 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800"
            >
              Search
            </button>
          </div>
        </form>
      </div>

      {/* Loading State */}
      {loading ? (
        <p>Loading products...</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {filteredProducts.map((product) => (
            <div
              key={product.id}
              onClick={() => router.push(`/productinfo/${product.id}`)} // Navigate to productinfo page
              className="text-left cursor-pointer border-2 border-gray-200 rounded-lg p-3 hover:border-[#f09627] transition-colors duration-200"
            >
              <div>
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
