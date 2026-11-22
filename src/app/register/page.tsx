import Link from "next/link";
import RegisterForm from "@/components/RegisterForm";

export default function RegisterPage() {
  return (
    <main className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <div className="absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-brand-100/70 to-transparent" />
      <div className="relative">
        <Link href="/" className="mb-8 block text-center text-2xl font-black tracking-tight text-brand-800">
          GetBoth<span className="text-amber-500">.tn</span>
        </Link>
        <h1 className="mb-1 text-center text-3xl font-extrabold tracking-tight text-slate-900">Join GetBoth</h1>
        <p className="mb-7 text-center text-sm text-slate-500">Free for students and local businesses.</p>
        <div className="card">
          <RegisterForm />
        </div>
        <p className="mt-5 text-center text-sm text-slate-600">
          Already have an account? <Link href="/login" className="font-semibold text-brand-700 hover:underline">Log in</Link>
        </p>
      </div>
    </main>
  );
}
