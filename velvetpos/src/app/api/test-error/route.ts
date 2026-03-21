import { NextResponse } from "next/server";

export function GET() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  throw new Error(
    `VelvetPOS Sentry test error — triggered deliberately from /api/test-error at ${new Date().toISOString()}`
  );
}
