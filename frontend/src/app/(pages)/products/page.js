"use client";
import Product2 from "@/components/product2";
import CreateProductForm from "@/components/cproduct";
import MiniChatBot from "@/components/minichatbot";
import ProductCarousel from "@/components/productrcm";
import { useEffect } from "react";

export default function Home() {
  useEffect(() => {
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
      <div className="product-carousel-section">
        <ProductCarousel />
      </div>
      <Product2 />
      <MiniChatBot />
    </div>
  );
}
