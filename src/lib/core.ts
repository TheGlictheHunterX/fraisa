import type { Plan, Prisma, PrismaClient } from "@prisma/client";
import { GETROOT_ACTOR, isSubscriptionActive, planExpiry } from "@/lib/subscription";

export type CoreResult = { ok: boolean; error?: string; chatId?: string; credited?: number };

/** Chat rooms are hard-deleted from the database 24 hours after they are created. */
export const CHAT_TTL_MS = 24 * 60 * 60 * 1000;

/** Only messages we authored are safe to show; Prisma/DB errors are hidden. */
class DomainError extends Error {}

function safeError(error: unknown, fallback: string): string {
  return error instanceof DomainError ? error.message : fallback;
}

/** Pure auth rule: suspended/banned users and unknown users cannot log in. */
export function canLogin(user: { status: string } | null | undefined): boolean {
  return !!user && user.status === "ACTIVE";
}

function newChatExpiry(): Date {
  return new Date(Date.now() + CHAT_TTL_MS);
}

/** Credits the student once, inside whatever transaction the caller opened. */
async function creditStudent(
  tx: Prisma.TransactionClient,
  application: { studentId: string; offerId: string },
  payout: number,
  minutes: number,
): Promise<void> {
  await tx.studentProfile.upsert({
    where: { userId: application.studentId },
    create: {
      userId: application.studentId,
      city: "",
      university: "",
      bio: "",
      phone: "",
      balanceTnd: payout,
      minutesWorked: minutes,
      completedShifts: 1,
    },
    update: {
      balanceTnd: { increment: payout },
      minutesWorked: { increment: minutes },
      completedShifts: { increment: 1 },
    },
  });
}

/** Shared by "Mark finished" and "End offer": completes one accepted application. */
async function completeApplication(
  tx: Prisma.TransactionClient,
  application: { id: string; studentId: string; offerId: string },
  offer: { title: string; hourlyRate: number; durationMin: number },
): Promise<number> {
  const payout = offer.hourlyRate * (offer.durationMin / 60);
  await tx.application.update({
    where: { id: application.id },
    data: { status: "COMPLETED", completedAt: new Date() },
  });
  await creditStudent(tx, application, payout, offer.durationMin);
  // Immutable wallet line: one credit per paid shift, visible in the student's wallet.
  await tx.walletEntry.create({
    data: {
      studentId: application.studentId,
      applicationId: application.id,
      amountTnd: payout,
      minutes: offer.durationMin,
      description: `${offer.title} · ${offer.durationMin} min at ${offer.hourlyRate} TND/h`,
    },
  });
  return payout;
}

/**
 * Creates the Application + 24h Chat in one transaction and flips the offer to ACCEPTED.
 * Idempotent per (offer, student). A single shift can only be taken by one student.
 */
export async function acceptOfferCore(
  prisma: PrismaClient,
  offerId: string,
  studentId: string,
): Promise<CoreResult> {
  try {
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const offer = await tx.offer.findUnique({
        where: { id: offerId },
        include: { business: true, applications: { select: { status: true } } },
      });
      const existing = await tx.application.findUnique({
        where: { offerId_studentId: { offerId, studentId } },
        include: { chat: { select: { id: true, expiresAt: true } } },
      });

      if (!offer || offer.business.status !== "ACTIVE" || offer.status.startsWith("REMOVED_")) {
        throw new DomainError("This offer is no longer available");
      }
      if (existing?.status === "COMPLETED") {
        throw new DomainError("You already completed this shift");
      }
      // A repeat accept by the same student is idempotent; a NEW student needs an open offer.
      if (!existing) {
        if (offer.status !== "PENDING") throw new DomainError("This offer is no longer available");
        if (offer.applications.some((app) => app.status === "ACCEPTED")) {
          throw new DomainError("This shift has already been taken by another student");
        }
      }
      if (existing?.status === "CANCELLED") {
        await tx.chat.deleteMany({ where: { applicationId: existing.id } });
        await tx.application.update({
          where: { id: existing.id },
          data: { status: "ACCEPTED", completedAt: null },
        });
      }

      let applicationId = existing?.id;
      if (!applicationId) {
        const application = await tx.application.create({
          data: { offerId, studentId, status: "ACCEPTED" },
        });
        applicationId = application.id;
      }

      // A purged/expired chat is recreated on a fresh accept, with a new 24h window.
      if (existing?.chat && existing.chat.expiresAt > new Date()) return existing.chat.id;
      await tx.chat.deleteMany({ where: { applicationId } });
      const chat = await tx.chat.create({
        data: { applicationId, expiresAt: newChatExpiry() },
      });
      await tx.offer.update({ where: { id: offerId }, data: { status: "ACCEPTED" } });
      return chat.id;
    });
    return { ok: true, chatId: result };
  } catch (error) {
    return { ok: false, error: safeError(error, "Could not accept offer") };
  }
}

/** Business marks one student's work "finished" — the money/time is credited now. */
export async function finishWorkCore(
  prisma: PrismaClient,
  businessId: string,
  applicationId: string,
): Promise<CoreResult> {
  try {
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { offer: true },
    });
    if (!application) return { ok: false, error: "Application not found" };
    if (application.offer.businessId !== businessId) return { ok: false, error: "Not your shift" };
    if (application.status === "COMPLETED") return { ok: false, error: "Already marked finished" };
    if (application.status === "CANCELLED") return { ok: false, error: "This application was cancelled" };

    const credited = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const payout = await completeApplication(tx, application, application.offer);
      const stillAccepted = await tx.application.count({
        where: { offerId: application.offerId, status: "ACCEPTED" },
      });
      if (stillAccepted === 0) {
        await tx.offer.update({ where: { id: application.offerId }, data: { status: "ENDED" } });
      }
      return payout;
    });
    return { ok: true, credited };
  } catch (error) {
    return { ok: false, error: safeError(error, "Could not finish shift") };
  }
}

/** Business controls the offer lifecycle: PENDING / ACCEPTED / ENDED. */
export async function setOfferStatusCore(
  prisma: PrismaClient,
  businessId: string,
  offerId: string,
  status: "PENDING" | "ACCEPTED" | "ENDED",
): Promise<CoreResult> {
  try {
    const offer = await prisma.offer.findFirst({ where: { id: offerId, businessId } });
    if (!offer) return { ok: false, error: "Offer not found" };
    if (offer.status.startsWith("REMOVED_")) return { ok: false, error: "Offer was removed" };

    const credited = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.offer.update({ where: { id: offerId }, data: { status } });
      if (status !== "ENDED") return 0;

      // Ending an offer finishes every in-progress student shift and pays them.
      const accepted = await tx.application.findMany({
        where: { offerId, status: "ACCEPTED" },
      });
      let total = 0;
      for (const application of accepted) {
        total += await completeApplication(tx, application, offer);
      }
      return total;
    });
    return { ok: true, credited };
  } catch (error) {
    return { ok: false, error: safeError(error, "Could not update offer") };
  }
}

/** Business removes its own offer; unfinished applications are cancelled. */
export async function removeBusinessOfferCore(
  prisma: PrismaClient,
  businessId: string,
  offerId: string,
): Promise<CoreResult> {
  try {
    const offer = await prisma.offer.findFirst({ where: { id: offerId, businessId } });
    if (!offer) return { ok: false, error: "Offer not found" };
    if (offer.status.startsWith("REMOVED_")) return { ok: false, error: "Offer already removed" };

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.offer.update({ where: { id: offerId }, data: { status: "REMOVED_BY_BUSINESS" } });
      await tx.application.updateMany({
        where: { offerId, status: { in: ["PENDING", "ACCEPTED"] } },
        data: { status: "CANCELLED" },
      });
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: safeError(error, "Could not remove offer") };
  }
}

/** Business cancels one student's shift without paying (e.g. no-show). */
export async function cancelApplicationCore(
  prisma: PrismaClient,
  businessId: string,
  applicationId: string,
): Promise<CoreResult> {
  try {
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { offer: true },
    });
    if (!application) return { ok: false, error: "Application not found" };
    if (application.offer.businessId !== businessId) return { ok: false, error: "Not your shift" };
    if (application.status === "COMPLETED") return { ok: false, error: "Finished shifts cannot be cancelled" };

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.application.update({
        where: { id: applicationId },
        data: { status: "CANCELLED" },
      });
      const stillAccepted = await tx.application.count({
        where: { offerId: application.offerId, status: "ACCEPTED" },
      });
      if (stillAccepted === 0 && application.offer.status === "ACCEPTED") {
        await tx.offer.update({ where: { id: application.offerId }, data: { status: "PENDING" } });
      }
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: safeError(error, "Could not cancel application") };
  }
}

/** Business rates a student 1-5 stars. Only possible on a finished shift. */
export async function writeFeedbackCore(
  prisma: PrismaClient,
  businessId: string,
  applicationId: string,
  rating: number,
  comment: string,
): Promise<CoreResult> {
  try {
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { offer: true },
    });
    if (!application) return { ok: false, error: "Application not found" };
    if (application.offer.businessId !== businessId) return { ok: false, error: "Not your shift" };
    if (application.status !== "COMPLETED") {
      return { ok: false, error: "Rate the student only after marking the shift finished" };
    }

    await prisma.feedback.upsert({
      where: { applicationId },
      create: {
        applicationId,
        studentId: application.studentId,
        businessId,
        rating,
        comment: comment || null,
      },
      update: { rating, comment: comment || null },
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: safeError(error, "Could not save feedback") };
  }
}

/**
 * Only an ADMIN (or the PIN-protected /getroot actor) can grant a business plan.
 * Every grant resets the expiry window: 7d trial, 30d BothDiamond, 365d GoldenEdge.
 */
export async function grantPlanCore(
  prisma: PrismaClient,
  actorId: string,
  businessUserId: string,
  plan: Plan,
): Promise<CoreResult> {
  try {
    if (actorId !== GETROOT_ACTOR) {
      const actor = await prisma.user.findUnique({ where: { id: actorId } });
      if (!actor || actor.role !== "ADMIN" || actor.status !== "ACTIVE") {
        return { ok: false, error: "Only an admin can grant a plan" };
      }
    }

    const target = await prisma.user.findUnique({
      where: { id: businessUserId },
      include: { businessProfile: true },
    });
    if (!target || target.role !== "BUSINESS" || !target.businessProfile) {
      return { ok: false, error: "Business account not found" };
    }

    await prisma.businessProfile.update({
      where: { userId: businessUserId },
      data: {
        plan,
        planExpiresAt: planExpiry(plan),
        planGrantedBy: actorId,
        planGrantedAt: new Date(),
      },
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: safeError(error, "Could not grant plan") };
  }
}

/** True when the business profile still has access to the platform. */
export function businessHasAccess(profile: { plan: Plan; planExpiresAt: Date } | null | undefined): boolean {
  return isSubscriptionActive(profile);
}

/** Deletes every chat older than 24h (and its messages) from the database. */
export async function purgeExpiredChats(prisma: PrismaClient): Promise<number> {
  const expired = await prisma.chat.findMany({
    where: { expiresAt: { lt: new Date() } },
    select: { id: true },
  });
  if (expired.length === 0) return 0;
  const ids = expired.map((chat) => chat.id);
  await prisma.message.deleteMany({ where: { chatId: { in: ids } } });
  await prisma.chat.deleteMany({ where: { id: { in: ids } } });
  return ids.length;
}

/** Marks an offer REMOVED_BY_ADMIN and writes an audit entry atomically. */
export async function removeOfferCore(
  prisma: PrismaClient,
  adminId: string,
  offerId: string,
  reason: string,
): Promise<CoreResult> {
  try {
    const offer = await prisma.offer.findUnique({ where: { id: offerId } });
    if (!offer) return { ok: false, error: "Offer not found" };
    if (offer.status === "REMOVED_BY_ADMIN") {
      return { ok: false, error: "Offer already removed" };
    }
    const cleanReason = reason.trim() || "Removed by admin";

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.offer.update({ where: { id: offerId }, data: { status: "REMOVED_BY_ADMIN" } });
      await tx.moderationLog.create({
        data: {
          adminId,
          action: "REMOVE_OFFER",
          targetType: "OFFER",
          targetId: offerId,
          reason: cleanReason,
        },
      });
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: safeError(error, "Could not remove offer") };
  }
}
