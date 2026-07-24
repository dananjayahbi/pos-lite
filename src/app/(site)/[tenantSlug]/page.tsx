import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getPublicWebsiteConfig } from '@/lib/services/website.service';
import { WebsiteShell } from '@/components/website/WebsiteShell';
import type { WebsiteConfigData } from '@/types/website.types';

interface SitePageProps {
  params: Promise<{ tenantSlug: string }>;
}

export default async function SitePage({ params }: SitePageProps) {
  const { tenantSlug } = await params;

  // Resolve tenant by slug
  const tenant = await prisma.tenant.findFirst({
    where: { slug: tenantSlug, deletedAt: null },
    select: { id: true, name: true, slug: true },
  });

  if (!tenant) {
    notFound();
  }

  const rawConfig = await getPublicWebsiteConfig(tenant.id);
  const config: WebsiteConfigData | null = rawConfig
    ? (JSON.parse(JSON.stringify(rawConfig)) as WebsiteConfigData)
    : null;

  return (
    <WebsiteShell
      tenantName={tenant.name}
      tenantSlug={tenant.slug}
      config={config}
    />
  );
}

/**
 * Helper to generate metadata dynamically
 */
export async function generateMetadata({ params }: SitePageProps) {
  const { tenantSlug } = await params;

  const tenant = await prisma.tenant.findFirst({
    where: { slug: tenantSlug, deletedAt: null },
    select: { id: true, name: true },
  });

  if (!tenant) return { title: 'Not Found' };

  const config = await prisma.websiteConfig.findUnique({
    where: { tenantId: tenant.id },
    select: { metaTitle: true, metaDescription: true, siteName: true },
  });

  return {
    title: config?.metaTitle || config?.siteName || tenant.name,
    description: config?.metaDescription || `Discover premium Ayurveda products at ${tenant.name}`,
  };
}
