import Link from "next/link";
import OfferForm from "@/components/OfferForm";

export default function NewOfferPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/business/offers" className="text-sm font-medium text-brand-600 hover:underline">← My offers</Link>
      <h1 className="mb-1 mt-3 text-2xl font-bold">Post a short shift</h1>
      <p className="mb-6 text-sm text-slate-500">Shifts must be 2 hours (120 minutes) or less.</p>
      <OfferForm />
    </div>
  );
}
