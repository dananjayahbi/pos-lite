import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import bcrypt from 'bcryptjs';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function seedPlans() {
  const plans = [
    {
      name: 'Basic POS',
      description: 'The essential toolkit for a modern clothing boutique',
      priceMonthly: 4999,
      features: [
        'POS Terminal',
        'Inventory Management',
        'Sales History',
        'Basic Reports',
        'Up to 3 Staff Accounts',
      ],
      isActive: true,
      sortOrder: 1,
    },
    {
      name: 'Pro POS + WhatsApp',
      description: 'Full-featured POS with WhatsApp marketing and priority support',
      priceMonthly: 7999,
      features: [
        'Everything in Basic POS',
        'WhatsApp Receipt Delivery',
        'WhatsApp Marketing Broadcasts',
        'Advanced Reports & Analytics',
        'Unlimited Staff Accounts',
        'Priority Support',
      ],
      isActive: true,
      sortOrder: 2,
    },
  ];

  for (const plan of plans) {
    const existing = await prisma.plan.findUnique({ where: { name: plan.name } });

    await prisma.plan.upsert({
      where: { name: plan.name },
      create: plan,
      update: {
        priceMonthly: plan.priceMonthly,
        features: plan.features,
        isActive: plan.isActive,
        sortOrder: plan.sortOrder,
      },
    });

    if (!existing) {
      console.log(`Created plan: ${plan.name}`);
    } else {
      console.log(`Plan already exists, updated fields: ${plan.name}`);
    }
  }
}

async function main() {
  await prisma.$connect();

  // Seed plans first (referenced by subscriptions later)
  try {
    await seedPlans();
  } catch (error) {
    console.error('Failed to seed plans:', error);
    throw error;
  }

  // Seed Super Admin account
  await seedSuperAdmin();

  // Seed sample tenant (gated behind SEED_SAMPLE_TENANT=true)
  try {
    await seedSampleTenant();
  } catch (error) {
    console.error('Failed to seed sample tenant:', error);
    throw error;
  }

  // Seed sample catalog (gated behind SEED_SAMPLE_TENANT=true)
  try {
    await seedSampleCatalog();
  } catch (error) {
    console.error('Failed to seed sample catalog:', error);
    throw error;
  }

  await prisma.$disconnect();
}

async function seedSuperAdmin() {
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
}

async function seedSampleTenant() {
  if (process.env.SEED_SAMPLE_TENANT !== 'true') {
    console.log("Skipping sample tenant seed (SEED_SAMPLE_TENANT is not set to 'true')");
    return;
  }

  const existing = await prisma.tenant.findFirst({ where: { slug: 'dilani' } });
  if (existing) {
    console.log('Sample tenant already exists, skipping');
    return;
  }

  const proPlan = await prisma.plan.findFirst({ where: { name: 'Pro POS + WhatsApp' } });
  if (!proPlan) {
    throw new Error('Pro plan not found — ensure plans are seeded before running tenant seed');
  }

  const ownerEmail = process.env.SEED_OWNER_EMAIL;
  const ownerPassword = process.env.SEED_OWNER_PASSWORD;
  if (!ownerEmail || !ownerPassword) {
    throw new Error(
      'SEED_OWNER_EMAIL and SEED_OWNER_PASSWORD must be set in .env.local to seed the sample tenant',
    );
  }

  const ownerPasswordHash = await bcrypt.hash(ownerPassword, 12);

  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setDate(periodEnd.getDate() + 30);

  const tenant = await prisma.tenant.create({
    data: {
      name: 'Dilani Boutique',
      slug: 'dilani',
      status: 'ACTIVE',
      logoUrl: null,
      graceEndsAt: null,
      customDomain: null,
      settings: {
        currency: 'LKR',
        timezone: 'Asia/Colombo',
        vatRate: 18,
        ssclRate: 2.5,
        receiptFooter: 'Thank you for shopping at Dilani Boutique!',
      },
    },
  });

  await prisma.$transaction([
    prisma.user.create({
      data: {
        email: ownerEmail,
        passwordHash: ownerPasswordHash,
        role: 'OWNER',
        tenantId: tenant.id,
        permissions: [],
        isActive: true,
      },
    }),
    prisma.subscription.create({
      data: {
        tenantId: tenant.id,
        planId: proPlan.id,
        status: 'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        nextBillingDate: periodEnd,
        payhereSubId: null,
        cancelledAt: null,
      },
    }),
  ]);

  console.log('Created sample tenant: Dilani Boutique');
  console.log(`Created OWNER user: ${ownerEmail}`);
  console.log('Created ACTIVE subscription for Dilani Boutique on Pro POS + WhatsApp plan.');
}

// ── Catalog Seed Data ────────────────────────────────────────────────────────

const SEED_CATEGORIES = [
  { name: "Men's Shirts", sortOrder: 1 },
  { name: "Women's Dresses", sortOrder: 2 },
  { name: 'Unisex Accessories', sortOrder: 3 },
  { name: 'Kids Clothing', sortOrder: 4 },
  { name: 'Sportswear', sortOrder: 5 },
];

const SEED_BRANDS = [
  { name: 'NovaWear', description: 'Contemporary Sri Lankan fashion brand' },
  { name: 'UrbanThread', description: 'Urban streetwear for the modern dresser' },
  { name: 'SilkTropic', description: 'Premium tropical occasion wear' },
  { name: 'ActivePeak', description: 'Sportswear and performance apparel' },
];

const SIZE_SETS: Record<string, string[]> = {
  "Men's Shirts": ['S', 'M', 'L', 'XL', 'XXL'],
  "Women's Dresses": ['XS', 'S', 'M', 'L'],
  'Kids Clothing': ['4Y', '6Y', '8Y', '10Y', '12Y'],
  'Sportswear': ['S', 'M', 'L', 'XL'],
  'Unisex Accessories': ['ONE SIZE'],
};

const COLOUR_SETS: Record<string, string[]> = {
  "Men's Shirts": ['White', 'Sky Blue', 'Charcoal', 'Slate Grey', 'Navy'],
  "Women's Dresses": ['Blush Rose', 'Ivory', 'Forest Green', 'Midnight Blue', 'Terracotta'],
  'Kids Clothing': ['Coral', 'Yellow', 'Mint', 'Lavender'],
  'Sportswear': ['Black', 'Cobalt Blue', 'Flame Orange', 'Slate'],
  'Unisex Accessories': ['Tan', 'Black', 'Olive', 'Camel', 'Steel'],
};

interface SeedProduct {
  name: string;
  description: string;
  gender: 'MEN' | 'WOMEN' | 'UNISEX' | 'KIDS';
  taxRule: 'STANDARD_VAT' | 'SSCL';
  brandName: string;
  categoryName: string;
  tags: string[];
}

const SEED_PRODUCTS: SeedProduct[] = [
  // ── Men's Shirts (8) ──
  { name: 'Classic Oxford Button-Down', description: 'Timeless oxford cotton shirt with button-down collar', gender: 'MEN', taxRule: 'STANDARD_VAT', brandName: 'NovaWear', categoryName: "Men's Shirts", tags: ['formal', 'cotton', 'oxford'] },
  { name: 'Slim Fit Linen Shirt', description: 'Breathable linen shirt perfect for Sri Lankan summers', gender: 'MEN', taxRule: 'STANDARD_VAT', brandName: 'NovaWear', categoryName: "Men's Shirts", tags: ['casual', 'linen', 'slim-fit'] },
  { name: 'Mandarin Collar Kurta Shirt', description: 'Modern kurta-style shirt with mandarin collar', gender: 'MEN', taxRule: 'STANDARD_VAT', brandName: 'UrbanThread', categoryName: "Men's Shirts", tags: ['ethnic', 'kurta', 'mandarin-collar'] },
  { name: 'Chambray Casual Shirt', description: 'Soft chambray fabric with a relaxed fit', gender: 'MEN', taxRule: 'SSCL', brandName: 'UrbanThread', categoryName: "Men's Shirts", tags: ['casual', 'chambray'] },
  { name: 'Printed Hawaiian Shirt', description: 'Tropical print casual shirt with camp collar', gender: 'MEN', taxRule: 'STANDARD_VAT', brandName: 'NovaWear', categoryName: "Men's Shirts", tags: ['casual', 'tropical', 'camp-collar'] },
  { name: 'Formal Dress Shirt', description: 'Crisp white cotton dress shirt for formal occasions', gender: 'MEN', taxRule: 'STANDARD_VAT', brandName: 'NovaWear', categoryName: "Men's Shirts", tags: ['formal', 'dress', 'cotton'] },
  { name: 'Henley Neck Tee Shirt', description: 'Three-button henley neck casual shirt', gender: 'MEN', taxRule: 'SSCL', brandName: 'UrbanThread', categoryName: "Men's Shirts", tags: ['casual', 'henley', 'tee'] },
  { name: 'Batik Print Shirt', description: 'Hand-crafted Sri Lankan batik print cotton shirt', gender: 'MEN', taxRule: 'STANDARD_VAT', brandName: 'NovaWear', categoryName: "Men's Shirts", tags: ['batik', 'handmade', 'cotton'] },

  // ── Women's Dresses (8) ──
  { name: 'Floral Wrap Dress', description: 'Elegant floral wrap dress with adjustable waist tie', gender: 'WOMEN', taxRule: 'STANDARD_VAT', brandName: 'SilkTropic', categoryName: "Women's Dresses", tags: ['floral', 'wrap', 'casual'] },
  { name: 'Silk Evening Gown', description: 'Luxurious silk gown for special occasions', gender: 'WOMEN', taxRule: 'STANDARD_VAT', brandName: 'SilkTropic', categoryName: "Women's Dresses", tags: ['silk', 'evening', 'formal'] },
  { name: 'Cotton A-Line Midi Dress', description: 'Comfortable A-line midi dress in soft cotton', gender: 'WOMEN', taxRule: 'SSCL', brandName: 'SilkTropic', categoryName: "Women's Dresses", tags: ['cotton', 'a-line', 'midi'] },
  { name: 'Lace Detail Shift Dress', description: 'Modern shift dress with delicate lace accents', gender: 'WOMEN', taxRule: 'STANDARD_VAT', brandName: 'SilkTropic', categoryName: "Women's Dresses", tags: ['lace', 'shift', 'elegant'] },
  { name: 'Tropical Maxi Dress', description: 'Floor-length maxi dress with tropical leaf print', gender: 'WOMEN', taxRule: 'STANDARD_VAT', brandName: 'SilkTropic', categoryName: "Women's Dresses", tags: ['maxi', 'tropical', 'casual'] },
  { name: 'Pleated Cocktail Dress', description: 'Pleated cocktail dress perfect for evening events', gender: 'WOMEN', taxRule: 'STANDARD_VAT', brandName: 'SilkTropic', categoryName: "Women's Dresses", tags: ['pleated', 'cocktail', 'party'] },
  { name: 'Batik Sarong Dress', description: 'Traditional Sri Lankan batik sarong-style dress', gender: 'WOMEN', taxRule: 'SSCL', brandName: 'SilkTropic', categoryName: "Women's Dresses", tags: ['batik', 'sarong', 'traditional'] },
  { name: 'Office Sheath Dress', description: 'Tailored sheath dress for professional settings', gender: 'WOMEN', taxRule: 'STANDARD_VAT', brandName: 'SilkTropic', categoryName: "Women's Dresses", tags: ['office', 'sheath', 'formal'] },

  // ── Unisex Accessories (5) ──
  { name: 'Leather Tote Bag', description: 'Genuine leather tote bag with multiple compartments', gender: 'UNISEX', taxRule: 'STANDARD_VAT', brandName: 'NovaWear', categoryName: 'Unisex Accessories', tags: ['leather', 'tote', 'bag'] },
  { name: 'Woven Straw Hat', description: 'Hand-woven straw hat for sun protection', gender: 'UNISEX', taxRule: 'SSCL', brandName: 'UrbanThread', categoryName: 'Unisex Accessories', tags: ['straw', 'hat', 'handmade'] },
  { name: 'Canvas Belt', description: 'Durable cotton canvas belt with brass buckle', gender: 'UNISEX', taxRule: 'STANDARD_VAT', brandName: 'UrbanThread', categoryName: 'Unisex Accessories', tags: ['canvas', 'belt'] },
  { name: 'Silk Scarf', description: 'Lightweight silk scarf with abstract design', gender: 'UNISEX', taxRule: 'STANDARD_VAT', brandName: 'SilkTropic', categoryName: 'Unisex Accessories', tags: ['silk', 'scarf', 'abstract'] },
  { name: 'Beaded Bracelet Set', description: 'Set of three handcrafted beaded bracelets', gender: 'UNISEX', taxRule: 'SSCL', brandName: 'NovaWear', categoryName: 'Unisex Accessories', tags: ['beaded', 'bracelet', 'handmade'] },

  // ── Kids Clothing (5) ──
  { name: 'Kids Graphic Print Tee', description: 'Fun graphic print cotton t-shirt for kids', gender: 'KIDS', taxRule: 'STANDARD_VAT', brandName: 'UrbanThread', categoryName: 'Kids Clothing', tags: ['graphic', 'cotton', 'tee'] },
  { name: 'Kids Denim Shorts', description: 'Comfortable stretch denim shorts for active kids', gender: 'KIDS', taxRule: 'STANDARD_VAT', brandName: 'UrbanThread', categoryName: 'Kids Clothing', tags: ['denim', 'shorts', 'stretch'] },
  { name: 'Kids Floral Sundress', description: 'Lightweight floral sundress for girls', gender: 'KIDS', taxRule: 'SSCL', brandName: 'NovaWear', categoryName: 'Kids Clothing', tags: ['floral', 'sundress', 'girls'] },
  { name: 'Kids Polo Shirt', description: 'Classic polo shirt for everyday wear', gender: 'KIDS', taxRule: 'STANDARD_VAT', brandName: 'NovaWear', categoryName: 'Kids Clothing', tags: ['polo', 'casual'] },
  { name: 'Kids Cargo Pants', description: 'Multi-pocket cargo pants in durable cotton', gender: 'KIDS', taxRule: 'STANDARD_VAT', brandName: 'UrbanThread', categoryName: 'Kids Clothing', tags: ['cargo', 'cotton', 'pants'] },

  // ── Sportswear (4) ──
  { name: 'Athletic Performance Tee', description: 'Moisture-wicking performance t-shirt', gender: 'UNISEX', taxRule: 'STANDARD_VAT', brandName: 'ActivePeak', categoryName: 'Sportswear', tags: ['performance', 'moisture-wicking', 'gym'] },
  { name: 'Training Jogger Pants', description: 'Tapered jogger pants with zip pockets', gender: 'UNISEX', taxRule: 'STANDARD_VAT', brandName: 'ActivePeak', categoryName: 'Sportswear', tags: ['jogger', 'training', 'zip-pocket'] },
  { name: 'Compression Running Shorts', description: 'Lightweight compression shorts for running', gender: 'MEN', taxRule: 'SSCL', brandName: 'ActivePeak', categoryName: 'Sportswear', tags: ['compression', 'running', 'shorts'] },
  { name: 'Sports Hoodie Jacket', description: 'Zip-up hoodie jacket with thumb-hole cuffs', gender: 'UNISEX', taxRule: 'STANDARD_VAT', brandName: 'ActivePeak', categoryName: 'Sportswear', tags: ['hoodie', 'jacket', 'zip-up'] },
];

function generateSku(brandName: string, colour: string, size: string, productIndex: number): string {
  const brandCode = brandName.substring(0, 3).toUpperCase();
  const colourAbbrev = colour.replace(/\s+/g, '').substring(0, 3).toUpperCase();
  return `${brandCode}-${String(productIndex).padStart(2, '0')}-${colourAbbrev}-${size.replace(/\s+/g, '')}`;
}

async function seedSampleCatalog() {
  if (process.env.SEED_SAMPLE_TENANT !== 'true') {
    return;
  }

  const tenant = await prisma.tenant.findFirst({ where: { slug: 'dilani' } });
  if (!tenant) {
    console.log('Sample tenant not found, skipping catalog seed');
    return;
  }
  const tenantId = tenant.id;

  // Idempotency check
  const existingCategory = await prisma.category.findFirst({
    where: { tenantId, name: "Men's Shirts" },
  });
  if (existingCategory) {
    console.log('Catalog data already seeded, skipping');
    return;
  }

  // ── Create Categories ──
  await prisma.category.createMany({
    data: SEED_CATEGORIES.map((c) => ({
      tenantId,
      name: c.name,
      sortOrder: c.sortOrder,
    })),
  });
  const categories = await prisma.category.findMany({ where: { tenantId } });
  const categoryMap = Object.fromEntries(categories.map((c) => [c.name, c.id]));

  // ── Create Brands ──
  await prisma.brand.createMany({
    data: SEED_BRANDS.map((b) => ({
      tenantId,
      name: b.name,
      description: b.description,
    })),
  });
  const brands = await prisma.brand.findMany({ where: { tenantId } });
  const brandMap = Object.fromEntries(brands.map((b) => [b.name, b.id]));

  // ── Create Products & Variants ──
  let totalVariants = 0;
  let lowStockVariants = 0;

  for (let pi = 0; pi < SEED_PRODUCTS.length; pi++) {
    const sp = SEED_PRODUCTS[pi]!;
    const categoryId = categoryMap[sp.categoryName];
    const brandId = brandMap[sp.brandName];
    if (!categoryId || !brandId) {
      throw new Error(`Missing category or brand for product: ${sp.name}`);
    }
    const product = await prisma.product.create({
      data: {
        tenantId,
        name: sp.name,
        description: sp.description,
        categoryId,
        brandId,
        gender: sp.gender,
        tags: sp.tags,
        taxRule: sp.taxRule,
      },
    });

    const sizes = SIZE_SETS[sp.categoryName] ?? ['ONE SIZE'];
    const colours = COLOUR_SETS[sp.categoryName] ?? ['Default'];

    // Build variant combos, cap at 12
    const variantData: {
      productId: string;
      tenantId: string;
      sku: string;
      size: string;
      colour: string;
      costPrice: number;
      retailPrice: number;
      stockQuantity: number;
      lowStockThreshold: number;
    }[] = [];

    let vi = 0;
    for (const size of sizes) {
      for (const colour of colours) {
        if (vi >= 12) break;

        // Deterministic pricing
        const costPrice = Math.round((250 + pi * 88 + vi * 17) * 100) / 100;
        const multiplier = 2.0 + ((pi * 7 + vi * 3) % 9) / 10;
        const retailPrice = Math.round(costPrice * multiplier * 100) / 100;

        // ~15% of variants below threshold: use a deterministic check
        const isLowStock = (pi * 13 + vi * 7) % 7 === 0;
        const stockQuantity = isLowStock
          ? (pi + vi) % 5 // 0-4
          : 5 + ((pi * 3 + vi * 11) % 46); // 5-50

        const sku = generateSku(sp.brandName, colour, size, pi);

        variantData.push({
          productId: product.id,
          tenantId,
          sku,
          size,
          colour,
          costPrice,
          retailPrice,
          stockQuantity,
          lowStockThreshold: 5,
        });

        if (stockQuantity < 5) lowStockVariants++;
        totalVariants++;
        vi++;
      }
      if (vi >= 12) break;
    }

    await prisma.productVariant.createMany({ data: variantData });
  }

  console.log('── Catalog Seed Summary ──');
  console.log(`  Categories: ${SEED_CATEGORIES.length}`);
  console.log(`  Brands:     ${SEED_BRANDS.length}`);
  console.log(`  Products:   ${SEED_PRODUCTS.length}`);
  console.log(`  Variants:   ${totalVariants}`);
  console.log(`  Low-stock:  ${lowStockVariants} (below threshold of 5)`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
