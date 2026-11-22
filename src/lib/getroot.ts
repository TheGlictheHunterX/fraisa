import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/** Secret admin entrance: /getroot with PIN 2007. */
export const GETROOT_PIN = "2007";
export const GETROOT_COOKIE = "getroot_access";
const GETROOT_MAX_AGE = 8 * 60 * 60; // 8 hours

function expectedToken(): string {
  const secret = process.env.NEXTAUTH_SECRET ?? "getroot-fallback-secret";
  return createHmac("sha256", secret).update(`getroot:${GETROOT_PIN}`).digest("hex");
}

export function isValidGetRootToken(value: string | undefined): boolean {
  if (!value) return false;
  const expected = Buffer.from(expectedToken());
  const actual = Buffer.from(value);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function hasGetRootAccess(): boolean {
  return isValidGetRootToken(cookies().get(GETROOT_COOKIE)?.value);
}

export function setGetRootCookie(): void {
  cookies().set(GETROOT_COOKIE, expectedToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: GETROOT_MAX_AGE,
  });
}

export function clearGetRootCookie(): void {
  cookies().set(GETROOT_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}
