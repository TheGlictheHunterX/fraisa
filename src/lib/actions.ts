"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Role, type Plan } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getActionUser, getAdminOrRootActionUser, getSubscribedBusinessUser } from "@/lib/session";
import { clearGetRootCookie, GETROOT_PIN, setGetRootCookie } from "@/lib/getroot";
import { planExpiry } from "@/lib/subscription";
import {
  feedbackSchema,
  messageSchema,
  moderationReasonSchema,
  offerSchema,
  profileSchema,
  registerSchema,
} from "@/lib/schemas";
import { isChatParticipant } from "@/lib/chat-access";
import {
  acceptOfferCore,
  cancelApplicationCore,
  canLogin,
  finishWorkCore,
  grantPlanCore,
  purgeExpiredChats,
  removeBusinessOfferCore,
  removeOfferCore,
  setOfferStatusCore,
  writeFeedbackCore,
} from "@/lib/core";

export type ActionResult = { ok: boolean; error?: string; chatId?: string };

export async function registerAction(formData: FormData): Promise<ActionResult> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid details" };
  }
  const data = parsed.data;
  const email = data.email.toLowerCase();

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return { ok: false, error: "That email is already registered" };

    const passwordHash = await bcrypt.hash(data.password, 10);
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { name: data.name, email, passwordHash, role: data.role },
      });
      if (data.role === "STUDENT") {
        await tx.studentProfile.create({
          data: {
            userId: user.id,
            city: data.city,
            phone: data.phone,
            university: data.university ?? "",
            bio: "",
          },
        });
      } else {
        await tx.businessProfile.create({
          data: {
            userId: user.id,
            city: data.city,
            phone: data.phone,
            businessName: data.businessName ?? "",
            category: data.category ?? "",
            description: "",
            plan: "FREE_TRIAL",
            planExpiresAt: planExpiry("FREE_TRIAL"),
          },
        });
      }
    });
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not create account. Please try again." };
  }
}

export async function createOfferAction(formData: FormData): Promise<ActionResult> {
  const user = await getSubscribedBusinessUser();
  if (!user) return { ok: false, error: "You must be signed in as a business" };

  const parsed = offerSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid offer" };
  }

  try {
    const businessProfile = await prisma.businessProfile.findUnique({ where: { userId: user.id } });
    if (!businessProfile) return { ok: false, error: "Complete your profile first" };

    await prisma.offer.create({
      data: {
        businessId: user.id,
        ...parsed.data,
      },
    });
    revalidatePath("/business/offers");
    revalidatePath("/business/dashboard");
    revalidatePath("/student/offers");
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not create offer" };
  }
}

export async function acceptOfferAction(offerId: string): Promise<ActionResult> {
  const user = await getActionUser([Role.STUDENT]);
  if (!user) return { ok: false, error: "You must be signed in as a student" };
  if (!offerId) return { ok: false, error: "Missing offer" };

  const result = await acceptOfferCore(prisma, offerId, user.id);
  if (result.ok) {
    revalidatePath("/student/offers");
    revalidatePath(`/student/offers/${offerId}`);
    revalidatePath("/student/dashboard");
    revalidatePath("/student/chat");
    revalidatePath("/business/offers");
  }
  return result;
}

export type ManageableOfferStatus = "PENDING" | "ACCEPTED" | "ENDED";

/** Business: change PENDING / ACCEPTED / ENDED. Ending pays every accepted student. */
export async function setOfferStatusAction(
  offerId: string,
  status: ManageableOfferStatus,
): Promise<ActionResult> {
  const user = await getSubscribedBusinessUser();
  if (!user) return { ok: false, error: "You must be signed in as a business" };

  const result = await setOfferStatusCore(prisma, user.id, offerId, status);
  if (result.ok) {
    revalidatePath("/business/offers");
    revalidatePath("/business/dashboard");
    revalidatePath("/student/offers");
    revalidatePath("/student/dashboard");
  }
  return result;
}

/** Business: mark one student's work finished → credits money + worked time. */
export async function finishWorkAction(applicationId: string): Promise<ActionResult> {
  const user = await getSubscribedBusinessUser();
  if (!user) return { ok: false, error: "You must be signed in as a business" };

  const result = await finishWorkCore(prisma, user.id, applicationId);
  if (result.ok) {
    revalidatePath("/business/offers");
    revalidatePath("/business/dashboard");
    revalidatePath("/student/offers");
    revalidatePath("/student/dashboard");
  }
  return result;
}

export async function cancelApplicationAction(applicationId: string): Promise<ActionResult> {
  const user = await getSubscribedBusinessUser();
  if (!user) return { ok: false, error: "You must be signed in as a business" };

  const result = await cancelApplicationCore(prisma, user.id, applicationId);
  if (result.ok) {
    revalidatePath("/business/offers");
    revalidatePath("/business/dashboard");
    revalidatePath("/student/offers");
    revalidatePath("/student/dashboard");
  }
  return result;
}

export async function removeBusinessOfferAction(offerId: string): Promise<ActionResult> {
  const user = await getSubscribedBusinessUser();
  if (!user) return { ok: false, error: "You must be signed in as a business" };

  const result = await removeBusinessOfferCore(prisma, user.id, offerId);
  if (result.ok) {
    revalidatePath("/business/offers");
    revalidatePath("/business/dashboard");
    revalidatePath("/student/offers");
  }
  return result;
}

/** Business rates a student 1-5 stars after the work was marked finished. */
export async function submitFeedbackAction(
  applicationId: string,
  rating: number,
  comment: string,
): Promise<ActionResult> {
  const user = await getSubscribedBusinessUser();
  if (!user) return { ok: false, error: "You must be signed in as a business" };

  const parsed = feedbackSchema.safeParse({ rating, comment });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid rating" };
  }

  const result = await writeFeedbackCore(
    prisma,
    user.id,
    applicationId,
    parsed.data.rating,
    parsed.data.comment ?? "",
  );
  if (result.ok) {
    revalidatePath("/business/offers");
    revalidatePath("/business/dashboard");
    revalidatePath("/student/dashboard");
    revalidatePath("/student/offers");
  }
  return result;
}

/** Called by the in-app scheduler and the cron route: hard-delete 24h-old chats. */
export async function cleanupExpiredChatsAction(): Promise<{ ok: boolean; deleted: number }> {
  try {
    return { ok: true, deleted: await purgeExpiredChats(prisma) };
  } catch {
    return { ok: false, deleted: 0 };
  }
}

export async function sendMessageAction(chatId: string, formData: FormData): Promise<ActionResult> {
  const user = await getActionUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const parsed = messageSchema.safeParse({ content: formData.get("content") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid message" };

  try {
    const allowed = await isChatParticipant(prisma, chatId, user.id, user.role);
    if (!allowed) return { ok: false, error: "Chat not found" };
    await prisma.message.create({
      data: { chatId, senderId: user.id, content: parsed.data.content },
    });
    revalidatePath(`/student/chat/${chatId}`);
    revalidatePath(`/business/chat/${chatId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not send message" };
  }
}

export type MessageView = {
  id: string;
  content: string;
  createdAt: string;
  senderId: string;
  senderName: string;
  mine: boolean;
};

export async function getMessagesAction(
  chatId: string,
): Promise<{ ok: boolean; error?: string; messages: MessageView[] }> {
  const user = await getActionUser();
  if (!user) return { ok: false, error: "Not signed in", messages: [] };

  try {
    const allowed = await isChatParticipant(prisma, chatId, user.id, user.role);
    if (!allowed) {
      return { ok: false, error: "This chat is no longer available — chats are deleted 24 hours after they start.", messages: [] };
    }
    const messages = await prisma.message.findMany({
      where: { chatId },
      orderBy: { createdAt: "asc" },
      include: { sender: { select: { name: true } } },
    });
    return {
      ok: true,
      messages: messages.map((m) => ({
        id: m.id,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
        senderId: m.senderId,
        senderName: m.sender.name,
        mine: m.senderId === user.id,
      })),
    };
  } catch {
    return { ok: false, error: "Could not load messages", messages: [] };
  }
}

export async function updateProfileAction(formData: FormData): Promise<ActionResult> {
  const user = await getActionUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const parsed = profileSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid details" };
  }
  const data = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { name: data.name } });
      if (user.role === "STUDENT") {
        await tx.studentProfile.update({
          where: { userId: user.id },
          data: {
            city: data.city,
            phone: data.phone,
            bio: data.bio ?? "",
            university: data.university ?? "",
          },
        });
      } else if (user.role === "BUSINESS") {
        await tx.businessProfile.update({
          where: { userId: user.id },
          data: {
            city: data.city,
            phone: data.phone,
            businessName: data.businessName ?? "",
            category: data.category ?? "",
            description: data.description ?? "",
          },
        });
      }
    });
    revalidatePath(user.role === "STUDENT" ? "/student/dashboard" : "/business/dashboard");
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not save profile" };
  }
}

export type ModerationStatus = "ACTIVE" | "SUSPENDED" | "BANNED";

export async function suspendUserAction(
  userId: string,
  status: ModerationStatus,
  reason: string,
): Promise<ActionResult> {
  const admin = await getActionUser([Role.ADMIN]);
  if (!admin) return { ok: false, error: "Admin only" };
  if (userId === admin.id) return { ok: false, error: "You cannot change your own status" };

  // No student or employer can be suspended/banned without a written reason.
  const parsedReason = moderationReasonSchema.safeParse(reason);
  if (!parsedReason.success) {
    return { ok: false, error: parsedReason.error.issues[0]?.message ?? "A reason is required" };
  }

  try {
    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target || target.role === Role.ADMIN) return { ok: false, error: "User not found" };

    const action =
      status === "BANNED" ? "BAN_USER" : status === "SUSPENDED" ? "SUSPEND_USER" : "REACTIVATE_USER";

    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { status } });
      await tx.moderationLog.create({
        data: {
          adminId: admin.id,
          action,
          targetType: "USER",
          targetId: userId,
          reason: parsedReason.data,
        },
      });
    });
    revalidatePath("/admin");
    revalidatePath("/student/offers");
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not update user" };
  }
}

/** Lets the login form tell a blocked student/employer exactly why. */
export async function accountBlockAction(
  email: string,
): Promise<{ blocked: boolean; status: string; reason: string }> {
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true, status: true },
  });
  if (!user || canLogin(user)) return { blocked: false, status: "", reason: "" };

  const lastAction = await prisma.moderationLog.findFirst({
    where: { targetId: user.id, action: { in: ["SUSPEND_USER", "BAN_USER"] } },
    orderBy: { createdAt: "desc" },
    select: { reason: true },
  });
  return {
    blocked: true,
    status: user.status,
    reason: lastAction?.reason ?? "No reason was recorded. Contact an admin.",
  };
}

export async function removeOfferAction(offerId: string, reason: string): Promise<ActionResult> {
  const admin = await getActionUser([Role.ADMIN]);
  if (!admin) return { ok: false, error: "Admin only" };

  const result = await removeOfferCore(prisma, admin.id, offerId, reason);
  if (result.ok) {
    revalidatePath("/admin");
    revalidatePath("/student/offers");
    revalidatePath("/business/offers");
  }
  return result;
}

// Thin wrappers for <form action={...}> usage in the admin page.
export async function suspendUserFormAction(formData: FormData): Promise<void> {
  const userId = String(formData.get("userId") ?? "");
  const raw = String(formData.get("status") ?? "");
  const status: ModerationStatus =
    raw === "ACTIVE" || raw === "SUSPENDED" || raw === "BANNED" ? raw : "SUSPENDED";
  const reason = String(formData.get("reason") ?? "");
  const result = await suspendUserAction(userId, status, reason);
  if (!result.ok) redirect(`/admin?error=${encodeURIComponent(result.error ?? "Action failed")}`);
  redirect("/admin?done=1");
}

export async function removeOfferFormAction(formData: FormData): Promise<void> {
  const offerId = String(formData.get("offerId") ?? "");
  const reason = String(formData.get("reason") ?? "");
  await removeOfferAction(offerId, reason);
}

// Form wrappers used by the business "manage my offers" dashboard.
export async function setOfferStatusFormAction(formData: FormData): Promise<void> {
  const offerId = String(formData.get("offerId") ?? "");
  const raw = String(formData.get("status") ?? "");
  const status: ManageableOfferStatus = raw === "ACCEPTED" || raw === "ENDED" ? raw : "PENDING";
  const result = await setOfferStatusAction(offerId, status);
  redirect(result.ok ? "/business/offers?done=1" : `/business/offers?error=${encodeURIComponent(result.error ?? "Action failed")}`);
}

export async function finishWorkFormAction(formData: FormData): Promise<void> {
  const applicationId = String(formData.get("applicationId") ?? "");
  const result = await finishWorkAction(applicationId);
  redirect(result.ok ? "/business/offers?done=1" : `/business/offers?error=${encodeURIComponent(result.error ?? "Action failed")}`);
}

export async function cancelApplicationFormAction(formData: FormData): Promise<void> {
  const applicationId = String(formData.get("applicationId") ?? "");
  const result = await cancelApplicationAction(applicationId);
  redirect(result.ok ? "/business/offers?done=1" : `/business/offers?error=${encodeURIComponent(result.error ?? "Action failed")}`);
}

export async function removeBusinessOfferFormAction(formData: FormData): Promise<void> {
  const offerId = String(formData.get("offerId") ?? "");
  const result = await removeBusinessOfferAction(offerId);
  redirect(result.ok ? "/business/offers?done=1" : `/business/offers?error=${encodeURIComponent(result.error ?? "Action failed")}`);
}

export async function feedbackFormAction(formData: FormData): Promise<void> {
  const applicationId = String(formData.get("applicationId") ?? "");
  const rating = Number(formData.get("rating") ?? 0);
  const comment = String(formData.get("comment") ?? "");
  const result = await submitFeedbackAction(applicationId, rating, comment);
  redirect(result.ok ? "/business/offers?done=1" : `/business/offers?error=${encodeURIComponent(result.error ?? "Action failed")}`);
}

const VALID_PLANS: Plan[] = ["FREE_TRIAL", "BOTH_DIAMOND", "GOLDEN_EDGE"];

/** Admin-only (or PIN-root): grants/renews a business plan and resets its expiry. */
export async function grantPlanAction(
  businessUserId: string,
  plan: Plan,
): Promise<ActionResult> {
  const actor = await getAdminOrRootActionUser();
  if (!actor) return { ok: false, error: "Admin access required" };
  if (!VALID_PLANS.includes(plan)) return { ok: false, error: "Unknown plan" };

  const result = await grantPlanCore(prisma, actor.id, businessUserId, plan);
  if (result.ok) {
    revalidatePath("/admin");
    revalidatePath("/business/dashboard");
    revalidatePath("/business/offers");
  }
  return result;
}

export async function grantPlanFormAction(formData: FormData): Promise<void> {
  const businessUserId = String(formData.get("businessUserId") ?? "");
  const rawPlan = String(formData.get("plan") ?? "") as Plan;
  const result = await grantPlanAction(businessUserId, rawPlan);
  redirect(result.ok ? "/admin?plan=1" : `/admin?error=${encodeURIComponent(result.error ?? "Action failed")}`);
}

/** /getroot PIN gate. PIN 2007 is the only way in without an ADMIN session. */
export async function getrootUnlockAction(formData: FormData): Promise<void> {
  const pin = String(formData.get("pin") ?? "").trim();
  if (pin !== GETROOT_PIN) redirect("/getroot?error=1");
  setGetRootCookie();
  redirect("/admin");
}

export async function getrootLockAction(): Promise<void> {
  clearGetRootCookie();
  redirect("/getroot");
}
