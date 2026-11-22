import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Clean slate so repeated runs always produce the same demo state.
  await prisma.message.deleteMany();
  await prisma.chat.deleteMany();
  await prisma.application.deleteMany();
  await prisma.offer.deleteMany();
  await prisma.moderationLog.deleteMany();
  await prisma.studentProfile.deleteMany();
  await prisma.businessProfile.deleteMany();
  await prisma.user.deleteMany();

  const pass = await bcrypt.hash("pass123", 10);
  const adminPass = await bcrypt.hash("admin123", 10);

  const admin = await prisma.user.create({
    data: {
      email: "admin@getboth.tn",
      passwordHash: adminPass,
      role: Role.ADMIN,
      name: "Admin GetBoth",
      status: "ACTIVE",
    },
  });

  const cafe = await prisma.user.create({
    data: {
      email: "cafe@getboth.tn",
      passwordHash: pass,
      role: Role.BUSINESS,
      name: "Café El Medina",
      businessProfile: {
        create: {
          businessName: "Café El Medina",
          category: "Coffee & Pastry",
          city: "Tunis",
          description: "Local café near the university, looking for help during rush hours.",
          phone: "+216 71 123 456",
          plan: "FREE_TRIAL",
          planExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      },
    },
  });

  const shop = await prisma.user.create({
    data: {
      email: "shop@getboth.tn",
      passwordHash: pass,
      role: Role.BUSINESS,
      name: "Shop Sfax Center",
      businessProfile: {
        create: {
          businessName: "Shop Sfax Center",
          category: "Retail",
          city: "Sfax",
          description: "Small retail shop needing short helping shifts on weekends.",
          phone: "+216 74 987 654",
          plan: "FREE_TRIAL",
          planExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      },
    },
  });

  const studentData = [
    { email: "student1@getboth.tn", name: "Amina Benali", city: "Tunis", university: "Université de Tunis", phone: "+216 20 111 111", bio: "Computer science student, available afternoons." },
    { email: "student2@getboth.tn", name: "Karim Sassi", city: "Sfax", university: "Université de Sfax", phone: "+216 20 222 222", bio: "Business student, free on weekends." },
    { email: "student3@getboth.tn", name: "Lina Trabelsi", city: "Tunis", university: "ESSTT", phone: "+216 20 333 333", bio: "Engineering student, quick learner." },
  ];

  const students = [];
  for (const s of studentData) {
    const user = await prisma.user.create({
      data: {
        email: s.email,
        passwordHash: pass,
        role: Role.STUDENT,
        name: s.name,
        studentProfile: {
          create: { city: s.city, university: s.university, phone: s.phone, bio: s.bio },
        },
      },
    });
    students.push(user);
  }

  const offerData = [
    { businessId: cafe.id, title: "Barista assistant - morning rush", description: "Help prepare coffee and serve customers during the 8-10am rush. No experience needed.", city: "Tunis", hourlyRate: 12, durationMin: 120 },
    { businessId: cafe.id, title: "Pastry counter helper", description: "Arrange pastries, take simple orders and clean the counter for two hours.", city: "Tunis", hourlyRate: 10, durationMin: 90 },
    { businessId: shop.id, title: "Weekend shelf stocker", description: "Restock shelves and help customers find items. Short 2h shift.", city: "Sfax", hourlyRate: 11, durationMin: 120 },
    { businessId: shop.id, title: "Storefront greeter", description: "Welcome customers and keep the entrance tidy during peak hours.", city: "Sfax", hourlyRate: 9, durationMin: 60 },
  ];

  const offers = [];
  for (const o of offerData) {
    const offer = await prisma.offer.create({ data: o });
    offers.push(offer);
  }

  // One accepted shift with a seeded conversation and a 24h chat deadline.
  const application = await prisma.application.create({
    data: { offerId: offers[0].id, studentId: students[0].id, status: "ACCEPTED" },
  });
  await prisma.offer.update({ where: { id: offers[0].id }, data: { status: "ACCEPTED" } });
  const chat = await prisma.chat.create({
    data: {
      applicationId: application.id,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });
  await prisma.message.create({
    data: { chatId: chat.id, senderId: cafe.id, content: "Salut Amina! Merci d'avoir accepté. Tu commences à 8h demain ?" },
  });
  await prisma.message.create({
    data: { chatId: chat.id, senderId: students[0].id, content: "Bonjour ! Oui, je serai là à 8h. À demain 😊" },
  });

  // One finished, paid shift: the business already marked Karim's work complete.
  const payout = offers[2].hourlyRate * (offers[2].durationMin / 60);
  const finishedApplication = await prisma.application.create({
    data: {
      offerId: offers[2].id,
      studentId: students[1].id,
      status: "COMPLETED",
      completedAt: new Date(),
    },
  });
  await prisma.feedback.create({
    data: {
      applicationId: finishedApplication.id,
      studentId: students[1].id,
      businessId: shop.id,
      rating: 5,
      comment: "Reliable, on time and quick to learn. Would book again!",
    },
  });
  await prisma.offer.update({ where: { id: offers[2].id }, data: { status: "ENDED" } });
  await prisma.studentProfile.update({
    where: { userId: students[1].id },
    data: {
      balanceTnd: payout,
      minutesWorked: offers[2].durationMin,
      completedShifts: 1,
    },
  });
  await prisma.walletEntry.create({
    data: {
      studentId: students[1].id,
      applicationId: finishedApplication.id,
      amountTnd: payout,
      minutes: offers[2].durationMin,
      description: `${offers[2].title} · ${offers[2].durationMin} min at ${offers[2].hourlyRate} TND/h`,
      createdAt: finishedApplication.completedAt ?? new Date(),
    },
  });

  // Historical moderation entries so the admin log is never empty.
  await prisma.moderationLog.create({
    data: {
      adminId: admin.id,
      action: "WARN_USER",
      targetType: "USER",
      targetId: students[2].id,
      reason: "Reminder to keep chat respectful.",
    },
  });
  await prisma.moderationLog.create({
    data: {
      adminId: admin.id,
      action: "CLOSE_OFFER",
      targetType: "OFFER",
      targetId: offers[3].id,
      reason: "Duplicate listing closed by moderator.",
    },
  });

  console.log(
    "Seed complete: 1 admin, 2 businesses, 3 students, 4 offers (2 pending, 1 accepted, 1 ended), 2 applications, 1 chat, 2 logs.",
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
