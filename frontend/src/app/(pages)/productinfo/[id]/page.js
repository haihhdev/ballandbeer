import ProductInfo from "@/components/productinfo";
import Comment from "@/components/commentsec";
import Minichatbot from "@/components/minichatbot";

export default function Home() {
  return (
    <div>
      <ProductInfo />
      {/* Add other components here if needed */}
      <Comment />
      <Minichatbot />
    </div>
  );
}
