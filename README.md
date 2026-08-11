# ChatGate SDK workspace

Publishable packages:

- `@chatgate/core` — REST, Socket.IO, sessions, uploads, and conversation state.
- `@chatgate/react` — React and Next.js provider, hooks, and web UI.
- `@chatgate/vue` — Vue 3 plugin, composable, and web UI.
- `@chatgate/react-native` — React Native and Expo provider, hooks, native UI,
  AppState handling, and media/push adapter contracts.

```bash
npm install
npm test
npm run typecheck
npm run pack:check
```

Read each package README under `packages/` for integration examples. Long-lived
subscription credentials and the embed HMAC secret must remain on the host
application server; every client receives only a short-lived visitor session.

## Working sample

[`examples/nextjs`](./examples/nextjs) is a standalone consumer project using
the local 0.2 packages before publication. It is configured for the live
ChatGate publishable-key flow and exercises visitor session creation, history,
text, image/file upload, browser voice recording, replies, reactions, typing,
presence, read receipts, Socket.IO acknowledgement, and merchant replies.

```bash
cd examples/nextjs
npm install
npm run verify
npm run dev
```
