"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSession, signIn } from "next-auth/react";
import { accountBlockAction } from "@/lib/actions";

function homeFor(role?: string) {
  if (role === "ADMIN") return "/admin";
  if (role === "BUSINESS") return "/business/dashboard";
  return "/student/dashboard";
}

export default function LoginForm({ notice }: { notice?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(notice ?? "");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    // A blocked student or employer always sees the recorded reason.
    const block = await accountBlockAction(email);
    if (block.blocked) {
      setError(`Account ${block.status.toLowerCase()}. Reason: ${block.reason}`);
      setLoading(false);
      return;
    }

    const result = await signIn("credentials", { email, password, redirect: false });
    if (!result?.ok) {
      setError("Invalid email or password.");
      setLoading(false);
      return;
    }
    const session = await getSession();
    router.push(homeFor(session?.user?.role));
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-4">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.tn" />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input id="password" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" />
      </div>
      <button type="submit" className="btn-primary w-full" disabled={loading}>
        {loading ? "Signing in…" : "Log in"}
      </button>
    </form>
  );
}
