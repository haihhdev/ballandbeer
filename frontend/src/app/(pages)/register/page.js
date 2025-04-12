"use client";
import { useEffect } from "react";
import Register from "@/components/register";

export default function Home() {
  useEffect(() => {
    // Automatically scroll to the register section on page load
    const registerSection = document.getElementById("register-section");
    if (registerSection) {
      registerSection.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  return (
    <div>
      {/* Register Section */}
      <div id="register-section">
        <Register />
      </div>
    </div>
  );
}
