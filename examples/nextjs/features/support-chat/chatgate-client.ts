"use client";

import { createChatGateClient } from "@chatgate/core";

const baseUrl = process.env.NEXT_PUBLIC_CHATGATE_URL ?? "https://api.chat-gate.com";

interface EmbedErrorResponse {
  code?: string;
  message?: string | string[];
}

function getVisitorSessionId(): string {
  const storageKey = "chatgate:sdk-sample:visitor-session";
  const existing = window.sessionStorage.getItem(storageKey);
  if (existing) return existing;
  const generated = `sdk_${crypto.randomUUID()}`;
  window.sessionStorage.setItem(storageKey, generated);
  return generated;
}

function currentPageUrl(): string {
  return `${window.location.origin}${window.location.pathname}`;
}

async function readEmbedError(response: Response): Promise<string> {
  const payload = await response.json().catch(() => undefined) as EmbedErrorResponse | undefined;
  const message = Array.isArray(payload?.message) ? payload.message.join(", ") : payload?.message;
  return [payload?.code, message ?? `Request failed with status ${response.status}`]
    .filter(Boolean)
    .join(": ");
}

export const chatGateClient = createChatGateClient({
  baseUrl,
  socketUrl: baseUrl,
  sessionProvider: async ({ businessUnitExternalId }) => {
    const visitorSessionId = getVisitorSessionId();
    const response = await fetch("/api/chatgate/session", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessUnitExternalId,
        visitorSessionId,
        visitorEventId: `${visitorSessionId}:session-started`,
        pageUrl: currentPageUrl(),
        pageTitle: document.title,
        pageReferrer: document.referrer || undefined,
        browserTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        browserLanguage: navigator.language,
        browserPlatform: navigator.platform,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      }),
    });
    if (!response.ok) {
      const details = await readEmbedError(response);
      throw new Error(
        `${details.replace(/[.\s]+$/, "")}. Allow ${window.location.origin} in ChatGate Settings → Developer access → Allowed embed domains.`,
      );
    }
    return response.json();
  },
});
