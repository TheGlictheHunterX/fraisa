"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { acceptOfferAction } from "@/lib/actions";

export default function AcceptButton({ offerId }: { offerId: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onClick() {
    setLoading(true);
    setError("");
    const result = await acceptOfferAction(offerId);
    if (!result.ok) {
      setError(result.error ?? "Could not accept offer");
      setLoading(false);
      return;
    }
    router.push(result.chatId ? `/student/chat/${result.chatId}` : "/student/chat");
    router.refresh();
  }

  return (
    <div>
      <button className="btn-primary w-full" onClick={onClick} disabled={loading}>
        {loading ? "Accepting…" : "Accept shift & open chat"}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
