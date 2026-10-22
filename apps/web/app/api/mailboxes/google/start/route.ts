import { NextRequest } from "next/server";
import { forwardLeadRequest } from "@/lib/backend";
export function POST(request: NextRequest) {
  return forwardLeadRequest(request, "/google/start", "mailboxes");
}
