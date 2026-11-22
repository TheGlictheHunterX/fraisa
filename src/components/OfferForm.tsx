"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createOfferAction } from "@/lib/actions";

export default function OfferForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const result = await createOfferAction(new FormData(event.currentTarget));
    if (!result.ok) {
      setError(result.error ?? "Could not create offer");
      setLoading(false);
      return;
    }
    router.push("/business/offers");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-4">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div>
        <label className="label" htmlFor="title">Offer title</label>
        <input id="title" name="title" className="input" required minLength={3} placeholder="e.g. Morning barista assistant" />
      </div>
      <div>
        <label className="label" htmlFor="description">Description</label>
        <textarea id="description" name="description" className="input" rows={3} required minLength={10} placeholder="What will the student do?" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="city">City</label>
          <input id="city" name="city" className="input" required placeholder="Tunis" />
        </div>
        <div>
          <label className="label" htmlFor="hourlyRate">Hourly rate (TND)</label>
          <input id="hourlyRate" name="hourlyRate" type="number" step="0.5" min="1" className="input" required defaultValue={10} />
        </div>
        <div>
          <label className="label" htmlFor="durationMin">Duration (minutes, max 120)</label>
          <input id="durationMin" name="durationMin" type="number" min="15" max="120" step="15" className="input" required defaultValue={120} />
        </div>
      </div>
      <button type="submit" className="btn-primary" disabled={loading}>
        {loading ? "Publishing…" : "Publish offer"}
      </button>
    </form>
  );
}
