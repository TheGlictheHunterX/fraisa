import Link from "next/link";
import LoginForm from "@/components/LoginForm";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const notice =
    searchParams.error === "suspended"
      ? "Your account has been suspended. Contact an admin."
      : searchParams.error
        ? "Please log in to continue."
        : undefined;

  return (
    <main className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <div className="absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-brand-100/70 to-transparent" />
      <div className="relative">
        <Link href="/" className="mb-8 block text-center text-2xl font-black tracking-tight text-brand-800">
          GetBoth<span className="text-amber-500">.tn</span>
        </Link>
        <h1 className="mb-1 text-center text-3xl font-extrabold tracking-tight text-slate-900">Welcome back</h1>
        <p className="mb-7 text-center text-sm text-slate-500">Log in as a student, business or admin.</p>
        <div className="card">
          <LoginForm notice={notice} />
        </div>
        <p className="mt-5 text-center text-sm text-slate-600">
          New here? <Link href="/register" className="font-semibold text-brand-700 hover:underline">Create an account</Link>
        </p>
      </div>
    </main>
  );
}
