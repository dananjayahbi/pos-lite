import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { ProductDetailClient } from '@/components/product/ProductDetailClient';

interface Props {
  params: Promise<{ productId: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { productId } = await params;
  const product = await prisma.product.findUnique({
    where: { id: productId, deletedAt: null },
    select: { name: true },
  });
  return { title: product ? `${product.name} | VelvetPOS` : 'Product | VelvetPOS' };
}

export default async function ProductDetailPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.tenantId) redirect('/login');

  const userPermissions = Array.isArray(session.user.permissions)
    ? session.user.permissions.filter((p): p is string => typeof p === 'string')
    : [];

  if (!userPermissions.includes('product:view')) {
    redirect('/inventory');
  }

  const { productId } = await params;

  return <ProductDetailClient productId={productId} permissions={userPermissions} />;
}
