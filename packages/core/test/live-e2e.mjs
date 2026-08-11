import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { createChatGateClient } from "../dist/index.js";

const baseUrl = process.env.CHATGATE_E2E_BASE_URL?.replace(/\/$/, "");
const sessionEndpoint = process.env.CHATGATE_E2E_SESSION_ENDPOINT;
const sessionOrigin = process.env.CHATGATE_E2E_ORIGIN;
const testAttachments = process.env.CHATGATE_E2E_ATTACHMENTS === "1";
const voiceFilePath = process.env.CHATGATE_E2E_VOICE_FILE;

if (!baseUrl || !sessionEndpoint) {
  throw new Error(
    "Set CHATGATE_E2E_BASE_URL and CHATGATE_E2E_SESSION_ENDPOINT to run the live SDK test.",
  );
}

const client = createChatGateClient({
  baseUrl,
  sessionProvider: async ({ forceRefresh, businessUnitExternalId }) => {
    const response = await fetch(sessionEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(sessionOrigin ? { Origin: sessionOrigin } : {}),
      },
      body: JSON.stringify({ forceRefresh, businessUnitExternalId }),
    });
    if (!response.ok) {
      const details = await response.text().catch(() => "");
      throw new Error(`Session endpoint returned ${response.status}: ${details}`);
    }
    return response.json();
  },
});

try {
  const connected = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Socket.IO did not connect within 15 seconds")), 15_000);
    let offConnected = () => undefined;
    offConnected = client.on("connected", () => {
      clearTimeout(timeout);
      offConnected();
      resolve();
    });
  });
  const session = await client.start();
  await connected;
  assert.ok(session.conversationId, "Live session did not return conversationId");
  const thread = await client.getConversation();
  assert.equal(thread.id, session.conversationId);

  const runId = new Date().toISOString();
  const content = `ChatGate SDK live check ${runId}`;
  const message = await client.sendMessage({ content, messageType: "text" });
  assert.equal(message.content, content);
  assert.equal(message.inboxConversationId, session.conversationId);

  const attachmentMessageIds = [];
  if (testAttachments) {
    const textFile = new File([`ChatGate attachment check ${runId}\n`], "chatgate-e2e.txt", {
      type: "text/plain",
    });
    const fileResult = await client.uploadAndSend(
      { value: textFile, name: textFile.name, mimeType: textFile.type },
      { content: "SDK file attachment", messageType: "file" },
    );
    assert.equal(fileResult.message.messageType, "file");
    assert.ok(fileResult.message.fileUrl);
    attachmentMessageIds.push(fileResult.message.id);

    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    );
    const imageFile = new File([png], "chatgate-e2e.png", { type: "image/png" });
    const imageResult = await client.uploadAndSend(
      { value: imageFile, name: imageFile.name, mimeType: imageFile.type },
      { content: "SDK image attachment", messageType: "image" },
    );
    assert.equal(imageResult.message.messageType, "image");
    assert.ok(imageResult.message.fileUrl);
    attachmentMessageIds.push(imageResult.message.id);

    if (voiceFilePath) {
      const voice = await readFile(voiceFilePath);
      const voiceName = basename(voiceFilePath);
      const voiceFile = new File([voice], voiceName, { type: "audio/mpeg" });
      const voiceResult = await client.uploadAndSend(
        { value: voiceFile, name: voiceFile.name, mimeType: voiceFile.type },
        { content: "Voice message", messageType: "voice" },
      );
      assert.equal(voiceResult.message.messageType, "voice");
      assert.ok(voiceResult.message.fileUrl);
      attachmentMessageIds.push(voiceResult.message.id);
    }

    const refreshed = await client.getConversation();
    const persistedIds = new Set(refreshed.messages.map((item) => item.id));
    for (const messageId of attachmentMessageIds) {
      assert.ok(persistedIds.has(messageId), `Attachment ${messageId} was not returned by history`);
    }
  }

  console.log(JSON.stringify({
    ok: true,
    conversationId: session.conversationId,
    messageId: message.id,
    attachmentMessageIds,
  }));
} finally {
  client.stop();
}
