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
