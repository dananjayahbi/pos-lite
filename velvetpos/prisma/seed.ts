import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '../src/generated/prisma/client';
import bcrypt from 'bcryptjs';
import Decimal from 'decimal.js';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function seedPlans() {
  const plans = [
    {
      name: 'Basic POS',
      monthlyPrice: 4999,
      annualPrice: 49990,
      maxUsers: 3,
      maxProductVariants: 200,
      features: [
        'POS Terminal',
        'Inventory Management',
        'Sales History',
        'Basic Reports',
        'Up to 3 Staff Accounts',
      ],
      isActive: true,
    },
    {
      name: 'Pro POS + WhatsApp',
      monthlyPrice: 7999,
      annualPrice: 79990,
      maxUsers: 50,
      maxProductVariants: 5000,
      features: [
        'Everything in Basic POS',
        'WhatsApp Receipt Delivery',
        'WhatsApp Marketing Broadcasts',
        'Advanced Reports & Analytics',
        'Unlimited Staff Accounts',
        'Priority Support',
      ],
      isActive: true,
    },
  ];

  for (const plan of plans) {
    const existing = await prisma.subscriptionPlan.findUnique({ where: { name: plan.name } });

    await prisma.subscriptionPlan.upsert({
      where: { name: plan.name },
      create: plan,
      update: {
        monthlyPrice: plan.monthlyPrice,
        features: plan.features,
        isActive: plan.isActive,
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

  // Seed CRM demo data (gated behind SEED_SAMPLE_TENANT=true)
  try {
    await seedCRMData();
  } catch (error) {
    console.error('Failed to seed CRM data:', error);
    throw error;
  }

  // Seed staff promotions & expenses (gated behind SEED_SAMPLE_TENANT=true)
  try {
    await seedStaffPromotionsExpenses();
  } catch (error) {
    console.error('Failed to seed staff promotions & expenses:', error);
    throw error;
  }

  // Seed hardware config and audit data (gated behind SEED_SAMPLE_TENANT=true)
  try {
    await seedHardwareAndAuditData();
  } catch (error) {
    console.error('Failed to seed hardware & audit data:', error);
    throw error;
  }

  // Seed billing demo data (subscription plans, subscriptions, invoices, reminders)
  try {
    await seedBillingData();
  } catch (error) {
    console.error('Failed to seed billing data:', error);
    throw error;
  }

  // Seed comprehensive demo data (gated behind SEED_DEMO_DATA=true)
  try {
    await seedComprehensiveDemoData();
  } catch (error) {
    console.error('Failed to seed comprehensive demo data:', error);
    throw error;
  }

  await prisma.$disconnect();
}

async function seedSuperAdmin() {
  const defaultEmail = 'superadmin@velvetpos.dev';
  const defaultPassword = 'changeme123!';
  const defaultPin = '9999';

  const superAdminEmail = process.env.SEED_SUPER_ADMIN_EMAIL ?? defaultEmail;
  const superAdminPassword = process.env.SEED_SUPER_ADMIN_PASSWORD ?? defaultPassword;
  const superAdminPin = process.env.SEED_SUPER_ADMIN_PIN ?? defaultPin;

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

  const superAdminPinHash = await bcrypt.hash(superAdminPin, 10);

  if (existingSuperAdmin) {
    await prisma.user.update({
      where: { id: existingSuperAdmin.id },
      data: { pin: superAdminPinHash },
    });
    console.log('Super Admin account already exists. Updated PIN.');
    return;
  }

  const passwordHash = await bcrypt.hash(superAdminPassword, 12);

  await prisma.user.create({
    data: {
      email: superAdminEmail,
      passwordHash,
      pin: superAdminPinHash,
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

  const proPlan = await prisma.subscriptionPlan.findFirst({ where: { name: 'Pro POS + WhatsApp' } });
  if (!proPlan) {
    throw new Error('Pro plan not found — ensure plans are seeded before running tenant seed');
  }

  const ownerEmail = process.env.SEED_OWNER_EMAIL;
  const ownerPassword = process.env.SEED_OWNER_PASSWORD;
  const ownerPin = process.env.SEED_OWNER_PIN ?? '1111';
  if (!ownerEmail || !ownerPassword) {
    throw new Error(
      'SEED_OWNER_EMAIL and SEED_OWNER_PASSWORD must be set in .env.local to seed the sample tenant',
    );
  }

  const ownerPasswordHash = await bcrypt.hash(ownerPassword, 12);
  const ownerPinHash = await bcrypt.hash(ownerPin, 10);

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
        pin: ownerPinHash,
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
  const cashier1PinHash = await bcrypt.hash('3333', 10);
  const cashier2PinHash = await bcrypt.hash('4444', 10);
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
      pin: cashier1PinHash,
      role: 'CASHIER',
      tenantId,
      permissions: cashierPermissions,
      isActive: true,
    },
    update: {
      pin: cashier1PinHash,
    },
  });

  const cashier2 = await prisma.user.upsert({
    where: { email: 'cashier2@velvetpos.dev' },
    create: {
      email: 'cashier2@velvetpos.dev',
      passwordHash: cashierPassword,
      pin: cashier2PinHash,
      role: 'CASHIER',
      tenantId,
      permissions: cashierPermissions,
      isActive: true,
    },
    update: {
      pin: cashier2PinHash,
    },
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

async function seedCRMData() {
  if (process.env.SEED_SAMPLE_TENANT !== 'true') {
    console.log("Skipping CRM data seed (SEED_SAMPLE_TENANT is not set to 'true')");
    return;
  }

  const tenant = await prisma.tenant.findFirst({ where: { slug: 'dilani' } });
  if (!tenant) {
    console.log('Sample tenant not found, skipping CRM seed');
    return;
  }
  const tenantId = tenant.id;

  // ── Customers ──
  const customersData = [
    { name: 'Amara Perera', phone: '+94770000001', tags: ['VIP', 'REGULAR'], birthday: new Date('1990-03-17'), creditBalance: 1500, totalSpend: 45000, gender: 'FEMALE' as const },
    { name: 'Nimal Fernando', phone: '+94770000002', tags: ['WHOLESALE'], birthday: undefined, creditBalance: 0, totalSpend: 12000, gender: 'MALE' as const },
    { name: 'Dilani Jayawardena', phone: '+94770000003', tags: ['VIP'], birthday: new Date('1985-06-21'), creditBalance: 0, totalSpend: 62000, gender: 'FEMALE' as const },
    { name: 'Kasun Dissanayake', phone: '+94770000004', tags: ['REGULAR'], birthday: new Date('1995-11-08'), creditBalance: 0, totalSpend: 8000, gender: 'MALE' as const },
    { name: 'Priya Rajapaksa', phone: '+94770000005', tags: ['VIP', 'ONLINE'], birthday: new Date('1992-07-14'), creditBalance: 2000, totalSpend: 38000, gender: 'FEMALE' as const },
    { name: 'Chamara Silva', phone: '+94770000006', tags: ['REGULAR'], birthday: undefined, creditBalance: 0, totalSpend: 5000, gender: 'MALE' as const },
    { name: 'Ruwan Bandara', phone: '+94770000007', tags: ['WHOLESALE'], birthday: new Date('1978-02-28'), creditBalance: 0, totalSpend: 15000, gender: 'MALE' as const },
    { name: 'Sanduni Gunawardena', phone: '+94770000008', tags: ['VIP'], birthday: new Date('1998-09-03'), creditBalance: 750, totalSpend: 28000, gender: 'FEMALE' as const },
    { name: 'Tharindu Wickramasinghe', phone: '+94770000009', tags: ['REGULAR'], birthday: new Date('1988-12-25'), creditBalance: 0, totalSpend: 3000, gender: 'MALE' as const },
    { name: 'Ishani Mendis', phone: '+94770000010', tags: ['STAFF'], birthday: new Date('1993-04-18'), creditBalance: 0, totalSpend: 7000, gender: 'FEMALE' as const },
  ];

  let customersCreated = 0;
  for (const c of customersData) {
    const existing = await prisma.customer.findFirst({
      where: { tenantId, phone: c.phone },
    });
    if (existing) continue;

    await prisma.customer.create({
      data: {
        tenantId,
        name: c.name,
        phone: c.phone,
        tags: c.tags,
        gender: c.gender,
        creditBalance: c.creditBalance,
        totalSpend: c.totalSpend,
        ...(c.birthday !== undefined && { birthday: c.birthday }),
      },
    });
    customersCreated++;
  }
  console.log(`Customers: ${customersCreated} created, ${customersData.length - customersCreated} skipped (already exist)`);

  // ── Suppliers ──
  const suppliersData = [
    { name: 'Colombo Fashion Imports', contactName: 'Ruwan Senanayake', phone: '+94112000001', whatsappNumber: '+94770100001', leadTimeDays: 14, email: 'contact@colombo-fashion-imports.lk' },
    { name: 'Lanka Textile Mills', contactName: 'Nirosha Wickrama', phone: '+94112000002', whatsappNumber: '+94770100002', leadTimeDays: 7, email: 'contact@lanka-textile-mills.lk' },
    { name: 'FabricCo Wholesale', contactName: 'Saman Rathnayake', phone: '+94112000003', whatsappNumber: '+94770100003', leadTimeDays: 10, email: 'contact@fabricco-wholesale.lk' },
  ];

  let suppliersCreated = 0;
  for (const s of suppliersData) {
    const existing = await prisma.supplier.findFirst({
      where: { tenantId, name: s.name },
    });
    if (existing) continue;

    await prisma.supplier.create({
      data: {
        tenantId,
        name: s.name,
        contactName: s.contactName,
        phone: s.phone,
        whatsappNumber: s.whatsappNumber,
        leadTimeDays: s.leadTimeDays,
        email: s.email,
      },
    });
    suppliersCreated++;
  }
  console.log(`Suppliers: ${suppliersCreated} created, ${suppliersData.length - suppliersCreated} skipped (already exist)`);

  // ── Purchase Orders ──
  const variants = await prisma.productVariant.findMany({
    where: { product: { tenantId } },
    include: { product: { select: { name: true } } },
    take: 2,
  });
  if (variants.length < 2) {
    console.log('Not enough variants for PO seed, skipping POs');
    return;
  }
  const [variantA, variantB] = variants;

  const firstUser = await prisma.user.findFirst({ where: { tenantId } });
  if (!firstUser) {
    console.log('No user found for PO seed, skipping POs');
    return;
  }

  function buildDesc(v: { size?: string | null; colour?: string | null }): string {
    const parts: string[] = [];
    if (v.size) parts.push(v.size);
    if (v.colour) parts.push(v.colour);
    return parts.length > 0 ? parts.join(' / ') : 'Default';
  }

  // Fetch suppliers by name for PO creation
  const lankaTextile = await prisma.supplier.findFirst({
    where: { tenantId, name: 'Lanka Textile Mills' },
  });
  const colomboFashion = await prisma.supplier.findFirst({
    where: { tenantId, name: 'Colombo Fashion Imports' },
  });

  if (!lankaTextile || !colomboFashion) {
    console.log('Suppliers not found for PO seed, skipping POs');
    return;
  }

  // PO 1 — RECEIVED
  const po1Notes = 'Demo PO \u2014 Received (seed)';
  const existingPO1 = await prisma.purchaseOrder.findFirst({
    where: { tenantId, notes: po1Notes },
  });

  let po1Created = false;
  if (!existingPO1) {
    await prisma.purchaseOrder.create({
      data: {
        tenantId,
        supplierId: lankaTextile.id,
        createdById: firstUser.id,
        status: 'RECEIVED',
        notes: po1Notes,
        expectedDeliveryDate: new Date(),
        totalAmount: 35000,
        lines: {
          create: [
            {
              variantId: variantA!.id,
              productNameSnapshot: variantA!.product.name,
              variantDescriptionSnapshot: buildDesc(variantA!),
              orderedQty: 20,
              expectedCostPrice: 850,
              receivedQty: 20,
              actualCostPrice: 840,
              isFullyReceived: true,
            },
            {
              variantId: variantB!.id,
              productNameSnapshot: variantB!.product.name,
              variantDescriptionSnapshot: buildDesc(variantB!),
              orderedQty: 15,
              expectedCostPrice: 1200,
              receivedQty: 15,
              actualCostPrice: 1200,
              isFullyReceived: true,
            },
          ],
        },
      },
    });

    // Seed-only direct stock increment (bypasses stock movement service)
    await prisma.productVariant.update({
      where: { id: variantA!.id },
      data: { stockQuantity: { increment: 20 } },
    });
    await prisma.productVariant.update({
      where: { id: variantB!.id },
      data: { stockQuantity: { increment: 15 } },
    });

    po1Created = true;
  }
  console.log(`PO 1 (RECEIVED): ${po1Created ? 'created' : 'skipped (already exists)'}`);

  // PO 2 — DRAFT
  const po2Notes = 'Demo PO \u2014 Draft (seed)';
  const existingPO2 = await prisma.purchaseOrder.findFirst({
    where: { tenantId, notes: po2Notes },
  });

  let po2Created = false;
  if (!existingPO2) {
    const expectedDelivery = new Date();
    expectedDelivery.setDate(expectedDelivery.getDate() + 21);

    await prisma.purchaseOrder.create({
      data: {
        tenantId,
        supplierId: colomboFashion.id,
        createdById: firstUser.id,
        status: 'DRAFT',
        notes: po2Notes,
        expectedDeliveryDate: expectedDelivery,
        totalAmount: 40500,
        lines: {
          create: [
            {
              variantId: variantA!.id,
              productNameSnapshot: variantA!.product.name,
              variantDescriptionSnapshot: buildDesc(variantA!),
              orderedQty: 30,
              expectedCostPrice: 900,
              receivedQty: 0,
              isFullyReceived: false,
            },
            {
              variantId: variantB!.id,
              productNameSnapshot: variantB!.product.name,
              variantDescriptionSnapshot: buildDesc(variantB!),
              orderedQty: 10,
              expectedCostPrice: 1350,
              receivedQty: 0,
              isFullyReceived: false,
            },
          ],
        },
      },
    });
    po2Created = true;
  }
  console.log(`PO 2 (DRAFT): ${po2Created ? 'created' : 'skipped (already exists)'}`);

  // ── Customer Broadcast ──
  const broadcastMessage =
    'Dear Valued Customer, our End of Season Sale is here! Visit us this weekend for up to 40% off selected items. Thank you for shopping with us!';
  const existingBroadcast = await prisma.customerBroadcast.findFirst({
    where: { tenantId, message: { contains: 'End of Season Sale' } },
  });

  let broadcastCreated = false;
  if (!existingBroadcast) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    await prisma.customerBroadcast.create({
      data: {
        tenantId,
        sentById: firstUser.id,
        sentAt: sevenDaysAgo,
        recipientCount: 8,
        filters: { tag: 'VIP' },
        message: broadcastMessage,
      },
    });
    broadcastCreated = true;
  }
  console.log(`Customer Broadcast: ${broadcastCreated ? 'created' : 'skipped (already exists)'}`);

  // ── Summary ──
  const customerCount = await prisma.customer.count({ where: { tenantId } });
  const supplierCount = await prisma.supplier.count({ where: { tenantId } });
  const poCount = await prisma.purchaseOrder.count({ where: { tenantId } });
  const broadcastCount = await prisma.customerBroadcast.count({ where: { tenantId } });

  console.log('\u2500\u2500 CRM Seed Summary \u2500\u2500');
  console.log(`  Customers:   ${customerCount}`);
  console.log(`  Suppliers:   ${supplierCount}`);
  console.log(`  POs:         ${poCount}`);
  console.log(`  Broadcasts:  ${broadcastCount}`);
}

async function seedStaffPromotionsExpenses() {
  if (process.env.SEED_SAMPLE_TENANT !== 'true') {
    console.log("Skipping staff promotions & expenses seed (SEED_SAMPLE_TENANT is not set to 'true')");
    return;
  }

  const tenant = await prisma.tenant.findFirst({ where: { slug: 'dilani' } });
  if (!tenant) {
    console.log('Sample tenant not found, skipping staff promotions & expenses seed');
    return;
  }
  const tenantId = tenant.id;

  // ── 1. Update CASHIER commissionRate ──
  const cashiers = await prisma.user.findMany({
    where: { tenantId, role: 'CASHIER' },
  });
  let cashiersUpdated = 0;
  for (const cashier of cashiers) {
    if (!cashier.commissionRate) {
      await prisma.user.update({
        where: { id: cashier.id },
        data: { commissionRate: 5.00 },
      });
      cashiersUpdated++;
    }
  }
  console.log(`Cashier commissionRate: ${cashiersUpdated} updated`);

  // ── 2. Seed CommissionRecords ──
  const demoSales = await prisma.sale.findMany({
    where: { tenantId, status: 'COMPLETED' },
    take: 5,
    orderBy: { createdAt: 'asc' },
  });
  let commissionsCreated = 0;
  for (let i = 0; i < demoSales.length; i++) {
    const sale = demoSales[i];
    if (!sale) continue;
    const existing = await prisma.commissionRecord.findFirst({ where: { saleId: sale.id } });
    if (!existing) {
      await prisma.commissionRecord.create({
        data: {
          tenantId,
          saleId: sale.id,
          userId: sale.cashierId,
          baseAmount: sale.totalAmount,
          commissionRate: 5.00,
          earnedAmount: new Decimal(sale.totalAmount.toString()).mul(5).div(100).toDecimalPlaces(2),
          isPaid: i >= 3,
        },
      });
      commissionsCreated++;
    }
  }
  console.log(`CommissionRecords: ${commissionsCreated} created`);

  // ── 3. Seed Promotions ──
  const firstCategory = await prisma.category.findFirst({ where: { tenantId } });

  const promotionDefs = [
    {
      name: '10% Off Everything',
      type: 'CART_PERCENTAGE' as const,
      value: 10,
      promoCode: null,
      targetCategoryId: null,
    },
    {
      name: 'Summer10',
      type: 'PROMO_CODE' as const,
      value: 10,
      promoCode: 'SUMMER10',
      targetCategoryId: null,
    },
    {
      name: 'Category Discount',
      type: 'CATEGORY_PERCENTAGE' as const,
      value: 15,
      promoCode: null,
      targetCategoryId: firstCategory?.id ?? null,
    },
  ];

  let promotionsCreated = 0;
  for (const promo of promotionDefs) {
    const existingPromo = await prisma.promotion.findFirst({
      where: { tenantId, name: promo.name },
    });
    if (!existingPromo) {
      await prisma.promotion.create({
        data: {
          tenantId,
          name: promo.name,
          type: promo.type,
          value: promo.value,
          ...(promo.promoCode !== null && { promoCode: promo.promoCode }),
          ...(promo.targetCategoryId !== null && { targetCategoryId: promo.targetCategoryId }),
          isActive: true,
        },
      });
      promotionsCreated++;
    }
  }
  console.log(`Promotions: ${promotionsCreated} created`);

  // ── 4. Seed Expenses ──
  const recorder = await prisma.user.findFirst({
    where: { tenantId, role: { in: ['MANAGER', 'OWNER'] } },
  });
  if (!recorder) {
    console.log('No MANAGER/OWNER found for expenses, skipping');
    return;
  }

  const expenseDefs = [
    { category: 'RENT' as const, amount: 1200, description: 'Monthly shop rent' },
    { category: 'UTILITIES' as const, amount: 230, description: 'Electricity and water bill' },
    { category: 'SALARIES' as const, amount: 3500, description: 'Staff salaries for the month' },
    { category: 'ADVERTISING' as const, amount: 150, description: 'Social media advertising campaign' },
    { category: 'MISCELLANEOUS' as const, amount: 45, description: 'Office supplies and stationery' },
  ];

  let expensesCreated = 0;
  for (const exp of expenseDefs) {
    const existingExpense = await prisma.expense.findFirst({
      where: { tenantId, category: exp.category, description: exp.description },
    });
    if (!existingExpense) {
      const now = new Date();
      now.setDate(now.getDate() - Math.floor(Math.random() * 28));
      await prisma.expense.create({
        data: {
          tenantId,
          category: exp.category,
          amount: exp.amount,
          description: exp.description,
          recordedById: recorder.id,
          expenseDate: now,
        },
      });
      expensesCreated++;
    }
  }
  console.log(`Expenses: ${expensesCreated} created`);

  // ── 5. Seed CashMovements ──
  const demoShift = await prisma.shift.findFirst({
    where: { tenantId },
    orderBy: { openedAt: 'desc' },
  });
  if (!demoShift) {
    console.log('No shifts found for cash movements, skipping');
    return;
  }

  let movementsCreated = 0;
  const existingFloatMovement = await prisma.cashMovement.findFirst({
    where: { tenantId, shiftId: demoShift.id, type: 'OPENING_FLOAT' },
  });
  if (!existingFloatMovement) {
    await prisma.cashMovement.create({
      data: {
        tenantId,
        shiftId: demoShift.id,
        type: 'OPENING_FLOAT',
        amount: 200,
      },
    });
    movementsCreated++;
  }

  const existingPettyCash = await prisma.cashMovement.findFirst({
    where: { tenantId, shiftId: demoShift.id, type: 'PETTY_CASH_OUT' },
  });
  if (!existingPettyCash) {
    await prisma.cashMovement.create({
      data: {
        tenantId,
        shiftId: demoShift.id,
        type: 'PETTY_CASH_OUT',
        amount: 35,
        reason: 'Purchased coffee supplies',
      },
    });
    movementsCreated++;
  }
  console.log(`CashMovements: ${movementsCreated} created`);

  // ── Summary ──
  console.log('\u2500\u2500 Staff Promotions & Expenses Seed Summary \u2500\u2500');
  console.log(`  Cashiers updated:      ${cashiersUpdated}`);
  console.log(`  Commission records:    ${commissionsCreated}`);
  console.log(`  Promotions:            ${promotionsCreated}`);
  console.log(`  Expenses:              ${expensesCreated}`);
  console.log(`  Cash movements:        ${movementsCreated}`);
}

// ── Seed Hardware Config & Audit Data ─────────────────────────────────────────

async function seedHardwareAndAuditData() {
  if (process.env.SEED_SAMPLE_TENANT !== 'true') {
    console.log("Skipping hardware & audit data seed (SEED_SAMPLE_TENANT is not set to 'true')");
    return;
  }

  const tenant = await prisma.tenant.findFirst({ where: { slug: 'dilani' } });
  if (!tenant) {
    console.log('Sample tenant not found, skipping hardware & audit data seed');
    return;
  }
  const tenantId = tenant.id;

  // ── 1. Update tenant hardware settings ──
  const existingSettings = (tenant.settings as Record<string, unknown>) ?? {};
  if (!existingSettings.hardware) {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        settings: {
          ...existingSettings,
          hardware: {
            type: 'NETWORK',
            host: '192.168.1.100',
            port: 9100,
            cashDrawerEnabled: true,
            cfdEnabled: true,
            paperWidth: '80mm',
          },
        },
      },
    });
    console.log('Tenant hardware settings updated');
  } else {
    console.log('Tenant hardware settings already present, skipping');
  }

  // Fetch demo users
  const owner = await prisma.user.findFirst({
    where: { tenantId, role: 'OWNER', deletedAt: null },
    select: { id: true },
  });
  const cashier1 = await prisma.user.findFirst({
    where: { tenantId, email: 'cashier1@velvetpos.dev', deletedAt: null },
    select: { id: true },
  });
  const cashier2 = await prisma.user.findFirst({
    where: { tenantId, email: 'cashier2@velvetpos.dev', deletedAt: null },
    select: { id: true },
  });

  if (!owner || !cashier1 || !cashier2) {
    console.log('Required demo users not found, skipping audit & cash movement seed');
    return;
  }

  // ── 2. Seed 10 AuditLog entries ──
  const auditCount = await prisma.auditLog.count({ where: { tenantId } });
  let auditsCreated = 0;
  if (auditCount === 0) {
    const now = new Date();
    const actors = [owner.id, cashier1.id, cashier2.id];
    const actorRoles = ['OWNER', 'CASHIER', 'CASHIER'];

    const auditEntries: Prisma.AuditLogCreateManyInput[] = [
      {
        tenantId,
        actorId: cashier1.id,
        actorRole: 'CASHIER',
        entityType: 'Sale',
        entityId: 'sale-seed-001',
        action: 'CREATE',
        before: Prisma.JsonNull,
        after: { totalAmount: 4500, paymentMethod: 'CASH', items: 3 },
        ipAddress: '127.0.0.1',
        userAgent: 'VelvetPOS/Seed',
        createdAt: new Date(now.getTime() - 13 * 24 * 60 * 60 * 1000),
      },
      {
        tenantId,
        actorId: cashier2.id,
        actorRole: 'CASHIER',
        entityType: 'Sale',
        entityId: 'sale-seed-002',
        action: 'CREATE',
        before: Prisma.JsonNull,
        after: { totalAmount: 7800, paymentMethod: 'CARD', items: 2 },
        ipAddress: '127.0.0.1',
        userAgent: 'VelvetPOS/Seed',
        createdAt: new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000),
      },
      {
        tenantId,
        actorId: cashier1.id,
        actorRole: 'CASHIER',
        entityType: 'Return',
        entityId: 'return-seed-001',
        action: 'CREATE',
        before: Prisma.JsonNull,
        after: { refundAmount: 1250, refundMethod: 'CASH', reason: 'Defective item' },
        ipAddress: '127.0.0.1',
        userAgent: 'VelvetPOS/Seed',
        createdAt: new Date(now.getTime() - 11 * 24 * 60 * 60 * 1000),
      },
      {
        tenantId,
        actorId: owner.id,
        actorRole: 'OWNER',
        entityType: 'Return',
        entityId: 'return-seed-002',
        action: 'AUTHORIZE',
        before: { status: 'PENDING' },
        after: { status: 'COMPLETED', refundAmount: 3200, refundMethod: 'STORE_CREDIT' },
        ipAddress: '127.0.0.1',
        userAgent: 'VelvetPOS/Seed',
        createdAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
      },
      {
        tenantId,
        actorId: owner.id,
        actorRole: 'OWNER',
        entityType: 'Customer',
        entityId: 'customer-seed-001',
        action: 'CREDIT_ADJUST',
        before: { creditBalance: 0 },
        after: { creditBalance: 1500, reason: 'Loyalty reward top-up' },
        ipAddress: '127.0.0.1',
        userAgent: 'VelvetPOS/Seed',
        createdAt: new Date(now.getTime() - 9 * 24 * 60 * 60 * 1000),
      },
      {
        tenantId,
        actorId: owner.id,
        actorRole: 'OWNER',
        entityType: 'User',
        entityId: cashier1.id,
        action: 'ROLE_CHANGE',
        before: { role: 'CASHIER', permissions: ['sale:create'] },
        after: { role: 'CASHIER', permissions: ['sale:create', 'sale:discount'] },
        ipAddress: '127.0.0.1',
        userAgent: 'VelvetPOS/Seed',
        createdAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      },
      {
        tenantId,
        actorId: owner.id,
        actorRole: 'OWNER',
        entityType: 'Promotion',
        entityId: 'promo-seed-001',
        action: 'CREATE',
        before: Prisma.JsonNull,
        after: { name: 'Weekend Flash Sale', type: 'CART_PERCENTAGE', value: 15 },
        ipAddress: '127.0.0.1',
        userAgent: 'VelvetPOS/Seed',
        createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      },
      {
        tenantId,
        actorId: owner.id,
        actorRole: 'OWNER',
        entityType: 'ProductVariant',
        entityId: 'variant-seed-001',
        action: 'STOCK_ADJUST',
        before: { stockQuantity: 12 },
        after: { stockQuantity: 20, reason: 'Manual count correction' },
        ipAddress: '127.0.0.1',
        userAgent: 'VelvetPOS/Seed',
        createdAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000),
      },
      {
        tenantId,
        actorId: owner.id,
        actorRole: 'OWNER',
        entityType: 'Expense',
        entityId: 'expense-seed-001',
        action: 'CREATE',
        before: Prisma.JsonNull,
        after: { category: 'UTILITIES', amount: 230, description: 'Electricity bill' },
        ipAddress: '127.0.0.1',
        userAgent: 'VelvetPOS/Seed',
        createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      },
      {
        tenantId,
        actorId: cashier1.id,
        actorRole: 'CASHIER',
        entityType: 'Shift',
        entityId: 'shift-seed-001',
        action: 'CLOSE',
        before: { status: 'OPEN', openedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString() },
        after: { status: 'CLOSED', cashDifference: 0, totalSalesCount: 8 },
        ipAddress: '127.0.0.1',
        userAgent: 'VelvetPOS/Seed',
        createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
      },
    ];

    await prisma.auditLog.createMany({ data: auditEntries });
    auditsCreated = auditEntries.length;
  }
  console.log(`AuditLog entries: ${auditsCreated > 0 ? `${auditsCreated} created` : 'already exist, skipped'}`);

  // ── 3. Seed 2 CashMovement records ──
  const cashMovementCount = await prisma.cashMovement.count({
    where: { tenantId, type: { in: ['PETTY_CASH_OUT', 'MANUAL_IN'] } },
  });
  let cashMovementsCreated = 0;
  if (cashMovementCount === 0) {
    // Find or create a demo shift for cash movements
    let demoShift = await prisma.shift.findFirst({
      where: { tenantId },
      orderBy: { openedAt: 'desc' },
      select: { id: true },
    });

    if (!demoShift) {
      const shiftDate = new Date();
      shiftDate.setDate(shiftDate.getDate() - 1);
      shiftDate.setHours(8, 30, 0, 0);
      demoShift = await prisma.shift.create({
        data: {
          tenantId,
          cashierId: cashier1.id,
          status: 'CLOSED',
          openedAt: shiftDate,
          closedAt: new Date(shiftDate.getTime() + 11 * 60 * 60 * 1000),
          openingFloat: 5000.0,
        },
        select: { id: true },
      });
    }

    await prisma.cashMovement.createMany({
      data: [
        {
          tenantId,
          shiftId: demoShift.id,
          type: 'PETTY_CASH_OUT',
          amount: 15.0,
          reason: 'Bought paper cups and straws',
          authorizedById: owner.id,
        },
        {
          tenantId,
          shiftId: demoShift.id,
          type: 'MANUAL_IN',
          amount: 100.0,
          reason: 'Cash float top-up from safe',
          authorizedById: owner.id,
        },
      ],
    });
    cashMovementsCreated = 2;
  }
  console.log(`CashMovements (hardware/audit): ${cashMovementsCreated > 0 ? `${cashMovementsCreated} created` : 'already exist, skipped'}`);

  // ── 4. Update demo customer birthdays ──
  await prisma.customer.updateMany({
    where: { tenantId },
    data: { lastBirthdayMessageSentYear: null },
  });

  const today = new Date();
  const firstCustomer = await prisma.customer.findFirst({
    where: { tenantId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, birthday: true },
  });
  if (firstCustomer) {
    const todayBirthday = new Date(1990, today.getMonth(), today.getDate());
    await prisma.customer.update({
      where: { id: firstCustomer.id },
      data: { birthday: todayBirthday },
    });
    console.log(`Customer ${firstCustomer.id.slice(0, 8)} birthday set to today's month/day for testing`);
  }

  console.log('── Hardware & Audit Seed Summary ──');
  console.log(`  Hardware settings:   updated`);
  console.log(`  Audit logs:          ${auditsCreated}`);
  console.log(`  Cash movements:      ${cashMovementsCreated}`);
  console.log(`  Customer birthdays:  reset & 1 set to today`);
}

// ── Billing Seed Data ─────────────────────────────────────────────────────────

async function seedBillingData() {
  // ── 1. Upsert SubscriptionPlan records ──────────────────────────────────────

  const starterPlan = await prisma.subscriptionPlan.upsert({
    where: { name: 'STARTER' },
    create: {
      name: 'STARTER',
      monthlyPrice: 1500,
      annualPrice: 15000,
      maxUsers: 3,
      maxProductVariants: 200,
      features: ['pos:basic', 'reports:basic', 'stock:basic'],
      isActive: true,
    },
    update: {
      monthlyPrice: 1500,
      annualPrice: 15000,
      maxUsers: 3,
      maxProductVariants: 200,
      features: ['pos:basic', 'reports:basic', 'stock:basic'],
      isActive: true,
    },
  });

  const growthPlan = await prisma.subscriptionPlan.upsert({
    where: { name: 'GROWTH' },
    create: {
      name: 'GROWTH',
      monthlyPrice: 3500,
      annualPrice: 35000,
      maxUsers: 10,
      maxProductVariants: 1000,
      features: [
        'pos:basic',
        'pos:returns',
        'reports:advanced',
        'stock:advanced',
        'crm:basic',
        'whatsapp:basic',
      ],
      isActive: true,
    },
    update: {
      monthlyPrice: 3500,
      annualPrice: 35000,
      maxUsers: 10,
      maxProductVariants: 1000,
      features: [
        'pos:basic',
        'pos:returns',
        'reports:advanced',
        'stock:advanced',
        'crm:basic',
        'whatsapp:basic',
      ],
      isActive: true,
    },
  });

  const enterprisePlan = await prisma.subscriptionPlan.upsert({
    where: { name: 'ENTERPRISE' },
    create: {
      name: 'ENTERPRISE',
      monthlyPrice: 8000,
      annualPrice: 80000,
      maxUsers: 50,
      maxProductVariants: 5000,
      features: [
        'pos:basic',
        'pos:returns',
        'reports:advanced',
        'reports:export',
        'stock:advanced',
        'crm:advanced',
        'whatsapp:advanced',
        'staff:unlimited',
        'hardware:all',
      ],
      isActive: true,
    },
    update: {
      monthlyPrice: 8000,
      annualPrice: 80000,
      maxUsers: 50,
      maxProductVariants: 5000,
      features: [
        'pos:basic',
        'pos:returns',
        'reports:advanced',
        'reports:export',
        'stock:advanced',
        'crm:advanced',
        'whatsapp:advanced',
        'staff:unlimited',
        'hardware:all',
      ],
      isActive: true,
    },
  });

  console.log('Upserted subscription plans: STARTER, GROWTH, ENTERPRISE');

  // ── 2. Assign primary demo tenant (Dilani) an ACTIVE GROWTH subscription ───

  const demoTenant = await prisma.tenant.findFirst({ where: { slug: 'dilani' } });
  if (!demoTenant) {
    console.log('Demo tenant (dilani) not found — skipping billing subscription & invoice seed');
    return;
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const demoSubscription = await prisma.subscription.upsert({
    where: { tenantId: demoTenant.id },
    create: {
      tenantId: demoTenant.id,
      planId: growthPlan.id,
      status: 'ACTIVE',
      currentPeriodStart: startOfMonth,
      currentPeriodEnd: endOfMonth,
    },
    update: {
      planId: growthPlan.id,
      status: 'ACTIVE',
      currentPeriodStart: startOfMonth,
      currentPeriodEnd: endOfMonth,
    },
  });

  await prisma.tenant.update({
    where: { id: demoTenant.id },
    data: { subscriptionStatus: 'ACTIVE' },
  });

  console.log('Assigned ACTIVE GROWTH subscription to Dilani Boutique');

  // ── 3. Three demo invoices ──────────────────────────────────────────────────

  const fourMonthsAgoStart = new Date(now.getFullYear(), now.getMonth() - 4, 1);
  const fourMonthsAgoEnd = new Date(now.getFullYear(), now.getMonth() - 4 + 1, 0);
  const twoMonthsAgoStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const twoMonthsAgoEnd = new Date(now.getFullYear(), now.getMonth() - 2 + 1, 0);

  const inv1 = await prisma.invoice.upsert({
    where: { invoiceNumber: 'INV-SEED-0001' },
    create: {
      tenantId: demoTenant.id,
      subscriptionId: demoSubscription.id,
      amount: 3500,
      currency: 'LKR',
      status: 'PAID',
      billingPeriodStart: fourMonthsAgoStart,
      billingPeriodEnd: fourMonthsAgoEnd,
      dueDate: fourMonthsAgoEnd,
      paidAt: new Date(fourMonthsAgoEnd.getTime() - 2 * 24 * 60 * 60 * 1000),
      invoiceNumber: 'INV-SEED-0001',
    },
    update: {
      amount: 3500,
      status: 'PAID',
      billingPeriodStart: fourMonthsAgoStart,
      billingPeriodEnd: fourMonthsAgoEnd,
      dueDate: fourMonthsAgoEnd,
      paidAt: new Date(fourMonthsAgoEnd.getTime() - 2 * 24 * 60 * 60 * 1000),
    },
  });

  const inv2 = await prisma.invoice.upsert({
    where: { invoiceNumber: 'INV-SEED-0002' },
    create: {
      tenantId: demoTenant.id,
      subscriptionId: demoSubscription.id,
      amount: 3500,
      currency: 'LKR',
      status: 'PAID',
      billingPeriodStart: twoMonthsAgoStart,
      billingPeriodEnd: twoMonthsAgoEnd,
      dueDate: twoMonthsAgoEnd,
      paidAt: new Date(twoMonthsAgoEnd.getTime() - 1 * 24 * 60 * 60 * 1000),
      invoiceNumber: 'INV-SEED-0002',
    },
    update: {
      amount: 3500,
      status: 'PAID',
      billingPeriodStart: twoMonthsAgoStart,
      billingPeriodEnd: twoMonthsAgoEnd,
      dueDate: twoMonthsAgoEnd,
      paidAt: new Date(twoMonthsAgoEnd.getTime() - 1 * 24 * 60 * 60 * 1000),
    },
  });

  const inv3 = await prisma.invoice.upsert({
    where: { invoiceNumber: 'INV-SEED-0003' },
    create: {
      tenantId: demoTenant.id,
      subscriptionId: demoSubscription.id,
      amount: 3500,
      currency: 'LKR',
      status: 'PENDING',
      billingPeriodStart: startOfMonth,
      billingPeriodEnd: endOfMonth,
      dueDate: endOfMonth,
      invoiceNumber: 'INV-SEED-0003',
    },
    update: {
      amount: 3500,
      status: 'PENDING',
      billingPeriodStart: startOfMonth,
      billingPeriodEnd: endOfMonth,
      dueDate: endOfMonth,
    },
  });

  console.log('Upserted 3 demo invoices: INV-SEED-0001 (PAID), INV-SEED-0002 (PAID), INV-SEED-0003 (PENDING)');

  // ── 4. Payment reminders for the pending invoice ────────────────────────────

  // Delete existing reminders for this invoice to re-create cleanly
  await prisma.paymentReminder.deleteMany({ where: { invoiceId: inv3.id } });

  await prisma.paymentReminder.createMany({
    data: [
      {
        tenantId: demoTenant.id,
        invoiceId: inv3.id,
        type: 'THREE_DAY_REMINDER',
        channel: 'WHATSAPP',
        status: 'SENT',
        sentAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      },
      {
        tenantId: demoTenant.id,
        invoiceId: inv3.id,
        type: 'DUE_DATE_REMINDER',
        channel: 'WHATSAPP',
        status: 'SENT',
        sentAt: now,
      },
    ],
  });

  console.log('Created 2 payment reminders for INV-SEED-0003');

  // ── 5. Trial demo tenant ────────────────────────────────────────────────────

  const trialPasswordHash = await bcrypt.hash('trial-demo-pass!', 12);
  const trialPinHash = await bcrypt.hash('6666', 10);

  let trialTenant = await prisma.tenant.findFirst({ where: { slug: 'trial-demo' } });
  if (!trialTenant) {
    trialTenant = await prisma.tenant.create({
      data: {
        name: 'Trial Demo Boutique',
        slug: 'trial-demo',
        status: 'ACTIVE',
        subscriptionStatus: 'TRIAL',
        settings: {},
      },
    });
  } else {
    await prisma.tenant.update({
      where: { id: trialTenant.id },
      data: { subscriptionStatus: 'TRIAL' },
    });
  }

  const existingTrialUser = await prisma.user.findFirst({
    where: { email: 'demo-trial-owner@velvetpos.dev', deletedAt: null },
  });
  if (!existingTrialUser) {
    await prisma.user.create({
      data: {
        email: 'demo-trial-owner@velvetpos.dev',
        passwordHash: trialPasswordHash,
        pin: trialPinHash,
        role: 'OWNER',
        tenantId: trialTenant.id,
        permissions: [],
        isActive: true,
      },
    });
  } else {
    await prisma.user.update({
      where: { id: existingTrialUser.id },
      data: { pin: trialPinHash },
    });
  }

  await prisma.subscription.upsert({
    where: { tenantId: trialTenant.id },
    create: {
      tenantId: trialTenant.id,
      planId: starterPlan.id,
      status: 'TRIAL',
      trialEndsAt: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
      currentPeriodStart: now,
      currentPeriodEnd: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
    },
    update: {
      planId: starterPlan.id,
      status: 'TRIAL',
      trialEndsAt: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
    },
  });

  console.log('Upserted Trial Demo Boutique (TRIAL, STARTER plan, trial ends in 14 days)');

  // ── 6. Suspended demo tenant ────────────────────────────────────────────────

  const suspendedPasswordHash = await bcrypt.hash('suspended-demo-pass!', 12);
  const suspendedPinHash = await bcrypt.hash('7777', 10);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  let suspendedTenant = await prisma.tenant.findFirst({ where: { slug: 'suspended-demo' } });
  if (!suspendedTenant) {
    suspendedTenant = await prisma.tenant.create({
      data: {
        name: 'Suspended Demo Boutique',
        slug: 'suspended-demo',
        status: 'ACTIVE',
        subscriptionStatus: 'SUSPENDED',
        settings: {},
      },
    });
  } else {
    await prisma.tenant.update({
      where: { id: suspendedTenant.id },
      data: { subscriptionStatus: 'SUSPENDED' },
    });
  }

  const existingSuspendedUser = await prisma.user.findFirst({
    where: { email: 'demo-suspended-owner@velvetpos.dev', deletedAt: null },
  });
  if (!existingSuspendedUser) {
    await prisma.user.create({
      data: {
        email: 'demo-suspended-owner@velvetpos.dev',
        passwordHash: suspendedPasswordHash,
        pin: suspendedPinHash,
        role: 'OWNER',
        tenantId: suspendedTenant.id,
        permissions: [],
        isActive: true,
      },
    });
  } else {
    await prisma.user.update({
      where: { id: existingSuspendedUser.id },
      data: { pin: suspendedPinHash },
    });
  }

  await prisma.subscription.upsert({
    where: { tenantId: suspendedTenant.id },
    create: {
      tenantId: suspendedTenant.id,
      planId: growthPlan.id,
      status: 'SUSPENDED',
      currentPeriodStart: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      currentPeriodEnd: lastMonthEnd,
    },
    update: {
      planId: growthPlan.id,
      status: 'SUSPENDED',
      currentPeriodEnd: lastMonthEnd,
    },
  });

  console.log('Upserted Suspended Demo Boutique (SUSPENDED, GROWTH plan, past grace period)');

  console.log('── Billing Seed Summary ──');
  console.log('  Subscription plans:  3 (STARTER, GROWTH, ENTERPRISE)');
  console.log('  Demo subscriptions:  3 (ACTIVE, TRIAL, SUSPENDED)');
  console.log('  Demo invoices:       3 (2 PAID, 1 PENDING)');
  console.log('  Payment reminders:   2 (THREE_DAY + DUE_DATE)');
  console.log('  Demo tenants:        2 new (Trial Demo, Suspended Demo)');
}

// ══════════════════════════════════════════════════════════════════════════════
// Comprehensive Demo Data — "velvet-demo" tenant with 90 days of rich data
// ══════════════════════════════════════════════════════════════════════════════

async function seedComprehensiveDemoData() {
  if (process.env.SEED_DEMO_DATA !== 'true') {
    console.log("Skipping comprehensive demo seed (SEED_DEMO_DATA is not set to 'true')");
    return;
  }

  // ── 0. Deterministic PRNG ──────────────────────────────────────────────────
  function seededRandom(seed: number) {
    let s = seed;
    return () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
  }

  const rng = seededRandom(42);

  function pick<T>(arr: T[]): T {
    return arr[Math.floor(rng() * arr.length)]!;
  }

  function pickN<T>(arr: T[], n: number): T[] {
    const shuffled = [...arr].sort(() => rng() - 0.5);
    return shuffled.slice(0, n);
  }

  function randInt(min: number, max: number): number {
    return Math.floor(rng() * (max - min + 1)) + min;
  }

  // ── 1. Upsert tenant ──────────────────────────────────────────────────────
  let tenant = await prisma.tenant.findFirst({ where: { slug: 'velvet-demo' } });
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name: 'Velvet Boutique (Demo)',
        slug: 'velvet-demo',
        status: 'ACTIVE',
        subscriptionStatus: 'ACTIVE',
        settings: {},
      },
    });
  }
  const tenantId = tenant.id;

  // Idempotency guard
  const existingSales = await prisma.sale.count({ where: { tenantId } });
  if (existingSales > 100) {
    console.log('Demo data already seeded — skipping');
    return;
  }

  console.log('── Seeding comprehensive demo data for velvet-demo ──');

  // ── 2. Staff users ─────────────────────────────────────────────────────────
  const staffDefs = [
    { email: 'owner@velvetdemo.com', role: 'OWNER' as const, pin: '1111', name: 'Kavindi Perera' },
    { email: 'manager@velvetdemo.com', role: 'MANAGER' as const, pin: '2222', name: 'Chamara Bandara' },
    { email: 'cashier1@velvetdemo.com', role: 'CASHIER' as const, pin: '3333', name: 'Dilani Senanayake' },
    { email: 'cashier2@velvetdemo.com', role: 'CASHIER' as const, pin: '4444', name: 'Ruwani Fernando' },
    { email: 'stock@velvetdemo.com', role: 'STOCK_CLERK' as const, pin: '5555', name: 'Asela Wickramasinghe' },
  ];

  const passwordHash = await bcrypt.hash('demo-pass-2025!', 12);
  const pinHashes = await Promise.all(staffDefs.map((s) => bcrypt.hash(s.pin, 10)));

  const staffData = staffDefs.map((s, i) => ({
    email: s.email,
    passwordHash,
    pin: pinHashes[i]!,
    role: s.role,
    tenantId,
    permissions: [] as string[],
    isActive: true,
    ...(s.role === 'CASHIER' ? { commissionRate: new Prisma.Decimal(1.5) } : {}),
  }));

  await prisma.user.createMany({ data: staffData, skipDuplicates: true });

  const allStaff = await prisma.user.findMany({
    where: { tenantId, deletedAt: null },
    orderBy: { email: 'asc' },
  });

  const owner = allStaff.find((u) => u.role === 'OWNER')!;
  const manager = allStaff.find((u) => u.role === 'MANAGER')!;
  const cashiers = allStaff.filter((u) => u.role === 'CASHIER');
  const stockClerk = allStaff.find((u) => u.role === 'STOCK_CLERK')!;

  console.log(`  Staff created: ${allStaff.length}`);

  // ── 3. Categories ──────────────────────────────────────────────────────────
  const categoryDefs = [
    { name: 'Sarees', sortOrder: 1 },
    { name: 'Kurtis & Tops', sortOrder: 2 },
    { name: 'Trousers & Palazzo', sortOrder: 3 },
    { name: 'Dresses', sortOrder: 4 },
    { name: 'Accessories', sortOrder: 5 },
  ];

  for (const cat of categoryDefs) {
    await prisma.category.upsert({
      where: { tenantId_name: { tenantId, name: cat.name } },
      create: { tenantId, name: cat.name, sortOrder: cat.sortOrder },
      update: {},
    });
  }

  const categories = await prisma.category.findMany({
    where: { tenantId, deletedAt: null },
    orderBy: { sortOrder: 'asc' },
  });

  const catMap = Object.fromEntries(categories.map((c) => [c.name, c.id])) as Record<string, string>;

  console.log(`  Categories created: ${categories.length}`);

  // ── 4. Products & Variants ─────────────────────────────────────────────────
  type ProductDef = {
    name: string;
    category: string;
    gender: 'WOMEN' | 'UNISEX';
    taxRule: 'STANDARD_VAT' | 'SSCL';
    variants: { size: string; colour: string; cost: number; retail: number; stock: number }[];
  };

  const productDefs: ProductDef[] = [
    // Sarees (6)
    { name: 'Kandyan Silk Saree', category: 'Sarees', gender: 'WOMEN', taxRule: 'STANDARD_VAT', variants: [
      { size: 'Standard', colour: 'Maroon', cost: 8500, retail: 15500, stock: 12 },
      { size: 'Standard', colour: 'Royal Blue', cost: 8500, retail: 15500, stock: 10 },
      { size: 'Standard', colour: 'Emerald', cost: 8500, retail: 15500, stock: 8 },
    ]},
    { name: 'Cotton Handloom Saree', category: 'Sarees', gender: 'WOMEN', taxRule: 'STANDARD_VAT', variants: [
      { size: 'Standard', colour: 'Off-White', cost: 4200, retail: 7800, stock: 18 },
      { size: 'Standard', colour: 'Peach', cost: 4200, retail: 7800, stock: 15 },
    ]},
    { name: 'Batik Print Saree', category: 'Sarees', gender: 'WOMEN', taxRule: 'STANDARD_VAT', variants: [
      { size: 'Standard', colour: 'Multi Blue', cost: 5800, retail: 9900, stock: 14 },
      { size: 'Standard', colour: 'Multi Green', cost: 5800, retail: 9900, stock: 12 },
      { size: 'Standard', colour: 'Sunset', cost: 5800, retail: 9900, stock: 10 },
    ]},
    { name: 'Linen Saree', category: 'Sarees', gender: 'WOMEN', taxRule: 'STANDARD_VAT', variants: [
      { size: 'Standard', colour: 'Grey', cost: 3800, retail: 6500, stock: 20 },
      { size: 'Standard', colour: 'Beige', cost: 3800, retail: 6500, stock: 16 },
    ]},
    { name: 'Embroidered Organza Saree', category: 'Sarees', gender: 'WOMEN', taxRule: 'STANDARD_VAT', variants: [
      { size: 'Standard', colour: 'Blush Pink', cost: 11000, retail: 19500, stock: 8 },
      { size: 'Standard', colour: 'Ivory', cost: 11000, retail: 19500, stock: 6 },
    ]},
    { name: 'Crepe Silk Saree', category: 'Sarees', gender: 'WOMEN', taxRule: 'STANDARD_VAT', variants: [
      { size: 'Standard', colour: 'Teal', cost: 7200, retail: 12500, stock: 10 },
      { size: 'Standard', colour: 'Wine', cost: 7200, retail: 12500, stock: 12 },
      { size: 'Standard', colour: 'Gold', cost: 7200, retail: 12500, stock: 9 },
    ]},

    // Kurtis & Tops (8)
    { name: 'Printed Cotton Kurti', category: 'Kurtis & Tops', gender: 'WOMEN', taxRule: 'STANDARD_VAT', variants: [
      { size: 'S', colour: 'Sky Blue', cost: 1200, retail: 2200, stock: 30 },
      { size: 'M', colour: 'Sky Blue', cost: 1200, retail: 2200, stock: 35 },
      { size: 'L', colour: 'Sky Blue', cost: 1200, retail: 2200, stock: 25 },
      { size: 'XL', colour: 'Sky Blue', cost: 1200, retail: 2200, stock: 20 },
    ]},
    { name: 'Embroidered Linen Kurti', category: 'Kurtis & Tops', gender: 'WOMEN', taxRule: 'STANDARD_VAT', variants: [
      { size: 'S', colour: 'Mint', cost: 1800, retail: 3200, stock: 18 },
      { size: 'M', colour: 'Mint', cost: 1800, retail: 3200, stock: 22 },
      { size: 'L', colour: 'Lavender', cost: 1800, retail: 3200, stock: 16 },
    ]},
    { name: 'Chiffon Blouse', category: 'Kurtis & Tops', gender: 'WOMEN', taxRule: 'STANDARD_VAT', variants: [
      { size: 'S', colour: 'White', cost: 1500, retail: 2800, stock: 20 },
      { size: 'M', colour: 'White', cost: 1500, retail: 2800, stock: 25 },
      { size: 'L', colour: 'Black', cost: 1500, retail: 2800, stock: 18 },
    ]},
    { name: 'Sleeveless Cotton Top', category: 'Kurtis & Tops', gender: 'WOMEN', taxRule: 'STANDARD_VAT', variants: [
      { size: 'S', colour: 'Coral', cost: 900, retail: 1800, stock: 32 },
      { size: 'M', colour: 'Coral', cost: 900, retail: 1800, stock: 38 },
      { size: 'L', colour: 'Navy', cost: 900, retail: 1800, stock: 28 },
    ]},
    { name: 'A-Line Rayon Kurti', category: 'Kurtis & Tops', gender: 'WOMEN', taxRule: 'STANDARD_VAT', variants: [
      { size: 'M', colour: 'Ochre', cost: 1400, retail: 2500, stock: 22 },
      { size: 'L', colour: 'Ochre', cost: 1400, retail: 2500, stock: 20 },
      { size: 'XL', colour: 'Dusty Rose', cost: 1400, retail: 2500, stock: 15 },
    ]},
    { name: 'Peplum Kurta Top', category: 'Kurtis & Tops', gender: 'WOMEN', taxRule: 'STANDARD_VAT', variants: [
      { size: 'S', colour: 'Olive', cost: 1600, retail: 2900, stock: 14 },
      { size: 'M', colour: 'Olive', cost: 1600, retail: 2900, stock: 18 },
    ]},
    { name: 'Tie-Dye Casual Top', category: 'Kurtis & Tops', gender: 'WOMEN', taxRule: 'STANDARD_VAT', variants: [
      { size: 'S', colour: 'Multi', cost: 800, retail: 1500, stock: 40 },
      { size: 'M', colour: 'Multi', cost: 800, retail: 1500, stock: 40 },
      { size: 'L', colour: 'Multi', cost: 800, retail: 1500, stock: 35 },
    ]},
    { name: 'Mandarin Collar Blouse', category: 'Kurtis & Tops', gender: 'WOMEN', taxRule: 'STANDARD_VAT', variants: [
      { size: 'S', colour: 'Burgundy', cost: 1300, retail: 2400, stock: 16 },
      { size: 'M', colour: 'Burgundy', cost: 1300, retail: 2400, stock: 20 },
      { size: 'L', colour: 'Sage', cost: 1300, retail: 2400, stock: 14 },
    ]},

    // Trousers & Palazzo (5)
    { name: 'Wide-Leg Palazzo', category: 'Trousers & Palazzo', gender: 'WOMEN', taxRule: 'STANDARD_VAT', variants: [
      { size: 'S', colour: 'Black', cost: 1100, retail: 2100, stock: 28 },
      { size: 'M', colour: 'Black', cost: 1100, retail: 2100, stock: 30 },
      { size: 'L', colour: 'Cream', cost: 1100, retail: 2100, stock: 22 },
    ]},
    { name: 'Cotton Cigarette Pants', category: 'Trousers & Palazzo', gender: 'WOMEN', taxRule: 'STANDARD_VAT', variants: [
      { size: 'S', colour: 'Navy', cost: 1000, retail: 1950, stock: 26 },
      { size: 'M', colour: 'Navy', cost: 1000, retail: 1950, stock: 30 },
      { size: 'L', colour: 'Charcoal', cost: 1000, retail: 1950, stock: 20 },
    ]},
    { name: 'Printed Harem Pants', category: 'Trousers & Palazzo', gender: 'UNISEX', taxRule: 'STANDARD_VAT', variants: [
      { size: 'Free Size', colour: 'Elephant Print', cost: 900, retail: 1800, stock: 35 },
      { size: 'Free Size', colour: 'Floral', cost: 900, retail: 1800, stock: 30 },
    ]},
    { name: 'High-Waist Linen Trouser', category: 'Trousers & Palazzo', gender: 'WOMEN', taxRule: 'STANDARD_VAT', variants: [
      { size: 'S', colour: 'Tan', cost: 1500, retail: 2800, stock: 18 },
      { size: 'M', colour: 'Tan', cost: 1500, retail: 2800, stock: 20 },
      { size: 'L', colour: 'White', cost: 1500, retail: 2800, stock: 14 },
    ]},
    { name: 'Culottes', category: 'Trousers & Palazzo', gender: 'WOMEN', taxRule: 'STANDARD_VAT', variants: [
      { size: 'S', colour: 'Rust', cost: 1200, retail: 2300, stock: 20 },
      { size: 'M', colour: 'Rust', cost: 1200, retail: 2300, stock: 24 },
    ]},

    // Dresses (7)
    { name: 'Batik Midi Dress', category: 'Dresses', gender: 'WOMEN', taxRule: 'STANDARD_VAT', variants: [
      { size: 'S', colour: 'Indigo', cost: 2800, retail: 4900, stock: 14 },
      { size: 'M', colour: 'Indigo', cost: 2800, retail: 4900, stock: 16 },
      { size: 'L', colour: 'Terracotta', cost: 2800, retail: 4900, stock: 12 },
    ]},
    { name: 'Linen Shirt Dress', category: 'Dresses', gender: 'WOMEN', taxRule: 'STANDARD_VAT', variants: [
      { size: 'S', colour: 'Olive', cost: 3200, retail: 5500, stock: 10 },
      { size: 'M', colour: 'Olive', cost: 3200, retail: 5500, stock: 14 },
      { size: 'L', colour: 'Sand', cost: 3200, retail: 5500, stock: 10 },
    ]},
    { name: 'Wrap Maxi Dress', category: 'Dresses', gender: 'WOMEN', taxRule: 'STANDARD_VAT', variants: [
      { size: 'S', colour: 'Floral Navy', cost: 3500, retail: 6200, stock: 10 },
      { size: 'M', colour: 'Floral Navy', cost: 3500, retail: 6200, stock: 12 },
    ]},
    { name: 'Cotton Shift Dress', category: 'Dresses', gender: 'WOMEN', taxRule: 'STANDARD_VAT', variants: [
      { size: 'S', colour: 'Mustard', cost: 2200, retail: 3900, stock: 18 },
      { size: 'M', colour: 'Mustard', cost: 2200, retail: 3900, stock: 20 },
      { size: 'L', colour: 'Teal', cost: 2200, retail: 3900, stock: 14 },
    ]},
    { name: 'Embroidered A-Line Dress', category: 'Dresses', gender: 'WOMEN', taxRule: 'STANDARD_VAT', variants: [
      { size: 'S', colour: 'Ivory', cost: 4500, retail: 7500, stock: 8 },
      { size: 'M', colour: 'Ivory', cost: 4500, retail: 7500, stock: 10 },
      { size: 'L', colour: 'Blush', cost: 4500, retail: 7500, stock: 8 },
    ]},
    { name: 'Tunic Dress', category: 'Dresses', gender: 'WOMEN', taxRule: 'STANDARD_VAT', variants: [
      { size: 'S', colour: 'Sage', cost: 2000, retail: 3500, stock: 22 },
      { size: 'M', colour: 'Sage', cost: 2000, retail: 3500, stock: 24 },
      { size: 'L', colour: 'Mauve', cost: 2000, retail: 3500, stock: 16 },
    ]},
    { name: 'Kaftan Beach Dress', category: 'Dresses', gender: 'WOMEN', taxRule: 'STANDARD_VAT', variants: [
      { size: 'Free Size', colour: 'Turquoise', cost: 2600, retail: 4500, stock: 15 },
      { size: 'Free Size', colour: 'Coral', cost: 2600, retail: 4500, stock: 12 },
    ]},

    // Accessories (4)
    { name: 'Handwoven Clutch Bag', category: 'Accessories', gender: 'WOMEN', taxRule: 'SSCL', variants: [
      { size: 'One Size', colour: 'Gold & Black', cost: 1800, retail: 3200, stock: 20 },
      { size: 'One Size', colour: 'Silver & Navy', cost: 1800, retail: 3200, stock: 18 },
    ]},
    { name: 'Beaded Necklace Set', category: 'Accessories', gender: 'WOMEN', taxRule: 'SSCL', variants: [
      { size: 'One Size', colour: 'Pearl', cost: 1200, retail: 2200, stock: 25 },
      { size: 'One Size', colour: 'Coral Beads', cost: 1200, retail: 2200, stock: 20 },
    ]},
    { name: 'Silk Scarf', category: 'Accessories', gender: 'UNISEX', taxRule: 'SSCL', variants: [
      { size: 'One Size', colour: 'Paisley Red', cost: 900, retail: 1800, stock: 30 },
      { size: 'One Size', colour: 'Geometric Blue', cost: 900, retail: 1800, stock: 26 },
      { size: 'One Size', colour: 'Floral Cream', cost: 900, retail: 1800, stock: 22 },
    ]},
    { name: 'Leather Belt', category: 'Accessories', gender: 'UNISEX', taxRule: 'SSCL', variants: [
      { size: 'S', colour: 'Brown', cost: 700, retail: 1500, stock: 28 },
      { size: 'M', colour: 'Brown', cost: 700, retail: 1500, stock: 32 },
      { size: 'L', colour: 'Black', cost: 700, retail: 1500, stock: 24 },
    ]},
  ];

  let variantCounter = 0;
  for (const pDef of productDefs) {
    const categoryId = catMap[pDef.category];
    if (!categoryId) continue;

    const existing = await prisma.product.findFirst({
      where: { tenantId, name: pDef.name, deletedAt: null },
    });
    if (existing) {
      variantCounter += pDef.variants.length;
      continue;
    }

    const product = await prisma.product.create({
      data: {
        tenantId,
        name: pDef.name,
        categoryId,
        gender: pDef.gender,
        taxRule: pDef.taxRule,
        tags: [],
      },
    });

    for (const v of pDef.variants) {
      variantCounter++;
      const sku = `VD-${String(variantCounter).padStart(4, '0')}`;
      await prisma.productVariant.create({
        data: {
          productId: product.id,
          tenantId,
          sku,
          size: v.size,
          colour: v.colour,
          costPrice: v.cost,
          retailPrice: v.retail,
          stockQuantity: v.stock,
          lowStockThreshold: 5,
        },
      });
    }
  }

  const allVariants = await prisma.productVariant.findMany({
    where: { tenantId, deletedAt: null },
    include: { product: { select: { name: true } } },
  });

  console.log(`  Products created: ${productDefs.length}, Variants: ${allVariants.length}`);

  // ── 5. Customers ───────────────────────────────────────────────────────────
  const customerDefs = [
    { name: 'Nishani Jayawardena', phone: '0771234501', birthday: '1990-03-15' },
    { name: 'Tharushi De Silva', phone: '0771234502', birthday: '1988-07-22' },
    { name: 'Amaya Perera', phone: '0771234503', birthday: '1995-11-08' },
    { name: 'Sachini Fernando', phone: '0771234504', birthday: '1992-01-30' },
    { name: 'Rashmi Wijesinghe', phone: '0771234505', birthday: '1987-05-12' },
    { name: 'Kumari Rathnayake', phone: '0771234506', birthday: '1993-09-25' },
    { name: 'Hiruni Bandara', phone: '0771234507', birthday: '1991-12-03' },
    { name: 'Nadeesha Gunawardena', phone: '0771234508', birthday: '1986-04-18' },
    { name: 'Sanduni Herath', phone: '0771234509', birthday: '1994-08-07' },
    { name: 'Chathurika Liyanage', phone: '0771234510', birthday: '1989-06-21' },
  ];

  const customerData = customerDefs.map((c) => ({
    tenantId,
    name: c.name,
    phone: c.phone,
    birthday: new Date(c.birthday),
    tags: [] as string[],
  }));

  await prisma.customer.createMany({ data: customerData, skipDuplicates: true });

  const customers = await prisma.customer.findMany({ where: { tenantId } });
  console.log(`  Customers created: ${customers.length}`);

  // ── 6. Sales (1000+ across 90 days) ────────────────────────────────────────
  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;

  // Create shifts for each day per cashier (needed by Sale.shiftId)
  const shiftMap = new Map<string, string>(); // key: `${cashierIdx}-${dayIdx}` -> shiftId

  const saleBatches: {
    id: string;
    tenantId: string;
    shiftId: string;
    cashierId: string;
    customerId: string | null;
    subtotal: Prisma.Decimal;
    discountAmount: Prisma.Decimal;
    taxAmount: Prisma.Decimal;
    totalAmount: Prisma.Decimal;
    paymentMethod: 'CASH';
    status: 'COMPLETED';
    completedAt: Date;
    createdAt: Date;
  }[] = [];

  const linesBatch: {
    saleId: string;
    variantId: string;
    productNameSnapshot: string;
    variantDescriptionSnapshot: string;
    sku: string;
    unitPrice: Prisma.Decimal;
    quantity: number;
    discountPercent: Prisma.Decimal;
    discountAmount: Prisma.Decimal;
    lineTotalBeforeDiscount: Prisma.Decimal;
    lineTotalAfterDiscount: Prisma.Decimal;
  }[] = [];

  const paymentsBatch: {
    saleId: string;
    method: 'CASH';
    amount: Prisma.Decimal;
  }[] = [];

  // Track which sales were made for return generation later
  const completedSaleIds: { id: string; dayIdx: number; cashierId: string; lines: typeof linesBatch }[] = [];

  for (let dayIdx = 0; dayIdx < 90; dayIdx++) {
    const saleDate = new Date(now.getTime() - (90 - dayIdx) * dayMs);
    const dayOfWeek = saleDate.getDay(); // 0=Sun

    let salesPerDay: number;
    if (dayOfWeek === 0) {
      salesPerDay = randInt(5, 10); // Sunday
    } else if (dayOfWeek === 5 || dayOfWeek === 6) {
      salesPerDay = randInt(18, 28); // Fri/Sat
    } else {
      salesPerDay = randInt(8, 15); // Weekdays
    }

    for (let saleIdx = 0; saleIdx < salesPerDay; saleIdx++) {
      const cashierIdx = saleIdx % cashiers.length;
      const cashier = cashiers[cashierIdx]!;

      // Ensure a shift exists for this cashier on this day
      const shiftKey = `${cashierIdx}-${dayIdx}`;
      let shiftId = shiftMap.get(shiftKey);
      if (!shiftId) {
        const shiftOpen = new Date(saleDate);
        shiftOpen.setHours(8, 30, 0, 0);
        const shiftClose = new Date(saleDate);
        shiftClose.setHours(20, 0, 0, 0);

        const shift = await prisma.shift.create({
          data: {
            tenantId,
            cashierId: cashier.id,
            status: 'CLOSED',
            openedAt: shiftOpen,
            closedAt: shiftClose,
            openingFloat: 10000,
          },
        });
        shiftId = shift.id;
        shiftMap.set(shiftKey, shiftId);
      }

      // Sale time between 09:00-19:00
      const hour = 9 + Math.floor(rng() * 10);
      const minute = Math.floor(rng() * 60);
      const saleTime = new Date(saleDate);
      saleTime.setHours(hour, minute, 0, 0);

      // Customer attachment (40% chance)
      const hasCustomer = rng() < 0.4;
      const customerId = hasCustomer ? pick(customers).id : null;

      // Line items (1-4)
      const lineCount = randInt(1, 4);
      const selectedVariants = pickN(allVariants, lineCount);

      const saleId = crypto.randomUUID();
      let subtotal = new Decimal(0);
      const saleLines: typeof linesBatch = [];

      for (const variant of selectedVariants) {
        const qty = randInt(1, 3);
        const unitPrice = new Decimal(variant.retailPrice.toString());
        const lineTotal = unitPrice.mul(qty);
        subtotal = subtotal.plus(lineTotal);

        saleLines.push({
          saleId,
          variantId: variant.id,
          productNameSnapshot: variant.product.name,
          variantDescriptionSnapshot: `${variant.size ?? ''} ${variant.colour ?? ''}`.trim(),
          sku: variant.sku,
          unitPrice: new Prisma.Decimal(unitPrice.toString()),
          quantity: qty,
          discountPercent: new Prisma.Decimal(0),
          discountAmount: new Prisma.Decimal(0),
          lineTotalBeforeDiscount: new Prisma.Decimal(lineTotal.toString()),
          lineTotalAfterDiscount: new Prisma.Decimal(lineTotal.toString()),
        });
      }

      const taxAmount = subtotal.mul(0.15).toDecimalPlaces(2);
      const totalAmount = subtotal.plus(taxAmount);

      saleBatches.push({
        id: saleId,
        tenantId,
        shiftId,
        cashierId: cashier.id,
        customerId,
        subtotal: new Prisma.Decimal(subtotal.toString()),
        discountAmount: new Prisma.Decimal(0),
        taxAmount: new Prisma.Decimal(taxAmount.toString()),
        totalAmount: new Prisma.Decimal(totalAmount.toString()),
        paymentMethod: 'CASH',
        status: 'COMPLETED',
        completedAt: saleTime,
        createdAt: saleTime,
      });

      linesBatch.push(...saleLines);

      paymentsBatch.push({
        saleId,
        method: 'CASH',
        amount: new Prisma.Decimal(totalAmount.toString()),
      });

      completedSaleIds.push({ id: saleId, dayIdx, cashierId: cashier.id, lines: saleLines });

      // Batch insert every 100 sales
      if (saleBatches.length >= 100) {
        await prisma.sale.createMany({ data: saleBatches });
        await prisma.saleLine.createMany({ data: linesBatch });
        await prisma.payment.createMany({ data: paymentsBatch });
        saleBatches.length = 0;
        linesBatch.length = 0;
        paymentsBatch.length = 0;
      }
    }
  }

  // Flush remaining
  if (saleBatches.length > 0) {
    await prisma.sale.createMany({ data: saleBatches });
    await prisma.saleLine.createMany({ data: linesBatch });
    await prisma.payment.createMany({ data: paymentsBatch });
    saleBatches.length = 0;
    linesBatch.length = 0;
    paymentsBatch.length = 0;
  }

  const totalSales = completedSaleIds.length;
  console.log(`  Sales created: ${totalSales}`);

  // ── 7. Returns (~8% of sales) ──────────────────────────────────────────────
  const returnReasons = ['Size issue', 'Colour mismatch', 'Customer changed mind', 'Defective item'];
  const returnCount = Math.floor(totalSales * 0.08);
  const salesToReturn = pickN(completedSaleIds, returnCount);

  let returnsCreated = 0;
  for (const saleMeta of salesToReturn) {
    if (saleMeta.lines.length === 0) continue;

    const daysAfter = randInt(1, 5);
    const returnDate = new Date(now.getTime() - (90 - saleMeta.dayIdx - daysAfter) * dayMs);
    returnDate.setHours(randInt(10, 17), randInt(0, 59), 0, 0);

    // Return first line item only
    const returnLine = saleMeta.lines[0]!;
    const returnQty = 1;
    const refundAmount = new Decimal(returnLine.unitPrice.toString()).mul(returnQty);

    // Need the SaleLine id — fetch it
    const saleLine = await prisma.saleLine.findFirst({
      where: { saleId: saleMeta.id, variantId: returnLine.variantId },
    });
    if (!saleLine) continue;

    await prisma.return.create({
      data: {
        tenantId,
        originalSaleId: saleMeta.id,
        initiatedById: saleMeta.cashierId,
        authorizedById: manager.id,
        refundMethod: 'CASH',
        refundAmount: new Prisma.Decimal(refundAmount.toString()),
        reason: pick(returnReasons),
        status: 'COMPLETED',
        createdAt: returnDate,
        lines: {
          create: {
            originalSaleLineId: saleLine.id,
            variantId: returnLine.variantId,
            productNameSnapshot: returnLine.productNameSnapshot,
            variantDescriptionSnapshot: returnLine.variantDescriptionSnapshot,
            quantity: returnQty,
            unitPrice: returnLine.unitPrice,
            lineRefundAmount: new Prisma.Decimal(refundAmount.toString()),
          },
        },
      },
    });
    returnsCreated++;
  }

  console.log(`  Returns created: ${returnsCreated}`);

  // ── 8. Suppliers & Purchase Orders ─────────────────────────────────────────
  const supplierDefs = [
    { name: 'Lanka Silk Traders', contactName: 'Ruwan Dissanayake', phone: '0112345678', address: 'Pettah, Colombo' },
    { name: 'Kandy Handloom Co-op', contactName: 'Saman Kumara', phone: '0812345678', address: 'Peradeniya Rd, Kandy' },
    { name: 'Batik House Matara', contactName: 'Priya Mendis', phone: '0412345678', address: 'Beach Rd, Matara' },
    { name: 'Southern Textiles', contactName: 'Ajith Bandara', phone: '0912345678', address: 'Galle Fort, Galle' },
    { name: 'Eastern Fabrics Ltd', contactName: 'Faizal Ahmed', phone: '0652345678', address: 'Main St, Batticaloa' },
  ];

  const createdSuppliers: string[] = [];
  for (const sDef of supplierDefs) {
    const existing = await prisma.supplier.findFirst({
      where: { tenantId, name: sDef.name },
    });
    if (existing) {
      createdSuppliers.push(existing.id);
      continue;
    }
    const supplier = await prisma.supplier.create({
      data: {
        tenantId,
        name: sDef.name,
        contactName: sDef.contactName,
        phone: sDef.phone,
        address: sDef.address,
      },
    });
    createdSuppliers.push(supplier.id);
  }

  // 2-3 POs per supplier
  let poCounter = 0;
  for (const supplierId of createdSuppliers) {
    const poCount = randInt(2, 3);
    for (let p = 0; p < poCount; p++) {
      poCounter++;
      const orderDate = new Date(now.getTime() - randInt(10, 80) * dayMs);
      const selectedVars = pickN(allVariants, randInt(2, 5));

      let poTotal = new Decimal(0);
      const poLineData = selectedVars.map((v) => {
        const qty = randInt(10, 50);
        const cost = new Decimal(v.costPrice.toString());
        const lineTotal = cost.mul(qty);
        poTotal = poTotal.plus(lineTotal);
        return {
          variantId: v.id,
          productNameSnapshot: v.product.name,
          variantDescriptionSnapshot: `${v.size ?? ''} ${v.colour ?? ''}`.trim(),
          orderedQty: qty,
          expectedCostPrice: v.costPrice,
          receivedQty: qty,
          actualCostPrice: v.costPrice,
          isFullyReceived: true,
        };
      });

      await prisma.purchaseOrder.create({
        data: {
          tenantId,
          supplierId,
          createdById: manager.id,
          status: 'RECEIVED',
          totalAmount: new Prisma.Decimal(poTotal.toString()),
          createdAt: orderDate,
          lines: { create: poLineData },
        },
      });
    }
  }

  console.log(`  Suppliers: ${createdSuppliers.length}, POs: ${poCounter}`);

  // ── 9. Expenses ────────────────────────────────────────────────────────────
  const expenseDefs: { category: 'RENT' | 'UTILITIES' | 'MAINTENANCE' | 'MISCELLANEOUS' | 'ADVERTISING' | 'OTHER'; description: string; amount: number; daysAgo: number }[] = [
    { category: 'RENT', description: 'Shop rent – January', amount: 85000, daysAgo: 80 },
    { category: 'RENT', description: 'Shop rent – February', amount: 85000, daysAgo: 50 },
    { category: 'RENT', description: 'Shop rent – March', amount: 85000, daysAgo: 20 },
    { category: 'UTILITIES', description: 'Electricity bill – Jan', amount: 12500, daysAgo: 75 },
    { category: 'UTILITIES', description: 'Electricity bill – Feb', amount: 14200, daysAgo: 45 },
    { category: 'UTILITIES', description: 'Electricity bill – Mar', amount: 11800, daysAgo: 15 },
    { category: 'MISCELLANEOUS', description: 'Packaging materials (bags & tissue)', amount: 8500, daysAgo: 60 },
    { category: 'MISCELLANEOUS', description: 'Receipt paper rolls x20', amount: 3200, daysAgo: 30 },
    { category: 'MAINTENANCE', description: 'AC servicing', amount: 15000, daysAgo: 55 },
    { category: 'OTHER', description: 'Delivery van fuel – Jan', amount: 7500, daysAgo: 70 },
    { category: 'OTHER', description: 'Delivery van fuel – Feb', amount: 8200, daysAgo: 40 },
    { category: 'ADVERTISING', description: 'Facebook ads – Valentine campaign', amount: 25000, daysAgo: 35 },
    { category: 'OTHER', description: 'Staff uniforms x5', amount: 22500, daysAgo: 65 },
    { category: 'OTHER', description: 'Fire extinguisher refill', amount: 4500, daysAgo: 25 },
    { category: 'MISCELLANEOUS', description: 'Hangers & display stands', amount: 6800, daysAgo: 10 },
  ];

  const expenseData = expenseDefs.map((e) => ({
    tenantId,
    category: e.category,
    description: e.description,
    amount: new Prisma.Decimal(e.amount),
    recordedById: owner.id,
    expenseDate: new Date(now.getTime() - e.daysAgo * dayMs),
  }));

  await prisma.expense.createMany({ data: expenseData, skipDuplicates: true });
  console.log(`  Expenses created: ${expenseDefs.length}`);

  // ── 10. Commission records ─────────────────────────────────────────────────
  // 1.5% of cashier sales per month for the past 3 months
  // CommissionRecord is per-sale, so we batch by month and create per-sale records
  const commissionRate = new Decimal(1.5);
  let commissionCount = 0;

  // Group completed sales by month and cashier
  for (const saleMeta of completedSaleIds) {
    // Only ~20% sample for commissions to keep it manageable
    if (rng() > 0.2) continue;

    const sale = await prisma.sale.findUnique({ where: { id: saleMeta.id }, select: { totalAmount: true } });
    if (!sale) continue;

    const baseAmount = new Decimal(sale.totalAmount.toString());
    const earned = baseAmount.mul(commissionRate).div(100).toDecimalPlaces(2);

    await prisma.commissionRecord.create({
      data: {
        tenantId,
        saleId: saleMeta.id,
        userId: saleMeta.cashierId,
        baseAmount: new Prisma.Decimal(baseAmount.toString()),
        commissionRate: new Prisma.Decimal(commissionRate.toString()),
        earnedAmount: new Prisma.Decimal(earned.toString()),
        isPaid: false,
      },
    });
    commissionCount++;
  }

  console.log(`  Commission records: ${commissionCount}`);

  // ── 11. TimeClock entries ──────────────────────────────────────────────────
  let timeClockCount = 0;
  for (let dayIdx = 0; dayIdx < 90; dayIdx++) {
    const clockDate = new Date(now.getTime() - (90 - dayIdx) * dayMs);
    const dayOfWeek = clockDate.getDay();

    // Skip Sundays for some staff (owner & stock clerk only on weekdays/Saturdays sometimes)
    for (const staff of allStaff) {
      // Skip Sunday for everyone except cashiers
      if (dayOfWeek === 0 && staff.role !== 'CASHIER') continue;
      // Stock clerk skips weekends
      if (staff.role === 'STOCK_CLERK' && (dayOfWeek === 0 || dayOfWeek === 6)) continue;
      // ~10% chance anyone skips a day (leave/off)
      if (rng() < 0.1) continue;

      let clockInHour: number;
      let clockOutHour: number;
      if (staff.role === 'OWNER' || staff.role === 'MANAGER') {
        clockInHour = 8;
        clockOutHour = 18;
      } else if (staff.role === 'CASHIER') {
        // Cashiers alternate between morning/evening shifts
        const isMorning = rng() < 0.5;
        clockInHour = isMorning ? 8 : 13;
        clockOutHour = isMorning ? 14 : 20;
      } else {
        clockInHour = 9;
        clockOutHour = 17;
      }

      const clockIn = new Date(clockDate);
      clockIn.setHours(clockInHour, randInt(0, 15), 0, 0);

      const clockOut = new Date(clockDate);
      clockOut.setHours(clockOutHour, randInt(0, 30), 0, 0);

      // Find shift for this day if cashier
      let shiftId: string | undefined;
      if (staff.role === 'CASHIER') {
        const cashierIdx = cashiers.indexOf(staff);
        if (cashierIdx >= 0) {
          shiftId = shiftMap.get(`${cashierIdx}-${dayIdx}`) ?? undefined;
        }
      }

      await prisma.timeClock.create({
        data: {
          tenantId,
          userId: staff.id,
          clockedInAt: clockIn,
          clockedOutAt: clockOut,
          shiftId: shiftId ?? null,
        },
      });
      timeClockCount++;
    }
  }

  console.log(`  TimeClock entries: ${timeClockCount}`);

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('── Comprehensive Demo Seed Complete ──');
  console.log(`  Tenant:       velvet-demo`);
  console.log(`  Staff:        ${allStaff.length}`);
  console.log(`  Products:     ${productDefs.length}`);
  console.log(`  Variants:     ${allVariants.length}`);
  console.log(`  Customers:    ${customers.length}`);
  console.log(`  Sales:        ${totalSales}`);
  console.log(`  Returns:      ${returnsCreated}`);
  console.log(`  Suppliers:    ${createdSuppliers.length}`);
  console.log(`  POs:          ${poCounter}`);
  console.log(`  Expenses:     ${expenseDefs.length}`);
  console.log(`  Commissions:  ${commissionCount}`);
  console.log(`  TimeClocks:   ${timeClockCount}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
