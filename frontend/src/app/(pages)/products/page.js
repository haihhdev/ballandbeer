import Product2 from "@/components/product2";
import CreateProductForm from "@/components/cproduct";
import MiniChatBot from "@/components/minichatbot";
import ProductCarousel from "@/components/productrcm";

export default function Home() {
  return (
    <div>
      {/* Product2 Section */}
      <ProductCarousel />
      <Product2 />
      <MiniChatBot />
    </div>
  );
}
