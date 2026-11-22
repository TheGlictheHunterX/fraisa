import Link from "next/link";
import StatCard from "@/components/StatCard";
import Stars from "@/components/Stars";
import ProfileForm from "@/components/ProfileForm";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { applicationStatusClass, applicationStatusLabel, offerStatusClass, offerStatusLabel } from "@/lib/status";

export const dynamic = "force-dynamic";

export default async function BusinessDashboard() {
  const user = await requireUser(["BUSINESS"]);
  const [profile, offers] = await Promise.all([
    prisma.businessProfile.findUnique({ where: { userId: user.id } }),
    prisma.offer.findMany({
      where: { businessId: user.id },
      include: {
        applications: {
          include: {
            chat: { select: { id: true } },
            student: {
              select: {
                name: true,
                feedbackReceived: { select: { rating: true } },
              },
            },
            offer: { select: { durationMin: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const allApplications = offers.flatMap((offer) => offer.applications);
  const inProgress = allApplications.filter((app) => app.status === "ACCEPTED").length;
  const finished = allApplications.filter((app) => app.status === "COMPLETED").length;
  const hours = allApplications
    .filter((app) => app.status === "ACCEPTED" || app.status === "COMPLETED")
    .reduce((sum, app) => sum + app.offer.durationMin / 60, 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{profile?.businessName ?? user.name} dashboard</h1>
          <p className="text-sm text-slate-500">Manage offers, student work status and payments.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/business/offers" className="btn-secondary">Manage offers</Link>
          <Link href="/business/offers/new" className="btn-primary">+ Post an offer</Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Offers posted" value={offers.length} hint="All your listings" />
        <StatCard label="In progress" value={inProgress} hint="Students accepted, not finished" />
        <StatCard label="Finished & paid" value={finished} hint="Shift marked finished by you" />
        <StatCard label="Booked hours" value={`${hours.toFixed(1)}h`} hint="Accepted + finished shifts" />
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Your offers</h2>
          <Link href="/business/offers" className="text-sm font-semibold text-brand-600 hover:underline">
            Change status, finish work or remove →
          </Link>
        </div>
        {offers.length === 0 ? (
          <div className="card text-sm text-slate-500">No offers yet. Post your first short shift.</div>
        ) : (
          <div className="space-y-3">
            {offers.map((offer) => (
              <div key={offer.id} className="card flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{offer.title}</p>
                  <p className="text-sm text-slate-500">{offer.city} · {offer.durationMin} min · {offer.hourlyRate} TND/h</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className={`badge ${offerStatusClass(offer.status)}`}>{offerStatusLabel(offer.status)}</span>
                  <span className="text-sm text-slate-600">{offer.applications.length} applicant(s)</span>
                </div>
                {offer.applications.length > 0 && (
                  <div className="w-full space-y-1 border-t border-slate-100 pt-3">
                    {offer.applications.map((app) => {
                      const reviews = app.student.feedbackReceived;
                      const avg = reviews.length
                        ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
                        : 0;
                      return (
                        <div key={app.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                          <span>{app.student.name}</span>
                          <span className="flex flex-wrap items-center gap-3">
                            {reviews.length > 0 && <Stars rating={avg} count={reviews.length} />}
                            <span className={`badge ${applicationStatusClass(app.status)}`}>{applicationStatusLabel(app.status)}</span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section id="profile">
        <h2 className="mb-3 text-lg font-bold">Business profile</h2>
        <ProfileForm
          role="BUSINESS"
          values={{
            name: user.name,
            city: profile?.city ?? "",
            phone: profile?.phone ?? "",
            bio: "",
            university: "",
            businessName: profile?.businessName ?? "",
            category: profile?.category ?? "",
            description: profile?.description ?? "",
          }}
        />
      </section>
    </div>
  );
}
