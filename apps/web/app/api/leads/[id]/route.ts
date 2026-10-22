import { NextRequest, NextResponse } from "next/server";
import { forwardLeadRequest } from "@/lib/backend";
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id))
    return NextResponse.json({ detail: "Invalid contact ID" }, { status: 400 });
  return forwardLeadRequest(request, `/${id}`);
}
