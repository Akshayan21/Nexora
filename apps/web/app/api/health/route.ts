import { NextResponse } from "next/server";
export async function GET() {
  try {
    const base =
      process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
    const response = await fetch(
      `${base.replace(/\/$/, "")}/api/v1/health/ready`,
      { cache: "no-store", signal: AbortSignal.timeout(4000) },
    );
    return NextResponse.json({ ready: response.ok });
  } catch {
    return NextResponse.json({ ready: false });
  }
}
