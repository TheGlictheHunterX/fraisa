import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { purgeExpiredChats } from "@/lib/core";

export const dynamic = "force-dynamic";

export default async function StudentChatListPage() {
  const user = await requireUser(["STUDENT"]);
  await purgeExpiredChats(prisma);
  const chats = await prisma.chat.findMany({
    where: { application: { studentId: user.id } },
    include: {
      application: {
        include: {
          offer: { include: { business: { select: { name: true } } } },
        },
      },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold">My chats</h1>
      <p className="mb-6 text-sm text-slate-500">Private conversations with businesses.</p>
      {chats.length === 0 ? (
        <div className="card text-sm text-slate-500">No chats yet — accept a shift to start one.</div>
      ) : (
        <div className="space-y-3">
          {chats.map((chat) => {
            const offer = chat.application.offer;
            return (
              <Link key={chat.id} href={`/student/chat/${chat.id}`} className="card block hover:shadow-md">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{offer.title}</p>
                  <span className="text-xs text-slate-400">{offer.business.name}</span>
                </div>
                <p className="mt-1 truncate text-sm text-slate-500">
                  {chat.messages[0]?.content ?? "No messages yet"}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Chat deleted automatically on {chat.expiresAt.toLocaleDateString("en-GB")} at {chat.expiresAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
