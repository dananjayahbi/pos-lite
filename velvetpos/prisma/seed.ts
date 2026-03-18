import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient();

async function main() {
  await prisma.$connect();
  console.log(
    'Prisma seed script connected to the database successfully. No data seeded at this stage — Phase 01 placeholder.',
  );
  await prisma.$disconnect();
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
