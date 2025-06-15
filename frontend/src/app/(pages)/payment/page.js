import dynamic from 'next/dynamic';

const PaymentInfo = dynamic(() => import('@/components/paymentqr'), { ssr: false });

export default function PaymentPage() {
  return <PaymentInfo />;
}
