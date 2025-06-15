'use client';

import dynamic from 'next/dynamic';

const PaymentProd = dynamic(() => import('@/components/paymentprod'), { ssr: false });

export default function PaymentPage() {
  return <PaymentProd />;
}
