import StatCard from "@/components/StatCard";
import { prisma } from "@/lib/prisma";
import { requireAdminOrRoot } from "@/lib/session";
import { grantPlanFormAction, removeOfferFormAction, suspendUserFormAction } from "@/lib/actions";
import { offerStatusClass, offerStatusLabel } from "@/lib/status";
import { isSubscriptionActive, PLAN_DAYS, PLAN_LABELS } from "@/lib/subscription";

export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: { error?: string; done?: string; plan?: string };
}) {
  await requireAdminOrRoot();
  const [users, offers, logs, userActions, businesses] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.offer.findMany({
      include: { business: { select: { name: true } }, _count: { select: { applications: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.moderationLog.findMany({
      include: { admin: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    // targetId is a plain String, so get each user's latest reason explicitly.
    prisma.moderationLog.findMany({
      where: { targetType: "USER" },
      orderBy: { createdAt: "desc" },
      select: { targetId: true, reason: true, action: true },
    }),
    prisma.user.findMany({
      where: { role: "BUSINESS" },
      include: { businessProfile: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const lastActionByUser = new Map<string, string>();
  for (const entry of userActions) {
    if (!lastActionByUser.has(entry.targetId)) {
      lastActionByUser.set(entry.targetId, `${entry.reason} · ${entry.action}`);
    }
  }

  const openOffers = offers.filter((offer) => offer.status === "PENDING").length;
  const suspendedUsers = users.filter((user) => user.status !== "ACTIVE").length;
  const activePlans = businesses.filter((business) => isSubscriptionActive(business.businessProfile)).length;
  const expiredPlans = businesses.length - activePlans;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Moderation dashboard</h1>
        <p className="text-sm text-slate-500">Manage users, offers and review the audit log.</p>
        {searchParams.error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{searchParams.error}</p>
        )}
        {searchParams.done && (
          <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Status updated — the reason was saved to the moderation log and shown to the user.
          </p>
        )}
        {searchParams.plan && (
          <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Plan granted — the business can keep using the platform until the new expiry date.
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Users" value={users.length} hint="All registered accounts" />
        <StatCard label="Open offers" value={openOffers} hint="Visible to students" />
        <StatCard label="Suspended users" value={suspendedUsers} hint="Cannot log in or browse" />
        <StatCard label="Active plans" value={activePlans} hint="Businesses allowed to post" />
        <StatCard label="Expired plans" value={expiredPlans} hint="Locked until admin grants a plan" />
      </div>

      <section id="subscriptions">
        <h2 className="mb-1 text-lg font-bold">Business subscriptions</h2>
        <p className="mb-3 text-sm text-slate-500">
          Every business starts with a {PLAN_DAYS.FREE_TRIAL}-day free trial. When it expires the account is locked
          until an admin grants <strong>BothDiamond</strong> ({PLAN_DAYS.BOTH_DIAMOND} days) or{" "}
          <strong>GoldenEdge</strong> ({PLAN_DAYS.GOLDEN_EDGE} days). Only admins / PIN-root can grant plans.
        </p>
        <div className="space-y-3">
          {businesses.map((business) => {
            const profile = business.businessProfile;
            if (!profile) return null;
            const active = isSubscriptionActive(profile);
            return (
              <div key={business.id} className="card flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-semibold">{profile.businessName}</p>
                  <p className="text-xs text-slate-500">{business.email}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className={`badge ${active ? "bg-brand-100 text-brand-700" : "bg-red-100 text-red-700"}`}>
                      {active ? "ACTIVE" : "EXPIRED / LOCKED"}
                    </span>
                    <span className="text-xs text-slate-600">
                      {PLAN_LABELS[profile.plan]} · until {profile.planExpiresAt.toLocaleDateString("en-GB")}{" "}
                      {profile.planExpiresAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {profile.planGrantedBy && (
                      <span className="text-xs text-slate-400">granted by {profile.planGrantedBy}</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(["FREE_TRIAL", "BOTH_DIAMOND", "GOLDEN_EDGE"] as const).map((plan) => (
                    <form key={plan} action={grantPlanFormAction}>
                      <input type="hidden" name="businessUserId" value={business.id} />
                      <input type="hidden" name="plan" value={plan} />
                      <button
                        type="submit"
                        className={`py-1 text-xs ${plan === "FREE_TRIAL" ? "btn-secondary" : "btn-primary"}`}
                      >
                        {PLAN_LABELS[plan]} · {PLAN_DAYS[plan]}d
                      </button>
                    </form>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">Users</h2>
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Reason on record</th>
                <th className="px-4 py-3">Action (reason required)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-4 py-3 font-medium">{user.name}</td>
                  <td className="px-4 py-3 text-slate-600">{user.email}</td>
                  <td className="px-4 py-3">{user.role}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${user.status === "ACTIVE" ? "bg-brand-100 text-brand-700" : "bg-red-100 text-red-700"}`}>
                      {user.status}
                    </span>
                  </td>
                  <td className="max-w-[220px] px-4 py-3 text-xs text-slate-600">
                    {lastActionByUser.get(user.id) ?? <span className="text-slate-400">No action yet</span>}
                  </td>
                  <td className="px-4 py-3">
                    {user.role === "ADMIN" ? (
                      <span className="text-xs text-slate-400">—</span>
                    ) : (
                      <form action={suspendUserFormAction} className="flex flex-wrap items-center gap-2">
                        <input type="hidden" name="userId" value={user.id} />
                        <input
                          name="reason"
                          required
                          minLength={3}
                          maxLength={200}
                          className="input w-40 py-1 text-xs"
                          placeholder="Reason (required)"
                          aria-label={`Reason for ${user.name}`}
                        />
                        {user.status === "ACTIVE" ? (
                          <>
                            <button name="status" value="SUSPENDED" className="btn-secondary py-1 text-xs" type="submit">
                              Suspend
                            </button>
                            <button name="status" value="BANNED" className="btn-secondary py-1 text-xs text-red-600" type="submit">
                              Ban
                            </button>
                          </>
                        ) : (
                          <button name="status" value="ACTIVE" className="btn-secondary py-1 text-xs" type="submit">
                            Reactivate
                          </button>
                        )}
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">Offers</h2>
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Business</th>
                <th className="px-4 py-3">Applicants</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {offers.map((offer) => (
                <tr key={offer.id}>
                  <td className="px-4 py-3 font-medium">{offer.title}</td>
                  <td className="px-4 py-3 text-slate-600">{offer.business.name}</td>
                  <td className="px-4 py-3">{offer._count.applications}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${offerStatusClass(offer.status)}`}>
                      {offerStatusLabel(offer.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {offer.status === "REMOVED_BY_ADMIN" ? (
                      <span className="text-xs text-slate-400">Removed</span>
                    ) : (
                      <form action={removeOfferFormAction} className="flex items-center gap-2">
                        <input type="hidden" name="offerId" value={offer.id} />
                        <input name="reason" className="input w-32 py-1 text-xs" placeholder="Reason" />
                        <button className="btn-secondary py-1 text-xs text-red-600" type="submit">Remove</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">Moderation log</h2>
        <div className="card space-y-2 p-0">
          <div className="divide-y divide-slate-100">
            {logs.length === 0 ? (
              <p className="px-4 py-3 text-sm text-slate-500">No moderation actions yet.</p>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold">{log.action} · {log.targetType}</p>
                    <p className="text-xs text-slate-500">{log.reason}</p>
                  </div>
                  <p className="text-xs text-slate-400">
                    by {log.admin.name} · {new Date(log.createdAt).toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
