import type { Plan } from "@prisma/client";

/** Paid plans are granted by an admin; the trial starts automatically at registration. */
export const PLAN_DAYS: Record<Plan, number> = {
  FREE_TRIAL: 7,
  BOTH_DIAMOND: 30,
  GOLDEN_EDGE: 365,
};

export const PLAN_LABELS: Record<Plan, string> = {
  FREE_TRIAL: "Free trial",
  BOTH_DIAMOND: "BothDiamond",
  GOLDEN_EDGE: "GoldenEdge",
};

/** Sentinel actor used when the PIN-protected /getroot area grants a plan. */
export const GETROOT_ACTOR = "GETROOT_PIN";

export function planExpiry(plan: Plan, from: Date = new Date()): Date {
  return new Date(from.getTime() + PLAN_DAYS[plan] * 24 * 60 * 60 * 1000);
}

export function isSubscriptionActive(
  profile: { plan: Plan; planExpiresAt: Date } | null | undefined,
  now: Date = new Date(),
): boolean {
  return !!profile && profile.planExpiresAt.getTime() > now.getTime();
}
