import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasGetRootAccess } from "@/lib/getroot";
import { GETROOT_ACTOR, isSubscriptionActive } from "@/lib/subscription";

export type SafeUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

/** For pages/layouts: redirects unauthenticated, wrong-role or suspended users. */
export async function requireUser(roles?: Role[]) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user || user.status !== "ACTIVE") redirect("/login?error=suspended");
  if (roles && !roles.includes(user.role)) redirect("/login");

  return { id: user.id, name: user.name, email: user.email, role: user.role } satisfies SafeUser;
}

/** For server actions: returns null instead of redirecting. */
export async function getActionUser(roles?: Role[]): Promise<SafeUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user || user.status !== "ACTIVE") return null;
  if (roles && !roles.includes(user.role)) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

const ROOT_USER: SafeUser = {
  id: GETROOT_ACTOR,
  name: "Root Access",
  email: "root@getroot.local",
  role: Role.ADMIN,
};

/** Admin area accepts either a logged-in ADMIN or the PIN-protected /getroot cookie. */
export async function getAdminOrRootActionUser(): Promise<SafeUser | null> {
  const admin = await getActionUser(["ADMIN"]);
  if (admin) return admin;
  return hasGetRootAccess() ? ROOT_USER : null;
}

/** Page/layout version: redirects to the PIN gate when neither credential is present. */
export async function requireAdminOrRoot(): Promise<SafeUser> {
  const actor = await getAdminOrRootActionUser();
  if (!actor) redirect("/getroot");
  return actor;
}

/** Server actions that belong to a business must also respect its subscription. */
export async function getSubscribedBusinessUser(): Promise<SafeUser | null> {
  const user = await getActionUser(["BUSINESS"]);
  if (!user) return null;
  const profile = await prisma.businessProfile.findUnique({
    where: { userId: user.id },
    select: { plan: true, planExpiresAt: true },
  });
  return isSubscriptionActive(profile) ? user : null;
}

export function homeForRole(role: Role): string {
  if (role === "ADMIN") return "/admin";
  if (role === "BUSINESS") return "/business/dashboard";
  return "/student/dashboard";
}
