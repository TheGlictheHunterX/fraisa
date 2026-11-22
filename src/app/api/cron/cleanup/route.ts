import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { purgeExpiredChats } from "@/lib/core";

export const dynamic = "force-dynamic";

/**
 * Hard-deletes every chat (and its messages) older than 24 hours.
 * The app also calls this on page loads and every 10 minutes while a tab is open,
 * so a hosted cron is optional. Set CRON_SECRET to protect this endpoint.
 */
async function cleanup(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const deleted = await purgeExpiredChats(prisma);
    return NextResponse.json({ ok: true, deletedChats: deleted, at: new Date().toISOString() });
  } catch {
    return NextResponse.json({ ok: false, deletedChats: 0 }, { status: 500 });
  }
}

export const GET = cleanup;
export const POST = cleanup;
