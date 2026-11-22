import { notFound } from "next/navigation";
import ChatRoom from "@/components/ChatRoom";
import { prisma } from "@/lib/prisma";
import { isChatParticipant } from "@/lib/chat-access";
import { requireUser } from "@/lib/session";
import { purgeExpiredChats } from "@/lib/core";

export const dynamic = "force-dynamic";

export default async function StudentChatPage({ params }: { params: { id: string } }) {
  const user = await requireUser(["STUDENT"]);
  await purgeExpiredChats(prisma);
  if (!(await isChatParticipant(prisma, params.id, user.id, user.role))) notFound();

  const chat = await prisma.chat.findUnique({
    where: { id: params.id },
    include: { application: { include: { offer: { include: { business: { select: { name: true } } } } } } },
  });
  if (!chat) notFound();

  return (
    <ChatRoom
      chatId={chat.id}
      title={chat.application.offer.title}
      subtitle={chat.application.offer.business.name}
      expiresAt={chat.expiresAt.toISOString()}
      backHref="/student/chat"
    />
  );
}
