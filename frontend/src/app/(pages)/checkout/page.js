'use client';

import React, { Suspense } from "react";
import Checkout from "@/components/checkout";

export default function Home() {
  return (
    <Suspense fallback={<div>Loading checkout...</div>}>
      <Checkout />
    </Suspense>
  );
}
