import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChatGateNativeContext, useChatGate } from "../dist/context.js";

function Probe() {
  const { status } = useChatGate();
  return React.createElement("span", null, status);
}

test("exports a framework context consumable by React Native hooks", async () => {
  const value = { client: {}, status: "idle", error: undefined };
  const html = renderToStaticMarkup(
    React.createElement(ChatGateNativeContext.Provider, { value }, React.createElement(Probe)),
  );
  assert.match(html, /idle/);
  const indexSource = await readFile(new URL("../dist/index.js", import.meta.url), "utf8");
  assert.match(indexSource, /ChatGateMessenger/);
});
test("exports a ChatGate one-component and provider fallback", async () => {
  const chatgateSource = await readFile(new URL("../dist/chatgate.js", import.meta.url), "utf8");
  assert.match(chatgateSource, /export function ChatGate\(/);
  assert.match(chatgateSource, /autoStart = true/);
  assert.match(chatgateSource, /stopOnUnmount = true/);
  assert.match(chatgateSource, /disconnectOnBackground = true/);
  const chatgateTypes = await readFile(new URL("../dist/chatgate.d.ts", import.meta.url), "utf8");
  assert.match(chatgateTypes, /autoStart\?:/);
  assert.match(chatgateTypes, /stopOnUnmount\?:/);
  assert.match(chatgateTypes, /disconnectOnBackground\?:/);
  const indexTypes = await readFile(new URL("../dist/index.d.ts", import.meta.url), "utf8");
  assert.match(indexTypes, /export \{ ChatGate,/);
  const providerTypes = await readFile(new URL("../dist/provider.d.ts", import.meta.url), "utf8");
  assert.match(providerTypes, /fallback\?:/);
  const contextTypes = await readFile(new URL("../dist/context.d.ts", import.meta.url), "utf8");
  assert.match(contextTypes, /"disconnected"/);
});

test("declares the composer, render and empty-state props on the public API", async () => {
  const declarations = await readFile(
    new URL("../dist/conversation.d.ts", import.meta.url),
    "utf8",
  );
  for (const prop of [
    "allowAttachments?:",
    "allowVoice?:",
    "acceptedFileTypes?:",
    "maxFileSizeBytes?:",
    "renderMessage?:",
    "emptyState?:",
  ]) {
    assert.ok(declarations.includes(prop), `missing ${prop}`);
  }
  const types = await readFile(new URL("../dist/types.d.ts", import.meta.url), "utf8");
  assert.match(types, /ChatGateAttachmentConstraints/);
  assert.match(types, /pickAttachment\(constraints\?/);
});
