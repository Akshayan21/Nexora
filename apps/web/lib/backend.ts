import { NextRequest, NextResponse } from "next/server";

export async function forwardLeadRequest(
  request: NextRequest,
  endpoint: string,
  resource: "leads" | "campaigns" | "mailboxes" = "leads",
) {
  // Local single-user bridge only. Production requires a signed-in user session.
  if (process.env.NODE_ENV !== "development")
    return NextResponse.json(
      {
        detail:
          "The local lead bridge is only available in development. Production sign-in is not configured.",
      },
      { status: 503 },
    );
  const host = request.nextUrl.hostname;
  if (!["localhost", "127.0.0.1", "[::1]"].includes(host))
    return NextResponse.json({ detail: "Local access only" }, { status: 403 });
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin)
    return NextResponse.json(
      { detail: "Origin is not allowed" },
      { status: 403 },
    );
  try {
    const credential = {
      access_token: process.env.OUTREACH_API_TOKEN,
      workspace_id: process.env.OUTREACH_WORKSPACE_ID,
      expires_at: process.env.OUTREACH_TOKEN_EXPIRES_AT || "",
    };
    if (
      !credential.access_token ||
      !credential.workspace_id ||
      !Number.isFinite(Date.parse(credential.expires_at)) ||
      Date.parse(credential.expires_at) <= Date.now()
    )
      return NextResponse.json(
        {
          detail:
            "Local API credentials are missing or expired. Refresh them with the backend bootstrap command.",
        },
        { status: 503 },
      );
    const headers: Record<string, string> = {
      Authorization: `Bearer ${credential.access_token}`,
      "X-Workspace-ID": credential.workspace_id,
    };
    const key = request.headers.get("Idempotency-Key");
    if (resource === "mailboxes") {
      headers["X-Dashboard-Origin"] = request.nextUrl.origin;
      const cookie = request.cookies.get("gmail_oauth");
      if (cookie) headers.Cookie = `gmail_oauth=${cookie.value}`;
    }
    if (key) headers["Idempotency-Key"] = key;
    const body = ["POST", "PUT"].includes(request.method)
      ? await request.text()
      : undefined;
    if (body) headers["Content-Type"] = "application/json";
    const response = await fetch(
      `${(process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "")}/api/v1/${resource}${endpoint}${request.nextUrl.search}`,
      {
        method: request.method,
        headers,
        body,
        cache: "no-store",
        signal: AbortSignal.timeout(resource === "mailboxes" ? 40000 : 12000),
      },
    );
    if (response.status === 401 || response.status === 403)
      return NextResponse.json(
        {
          detail:
            "Backend workspace authentication failed. Refresh the local API credentials.",
        },
        { status: 503 },
      );
    const result = new NextResponse(await response.text(), {
      status: response.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
    if (resource === "mailboxes") {
      const cookie = response.headers.get("set-cookie");
      if (cookie) result.headers.set("Set-Cookie", cookie);
    }
    return result;
  } catch {
    return NextResponse.json(
      {
        detail:
          "Could not reach the lead API. Start the backend and check local credentials.",
      },
      { status: 503 },
    );
  }
}
