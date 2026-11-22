import Link from "next/link";
import { notFound } from "next/navigation";
import AcceptButton from "@/components/AcceptButton";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { purgeExpiredChats } from "@/lib/core";
import { applicationStatusClass, applicationStatusLabel, offerStatusClass, offerStatusLabel } from "@/lib/status";

export const dynamic = "force-dynamic";

export default async function OfferDetailPage({ params }: { params: { id: string } }) {
  const user = await requireUser(["STUDENT"]);
  await purgeExpiredChats(prisma);

  const offer = await prisma.offer.findFirst({
    where: { id: params.id, business: { status: "ACTIVE" } },
    include: { business: { select: { name: true } } },
  });
  if (!offer) notFound();

  const existing = await prisma.application.findUnique({
    where: { offerId_studentId: { offerId: offer.id, studentId: user.id } },
    include: { chat: { select: { id: true } } },
  });

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/student/offers" className="text-sm font-medium text-brand-600 hover:underline">← All offers</Link>
      <div className="card mt-3 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{offer.title}</h1>
            <p className="mt-1 text-sm text-slate-500">Posted by {offer.business.name}</p>
          </div>
          <span className={`badge ${offerStatusClass(offer.status)}`}>Offer: {offerStatusLabel(offer.status)}</span>
        </div>

        <div className="grid grid-cols-3 gap-3 rounded-lg bg-slate-50 p-4 text-center">
          <div><p className="text-xs text-slate-500">Pay</p><p className="font-bold">{offer.hourlyRate} TND/h</p></div>
          <div><p className="text-xs text-slate-500">Duration</p><p className="font-bold">{offer.durationMin} min</p></div>
          <div><p className="text-xs text-slate-500">City</p><p className="font-bold">{offer.city}</p></div>
        </div>

        <div>
          <h2 className="mb-1 font-semibold">About the shift</h2>
          <p className="whitespace-pre-wrap text-sm text-slate-600">{offer.description}</p>
        </div>

        {existing ? (
          <div className="rounded-lg bg-brand-50 p-4">
            <p className="font-semibold text-brand-700">Your work on this shift</p>
            <p className="mt-1 text-sm text-brand-700">
              Status: <span className="font-semibold">{applicationStatusLabel(existing.status)}</span>
            </p>
            <p className="mt-1 text-xs text-brand-700/80">
              Your earnings and worked hours are credited when this business marks the work finished.
            </p>
            {existing.chat && (
              <Link href={`/student/chat/${existing.chat.id}`} className="btn-primary mt-3">Open chat</Link>
            )}
            {existing.status === "COMPLETED" && (
              <p className="mt-3 font-bold text-emerald-700">
                Earned {(offer.hourlyRate * (offer.durationMin / 60)).toFixed(1)} TND
              </p>
            )}
          </div>
        ) : offer.status === "PENDING" ? (
          <AcceptButton offerId={offer.id} />
        ) : (
          <div className="rounded-lg bg-slate-100 p-4 text-sm text-slate-600">
            This offer is {offerStatusLabel(offer.status).toLowerCase()} and is no longer accepting students.
          </div>
        )}
      </div>
    </div>
  );
}
