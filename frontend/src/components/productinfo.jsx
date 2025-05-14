"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation"; // Import useRouter

export default function ProductInfo() {
  const { id } = useParams(); // Lấy ID từ URL
  const router = useRouter(); // Khởi tạo router
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState(0); // State để lưu số lượt đánh giá
  // Map of product _id to image paths
  const imageMap = {
    "67ff9ff35e234d7307549c8f": "/images/products/giay4.jpeg",
    "67ff9ff35e234d7307549c90": "/images/products/giay2.jpeg",
    "67ff9ff35e234d7307549c91": "/images/products/giay1.jpeg",
    "67ff9ff35e234d7307549c92": "/images/products/giay5.webp",
    "67ff9ff35e234d7307549c93": "/images/products/giay6.jpeg",
    "67ff9ff35e234d7307549c94": "/images/products/binhnuoc.jpg",
    "67ff9ff35e234d7307549c95": "/images/products/bocongdong.webp",
    "67ff9ff35e234d7307549c96": "/images/products/bongda.webp",
    "67ff9ff35e234d7307549c97": "/images/products/gangtay.jpg",
    "67ff9ff35e234d7307549c98": "/images/products/tat.webp",
    "67ff9ff35e234d7307549c99": "/images/products/aoj97.jpg",
    "67ff9ff35e234d7307549c9a": "/images/products/ao5.jpeg",
    "67ff9ff35e234d7307549c9b": "/images/products/ao1.webp",
    "67ff9ff35e234d7307549c9c": "/images/products/ao4.jpg",
    "67ff9ff35e234d7307549c9d": "/images/products/ao2.webp",
    "67ff9ff35e234d7307549c9e": "/images/products/sting.jpg",
    "67ff9ff35e234d7307549c9f": "/images/products/nuoc4.jpg",
    "67ff9ff35e234d7307549ca0": "/images/products/nuoc1.jpeg",
    "67ff9ff35e234d7307549ca1": "/images/products/nuoc2.jpg",
    "67ff9ff35e234d7307549ca2": "/images/products/doan2.webp",
    "67ff9ff35e234d7307549ca3": "/images/products/doan1.jpg",
  };

  useEffect(() => {
    if (!id) return; // Đợi đến khi ID có giá trị

    const fetchProduct = async () => {
      try {
        const response = await fetch(
          `product/api/products/${id}`
        );
        const data = await response.json();
        setProduct({
          ...data,
          image: imageMap[data._id] || "/images/default.jpg",
        });
        setLoading(false);

        // Tạo số lượt đánh giá ngẫu nhiên từ 100 đến 500
        const randomReviews = Math.floor(Math.random() * (500 - 100 + 1)) + 100;
        setReviews(randomReviews);
      } catch (error) {
        console.error("Error fetching product:", error);
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  if (loading) {
    return <p>Loading product details...</p>;
  }

  if (!product) {
    return <p>Product not found.</p>;
  }
  const handleBuyNow = () => {
    const quantity = document.getElementById("quantityInput").value; // Lấy số lượng từ input
    const totalPrice = product.price * quantity; // Tính tổng tiền
    // Chuyển hướng đến trang checkout với thông tin sản phẩm
    router.push(
      `/checkout?name=${product.name}&price=${product.price}&image=${product.image}&quantity=${quantity}&totalPrice=${totalPrice}`
    );
  };
  const handleAddToCart = () => {
    const quantity = document.getElementById("quantityInput").value; // Lấy số lượng từ input
    const cartItem = {
      id: product._id,
      name: product.name,
      price: product.price,
      quantity: parseInt(quantity, 10),
      image: product.image,
    };

    // Lấy giỏ hàng hiện tại từ localStorage
    const cart = JSON.parse(localStorage.getItem("cart")) || [];

    // Kiểm tra nếu sản phẩm đã tồn tại trong giỏ hàng
    const existingItemIndex = cart.findIndex((item) => item.id === cartItem.id);
    if (existingItemIndex !== -1) {
      cart[existingItemIndex].quantity += cartItem.quantity; // Cộng dồn số lượng
    } else {
      cart.push(cartItem); // Thêm sản phẩm mới
    }

    // Lưu lại giỏ hàng vào localStorage
    localStorage.setItem("cart", JSON.stringify(cart));

    // Chuyển hướng đến trang shoppingcart
    router.push("/shoppingcart");
  };
  return (
    <div className="bg-green-50 text-black p-6 mb-[32vh]">
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-20">
        {/* Product Image Section */}
        <div className="flex flex-col items-center">
          <img
            src={product.image || "/images/default.jpg"} // Hiển thị ảnh sản phẩm
            alt={product.name}
            className="w-full max-w-md object-cover"
          />
        </div>

        {/* Product Details Section */}
        <div>
          <h1 className="text-2xl font-bold">{product.name}</h1>
          <div className="flex items-center mt-2">
            <span className="text-yellow-400 text-lg">★★★★★</span>
            <span className="ml-2 text-sm">({reviews} Lượt đánh giá.)</span>
          </div>
          <p className="text-3xl font-semibold mt-4">{product.price} VND</p>

          {/* Buttons */}
          <div className="flex space-x-4 mt-6">
            <button
              id="cartBtn"
              onClick={handleAddToCart}
              className="rounded-lg px-5 py-2.5 border-2 border-green-600 text-black font-medium hover:bg-green-500 hover:text-white hover:scale-105 transition-transform"
            >
              🛒 Thêm vào giỏ hàng
            </button>
            <button
              id="buyBtn"
              onClick={handleBuyNow}
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
              id="quantityInput" // Thêm ID để lấy giá trị
              min="1"
              defaultValue="1"
              className="w-16 p-2 border border-gray-700 bg-gray-100 rounded text-black"
            />
          </div>

          {/* Description Section */}
          <div className="mt-6">
            <h3 className="font-semibold">Description</h3>
            <p className="text-sm text-gray-400 mt-2">
              Đây là mô tả sản phẩm. Mô tả cung cấp thông tin chi tiết về sản
              phẩm, bao gồm chất liệu, kích thước, và các tính năng nổi bật. Mô
              tả này giúp khách hàng hiểu rõ hơn về sản phẩm trước khi quyết
              định mua hàng.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
