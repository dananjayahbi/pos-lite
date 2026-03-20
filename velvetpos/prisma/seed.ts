import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import bcrypt from 'bcryptjs';
import Decimal from 'decimal.js';

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

  // Seed initial stock movements (gated behind SEED_SAMPLE_TENANT=true)
  try {
    await seedInitialStockMovements();
  } catch (error) {
    console.error('Failed to seed initial stock movements:', error);
    throw error;
  }

  // Seed demo sales data (gated behind SEED_SAMPLE_TENANT=true)
  try {
    await seedDemoSales();
  } catch (error) {
    console.error('Failed to seed demo sales:', error);
    throw error;
  }

  // Seed demo returns data (gated behind SEED_SAMPLE_TENANT=true)
  try {
    await seedDemoReturns();
  } catch (error) {
    console.error('Failed to seed demo returns:', error);
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

// ── Seed Initial Stock Movements ─────────────────────────────────────────────
// Creates INITIAL_STOCK StockMovement records for every variant with stockQuantity > 0.
// This gives the stock movement history realistic data from ~30 days ago.
// Expected low-stock count: variants where stockQuantity < lowStockThreshold (5).
// Valuation totals depend on deterministic pricing in seedSampleCatalog.

async function seedInitialStockMovements() {
  if (process.env.SEED_SAMPLE_TENANT !== 'true') {
    console.log("Skipping initial stock movements seed (SEED_SAMPLE_TENANT is not set to 'true')");
    return;
  }

  const tenant = await prisma.tenant.findFirst({ where: { slug: 'dilani' } });
  if (!tenant) {
    console.log('Sample tenant not found, skipping stock movements seed');
    return;
  }

  // Use the OWNER user as the actor for initial stock movements
  const owner = await prisma.user.findFirst({
    where: { tenantId: tenant.id, role: 'OWNER', deletedAt: null },
    select: { id: true },
  });
  if (!owner) {
    console.log('Owner user not found for tenant, skipping stock movements seed');
    return;
  }

  // Idempotency: check if any INITIAL_STOCK movements already exist for this tenant
  const existingMovement = await prisma.stockMovement.findFirst({
    where: { tenantId: tenant.id, reason: 'INITIAL_STOCK' },
    select: { id: true },
  });
  if (existingMovement) {
    console.log('Initial stock movements already seeded, skipping');
    return;
  }

  // Fetch all variants with stock > 0
  const variants = await prisma.productVariant.findMany({
    where: { tenantId: tenant.id, stockQuantity: { gt: 0 } },
    select: { id: true, stockQuantity: true },
    orderBy: { createdAt: 'asc' },
  });

  if (variants.length === 0) {
    console.log('No variants with stock > 0 found, skipping stock movements seed');
    return;
  }

  // Base timestamp: ~30 days ago, stagger each variant by 1-2 hours
  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() - 30);
  baseDate.setHours(9, 0, 0, 0); // Start at 9 AM

  const movementData = variants.map((v, index) => {
    const createdAt = new Date(baseDate.getTime() + index * (90 * 60 * 1000)); // 90 min apart
    return {
      tenantId: tenant.id,
      variantId: v.id,
      reason: 'INITIAL_STOCK' as const,
      quantityDelta: v.stockQuantity,
      quantityBefore: 0,
      quantityAfter: v.stockQuantity,
      actorId: owner.id,
      note: 'Initial stock seeded for development environment.',
      createdAt,
    };
  });

  await prisma.stockMovement.createMany({ data: movementData });

  const allVariantsCount = await prisma.productVariant.count({
    where: { tenantId: tenant.id },
  });

  console.log('── Initial Stock Movements Summary ──');
  console.log(`  Total variants:     ${allVariantsCount}`);
  console.log(`  With stock > 0:     ${variants.length}`);
  console.log(`  Movements created:  ${movementData.length}`);
  console.log(`  Skipped (zero qty): ${allVariantsCount - variants.length}`);
}

// ── Seed Demo Sales ──────────────────────────────────────────────────────────

async function seedDemoSales() {
  if (process.env.SEED_SAMPLE_TENANT !== 'true') {
    console.log("Skipping demo sales seed (SEED_SAMPLE_TENANT is not set to 'true')");
    return;
  }

  const tenant = await prisma.tenant.findFirst({ where: { slug: 'dilani' } });
  if (!tenant) {
    console.log('Sample tenant not found, skipping demo sales seed');
    return;
  }
  const tenantId = tenant.id;

  // Idempotency check
  const existingSalesCount = await prisma.sale.count({ where: { tenantId } });
  if (existingSalesCount >= 20) {
    console.log('Demo sales already seeded — skipping.');
    return;
  }

  // ── Create 2 cashier users ──
  const cashierPassword = await bcrypt.hash('cashier123!', 12);
  const cashierPermissions = [
    'sale:create',
    'sale:view',
    'sale:hold',
    'sale:resume',
    'sale:receipt:reprint',
    'shift:open',
    'shift:close',
    'shift:view',
  ];

  const cashier1 = await prisma.user.upsert({
    where: { email: 'cashier1@velvetpos.dev' },
    create: {
      email: 'cashier1@velvetpos.dev',
      passwordHash: cashierPassword,
      role: 'CASHIER',
      tenantId,
      permissions: cashierPermissions,
      isActive: true,
    },
    update: {},
  });

  const cashier2 = await prisma.user.upsert({
    where: { email: 'cashier2@velvetpos.dev' },
    create: {
      email: 'cashier2@velvetpos.dev',
      passwordHash: cashierPassword,
      role: 'CASHIER',
      tenantId,
      permissions: cashierPermissions,
      isActive: true,
    },
    update: {},
  });

  const cashiers = [cashier1, cashier2];

  // ── Create 2 shifts (CLOSED) ──
  const now = new Date();
  const shiftOpenedAt = new Date(now);
  shiftOpenedAt.setDate(shiftOpenedAt.getDate() - 4);
  shiftOpenedAt.setHours(8, 30, 0, 0);

  const shiftClosedAt = new Date(now);
  shiftClosedAt.setHours(20, 0, 0, 0);

  const shift1 = await prisma.shift.create({
    data: {
      tenantId,
      cashierId: cashier1.id,
      status: 'CLOSED',
      openedAt: shiftOpenedAt,
      closedAt: shiftClosedAt,
      openingFloat: 5000.0,
    },
  });

  const shift2 = await prisma.shift.create({
    data: {
      tenantId,
      cashierId: cashier2.id,
      status: 'CLOSED',
      openedAt: shiftOpenedAt,
      closedAt: shiftClosedAt,
      openingFloat: 5000.0,
    },
  });

  const shifts = [shift1, shift2];

  // ── Fetch product variants ──
  const variants = await prisma.productVariant.findMany({
    where: { tenantId },
    take: 20,
    include: { product: { select: { name: true } } },
  });

  if (variants.length === 0) {
    console.log('No product variants found, skipping demo sales seed');
    return;
  }

  // ── Define 20 sale compositions ──
  // Each sale: { dayIndex, hourOffset, cashierIndex, paymentMethod, lineItems: [{ variantIndex, quantity }] }
  type SaleComposition = {
    dayIndex: number;
    hourOffset: number;
    cashierIndex: number;
    paymentMethod: 'CASH' | 'CARD' | 'SPLIT';
    lineItems: { variantIndex: number; quantity: number }[];
  };

  const saleCompositions: SaleComposition[] = [
    // Day 0 (4 days ago) - 4 sales
    { dayIndex: 0, hourOffset: 0, cashierIndex: 0, paymentMethod: 'CASH', lineItems: [{ variantIndex: 0, quantity: 1 }, { variantIndex: 1, quantity: 2 }] },
    { dayIndex: 0, hourOffset: 1, cashierIndex: 1, paymentMethod: 'CARD', lineItems: [{ variantIndex: 2, quantity: 1 }, { variantIndex: 3, quantity: 1 }, { variantIndex: 4, quantity: 1 }] },
    { dayIndex: 0, hourOffset: 2, cashierIndex: 0, paymentMethod: 'CASH', lineItems: [{ variantIndex: 5, quantity: 2 }, { variantIndex: 6, quantity: 1 }] },
    { dayIndex: 0, hourOffset: 3, cashierIndex: 1, paymentMethod: 'CASH', lineItems: [{ variantIndex: 7, quantity: 1 }, { variantIndex: 8, quantity: 1 }] },

    // Day 1 (3 days ago) - 4 sales
    { dayIndex: 1, hourOffset: 0, cashierIndex: 0, paymentMethod: 'CARD', lineItems: [{ variantIndex: 9, quantity: 1 }, { variantIndex: 10, quantity: 1 }] },
    { dayIndex: 1, hourOffset: 1, cashierIndex: 1, paymentMethod: 'CASH', lineItems: [{ variantIndex: 11, quantity: 1 }, { variantIndex: 12, quantity: 2 }] },
    { dayIndex: 1, hourOffset: 2, cashierIndex: 0, paymentMethod: 'CASH', lineItems: [{ variantIndex: 13, quantity: 1 }, { variantIndex: 14, quantity: 1 }, { variantIndex: 15, quantity: 1 }] },
    { dayIndex: 1, hourOffset: 3, cashierIndex: 1, paymentMethod: 'SPLIT', lineItems: [{ variantIndex: 16, quantity: 2 }, { variantIndex: 17, quantity: 1 }, { variantIndex: 18, quantity: 1 }, { variantIndex: 19, quantity: 1 }] },

    // Day 2 (2 days ago) - 4 sales
    { dayIndex: 2, hourOffset: 0, cashierIndex: 0, paymentMethod: 'CASH', lineItems: [{ variantIndex: 0, quantity: 2 }, { variantIndex: 3, quantity: 1 }] },
    { dayIndex: 2, hourOffset: 1, cashierIndex: 1, paymentMethod: 'CARD', lineItems: [{ variantIndex: 5, quantity: 1 }, { variantIndex: 7, quantity: 1 }] },
    { dayIndex: 2, hourOffset: 2, cashierIndex: 0, paymentMethod: 'CASH', lineItems: [{ variantIndex: 9, quantity: 1 }, { variantIndex: 11, quantity: 2 }] },
    { dayIndex: 2, hourOffset: 3, cashierIndex: 1, paymentMethod: 'CASH', lineItems: [{ variantIndex: 13, quantity: 1 }, { variantIndex: 15, quantity: 1 }] },

    // Day 3 (yesterday) - 4 sales
    { dayIndex: 3, hourOffset: 0, cashierIndex: 0, paymentMethod: 'CARD', lineItems: [{ variantIndex: 1, quantity: 1 }, { variantIndex: 4, quantity: 2 }] },
    { dayIndex: 3, hourOffset: 1, cashierIndex: 1, paymentMethod: 'CASH', lineItems: [{ variantIndex: 6, quantity: 1 }, { variantIndex: 8, quantity: 1 }, { variantIndex: 10, quantity: 1 }] },
    { dayIndex: 3, hourOffset: 2, cashierIndex: 0, paymentMethod: 'CASH', lineItems: [{ variantIndex: 12, quantity: 1 }, { variantIndex: 14, quantity: 2 }] },
    { dayIndex: 3, hourOffset: 3, cashierIndex: 1, paymentMethod: 'CARD', lineItems: [{ variantIndex: 16, quantity: 1 }, { variantIndex: 18, quantity: 1 }] },

    // Day 4 (today) - 4 sales
    { dayIndex: 4, hourOffset: 0, cashierIndex: 0, paymentMethod: 'CASH', lineItems: [{ variantIndex: 2, quantity: 1 }, { variantIndex: 5, quantity: 1 }] },
    { dayIndex: 4, hourOffset: 1, cashierIndex: 1, paymentMethod: 'SPLIT', lineItems: [{ variantIndex: 7, quantity: 2 }, { variantIndex: 10, quantity: 1 }, { variantIndex: 13, quantity: 1 }] },
    { dayIndex: 4, hourOffset: 2, cashierIndex: 0, paymentMethod: 'CARD', lineItems: [{ variantIndex: 15, quantity: 1 }, { variantIndex: 17, quantity: 1 }, { variantIndex: 19, quantity: 2 }] },
    { dayIndex: 4, hourOffset: 3, cashierIndex: 1, paymentMethod: 'CASH', lineItems: [{ variantIndex: 0, quantity: 1 }, { variantIndex: 4, quantity: 1 }] },
  ];

  // ── Create sales loop ──
  const TAX_RATE = new Decimal('0.205'); // 18% VAT + 2.5% SSCL

  for (let i = 0; i < saleCompositions.length; i++) {
    const comp = saleCompositions[i]!;
    const cashier = cashiers[comp.cashierIndex]!;
    const shift = shifts[comp.cashierIndex]!;

    // Compute sale timestamp
    const saleDate = new Date(now);
    saleDate.setDate(saleDate.getDate() - (4 - comp.dayIndex));
    saleDate.setHours(9 + comp.hourOffset, Math.floor(Math.random() * 59), 0, 0);

    // Build line items and compute totals
    const lineItemsData: {
      variantId: string;
      productNameSnapshot: string;
      variantDescriptionSnapshot: string;
      sku: string;
      unitPrice: Decimal;
      quantity: number;
      discountPercent: Decimal;
      discountAmount: Decimal;
      lineTotalBeforeDiscount: Decimal;
      lineTotalAfterDiscount: Decimal;
      createdAt: Date;
    }[] = [];

    let subtotal = new Decimal(0);

    for (const li of comp.lineItems) {
      const variant = variants[li.variantIndex % variants.length]!;
      const unitPrice = new Decimal(variant.retailPrice.toString());
      const quantity = li.quantity;
      const lineTotalBeforeDiscount = unitPrice.mul(quantity);
      const lineTotalAfterDiscount = lineTotalBeforeDiscount;

      lineItemsData.push({
        variantId: variant.id,
        productNameSnapshot: variant.product.name,
        variantDescriptionSnapshot: `${variant.colour} / ${variant.size}`,
        sku: variant.sku,
        unitPrice,
        quantity,
        discountPercent: new Decimal(0),
        discountAmount: new Decimal(0),
        lineTotalBeforeDiscount,
        lineTotalAfterDiscount,
        createdAt: saleDate,
      });

      subtotal = subtotal.add(lineTotalAfterDiscount);
    }

    const taxAmount = subtotal.mul(TAX_RATE).toDecimalPlaces(2);
    const totalAmount = subtotal.add(taxAmount).toDecimalPlaces(2);

    // Create sale record
    const sale = await prisma.sale.create({
      data: {
        tenantId,
        shiftId: shift.id,
        cashierId: cashier.id,
        subtotal: subtotal.toNumber(),
        discountAmount: 0,
        taxAmount: taxAmount.toNumber(),
        totalAmount: totalAmount.toNumber(),
        paymentMethod: comp.paymentMethod,
        status: 'COMPLETED',
        completedAt: saleDate,
        createdAt: saleDate,
      },
    });

    // Create sale lines
    await prisma.saleLine.createMany({
      data: lineItemsData.map((li) => ({
        saleId: sale.id,
        variantId: li.variantId,
        productNameSnapshot: li.productNameSnapshot,
        variantDescriptionSnapshot: li.variantDescriptionSnapshot,
        sku: li.sku,
        unitPrice: li.unitPrice.toNumber(),
        quantity: li.quantity,
        discountPercent: li.discountPercent.toNumber(),
        discountAmount: li.discountAmount.toNumber(),
        lineTotalBeforeDiscount: li.lineTotalBeforeDiscount.toNumber(),
        lineTotalAfterDiscount: li.lineTotalAfterDiscount.toNumber(),
        createdAt: li.createdAt,
      })),
    });

    // Create payment records
    if (comp.paymentMethod === 'CASH') {
      await prisma.payment.create({
        data: {
          saleId: sale.id,
          method: 'CASH',
          amount: totalAmount.toNumber(),
          createdAt: saleDate,
        },
      });
    } else if (comp.paymentMethod === 'CARD') {
      await prisma.payment.create({
        data: {
          saleId: sale.id,
          method: 'CARD',
          amount: totalAmount.toNumber(),
          cardReferenceNumber: `AUTO${String(i).padStart(6, '0')}`,
          createdAt: saleDate,
        },
      });
    } else {
      // SPLIT: CARD 60% + CASH remainder
      const cardAmount = totalAmount.mul(0.6).toDecimalPlaces(2);
      const cashAmount = totalAmount.sub(cardAmount);

      await prisma.payment.createMany({
        data: [
          {
            saleId: sale.id,
            method: 'CARD',
            amount: cardAmount.toNumber(),
            cardReferenceNumber: `AUTO${String(i).padStart(6, '0')}`,
            createdAt: saleDate,
          },
          {
            saleId: sale.id,
            method: 'CASH',
            amount: cashAmount.toNumber(),
            createdAt: saleDate,
          },
        ],
      });
    }
  }

  // ── Create ShiftClosure records ──
  for (let si = 0; si < shifts.length; si++) {
    const shift = shifts[si]!;
    const cashier = cashiers[si]!;

    const shiftSales = await prisma.sale.findMany({
      where: { shiftId: shift.id },
      include: { payments: true },
    });

    let totalSalesAmount = new Decimal(0);
    let totalCashAmount = new Decimal(0);
    let totalCardAmount = new Decimal(0);

    for (const sale of shiftSales) {
      totalSalesAmount = totalSalesAmount.add(new Decimal(sale.totalAmount.toString()));
      for (const payment of sale.payments) {
        if (payment.method === 'CASH') {
          totalCashAmount = totalCashAmount.add(new Decimal(payment.amount.toString()));
        } else {
          totalCardAmount = totalCardAmount.add(new Decimal(payment.amount.toString()));
        }
      }
    }

    const openingFloat = new Decimal(5000);
    const expectedCash = openingFloat.add(totalCashAmount);

    await prisma.shiftClosure.create({
      data: {
        shiftId: shift.id,
        closingCashCount: expectedCash.toNumber(),
        expectedCash: expectedCash.toNumber(),
        cashDifference: 0,
        totalSalesCount: shiftSales.length,
        totalSalesAmount: totalSalesAmount.toNumber(),
        totalReturnsCount: 0,
        totalReturnsAmount: 0,
        totalCashAmount: totalCashAmount.toNumber(),
        totalCardAmount: totalCardAmount.toNumber(),
        closedById: cashier.id,
        closedAt: shiftClosedAt,
      },
    });
  }

  // NOTE: Seed data bypasses adjustStock service. Stock quantities are set directly
  // after sale creation to avoid race conditions and excessive transaction overhead
  // in seed. This deviates from the production code path.
  const soldVariantIds = await prisma.saleLine.findMany({
    where: { sale: { tenantId } },
    select: { variantId: true },
    distinct: ['variantId'],
  });

  for (const { variantId } of soldVariantIds) {
    await prisma.productVariant.update({
      where: { id: variantId },
      data: { stockQuantity: 50 },
    });
  }

  // ── Sanity logs ──
  const saleCount = await prisma.sale.count({ where: { tenantId } });
  const paymentCount = await prisma.payment.count({
    where: { sale: { tenantId } },
  });

  console.log('── Demo Sales Seed Summary ──');
  console.log(`  Cashiers created:  2`);
  console.log(`  Shifts created:    2`);
  console.log(`  Sales created:     ${saleCount}`);
  console.log(`  Payments created:  ${paymentCount}`);
  console.log(`  Variants restocked: ${soldVariantIds.length}`);
}

// ── Seed Demo Returns ────────────────────────────────────────────────────────

async function seedDemoReturns() {
  if (process.env.SEED_SAMPLE_TENANT !== 'true') {
    console.log("Skipping demo returns seed (SEED_SAMPLE_TENANT is not set to 'true')");
    return;
  }

  const tenant = await prisma.tenant.findFirst({ where: { slug: 'dilani' } });
  if (!tenant) {
    console.log('Sample tenant not found, skipping demo returns seed');
    return;
  }
  const tenantId = tenant.id;

  // Idempotency check
  const existingReturn = await prisma.return.findFirst({
    where: { tenantId, reason: 'SEED_DEMO_CASH_REFUND' },
  });
  if (existingReturn) {
    console.log('Demo returns already seeded — skipping.');
    return;
  }

  // Find the owner user (OWNER role) for authorizedById
  const owner = await prisma.user.findFirst({
    where: { tenantId, role: 'OWNER', deletedAt: null },
  });
  if (!owner) {
    console.log('Owner user not found, skipping demo returns seed');
    return;
  }

  // Find cashier1 for initiatedById
  const cashier1 = await prisma.user.findFirst({
    where: { email: 'cashier1@velvetpos.dev', tenantId, deletedAt: null },
  });
  if (!cashier1) {
    console.log('Cashier1 not found, skipping demo returns seed');
    return;
  }

  // Fetch first 4 completed sales with their lines
  const sales = await prisma.sale.findMany({
    where: { tenantId, status: 'COMPLETED' },
    include: { lines: true },
    orderBy: { createdAt: 'asc' },
    take: 4,
  });

  if (sales.length < 4) {
    console.log(`Only ${sales.length} sales found, need 4. Skipping demo returns seed`);
    return;
  }

  // ── Return A — Cash Refund with Restocking ──
  const saleA = sales[0]!;
  const lineA = saleA.lines[0]!;
  const lineARefundAmount = new Decimal(1)
    .div(new Decimal(lineA.quantity))
    .mul(new Decimal(lineA.lineTotalAfterDiscount.toString()))
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  const returnA = await prisma.return.create({
    data: {
      tenantId,
      originalSaleId: saleA.id,
      initiatedById: cashier1.id,
      authorizedById: owner.id,
      refundMethod: 'CASH',
      refundAmount: lineARefundAmount.toNumber(),
      restockItems: true,
      reason: 'SEED_DEMO_CASH_REFUND',
      status: 'COMPLETED',
    },
  });

  await prisma.returnLine.create({
    data: {
      returnId: returnA.id,
      originalSaleLineId: lineA.id,
      variantId: lineA.variantId,
      productNameSnapshot: lineA.productNameSnapshot,
      variantDescriptionSnapshot: lineA.variantDescriptionSnapshot,
      quantity: 1,
      unitPrice: Number(lineA.unitPrice.toString()),
      lineRefundAmount: lineARefundAmount.toNumber(),
      isRestocked: false,
    },
  });

  await prisma.productVariant.update({
    where: { id: lineA.variantId },
    data: { stockQuantity: { increment: 1 } },
  });

  await prisma.returnLine.updateMany({
    where: { returnId: returnA.id },
    data: { isRestocked: true },
  });

  // ── Return B — Store Credit, No Restock ──
  const saleB = sales[1]!;
  const lineB = saleB.lines[0]!;
  const lineBRefundAmount = new Decimal(lineB.lineTotalAfterDiscount.toString()).toDecimalPlaces(
    2,
    Decimal.ROUND_HALF_UP,
  );

  const returnB = await prisma.return.create({
    data: {
      tenantId,
      originalSaleId: saleB.id,
      initiatedById: cashier1.id,
      authorizedById: owner.id,
      refundMethod: 'STORE_CREDIT',
      refundAmount: lineBRefundAmount.toNumber(),
      restockItems: false,
      reason: 'SEED_DEMO_STORE_CREDIT',
      status: 'COMPLETED',
    },
  });

  await prisma.returnLine.create({
    data: {
      returnId: returnB.id,
      originalSaleLineId: lineB.id,
      variantId: lineB.variantId,
      productNameSnapshot: lineB.productNameSnapshot,
      variantDescriptionSnapshot: lineB.variantDescriptionSnapshot,
      quantity: lineB.quantity,
      unitPrice: Number(lineB.unitPrice.toString()),
      lineRefundAmount: lineBRefundAmount.toNumber(),
      isRestocked: false,
    },
  });

  await prisma.storeCredit.create({
    data: {
      tenantId,
      amount: lineBRefundAmount.toNumber(),
      usedAmount: 0,
      note: `Return ${returnB.id.slice(0, 8).toUpperCase()} — store credit issued`,
    },
  });

  // ── Return C — Card Reversal, Partial Return ──
  const saleC = sales[2]!;
  // Sale 2 has variants[5] qty 2, find the line with quantity >= 2
  const lineC = saleC.lines.find((l) => l.quantity >= 2) ?? saleC.lines[0]!;
  const lineCRefundAmount = new Decimal(1)
    .div(new Decimal(lineC.quantity))
    .mul(new Decimal(lineC.lineTotalAfterDiscount.toString()))
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  const returnC = await prisma.return.create({
    data: {
      tenantId,
      originalSaleId: saleC.id,
      initiatedById: cashier1.id,
      authorizedById: owner.id,
      refundMethod: 'CARD_REVERSAL',
      refundAmount: lineCRefundAmount.toNumber(),
      restockItems: true,
      reason: 'SEED_DEMO_CARD_REVERSAL',
      status: 'COMPLETED',
    },
  });

  await prisma.returnLine.create({
    data: {
      returnId: returnC.id,
      originalSaleLineId: lineC.id,
      variantId: lineC.variantId,
      productNameSnapshot: lineC.productNameSnapshot,
      variantDescriptionSnapshot: lineC.variantDescriptionSnapshot,
      quantity: 1,
      unitPrice: Number(lineC.unitPrice.toString()),
      lineRefundAmount: lineCRefundAmount.toNumber(),
      isRestocked: false,
    },
  });

  await prisma.productVariant.update({
    where: { id: lineC.variantId },
    data: { stockQuantity: { increment: 1 } },
  });

  await prisma.returnLine.updateMany({
    where: { returnId: returnC.id },
    data: { isRestocked: true },
  });

  // ── Return D — Exchange ──
  const saleD = sales[3]!;
  const lineD = saleD.lines[0]!;
  const lineDRefundAmount = new Decimal(lineD.lineTotalAfterDiscount.toString()).toDecimalPlaces(
    2,
    Decimal.ROUND_HALF_UP,
  );

  const returnD = await prisma.return.create({
    data: {
      tenantId,
      originalSaleId: saleD.id,
      initiatedById: cashier1.id,
      authorizedById: owner.id,
      refundMethod: 'EXCHANGE',
      refundAmount: lineDRefundAmount.toNumber(),
      restockItems: true,
      reason: 'SEED_DEMO_EXCHANGE',
      status: 'COMPLETED',
    },
  });

  await prisma.returnLine.create({
    data: {
      returnId: returnD.id,
      originalSaleLineId: lineD.id,
      variantId: lineD.variantId,
      productNameSnapshot: lineD.productNameSnapshot,
      variantDescriptionSnapshot: lineD.variantDescriptionSnapshot,
      quantity: lineD.quantity,
      unitPrice: Number(lineD.unitPrice.toString()),
      lineRefundAmount: lineDRefundAmount.toNumber(),
      isRestocked: false,
    },
  });

  await prisma.productVariant.update({
    where: { id: lineD.variantId },
    data: { stockQuantity: { increment: lineD.quantity } },
  });

  await prisma.returnLine.updateMany({
    where: { returnId: returnD.id },
    data: { isRestocked: true },
  });

  // ── Summary ──
  const returnCount = await prisma.return.count({ where: { tenantId } });
  const returnLineCount = await prisma.returnLine.count({
    where: { return: { tenantId } },
  });
  const storeCreditCount = await prisma.storeCredit.count({ where: { tenantId } });

  console.log('── Demo Returns Seed Summary ──');
  console.log(`  Returns created:      ${returnCount}`);
  console.log(`  Return lines created: ${returnLineCount}`);
  console.log(`  Store credits created: ${storeCreditCount}`);
  console.log('  Methods: CASH, STORE_CREDIT, CARD_REVERSAL, EXCHANGE');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
