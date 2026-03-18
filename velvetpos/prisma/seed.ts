import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import bcrypt from 'bcryptjs';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.$connect();

  const defaultEmail = 'superadmin@velvetpos.dev';
  const defaultPassword = 'changeme123!';

  const superAdminEmail = process.env.SEED_SUPER_ADMIN_EMAIL ?? defaultEmail;
  const superAdminPassword = process.env.SEED_SUPER_ADMIN_PASSWORD ?? defaultPassword;

  if (superAdminEmail === defaultEmail || superAdminPassword === defaultPassword) {
    console.warn('------------------------------------------------------------');
    console.warn('WARNING: Using default Super Admin credentials.');
    console.warn(
      'These must be changed before any production or staging deployment. Do not use these values in a live environment.',
    );
    console.warn('------------------------------------------------------------');
  }

  const existingSuperAdmin = await prisma.user.findFirst({
    where: {
      email: superAdminEmail,
      deletedAt: null,
    },
    select: {
      id: true,
    },
  });

  if (existingSuperAdmin) {
    console.log('Super Admin account already exists. Skipping creation.');
    return;
  }

  const passwordHash = await bcrypt.hash(superAdminPassword, 12);

  await prisma.user.create({
    data: {
      email: superAdminEmail,
      passwordHash,
      pin: null,
      role: 'SUPER_ADMIN',
      permissions: [],
      isActive: true,
      tenantId: null,
      sessionVersion: 1,
    },
  });

  console.log(`Super Admin account created successfully. Email: ${superAdminEmail}`);

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
