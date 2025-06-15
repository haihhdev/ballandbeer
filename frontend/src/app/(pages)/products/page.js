"use client";
import Product2 from "@/components/product2";
import CreateProductForm from "@/components/cproduct";
import MiniChatBot from "@/components/minichatbot";
import ProductCarousel from "@/components/productrcm";
import { useEffect, useState } from "react";

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    // Check if user is logged in
    const loggedInStatus = localStorage.getItem("isLoggedIn");
    setIsLoggedIn(loggedInStatus === "true");

    // Automatically scroll to the ProductCarousel section on page load
    const productCarouselSection = document.querySelector(
      ".product-carousel-section"
    );
    if (productCarouselSection) {
      productCarouselSection.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  return (
    <div>
      {/* Product2 Section */}
      {isLoggedIn && (
        <div className="product-carousel-section">
          <ProductCarousel />
        </div>
      )}
      <Product2 />
      <MiniChatBot />
    </div>
  );
}
