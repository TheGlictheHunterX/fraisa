import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { purgeExpiredChats } from "@/lib/core";
import Stars from "@/components/Stars";

export const dynamic = "force-dynamic";

export default async function WalletPage() {
  const user = await requireUser(["STUDENT"]);
  await purgeExpiredChats(prisma);

  const [profile, entries, feedback] = await Promise.all([
    prisma.studentProfile.findUnique({ where: { userId: user.id } }),
    prisma.walletEntry.findMany({
      where: { studentId: user.id },
      include: {
        application: {
          include: {
            offer: { include: { business: { select: { name: true } } } },
            feedback: { select: { rating: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.feedback.findMany({ where: { studentId: user.id }, select: { rating: true } }),
  ]);

  const balance = profile?.balanceTnd ?? 0;
  const minutes = profile?.minutesWorked ?? 0;
  const earned = entries.reduce((sum, entry) => sum + entry.amountTnd, 0);
  const minutesLogged = entries.reduce((sum, entry) => sum + entry.minutes, 0);
  const average = feedback.length
    ? feedback.reduce((sum, review) => sum + review.rating, 0) / feedback.length
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">My wallet 💰</h1>
          <p className="text-sm text-slate-500">Everything you earned from finished freelance shifts.</p>
        </div>
        <Link href="/student/work-log" className="btn-secondary">View work log →</Link>
      </div>

      <div className="card bg-gradient-to-br from-brand-700 to-brand-500 text-white">
        <p className="text-sm font-medium text-brand-100">Available balance</p>
        <p className="mt-1 text-5xl font-black tracking-tight">{balance.toFixed(1)} <span className="text-2xl">TND</span></p>
        <p className="mt-2 text-xs text-brand-100">
          Credited when a business marks your work finished · {entries.length} paid shift(s) in your ledger
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card"><p className="text-sm text-slate-500">Total earned</p><p className="mt-2 text-3xl font-extrabold">{earned.toFixed(1)} TND</p><p className="text-xs text-slate-400">All wallet credits</p></div>
        <div className="card"><p className="text-sm text-slate-500">Hours worked</p><p className="mt-2 text-3xl font-extrabold">{(minutes / 60).toFixed(1)}h</p><p className="text-xs text-slate-400">{minutesLogged} paid minutes logged</p></div>
        <div className="card"><p className="text-sm text-slate-500">Finished shifts</p><p className="mt-2 text-3xl font-extrabold">{profile?.completedShifts ?? 0}</p><p className="text-xs text-slate-400">Paid by local businesses</p></div>
        <div className="card"><p className="text-sm text-slate-500">Business rating</p><p className="mt-2 text-3xl font-extrabold">{average.toFixed(1)} ★</p><p className="text-xs text-slate-400">{feedback.length} review(s)</p></div>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-bold">Earnings history</h2>
        {entries.length === 0 ? (
          <div className="card text-sm text-slate-500">
            No earnings yet. Accept a shift and, once the business marks it finished, the money will appear here.
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => {
              const app = entry.application;
              return (
                <article key={entry.id} className="card flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{app.offer.title}</p>
                    <p className="text-sm text-slate-500">
                      {app.offer.business.name} · {entry.description}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Credited {entry.createdAt.toLocaleDateString("en-GB")} at {entry.createdAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-extrabold text-emerald-600">+{entry.amountTnd.toFixed(1)} TND</p>
                    {app.feedback && <div className="mt-1"><Stars rating={app.feedback.rating} /></div>}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <div className="card bg-amber-50 text-sm text-amber-900">
        <p className="font-semibold">How the wallet works</p>
        <p className="mt-1">
          Accepting a shift logs the work as “in progress”. Your balance and this ledger update together only
          when the business clicks <strong>Finished for this student</strong> — one wallet line per paid shift.
        </p>
      </div>
    </div>
  );
}
