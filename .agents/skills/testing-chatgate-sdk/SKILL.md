---
name: testing-chatgate-sdk
description: How to exercise the @chatgate/react, /vue and /react-native conversation UIs end-to-end in a browser without a ChatGate backend, and how to verify rendered attribute-level details (target/rel, unsafe URL schemes).
---

# Testing the ChatGate SDK UI without a backend

The SDK packages (`packages/core`, `react`, `vue`, `react-native`) render conversations from a
`ChatGateClient`. Live sockets need a ChatGate backend, but **you never need one**: the client accepts
`fetch` and `socketFactory` overrides, so you can seed an entire thread.

## Fake client recipe (works for all four packages)

```ts
createChatGateClient({
  baseUrl: "https://api.example.test",
  sessionProvider: async () => ({ accessToken: "t", organizationId: "org-1", userId: "customer-1", conversationId: "conv-1" }),
  fetch: async (url) => ({ ok: true, status: 200,
    json: async () => (String(url).includes("/inbox/conversations/") ? SEEDED_THREAD : {}),
    text: async () => "{}" }),
  socketFactory: () => { const s = { connected: true, auth: {}, connect(){return s;}, disconnect(){return s;}, on(){return s;}, off(){return s;}, emit(){return s;} }; return s; },
});
```
`SEEDED_THREAD = { id: "conv-1", status: "OPEN", messages: [...], nextCursor: null }`; each message needs
`id, inboxConversationId, senderId, receiverId, content, messageType ("text"|"image"|"voice"|"file"),
fileUrl, fileName, createdAt, read, sender:{ id, username, avatarUrl }`.

## Getting a real browser page up

- **React**: add a temporary `"use client"` page under `examples/nextjs/app/<name>/page.tsx` and run
  `cd examples/nextjs && npm run dev` (serves 127.0.0.1:3000). Fast, no extra tooling.
- **Vue**: `packages/vue/dist` is plain ESM. Serve the repo root (`python3 -m http.server 8099 --bind 127.0.0.1`)
  and use an HTML page with an importmap:
  `vue -> /node_modules/vue/dist/vue.esm-browser.js`, `@chatgate/core -> /packages/core/dist/index.js`,
  `@chatgate/vue -> /packages/vue/dist/index.js`, `socket.io-client -> /node_modules/socket.io-client/dist/socket.io.esm.min.js`.
  Mount with `createApp({render:()=>h(ChatGateConversation,{conversationId:"conv-1"})}).use(createChatGatePlugin({client}))`.
  Seeded messages must be a `.js` file (browser cannot import `.ts`).
- **React Native**: `@chatgate/react-native` can be rendered in the DOM by aliasing `react-native` to a
  small stub in `next.config.ts`:
  `turbopack: { resolveAlias: { "react-native": "./app/<harness>/rn-stub.tsx" } }`.
  Stub `View/Text/Pressable/Image/FlatList/TextInput/Modal/StyleSheet/Platform/Linking`. Make
  `Linking.openURL` dispatch a `window` CustomEvent and render a visible on-page counter/log so
  navigation intents are observable on screen (React Native has no address bar). Expect harmless
  React hydration warnings from the stub (nested `<button>`, unknown `delayLongPress` prop) — they are
  stub artifacts, not SDK bugs.
- Always run `npm test` at the repo root first: each package's `test` script rebuilds `dist`, and the
  browser harnesses consume `dist`, not `src`.

## Gotcha: the automation browser strips `target` from anchors

In the instrumented Chrome used by computer-use, `a[target]` is removed from real page anchors
(`getAttribute("target")` returns `null`) even though `rel` survives. Do **not** conclude
`target="_blank"` is missing. Get ground truth from an uninstrumented DOM dump:

```
google-chrome --headless=new --disable-gpu --no-sandbox --virtual-time-budget=8000 \
  --dump-dom "http://127.0.0.1:3000/<page>" > /tmp/dump.html
grep -o '<a [^>]*target="_blank"[^>]*>' /tmp/dump.html | grep -vc 'rel="noopener noreferrer"'
```

## URL-safety specifics

- `sanitizeUrl(value, {schemes, allowRelative})` from `@chatgate/core` allows `http:`, `https:`,
  `mailto:`, `tel:` and (by default) relative refs; strips C0 controls/whitespace before matching.
- Zero-width / bidi marks (e.g. `U+200E`) are **not** in the strip set, so `"\u200Ejavascript:..."`
  is returned unchanged and an anchor renders. In Chrome it resolves as a *relative* path (no script
  runs), but if you are testing this area, re-check it — a renderer or a native
  `Linking.openURL` implementation that normalizes such marks could make it exploitable. Scheme-relative
  `//host/x` is intentionally allowed.
- Fast bypass sweep without any UI: `node -e` against `packages/core/dist/index.js`, feeding payload
  variants (case, leading whitespace/NUL/newline, `java\u0000script:`, HTML entities, percent-encoding,
  `blob:`, `filesystem:`, `view-source:`, `about:`, bidi marks) and flagging any non-`undefined` output.

## Regression commands (all pass on a clean tree)

```
npm test                       # builds + tests core/react/vue/react-native
npm run typecheck
cd examples/nextjs && npm run verify   # test + eslint + tsc + next build
```
Move temporary harness dirs out of the tree (and `git checkout next.config.ts`) before running
`examples/nextjs npm run verify`, otherwise the sample's lint/build covers harness files.

## Devin Secrets Needed

None — all of the above runs fully offline except remote placeholder images
(`https://placehold.co/...` is handy as a visibly-labelled "SAFE IMAGE" test asset).
