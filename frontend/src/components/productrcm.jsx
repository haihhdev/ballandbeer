"use client";
import { useState, useEffect } from "react";
import Slider from "react-slick";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import { useRouter } from "next/navigation";

export default function ProductCarousel() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        // Get userId from localStorage
        const userId = localStorage.getItem("userId");

        // First, get recommended product IDs from RCM FastAPI
        const rcmResponse = await fetch("/recommend", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_id: userId,
            k: 5,
          }),
        });

        if (!rcmResponse.ok)
          throw new Error(`RCM API error! status: ${rcmResponse.status}`);
        const rcmData = await rcmResponse.json();

        // Then fetch product details for each recommended product
        const productPromises = rcmData.recommendations.map(async (rec) => {
          const response = await fetch(
            `/api/products/${rec.product_id}`
          );
          if (!response.ok)
            throw new Error(`Product API error! status: ${response.status}`);
          return response.json();
        });

        const productDetails = await Promise.all(productPromises);

        if (!Array.isArray(productDetails)) {
          setProducts([]);
          setLoading(false);
          return;
        }

        const formattedProducts = productDetails.map((item, idx) => {
          let salePercent = 0;
          if (idx === 0) salePercent = 50;
          else if (idx === 1) salePercent = 40;
          else if (idx === 2) salePercent = 30;
          else if (idx === 3) salePercent = 20;
          else if (idx === 4) salePercent = 10;
          return {
            id: item._id,
            name: item.name,
            price: item.price,
            stock: item.quantity,
            image: `https://raw.githubusercontent.com/haihhdev/ballandbeer-image/refs/heads/main/Ballandbeeritem/${item.image}`,
            salePercent,
          };
        });

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

  const handleProductClick = (e, productId) => {
    e.stopPropagation(); // Prevent event bubbling
    router.push(`/productinfo/${productId}`);
  };

  const settings = {
    dots: false,
    infinite: true,
    speed: 800,
    slidesToShow: 3,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 2000,
    arrows: false,
    responsive: [
      {
        breakpoint: 1024,
        settings: {
          slidesToShow: 2,
        },
      },
      {
        breakpoint: 640,
        settings: {
          slidesToShow: 1,
        },
      },
    ],
  };

  return (
    <div className="w-full min-h-screen py-8 bg-[#f9be0c]">
      {/* Banner Flash Sale */}
      <div className="w-full mb-2 px-2">
        <img
          src="/images/banner.png"
          alt="Flash Sale Banner"
          className="w-full rounded-xl object-cover mx-auto"
          style={{ maxHeight: "50vh" }}
        />
      </div>
      {/* Carousel sản phẩm */}
      {loading ? (
        <div className="text-center py-8 text-[#5c3613] text-lg">
          Đang tải sản phẩm...
        </div>
      ) : (
        <div className="w-full px-2">
          <Slider {...settings}>
            {products.map((product, idx) => (
              <div
                key={product.id || idx}
                className="p-3 h-full"
              >
                <div className="bg-white rounded-2xl border border-[#f0962e] shadow flex flex-col justify-between items-center h-full min-h-[420px]">
                  <div className="w-full flex justify-center items-center p-4 min-h-[260px]">
                    <img
                      src={product.image}
                      alt={product.name}
                      className="object-contain rounded-xl max-h-80 w-full"
                    />
                  </div>
                  <div className="px-4 pb-4 w-full flex flex-col flex-grow">
                    <h2 
                      className="font-bold text-lg text-[#5c3613] mb-2 min-h-[3.5rem] break-words cursor-pointer hover:text-[#f0962e] transition-colors"
                      onClick={(e) => handleProductClick(e, product.id)}
                    >
                      {product.name}
                    </h2>
                    {/* Giá sản phẩm với hiệu ứng discount */}
                    {product.salePercent && product.salePercent > 0 ? (
                      <div className="flex items-center gap-2 mb-1">
                        <span className="line-through text-gray-400 text-base">
                          {product.price.toLocaleString()} VND
                        </span>
                        <span className="text-[#f0962e] font-bold text-lg animate-pulse">
                          {Math.round(
                            product.price * (1 - product.salePercent / 100)
                          ).toLocaleString()}{" "}
                          VND
                        </span>
                        <span className="bg-[#f0962e] text-white text-xs font-bold px-2 py-0.5 rounded animate-bounce">
                          -{product.salePercent}%
                        </span>
                      </div>
                    ) : (
                      <div className="text-[#f0962e] font-semibold text-base mb-1">
                        Giá: {product.price.toLocaleString()} VND
                      </div>
                    )}
                    <div className="text-[#5c3613] text-base mt-auto">
                      Sản phẩm còn lại: {product.stock}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </Slider>
        </div>
      )}
    </div>
  );
}
