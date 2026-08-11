import { NextResponse } from "next/server";

const chatGateApiUrl = process.env.CHATGATE_API_URL ?? "https://api.chat-gate.com";
const publicKey = process.env.CHATGATE_PUBLIC_KEY ?? "cg_pub_z1lzc3otAHo_jWq0fFq8CDEV";
const organizationId = process.env.CHATGATE_ORG_ID ?? "cmsesv871000cro1lf82msw20";
const externalUserId = process.env.CHATGATE_USER_ID ?? "customer-1234";
const userName = process.env.CHATGATE_USER_NAME ?? "Customer";

interface VisitorContext {
  businessUnitExternalId?: string;
  visitorSessionId?: string;
  visitorEventId?: string;
  pageUrl?: string;
  pageTitle?: string;
  pageReferrer?: string;
  browserTimezone?: string;
  browserLanguage?: string;
  browserPlatform?: string;
  screenWidth?: number;
  screenHeight?: number;
  viewportWidth?: number;
  viewportHeight?: number;
}

export async function POST(request: Request) {
  const context = await request.json().catch(() => ({})) as VisitorContext;
  const origin = request.headers.get("origin") ?? new URL(request.url).origin;
  const response = await fetch(`${chatGateApiUrl}/api/gateway/embed/token`, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
    },
    body: JSON.stringify({
      publicKey,
      organizationId,
      externalUserId,
      name: userName,
      channel: "WEB_WIDGET",
      businessUnitExternalId: context.businessUnitExternalId,
      visitorSessionId: context.visitorSessionId,
      visitorEventId: context.visitorEventId,
      pageUrl: context.pageUrl,
      pageTitle: context.pageTitle,
      pageReferrer: context.pageReferrer,
      browserTimezone: context.browserTimezone,
      browserLanguage: context.browserLanguage,
      browserPlatform: context.browserPlatform,
      screenWidth: context.screenWidth,
      screenHeight: context.screenHeight,
      viewportWidth: context.viewportWidth,
      viewportHeight: context.viewportHeight,
    }),
  });
  const payload = await response.json().catch(() => ({
    message: `ChatGate returned status ${response.status}`,
  }));
  return NextResponse.json(payload, { status: response.status });
}
