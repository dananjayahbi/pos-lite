-- CreateTable
CREATE TABLE "website_configs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "siteName" TEXT,
    "tagline" TEXT,
    "logoUrl" TEXT,
    "faviconUrl" TEXT,
    "primaryColor" TEXT DEFAULT '#0a0a0a',
    "accentColor" TEXT DEFAULT '#b4946e',
    "bgColor" TEXT DEFAULT '#ece2d6',
    "headingFontFamily" TEXT,
    "bodyFontFamily" TEXT,
    "headingColor" TEXT DEFAULT '#0a0a0a',
    "bodyColor" TEXT DEFAULT '#555555',
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "socialLinks" JSONB NOT NULL DEFAULT '{}',
    "navItems" JSONB NOT NULL DEFAULT '[]',
    "sections" JSONB NOT NULL DEFAULT '{}',
    "footerAbout" TEXT,
    "footerColumns" JSONB NOT NULL DEFAULT '[]',
    "aboutPageTitle" TEXT,
    "aboutPageSubtitle" TEXT,
    "aboutHeroImageUrl" TEXT,
    "aboutStoryTitle" TEXT,
    "aboutStoryContent" TEXT,
    "aboutStoryImageUrl" TEXT,
    "aboutMissionTitle" TEXT,
    "aboutMissionContent" TEXT,
    "aboutValuesSectionTitle" TEXT,
    "aboutValues" JSONB NOT NULL DEFAULT '[]',
    "contactPageTitle" TEXT,
    "contactPageSubtitle" TEXT,
    "contactHeroImageUrl" TEXT,
    "contactInfoTitle" TEXT,
    "contactAddress" TEXT,
    "contactPhoneDisplay" TEXT,
    "contactEmailDisplay" TEXT,
    "contactBusinessHours" TEXT,
    "contactMapEmbedUrl" TEXT,
    "shopPageTitle" TEXT,
    "shopPageSubtitle" TEXT,
    "shopHeroImageUrl" TEXT,
    "shopPageDescription" TEXT,
    "shopProductsPerPage" INTEGER DEFAULT 24,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "website_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_hero_slides" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL DEFAULT 'image',
    "mediaUrl" TEXT NOT NULL,
    "mobileMediaUrl" TEXT,
    "title" TEXT,
    "subtitle" TEXT,
    "description" TEXT,
    "ctaText" TEXT,
    "ctaLink" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "website_hero_slides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_ads" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL DEFAULT 'image',
    "mediaUrl" TEXT NOT NULL,
    "mobileMediaUrl" TEXT,
    "targetUrl" TEXT,
    "position" TEXT NOT NULL DEFAULT 'between_sections',
    "displayAfterSection" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "website_ads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "website_configs_tenantId_key" ON "website_configs"("tenantId");

-- CreateIndex
CREATE INDEX "website_hero_slides_configId_idx" ON "website_hero_slides"("configId");

-- CreateIndex
CREATE INDEX "website_hero_slides_tenantId_idx" ON "website_hero_slides"("tenantId");

-- CreateIndex
CREATE INDEX "website_ads_configId_idx" ON "website_ads"("configId");

-- CreateIndex
CREATE INDEX "website_ads_tenantId_idx" ON "website_ads"("tenantId");

-- AddForeignKey
ALTER TABLE "website_configs" ADD CONSTRAINT "website_configs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_hero_slides" ADD CONSTRAINT "website_hero_slides_configId_fkey" FOREIGN KEY ("configId") REFERENCES "website_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_ads" ADD CONSTRAINT "website_ads_configId_fkey" FOREIGN KEY ("configId") REFERENCES "website_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
