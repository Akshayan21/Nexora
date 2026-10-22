import { NextRequest } from "next/server";
import { forwardLeadRequest } from "@/lib/backend";
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return forwardLeadRequest(request, `/${encodeURIComponent(id)}/disconnect`, "mailboxes");
}
