import Link from "next/link";
import StatCard from "@/components/StatCard";
import Stars from "@/components/Stars";
import ProfileForm from "@/components/ProfileForm";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { purgeExpiredChats } from "@/lib/core";
import { applicationStatusClass, applicationStatusLabel, offerStatusLabel } from "@/lib/status";

export const dynamic = "force-dynamic";

export default async function StudentDashboard() {
  const user = await requireUser(["STUDENT"]);
  await purgeExpiredChats(prisma);

  const [profile, applications, feedback] = await Promise.all([
    prisma.studentProfile.findUnique({ where: { userId: user.id } }),
    prisma.application.findMany({
      where: { studentId: user.id },
      include: { offer: { include: { business: { select: { name: true } } } }, chat: { select: { id: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.feedback.findMany({
      where: { studentId: user.id },
      include: { business: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const averageRating = feedback.length
    ? feedback.reduce((sum, review) => sum + review.rating, 0) / feedback.length
    : 0;

  // Money and minutes are credited ONLY when the business marks the work finished.
  const balance = profile?.balanceTnd ?? 0;
  const minutes = profile?.minutesWorked ?? 0;
  const completed = profile?.completedShifts ?? 0;
  const active = applications.filter((app) => app.status === "ACCEPTED").length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Hi {user.name.split(" ")[0]} 👋</h1>
        <p className="text-sm text-slate-500">Your freelance shifts, paid work and earnings at a glance.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Available balance" value={`${balance.toFixed(1)} TND`} hint="Credited when the business marks work finished" />
        <StatCard label="Hours worked" value={`${(minutes / 60).toFixed(1)}h`} hint="Paid minutes logged by businesses" />
        <StatCard label="Finished shifts" value={completed} hint="Completed and paid" />
        <StatCard label="Active shifts" value={active} hint="Accepted, waiting to be finished" />
        <StatCard label="Business rating" value={`${averageRating.toFixed(1)} ★`} hint={`${feedback.length} review(s) from local businesses`} />
      </div>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">My work status</h2>
          <div className="flex flex-wrap gap-3 text-sm font-semibold text-brand-600">
            <Link href="/student/wallet" className="hover:underline">My wallet →</Link>
            <Link href="/student/work-log" className="hover:underline">Work log →</Link>
            <Link href="/student/offers" className="hover:underline">Browse shifts →</Link>
          </div>
        </div>
        {applications.length === 0 ? (
          <div className="card text-sm text-slate-500">No shifts yet. Accept an open offer to get started.</div>
        ) : (
          <div className="space-y-3">
            {applications.map((app) => {
              const payout = app.offer.hourlyRate * (app.offer.durationMin / 60);
              return (
                <div key={app.id} className="card flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{app.offer.title}</p>
                    <p className="text-sm text-slate-500">
                      {app.offer.business.name} · {app.offer.city} · {app.offer.durationMin} min · {app.offer.hourlyRate} TND/h
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Offer: {offerStatusLabel(app.offer.status)}
                      {app.status === "COMPLETED" && ` · Earned ${payout.toFixed(1)} TND`}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={`badge ${applicationStatusClass(app.status)}`}>{applicationStatusLabel(app.status)}</span>
                    {app.chat && (
                      <Link href={`/student/chat/${app.chat.id}`} className="btn-secondary">Open chat</Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <p className="mt-3 text-xs text-slate-400">
          Chats are automatically deleted from the database 24 hours after they start.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">Feedback from businesses</h2>
        {feedback.length === 0 ? (
          <div className="card text-sm text-slate-500">
            No ratings yet. Once a business marks one of your shifts finished, it can rate you from 1 to 5 stars.
          </div>
        ) : (
          <div className="space-y-3">
            {feedback.map((review) => (
              <div key={review.id} className="card flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{review.business.name}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {review.comment || "No written note — just a star rating."}
                  </p>
                </div>
                <div className="text-right">
                  <Stars rating={review.rating} />
                  <p className="mt-1 text-xs text-slate-400">
                    {review.createdAt.toLocaleDateString("en-GB")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section id="profile">
        <h2 className="mb-3 text-lg font-bold">My profile</h2>
        <ProfileForm
          role="STUDENT"
          values={{
            name: user.name,
            city: profile?.city ?? "",
            phone: profile?.phone ?? "",
            bio: profile?.bio ?? "",
            university: profile?.university ?? "",
            businessName: "",
            category: "",
            description: "",
          }}
        />
      </section>
    </div>
  );
}
