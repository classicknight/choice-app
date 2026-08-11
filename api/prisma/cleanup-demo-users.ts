import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const seedDemoEmailSuffix = ".demo@choice.local";
const privateQaEmailSuffix = ".qa@choice.local";

async function main() {
  const demoUsers = await prisma.user.findMany({
    where: {
      OR: [
        { email: { endsWith: seedDemoEmailSuffix } },
        { email: { endsWith: privateQaEmailSuffix } },
      ],
    },
    select: { id: true },
  });

  if (!demoUsers.length) {
    console.log("No Choice demo or private QA accounts found.");
    return;
  }

  const result = await prisma.user.deleteMany({
    where: { id: { in: demoUsers.map((user) => user.id) } },
  });

  console.log(`Removed ${result.count} Choice demo or private QA account(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
