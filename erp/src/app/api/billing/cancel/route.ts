import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SubscriptionStatus } from "@/generated/prisma/client";

export async function PATCH() {
  const session = await auth();
  if (!session?.user?.id || !session.user.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "OWNER") {
    return NextResponse.json(
      { error: "Only the store owner can cancel the subscription" },
      { status: 403 },
    );
  }

  const tenantId = session.user.tenantId;

  const subscription = await prisma.subscription.findUnique({
    where: { tenantId },
  });

  if (!subscription) {
    return NextResponse.json(
      { error: "No subscription found" },
      { status: 404 },
    );
  }

  if (subscription.status === SubscriptionStatus.CANCELLED) {
    return NextResponse.json(
      { error: "Subscription is already cancelled" },
      { status: 409 },
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const sub = await tx.subscription.update({
      where: { tenantId },
      data: {
        status: SubscriptionStatus.CANCELLED,
        cancelledAt: new Date(),
      },
    });

    await tx.tenant.update({
      where: { id: tenantId },
      data: { subscriptionStatus: SubscriptionStatus.CANCELLED },
    });

    return sub;
  });

  return NextResponse.json({ subscription: updated });
}
