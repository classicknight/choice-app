import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const seedDemoEmailSuffix = ".demo@choice.local";

async function main() {
  const demoUsers = await prisma.user.findMany({
    where: { email: { endsWith: seedDemoEmailSuffix } },
    select: { id: true },
  });

  if (!demoUsers.length) {
    console.log("No Choice seed demo accounts found.");
    return;
  }

  const result = await prisma.user.deleteMany({
    where: { id: { in: demoUsers.map((user) => user.id) } },
  });

  console.log(`Removed ${result.count} Choice seed demo account(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
