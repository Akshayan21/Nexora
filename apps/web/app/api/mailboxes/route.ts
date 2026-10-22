import { NextRequest } from "next/server";
import { forwardLeadRequest } from "@/lib/backend";
export function GET(request: NextRequest) {
  return forwardLeadRequest(request, "", "mailboxes");
}
