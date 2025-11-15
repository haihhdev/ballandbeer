"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation"; // Import useRouter
import Pagination from "./Pagination";

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
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOption, setSortOption] = useState("Sản phẩm nổi bật");

  // Fetch products from API
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await fetch("/api/products");
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        // Check if data is an array
        if (!Array.isArray(data)) {
          console.error("Received non-array data:", data);
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
          image: `https://raw.githubusercontent.com/haihhdev/ballandbeer-image/refs/heads/main/Ballandbeeritem/${item.image}`,
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

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);

  // Sắp xếp sản phẩm theo lựa chọn
  const sortProducts = (products) => {
    let sorted = [...products];
    switch (sortOption) {
      case "Giá: Tăng dần":
        sorted.sort(
          (a, b) =>
            parseInt(a.price.replace(/\D/g, "")) -
            parseInt(b.price.replace(/\D/g, ""))
        );
        break;
      case "Giá: Giảm dần":
        sorted.sort(
          (a, b) =>
            parseInt(b.price.replace(/\D/g, "")) -
            parseInt(a.price.replace(/\D/g, ""))
        );
        break;
      case "Tên: A-Z":
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "Tên: Z-A":
        sorted.sort((a, b) => b.name.localeCompare(a.name));
        break;
      default:
        // Sản phẩm nổi bật giữ nguyên thứ tự
        break;
    }
    return sorted;
  };

  // Lọc sản phẩm theo tên
  const searchedProducts = filteredProducts.filter((product) =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Sắp xếp sản phẩm sau khi lọc
  const finalProducts = sortProducts(searchedProducts);

  const paginatedProducts = finalProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Khi đổi category thì về trang 1
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory]);

  // Khi đổi trang thì cuộn lên đầu danh sách
  const handlePageChange = (page) => {
    setCurrentPage(page);
    const listTop = document.getElementById("product-list-top");
    if (listTop) {
      listTop.scrollIntoView({ behavior: "smooth" });
    }
  };

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
              className={`text-[#5c3613] border border-white hover:border-[#f1c43e]  rounded-full text-base font-medium px-5 py-2.5 text-center  ${
                selectedCategory === category
                  ? "bg-[#f1c43e] text-[#5c3613] border-2 border-[#f1c43e]"
                  : ""
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Search Form và Sort Dropdown */}
        <div className="flex flex-1 items-center justify-end gap-4 max-w-md">
          <form
            className="flex-grow"
            onSubmit={(e) => {
              e.preventDefault();
            }}
          >
            <label
              htmlFor="default-search"
              className="mb-2 text-sm font-medium text-[#5c3613] sr-only"
            >
              Search
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <svg
                  className="w-4 h-4 text-[#5c3613]"
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
                className="block w-full p-2 pl-10 text-sm text-[#5c3613] border border-gray-300 rounded-lg bg-gray-50 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Tìm sản phẩm..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </form>
          {/* Sort Dropdown */}
          <div className="flex items-center">
            <select
              id="sort-select"
              className="border border-gray-300 rounded px-2 py-2 text-[#5c3613] bg-white focus:outline-none focus:ring-2 focus:ring-[#f1c43e] focus:shadow-[0_0_8px_2px_rgba(240,150,39,0.5)] transition-all duration-200 font-medium text-base"
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value)}
            >
              <option>Sản phẩm nổi bật</option>
              <option>Giá: Tăng dần</option>
              <option>Giá: Giảm dần</option>
              <option>Tên: A-Z</option>
              <option>Tên: Z-A</option>
            </select>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <p className="text-center py-8 text-[#5c3613]">Loading products...</p>
      ) : (
        <>
          <div id="product-list-top" />
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
            {paginatedProducts.map((product) => (
              <div
                key={product.id}
                onClick={() => router.push(`/productinfo/${product.id}`)}
                className="flex flex-col bg-white cursor-pointer border-2 border-gray-200 rounded-lg overflow-hidden hover:border-[#f09627] hover:shadow-lg transition-all duration-300 group"
              >
                {/* Image Container - Square Aspect Ratio */}
                <div className="relative w-full aspect-square overflow-hidden bg-gray-100">
                  <img
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    src={product.image}
                    alt={product.name}
                    loading="lazy"
                  />
                  {/* Out of Stock Overlay */}
                  {product.quantity === 0 && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <span className="text-white font-bold text-sm sm:text-base">
                        Hết hàng
                      </span>
                    </div>
                  )}
                </div>

                {/* Product Info */}
                <div className="p-2 sm:p-3 flex flex-col flex-grow">
                  <h3 className="text-sm sm:text-base font-bold text-[#5c3613] line-clamp-2 mb-1 sm:mb-2 min-h-[2.5rem] sm:min-h-[3rem]">
                    {product.name}
                  </h3>
                  <div className="mt-auto space-y-1">
                    <p className="text-xs sm:text-sm text-[#5c3613]">
                      <span className="font-semibold text-[#f09627] text-sm sm:text-base">
                        {product.price}
                      </span>
                    </p>
                    <p className="text-xs text-gray-600">
                      Còn lại:{" "}
                      <span className="font-medium">{product.quantity}</span>
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {/* Pagination */}
          {totalPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
          )}
        </>
      )}
    </div>
  );
}
