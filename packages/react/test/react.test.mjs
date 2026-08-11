import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createChatGateClient } from "@chatgate/core";
import { ChatGate, ChatGateConversation, ChatGateProvider } from "../dist/index.js";

function fakeClient() {
  return createChatGateClient({
    baseUrl: "https://api.example.test",
    sessionProvider: async () => ({ accessToken: "token", organizationId: "org-1", userId: "visitor-1" }),
    fetch: async () => ({ ok: true, status: 200, json: async () => ({}), text: async () => "{}" }),
    socketFactory: () => ({ connected: false, auth: {}, connect() { return this; }, disconnect() { return this; }, on() { return this; }, off() { return this; }, emit() { return this; } }),
  });
}

test("renders the framework UI without starting sockets during SSR", () => {
  const html = renderToStaticMarkup(
    React.createElement(
      ChatGateProvider,
      { client: fakeClient(), autoStart: false },
      React.createElement(ChatGateConversation, { title: "Customer care" }),
    ),
  );

  assert.match(html, /Customer care/);
  assert.match(html, /No messages yet/);
  assert.match(html, /aria-label="Message"/);
});

test("renders the one-component publishable-key integration during SSR", () => {
  const html = renderToStaticMarkup(
    React.createElement(ChatGate, {
      publicKey: "cg_pub_example",
      organizationId: "org-1",
      userId: "customer-123",
      title: "Simple support",
    }),
  );

  assert.match(html, /Simple support/);
  assert.match(html, /aria-label="Message"/);
});
