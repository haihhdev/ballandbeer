import Product2 from "@/components/product2";
import ProductView from "@/components/productview";
import Checkout from "@/components/checkout";

export default function Home() {
  return (
    <div>
      {/* Product2 Section */}
      <Product2 />
      {/* ProductView Section */}
      <ProductView />

      {/* Checkout Section */}
      <Checkout />
    </div>
  );
}
