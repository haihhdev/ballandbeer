"use client";
import { useEffect } from "react";
import Login from "@/components/login";

export default function Home() {
  useEffect(() => {
    // Automatically scroll to the login section on page load
    const loginSection = document.getElementById("login-section");
    if (loginSection) {
      loginSection.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  return (
    <div>
      {/* Login Section */}
      <div id="login-section">
        <Login />
      </div>
    </div>
  );
}
