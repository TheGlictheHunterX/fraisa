import type { PrismaClient, Role } from "@prisma/client";

/** A student owns chats on their applications; a business owns chats on offers they posted. */
export async function isChatParticipant(
  prisma: PrismaClient,
  chatId: string,
  userId: string,
  role: Role,
): Promise<boolean> {
  const chat = await prisma.chat.findUnique({
    where: { id: chatId },
    include: { application: { include: { offer: true } } },
  });
  if (!chat) return false;
  // A chat past its 24h deadline is treated as gone even before the next purge runs.
  if (chat.expiresAt <= new Date()) return false;
  if (chat.application.studentId === userId && role === "STUDENT") return true;
  if (chat.application.offer.businessId === userId && role === "BUSINESS") return true;
  return false;
}
