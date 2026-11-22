import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { purgeExpiredChats } from "@/lib/core";
import { applicationStatusClass, applicationStatusLabel } from "@/lib/status";

export const dynamic = "force-dynamic";

export default async function StudentOffersPage() {
  const user = await requireUser(["STUDENT"]);
  await purgeExpiredChats(prisma);

  const [offers, applications] = await Promise.all([
    prisma.offer.findMany({
      where: { status: "PENDING", business: { status: "ACTIVE" } },
      include: { business: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.application.findMany({
      where: { studentId: user.id },
      include: {
        offer: { include: { business: { select: { name: true } } } },
        chat: { select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="space-y-8">
      {applications.length > 0 && (
        <section>
          <h1 className="text-2xl font-bold">My shifts</h1>
          <p className="mb-4 text-sm text-slate-500">Status is updated by the business when your work is finished.</p>
          <div className="space-y-3">
            {applications.map((app) => (
              <div key={app.id} className="card flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{app.offer.title}</p>
                  <p className="text-sm text-slate-500">
                    {app.offer.business.name} · {app.offer.durationMin} min · {app.offer.hourlyRate} TND/h
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`badge ${applicationStatusClass(app.status)}`}>{applicationStatusLabel(app.status)}</span>
                  {app.chat && (
                    <Link href={`/student/chat/${app.chat.id}`} className="btn-secondary py-1 text-xs">Open chat</Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h1 className="text-2xl font-bold">Open shifts near you</h1>
        <p className="mb-6 text-sm text-slate-500">
          Short shifts of two hours or less. Accept one to start a private chat and get paid when the business marks it finished.
        </p>

        {offers.length === 0 ? (
          <div className="card text-sm text-slate-500">No open offers right now. Check back soon.</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {offers.map((offer) => (
              <Link key={offer.id} href={`/student/offers/${offer.id}`} className="card block transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-bold">{offer.title}</h2>
                  <span className="badge whitespace-nowrap bg-amber-100 text-amber-700">PENDING</span>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-slate-600">{offer.description}</p>
                <div className="mt-4 flex items-center gap-3 text-xs text-slate-500">
                  <span>📍 {offer.city}</span>
                  <span>⏱ {offer.durationMin} min</span>
                  <span>🏪 {offer.business.name}</span>
                  <span className="ml-auto font-semibold text-brand-700">{offer.hourlyRate} TND/h</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
