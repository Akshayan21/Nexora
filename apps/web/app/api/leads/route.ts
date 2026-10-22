import { NextRequest } from "next/server";
import { forwardLeadRequest } from "@/lib/backend";
export const dynamic = "force-dynamic";
export function GET(request: NextRequest) {
  return forwardLeadRequest(request, "");
}
export function POST(request: NextRequest) {
  return forwardLeadRequest(request, "");
}
