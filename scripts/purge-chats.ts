import { PrismaClient } from "@prisma/client";
import { purgeExpiredChats } from "../src/lib/core";

const prisma = new PrismaClient();

purgeExpiredChats(prisma)
  .then((deleted) => console.log(`Chat cleanup complete: ${deleted} expired chat(s) deleted.`))
  .catch((error) => {
    console.error("Chat cleanup failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
