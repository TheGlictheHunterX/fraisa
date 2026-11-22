import { execSync } from "node:child_process";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { feedbackSchema, offerSchema } from "../src/lib/schemas";
import {
  acceptOfferCore,
  canLogin,
  finishWorkCore,
  grantPlanCore,
  purgeExpiredChats,
  removeOfferCore,
  writeFeedbackCore,
} from "../src/lib/core";

const testDbPath = path.resolve(process.cwd(), "prisma", "test.db");
const testDbUrl = `file:${testDbPath.replace(/\\/g, "/")}`;

let prisma: PrismaClient;
let studentId = "";
let businessId = "";
let adminId = "";
let offerId = "";
let suspendedId = "";

beforeAll(async () => {
  execSync("npx prisma db push --skip-generate --force-reset", {
    env: { ...process.env, DATABASE_URL: testDbUrl },
    stdio: "ignore",
  });
  prisma = new PrismaClient({ datasourceUrl: testDbUrl });
  const hash = await bcrypt.hash("pass123", 10);

  const student = await prisma.user.create({
    data: { email: "t-student@test.tn", name: "Test Student", passwordHash: hash, role: "STUDENT" },
  });
  const business = await prisma.user.create({
    data: { email: "t-business@test.tn", name: "Test Business", passwordHash: hash, role: "BUSINESS" },
  });
  await prisma.businessProfile.create({
    data: {
      userId: business.id,
      businessName: "Test Business",
      category: "Test",
      city: "Tunis",
      description: "",
      phone: "",
      plan: "FREE_TRIAL",
      planExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
  const admin = await prisma.user.create({
    data: { email: "t-admin@test.tn", name: "Test Admin", passwordHash: hash, role: "ADMIN" },
  });
  const suspended = await prisma.user.create({
    data: { email: "t-suspended@test.tn", name: "Suspended", passwordHash: hash, role: "STUDENT", status: "SUSPENDED" },
  });
  const offer = await prisma.offer.create({
    data: {
      businessId: business.id,
      title: "Test shift",
      description: "A short test shift",
      city: "Tunis",
      hourlyRate: 12,
      durationMin: 120,
    },
  });
  studentId = student.id;
  businessId = business.id;
  adminId = admin.id;
  suspendedId = suspended.id;
  offerId = offer.id;
});

afterAll(async () => {
  await prisma?.$disconnect();
});

describe("GetBoth freelance unit + integration tests", () => {
  it("1. bcrypt hashes and verifies passwords", async () => {
    const hash = await bcrypt.hash("pass123", 10);
    expect(hash).not.toBe("pass123");
    expect(await bcrypt.compare("pass123", hash)).toBe(true);
    expect(await bcrypt.compare("wrong", hash)).toBe(false);
  });

  it("2. offer schema rejects shifts longer than 120 minutes", () => {
    const valid = offerSchema.safeParse({
      title: "Short shift",
      description: "Something useful to do",
      city: "Tunis",
      hourlyRate: 10,
      durationMin: 120,
    });
    const invalid = offerSchema.safeParse({
      title: "Long shift",
      description: "Something useful to do",
      city: "Tunis",
      hourlyRate: 10,
      durationMin: 121,
    });
    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);

    // Business feedback: 1-5 stars only.
    expect(feedbackSchema.safeParse({ rating: 5, comment: "Great" }).success).toBe(true);
    expect(feedbackSchema.safeParse({ rating: 6 }).success).toBe(false);
  });

  it("3. accepting creates Application + 24h Chat atomically and marks the offer ACCEPTED", async () => {
    const result = await acceptOfferCore(prisma, offerId, studentId);
    expect(result.ok).toBe(true);
    expect(result.chatId).toBeTruthy();

    const application = await prisma.application.findUnique({
      where: { offerId_studentId: { offerId, studentId } },
      include: { chat: true },
    });
    expect(application).not.toBeNull();
    expect(application?.status).toBe("ACCEPTED");
    expect(application?.chat?.id).toBe(result.chatId);

    const hoursToExpiry = (application!.chat!.expiresAt.getTime() - Date.now()) / 3_600_000;
    expect(hoursToExpiry).toBeGreaterThan(23);
    expect(hoursToExpiry).toBeLessThanOrEqual(24);
    expect((await prisma.offer.findUnique({ where: { id: offerId } }))?.status).toBe("ACCEPTED");

    const again = await acceptOfferCore(prisma, offerId, studentId);
    expect(again.ok).toBe(true);
    expect(await prisma.application.count({ where: { offerId, studentId } })).toBe(1);
    expect(businessId).toBeTruthy();
  });

  it("4. suspended users cannot log in", async () => {
    const suspended = await prisma.user.findUnique({ where: { id: suspendedId } });
    const active = await prisma.user.findUnique({ where: { id: studentId } });
    expect(canLogin(suspended)).toBe(false);
    expect(canLogin(active)).toBe(true);
    expect(canLogin(null)).toBe(false);
  });

  it("5. finish credits wallet + work log, feedback saves, 24h purge deletes chat, admin logs removal", async () => {
    const application = await prisma.application.findUnique({
      where: { offerId_studentId: { offerId, studentId } },
      include: { chat: true },
    });
    const finish = await finishWorkCore(prisma, businessId, application!.id);
    expect(finish.ok).toBe(true);
    expect(finish.credited).toBe(24);

    const profile = await prisma.studentProfile.findUnique({ where: { userId: studentId } });
    expect(profile?.balanceTnd).toBe(24);
    expect(profile?.minutesWorked).toBe(120);
    expect(profile?.completedShifts).toBe(1);

    // One immutable wallet line per paid shift (visible in the student's wallet).
    const wallet = await prisma.walletEntry.findUnique({ where: { applicationId: application!.id } });
    expect(wallet?.amountTnd).toBe(24);
    expect(wallet?.minutes).toBe(120);
    expect(wallet?.studentId).toBe(studentId);

    expect((await prisma.application.findUnique({ where: { id: application!.id } }))?.status).toBe("COMPLETED");
    expect((await prisma.offer.findUnique({ where: { id: offerId } }))?.status).toBe("ENDED");

    // Business can rate the student only after the work is finished.
    const review = await writeFeedbackCore(prisma, businessId, application!.id, 5, "Great work");
    expect(review.ok).toBe(true);
    const saved = await prisma.feedback.findUnique({ where: { applicationId: application!.id } });
    expect(saved?.rating).toBe(5);
    expect(saved?.studentId).toBe(studentId);
    expect((await writeFeedbackCore(prisma, businessId, application!.id, 4, "Updated")).ok).toBe(true);
    expect((await prisma.feedback.findUnique({ where: { applicationId: application!.id } }))?.rating).toBe(4);

    await prisma.chat.update({
      where: { id: application!.chat!.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(await purgeExpiredChats(prisma)).toBeGreaterThanOrEqual(1);
    expect(await prisma.chat.count({ where: { id: application!.chat!.id } })).toBe(0);

    const result = await removeOfferCore(prisma, adminId, offerId, "Test removal");
    expect(result.ok).toBe(true);
    expect((await prisma.offer.findUnique({ where: { id: offerId } }))?.status).toBe("REMOVED_BY_ADMIN");
    const log = await prisma.moderationLog.findFirst({ where: { targetId: offerId } });
    expect(log?.action).toBe("REMOVE_OFFER");
    expect(log?.reason).toBe("Test removal");

    // Subscriptions: a business cannot grant itself a plan; an admin can (30/365 days).
    expect((await grantPlanCore(prisma, businessId, businessId, "BOTH_DIAMOND")).ok).toBe(false);
    expect((await grantPlanCore(prisma, adminId, businessId, "BOTH_DIAMOND")).ok).toBe(true);
    const renewed = await prisma.businessProfile.findUnique({ where: { userId: businessId } });
    expect(renewed?.plan).toBe("BOTH_DIAMOND");
    const daysLeft = (renewed!.planExpiresAt.getTime() - Date.now()) / 86_400_000;
    expect(daysLeft).toBeGreaterThan(29);
    expect(daysLeft).toBeLessThanOrEqual(30);
    expect((await grantPlanCore(prisma, adminId, businessId, "GOLDEN_EDGE")).ok).toBe(true);
    const yearPlan = await prisma.businessProfile.findUnique({ where: { userId: businessId } });
    expect(yearPlan?.plan).toBe("GOLDEN_EDGE");
  });
});
