import ProductInfo from "@/components/productinfo";
import Comment from "@/components/commentsec";
import MiniChatBot from "@/components/minichatbot";

export default function Home() {
  return (
    <div>
      <ProductInfo />
      {/* Add other components here if needed */}
      <Comment />
      <MiniChatBot />
    </div>
  );
}
