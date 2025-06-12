"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function ProductInfo() {
  const { id } = useParams();
  const router = useRouter();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState(0);
  const [averageRating, setAverageRating] = useState(0);
  const [addingToCart, setAddingToCart] = useState(false);
  const [quantity, setQuantity] = useState(1);

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  useEffect(() => {
    if (!id) return;

    const fetchProduct = async () => {
      try {
        const response = await fetch(`http://localhost:4003/api/products/${id}`);
        const data = await response.json();
        setProduct(data);
        setLoading(false);
        
        // Fetch comments and calculate average rating
        const commentsResponse = await fetch(`http://localhost:4003/api/products/${id}/comments`);
        const commentsData = await commentsResponse.json();
        if (commentsData && Array.isArray(commentsData)) {
          setReviews(commentsData.length);
          const totalRating = commentsData.reduce((sum, comment) => sum + comment.rating, 0);
          const avgRating = commentsData.length > 0 ? Math.ceil(totalRating / commentsData.length) : 0;
          setAverageRating(avgRating);
        }
      } catch (error) {
        console.error("Error fetching product:", error);
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  if (loading) return <p>Loading product details...</p>;
  if (!product) return <p>Product not found.</p>;

  const handleBuyNow = () => {
    const userToken = localStorage.getItem("token");
    if (!userToken) {
      toast.warning("Vui lòng đăng nhập để có thể mua hàng!", {
        position: "top-right",
        autoClose: 2000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      return;
    }

    const totalPrice = product.price * quantity;
    router.push(
      `/checkout?name=${product.name}&price=${product.price}&image=${product.image}&quantity=${quantity}&totalPrice=${totalPrice}`
    );
  };

  const handleAddToCart = async () => {
    const userToken = localStorage.getItem("token");
    if (!userToken) {
      toast.warning("Vui lòng đăng nhập để có thể mua hàng!", {
        position: "top-right",
        autoClose: 2000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      return;
    }

    setAddingToCart(true);
    const productToAdd = {
      productId: product._id,
      quantity: quantity,
    };

    try {
      const ordersRes = await fetch("http://localhost:4002/api/orders/my-orders", {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      const ordersData = await ordersRes.json();
      if (!ordersData || !Array.isArray(ordersData.data)) {
        console.error("Lỗi khi load đơn hàng:", ordersData);
        alert("Không lấy được đơn hàng từ hệ thống!");
        setAddingToCart(false);
        return;
      }

      const pendingOrder = ordersData.data.find(order => order.status === "pending");

      if (pendingOrder) {
        const updatedProducts = [...pendingOrder.products];
        const existing = updatedProducts.find(p => p.productId === productToAdd.productId);
        if (existing) {
          existing.quantity += productToAdd.quantity;
        } else {
          updatedProducts.push(productToAdd);
        }

        await fetch(`http://localhost:4002/api/orders/${pendingOrder._id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${userToken}`,
          },
          body: JSON.stringify({ products: updatedProducts, status: "pending" })
        });
      } else {
        await fetch("http://localhost:4002/api/orders/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${userToken}`,
          },
          body: JSON.stringify({ products: [productToAdd] }),
        });
      }

      await sleep(1000);
      router.push("/shoppingcart");
    } catch (error) {
      console.error(error);
      alert("Có lỗi xảy ra khi thêm vào giỏ hàng!");
      setAddingToCart(false);
    }
  };

  // Sử dụng ảnh base64 nếu có, nếu không thì dùng ảnh mặc định
  const productImage = product.image && product.image.startsWith("data:image")
    ? product.image
    : product.image
    ? `https://raw.githubusercontent.com/haihhdev/ballandbeer-image/refs/heads/main/Ballandbeeritem/${product.image}`
    : "/images/missing.png";

  return (
    <div className="bg-white text-black p-6 relative">
      <ToastContainer />
      {addingToCart && (
        <div className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="w-16 h-16 border-4 border-white border-dashed rounded-full animate-spin"></div>
        </div>
      )}

      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-20">
        <div className="flex flex-col items-center">
          <img
            src={productImage}
            alt={product.name}
            className="w-full max-w-md object-cover"
          />
        </div>

        <div>
          <h1 className="text-2xl font-bold text-[#5c3613]">{product.name}</h1>
          <div className="flex items-center mt-2">
            <span className="text-yellow-400 text-lg">
              {[...Array(5)].map((_, index) => (
                <span key={index}>{index < averageRating ? '★' : '☆'}</span>
              ))}
            </span>
            <span className="ml-2 text-sm">({reviews} Lượt đánh giá)</span>
          </div>
          <p className="text-3xl font-semibold mt-4 text-[#5c3613]">{product.price} VND</p>

          <div className="flex space-x-4 mt-6">
            <button
              onClick={handleAddToCart}
              className="rounded-lg px-5 py-2.5 border-2 border-[#5c3613] text-[#5c3613] font-medium hover:bg-[#f1c43e] shadow-lg hover:shadow-[0_0_15px_rgba(240,150,39,0.5)] hover:text-white hover:scale-105 transition-transform"
            >
              <img src="/icons/cart.svg" alt="cart" className="inline w-5 h-5 mr-2 mb-1" />
              Thêm vào giỏ hàng
            </button>
            <button
              onClick={handleBuyNow}
              className="rounded-lg px-5 py-2.5 text-base font-medium border-transparent text-[#f8f7f4] bg-[#f09627] hover:text-[#5c3613] hover:bg-[#f1c43e] hover:scale-105 transition-transform"
            >
              Mua ngay
            </button>
          </div>

          <div className="flex items-center mt-4">
            <span className="mr-4 text-[#5c3613] font-medium">Số Lượng</span>
            <div className="flex items-center border border-gray-300 rounded overflow-hidden select-none">
              <button
                className="w-10 h-10 flex items-center justify-center text-xl text-gray-500 hover:bg-gray-100 border-r border-gray-300"
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                type="button"
              >
                -
              </button>
              <span className="w-12 h-10 flex items-center justify-center font-semibold" style={{ color: '#f09627' }}>{quantity}</span>
              <button
                className="w-10 h-10 flex items-center justify-center text-xl text-gray-500 hover:bg-gray-100 border-l border-gray-300"
                onClick={() => setQuantity(q => q + 1)}
                type="button"
              >
                +
              </button>
            </div>
          </div>

          <div className="mt-6">
            <h3 className="font-semibold text-[#5c3613]">Mô tả sản phẩm</h3>
            <p className="text-sm mt-2 text-[#5c3613]/80">
              Đây là mô tả sản phẩm. Mô tả cung cấp thông tin chi tiết về sản phẩm,
              bao gồm chất liệu, kích thước, và các tính năng nổi bật.
              Mô tả này giúp khách hàng hiểu rõ hơn về sản phẩm trước khi quyết định mua hàng.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
