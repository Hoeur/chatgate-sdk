import assert from "node:assert/strict";
import test from "node:test";
import { createSSRApp, h } from "vue";
import { renderToString } from "@vue/server-renderer";
import { createChatGateClient } from "@chatgate/core";
import { ChatGateConversation, createChatGatePlugin } from "../dist/index.js";

test("renders the Vue chat UI without starting sockets during SSR", async () => {
  const client = createChatGateClient({
    baseUrl: "https://api.example.test",
    sessionProvider: async () => ({ accessToken: "token", organizationId: "org-1", userId: "visitor-1" }),
    fetch: async () => ({ ok: true, status: 200, json: async () => ({}), text: async () => "{}" }),
    socketFactory: () => ({ connected: false, auth: {}, connect() { return this; }, disconnect() { return this; }, on() { return this; }, off() { return this; }, emit() { return this; } }),
  });
  const app = createSSRApp({ render: () => h(ChatGateConversation, { title: "Vue support" }) });
  app.use(createChatGatePlugin({ client, autoStart: false }));

  const html = await renderToString(app);
  assert.match(html, /Vue support/);
  assert.match(html, /No messages yet/);
  assert.match(html, /aria-label="Message"/);
});
