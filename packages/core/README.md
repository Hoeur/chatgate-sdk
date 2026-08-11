# `@chatgate/core`

Framework-independent ChatGate client for browsers, Next.js, Vue, React Native,
Expo, and other JavaScript runtimes with `fetch` and Socket.IO support.

This is the shared transport package. The SDK workspace also contains:

- `@chatgate/react` for React and Next.js.
- `@chatgate/vue` for Vue 3.
- `@chatgate/react-native` for React Native and Expo.

All adapters compose this package instead of implementing ChatGate REST and
realtime contracts again.

## Security boundary

Never place a `cg_live_` subscription key or ChatGate embed HMAC secret in a web
or mobile application. A `cg_pub_` publishable key is designed for client code;
the SDK exchanges it for a short-lived, visitor-scoped ChatGate session.

Use `sessionProvider` when your application owns a private authenticated session
flow. A host endpoint may compute a verified user hash, but the HMAC secret must
never be sent to the browser.

## Install

```bash
npm install @chatgate/core
```

Version 0.3 adds the simple publishable-key setup while retaining the complete
customer-conversation contract: attachments, voice metadata, replies, reactions,
typing, presence, read receipts, edits, deletes, and realtime reconciliation.

## Publishable-key client

This matches the browser embed-script contract and needs no application proxy
route:

```ts
import { createChatGateClient } from "@chatgate/core";

const chatgate = createChatGateClient({
  baseUrl: "https://api.chat-gate.com",
  publicKey: "cg_pub_...",
  organizationId: "your-organization-id",
  userId: "customer-1234",
  userName: "Customer",
});

await chatgate.start();
```

The website origin must be registered in ChatGate Developer Access. When
`userId` is omitted, the SDK creates and persists an anonymous visitor ID.

## Custom authenticated client

```ts
import { createChatGateClient } from "@chatgate/core";

const chatgate = createChatGateClient({
  baseUrl: "https://api.chat-gate.com",
  sessionProvider: async ({ forceRefresh, businessUnitExternalId }) => {
    const response = await fetch("/api/chatgate/session", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ forceRefresh, businessUnitExternalId }),
    });
    if (!response.ok) throw new Error("Unable to start ChatGate session");
    return response.json();
  },
});

await chatgate.start();

const unsubscribe = chatgate.on("message", (message) => {
  console.log("New message", message);
});

const thread = await chatgate.getConversation();
await chatgate.sendMessage({ content: "Hello", messageType: "text" });
await chatgate.uploadAndSend(
  { value: file, name: file.name, mimeType: file.type },
  { messageType: file.type.startsWith("image/") ? "image" : "file" },
);

unsubscribe();
chatgate.stop();
```

## Next.js

Install `@chatgate/react` and use its high-level `<ChatGate />` component. It
creates the client only within the Client Component boundary.

## Vue

Create one client for the application, start it when the app mounts, subscribe in
composables, and call `stop()` when the integration is disposed.

## React Native and Expo

React Native uses the same client. Its session provider calls the application's
authenticated API and the upload method accepts React Native FormData values:

```ts
await chatgate.upload({
  value: {
    uri: pickedAsset.uri,
    name: pickedAsset.name ?? "attachment.jpg",
    type: pickedAsset.mimeType ?? "image/jpeg",
  },
});
```

Install `@chatgate/react-native` for AppState reconnection, native chat UI, and
host-provided media and push-notification adapters. The host application chooses
Expo or bare React Native implementations for picking, recording, and push-token
provisioning.

## API surface

- `start()` / `stop()`
- `refreshSession()`
- `switchBusinessUnit(externalId)`
- `listConversations(filters)`
- `getConversation(conversationId?, { cursor, limit })`
- `sendMessage(input)`
- `upload(file)`
- `uploadAndSend(file, input)`
- `setTyping(receiverId, isTyping)`
- `markRead(receiverId)`
- `toggleReaction(messageId, emoji)`
- `editMessage(messageId, content)` / `deleteMessage(messageId)`
- `request(path, init)` for typed extension APIs
- `on(event, listener)` / `off(event, listener)`
- `createChatGateConversationController(client)` for framework-neutral reactive
  conversation state, pagination, sending, uploads, deduplication, and resync.
- `createChatGateConversationListController(client)` for all merchant
  conversations, unread updates, available business units, list/detail
  navigation, and `switchBusinessUnit()` session changes.

Supported events are `session`, `connected`, `disconnected`, `connectionError`,
`embedReady`, `message`, `messageUpdated`, `messageDeleted`,
`messageReactions`, `typing`, `presence`, `read`, `resync`, and `error`.

## Live contract test

Run the real visitor session → history → Socket.IO send flow against a deployed
ChatGate environment and an application-owned session endpoint:

```bash
CHATGATE_E2E_BASE_URL=https://api.chat-gate.com \
CHATGATE_E2E_SESSION_ENDPOINT=https://your-app.example/api/chatgate/session \
npm run test:e2e
```

The normal unit suite does not require credentials or a running backend.
