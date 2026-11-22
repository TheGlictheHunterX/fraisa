import Nav from "@/components/Nav";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { isSubscriptionActive, PLAN_LABELS } from "@/lib/subscription";

export default async function BusinessLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(["BUSINESS"]);
  const profile = await prisma.businessProfile.findUnique({
    where: { userId: user.id },
    select: { plan: true, planExpiresAt: true },
  });
  const active = isSubscriptionActive(profile);

  return (
    <>
      <Nav
        name={user.name}
        role="BUSINESS"
        links={active ? [
          { href: "/business/dashboard", label: "Dashboard" },
          { href: "/business/offers/new", label: "Post an offer" },
          { href: "/business/offers", label: "My offers" },
        ] : []}
      />
      <main className="mx-auto max-w-6xl px-4 py-8">
        {active ? (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-100 bg-brand-50 px-4 py-2 text-xs text-brand-800">
              <span>
                <strong>Plan:</strong> {profile ? PLAN_LABELS[profile.plan] : "Free trial"} · active until{" "}
                {profile?.planExpiresAt.toLocaleDateString("en-GB")}
              </span>
              <span>Students never pay — subscriptions are for businesses only.</span>
            </div>
            {children}
          </>
        ) : (
          <div className="mx-auto max-w-2xl">
            <div className="card border-red-200 bg-red-50">
              <p className="text-xs font-bold uppercase tracking-widest text-red-600">Subscription required</p>
              <h1 className="mt-2 text-2xl font-bold text-red-900">Your access is locked 🔒</h1>
              <p className="mt-3 text-sm text-red-800">
                The {profile ? PLAN_LABELS[profile.plan] : "free trial"} ended on{" "}
                {profile?.planExpiresAt.toLocaleDateString("en-GB") ?? "—"}. To keep posting shifts and managing
                students, an admin must grant you a plan.
              </p>
              <div className="mt-4 grid gap-2 text-sm text-red-800 sm:grid-cols-2">
                <div className="rounded-lg bg-white p-3"><strong>BothDiamond</strong> — 1 month</div>
                <div className="rounded-lg bg-white p-3"><strong>GoldenEdge</strong> — 1 year</div>
              </div>
              <p className="mt-4 text-xs text-red-700">
                Ask the platform admin to open the admin panel → Subscriptions and grant your business a plan.
                Your data and offers are safe and will be available again immediately.
              </p>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
