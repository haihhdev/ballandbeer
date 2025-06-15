import Profile from "@/components/profile";
import { Suspense } from "react";

export default function Home() {
  return (
    <div>
      {/* Profile Section */}
      <Suspense fallback={<div>Loading...</div>}>
        <Profile />
      </Suspense>
    </div>
  );
}
