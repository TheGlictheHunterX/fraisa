"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSession, signIn } from "next-auth/react";
import { registerAction } from "@/lib/actions";

type Role = "STUDENT" | "BUSINESS";

export default function RegisterForm() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("STUDENT");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const formData = new FormData(event.currentTarget);
    formData.set("role", role);
    const result = await registerAction(formData);
    if (!result.ok) {
      setError(result.error ?? "Could not register");
      setLoading(false);
      return;
    }
    const email = String(formData.get("email"));
    const password = String(formData.get("password"));
    const signed = await signIn("credentials", { email, password, redirect: false });
    if (!signed?.ok) {
      router.push("/login");
      return;
    }
    const session = await getSession();
    router.push(session?.user?.role === "BUSINESS" ? "/business/dashboard" : "/student/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-4">
      <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1">
        {(["STUDENT", "BUSINESS"] as Role[]).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setRole(option)}
            className={`rounded-md py-2 text-sm font-semibold transition-colors ${
              role === option ? "bg-white text-brand-700 shadow-sm" : "text-slate-500"
            }`}
          >
            {option === "STUDENT" ? "I'm a student" : "I'm a business"}
          </button>
        ))}
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div>
        <label className="label" htmlFor="name">{role === "STUDENT" ? "Full name" : "Contact name"}</label>
        <input id="name" name="name" className="input" required minLength={2} />
      </div>
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" className="input" required />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input id="password" name="password" type="password" className="input" required minLength={6} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="city">City</label>
          <input id="city" name="city" className="input" required placeholder="Tunis" />
        </div>
        <div>
          <label className="label" htmlFor="phone">Phone</label>
          <input id="phone" name="phone" className="input" required placeholder="+216 …" />
        </div>
      </div>

      {role === "STUDENT" ? (
        <div>
          <label className="label" htmlFor="university">University</label>
          <input id="university" name="university" className="input" required placeholder="Université de Tunis" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="businessName">Business name</label>
            <input id="businessName" name="businessName" className="input" required />
          </div>
          <div>
            <label className="label" htmlFor="category">Category</label>
            <input id="category" name="category" className="input" required placeholder="Café, retail…" />
          </div>
        </div>
      )}

      <button type="submit" className="btn-primary w-full" disabled={loading}>
        {loading ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
