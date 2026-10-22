import { NextRequest, NextResponse } from "next/server";
import { forwardLeadRequest } from "@/lib/backend";

export async function GET(request: NextRequest) {
  const input = request.nextUrl.searchParams;
  const internal = new URL("/api/mailboxes/google/complete", request.url);
  const completion = new NextRequest(internal, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: request.headers.get("cookie") || "",
    },
    body: JSON.stringify({ state: input.get("state") || "", code: input.get("code") || "", error: input.get("error") || "" }),
  });
  const result = await forwardLeadRequest(completion, "/google/complete", "mailboxes");
  const target = new URL("/settings", request.url);
  target.searchParams.set("gmail", result.ok ? "connected" : input.has("error") ? "cancelled" : "failed");
  const response = NextResponse.redirect(target);
  response.cookies.set("gmail_oauth", "", { maxAge: 0, path: "/api/mailboxes", httpOnly: true, sameSite: "lax" });
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
