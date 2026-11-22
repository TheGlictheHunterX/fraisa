import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import Stars from "@/components/Stars";
import {
  cancelApplicationFormAction,
  feedbackFormAction,
  finishWorkFormAction,
  removeBusinessOfferFormAction,
  setOfferStatusFormAction,
} from "@/lib/actions";
import {
  applicationStatusClass,
  applicationStatusLabel,
  offerStatusClass,
  offerStatusLabel,
} from "@/lib/status";

export const dynamic = "force-dynamic";

const statuses = ["PENDING", "ACCEPTED", "ENDED"] as const;

export default async function BusinessOffersPage({
  searchParams,
}: {
  searchParams: { error?: string; done?: string };
}) {
  const user = await requireUser(["BUSINESS"]);
  const offers = await prisma.offer.findMany({
    where: { businessId: user.id },
    include: {
      applications: {
        include: {
          student: {
            select: {
              name: true,
              feedbackReceived: { select: { rating: true } },
            },
          },
          chat: { select: { id: true } },
          feedback: { select: { rating: true, comment: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Manage my offers</h1>
          <p className="text-sm text-slate-500">
            Change offer status, finish a student&apos;s work, or remove a listing.
          </p>
        </div>
        <Link href="/business/offers/new" className="btn-primary">+ Post an offer</Link>
      </div>

      {searchParams.error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{searchParams.error}</p>
      )}
      {searchParams.done && (
        <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Updated — the student&apos;s work status and earnings are in sync.
        </p>
      )}

      {offers.length === 0 ? (
        <div className="card text-sm text-slate-500">No offers yet.</div>
      ) : (
        <div className="space-y-4">
          {offers.map((offer) => (
            <div key={offer.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-bold">{offer.title}</h2>
                  <p className="text-sm text-slate-500">
                    {offer.city} · {offer.durationMin} min · {offer.hourlyRate} TND/h
                  </p>
                </div>
                <span className={`badge ${offerStatusClass(offer.status)}`}>{offerStatusLabel(offer.status)}</span>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Offer status:</span>
                {statuses.map((status) => (
                  <form key={status} action={setOfferStatusFormAction}>
                    <input type="hidden" name="offerId" value={offer.id} />
                    <input type="hidden" name="status" value={status} />
                    <button
                      type="submit"
                      disabled={offer.status === status || offer.status.startsWith("REMOVED_")}
                      className={`py-1 text-xs ${offer.status === status ? "btn-primary" : "btn-secondary"}`}
                    >
                      {status === "ENDED" ? "End & pay" : status}
                    </button>
                  </form>
                ))}
                {!offer.status.startsWith("REMOVED_") && (
                  <form action={removeBusinessOfferFormAction} className="ml-auto">
                    <input type="hidden" name="offerId" value={offer.id} />
                    <button type="submit" className="btn-secondary py-1 text-xs text-red-600">Remove offer</button>
                  </form>
                )}
              </div>

              <div className="mt-4 border-t border-slate-100 pt-3">
                <p className="mb-2 text-sm font-semibold">Student work status ({offer.applications.length})</p>
                {offer.applications.length === 0 ? (
                  <p className="text-sm text-slate-400">No applicants yet.</p>
                ) : (
                  <div className="space-y-2">
                    {offer.applications.map((application) => (
                      <div key={application.id} className="rounded-lg bg-slate-50 px-3 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium">{application.student.name}</span>
                            {application.student.feedbackReceived.length > 0 && (
                              <Stars
                                rating={
                                  application.student.feedbackReceived.reduce((sum, r) => sum + r.rating, 0) /
                                  application.student.feedbackReceived.length
                                }
                                count={application.student.feedbackReceived.length}
                              />
                            )}
                          </span>
                          <span className={`badge ${applicationStatusClass(application.status)}`}>
                            {applicationStatusLabel(application.status)}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {application.chat && (
                            <Link href={`/business/chat/${application.chat.id}`} className="btn-secondary py-1 text-xs">
                              Open chat
                            </Link>
                          )}
                          {application.status === "ACCEPTED" && (
                            <>
                              <form action={finishWorkFormAction}>
                                <input type="hidden" name="applicationId" value={application.id} />
                                <button type="submit" className="btn-primary py-1 text-xs">
                                  ✓ Finished for this student (pay {(offer.hourlyRate * (offer.durationMin / 60)).toFixed(1)} TND)
                                </button>
                              </form>
                              <form action={cancelApplicationFormAction}>
                                <input type="hidden" name="applicationId" value={application.id} />
                                <button type="submit" className="btn-secondary py-1 text-xs text-red-600">Cancel work</button>
                              </form>
                            </>
                          )}
                          {application.status === "COMPLETED" && application.completedAt && (
                            <div className="w-full border-t border-slate-200 pt-2">
                              <div className="mb-2 flex flex-wrap items-center gap-2">
                                <span className="text-xs text-emerald-600">
                                  Paid on {application.completedAt.toLocaleDateString("en-GB")}
                                </span>
                                {application.feedback && (
                                  <span className="flex items-center gap-1 text-xs text-slate-500">
                                    Your rating:
                                    <Stars rating={application.feedback.rating} />
                                    {application.feedback.comment && `“${application.feedback.comment}”`}
                                  </span>
                                )}
                              </div>
                              <form action={feedbackFormAction} className="flex flex-wrap items-center gap-2">
                                <input type="hidden" name="applicationId" value={application.id} />
                                <fieldset className="flex items-center gap-0.5">
                                  <legend className="sr-only">Stars for {application.student.name}</legend>
                                  {[1, 2, 3, 4, 5].map((star) => (
                                    <label key={star} className="cursor-pointer text-lg leading-none text-amber-500" title={`${star} star${star > 1 ? "s" : ""}`}>
                                      <input
                                        type="radio"
                                        name="rating"
                                        value={star}
                                        required
                                        defaultChecked={(application.feedback?.rating ?? 0) === star}
                                        className="sr-only"
                                      />
                                      ★
                                    </label>
                                  ))}
                                </fieldset>
                                <input
                                  name="comment"
                                  maxLength={500}
                                  defaultValue={application.feedback?.comment ?? ""}
                                  placeholder="Optional note about this student"
                                  className="input w-56 py-1 text-xs"
                                  aria-label={`Note about ${application.student.name}`}
                                />
                                <button type="submit" className="btn-secondary py-1 text-xs">
                                  {application.feedback ? "Update rating" : "Rate student"}
                                </button>
                              </form>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <p className="mt-2 text-xs text-slate-400">
                  Marking work finished credits the student&apos;s balance and worked hours immediately. Ending an offer pays all accepted students.
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
