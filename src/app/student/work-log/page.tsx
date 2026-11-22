import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { purgeExpiredChats } from "@/lib/core";
import { applicationStatusClass, applicationStatusLabel, offerStatusLabel } from "@/lib/status";
import Stars from "@/components/Stars";

export const dynamic = "force-dynamic";

export default async function WorkLogPage() {
  const user = await requireUser(["STUDENT"]);
  await purgeExpiredChats(prisma);

  const applications = await prisma.application.findMany({
    where: { studentId: user.id },
    include: {
      offer: { include: { business: { select: { name: true } } } },
      chat: { select: { id: true } },
      feedback: { select: { rating: true, comment: true } },
      walletEntry: { select: { amountTnd: true, minutes: true, createdAt: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const completed = applications.filter((app) => app.status === "COMPLETED").length;
  const active = applications.filter((app) => app.status === "ACCEPTED").length;
  const cancelled = applications.filter((app) => app.status === "CANCELLED").length;
  const earned = applications.reduce((sum, app) => sum + (app.walletEntry?.amountTnd ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">My work log 📒</h1>
          <p className="text-sm text-slate-500">Every shift you accepted, its status, pay and business feedback.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/student/wallet" className="btn-secondary">My wallet →</Link>
          <Link href="/student/offers" className="btn-primary">Find more shifts</Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card"><p className="text-sm text-slate-500">Shifts accepted</p><p className="mt-2 text-3xl font-extrabold">{applications.length}</p></div>
        <div className="card"><p className="text-sm text-slate-500">Finished &amp; paid</p><p className="mt-2 text-3xl font-extrabold text-emerald-600">{completed}</p></div>
        <div className="card"><p className="text-sm text-slate-500">In progress / cancelled</p><p className="mt-2 text-3xl font-extrabold">{active} / {cancelled}</p></div>
        <div className="card"><p className="text-sm text-slate-500">Total earned</p><p className="mt-2 text-3xl font-extrabold text-brand-700">{earned.toFixed(1)} TND</p></div>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-bold">Shift history</h2>
        {applications.length === 0 ? (
          <div className="card text-sm text-slate-500">
            No work logged yet. Accept an offer and it will appear here with its full history.
          </div>
        ) : (
          <div className="space-y-3">
            {applications.map((app) => (
              <article key={app.id} className="card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{app.offer.title}</p>
                    <p className="text-sm text-slate-500">
                      {app.offer.business.name} · {app.offer.city} · {app.offer.durationMin} min · {app.offer.hourlyRate} TND/h
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Offer: {offerStatusLabel(app.offer.status)} · Accepted {app.createdAt.toLocaleDateString("en-GB")}
                      {app.walletEntry && ` · Paid ${app.walletEntry.createdAt.toLocaleDateString("en-GB")}`}
                    </p>
                  </div>
                  <span className={`badge ${applicationStatusClass(app.status)}`}>{applicationStatusLabel(app.status)}</span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3 text-sm">
                  <span className="font-semibold text-brand-700">
                    {app.walletEntry ? `+${app.walletEntry.amountTnd.toFixed(1)} TND earned` : "Not paid yet"}
                  </span>
                  {app.walletEntry && <span className="text-slate-500">{app.walletEntry.minutes} min logged</span>}
                  {app.feedback && (
                    <span className="flex flex-wrap items-center gap-2 text-slate-600">
                      <Stars rating={app.feedback.rating} />
                      {app.feedback.comment && <span className="text-xs italic">“{app.feedback.comment}”</span>}
                    </span>
                  )}
                  {app.chat && (
                    <Link href={`/student/chat/${app.chat.id}`} className="ml-auto text-xs font-semibold text-brand-600 hover:underline">
                      Open chat →
                    </Link>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <p className="text-xs text-slate-400">
        A shift moves to Finished &amp; paid — and its wallet line appears — only when the business marks the work finished.
      </p>
    </div>
  );
}
