# ChatGate SDK workspace

Publishable packages:

- `@chatgate/core` — REST, Socket.IO, sessions, uploads, and conversation state.
- `@chatgate/react` — React and Next.js provider, hooks, and web UI.
- `@chatgate/vue` — Vue 3 plugin, composable, and web UI.
- `@chatgate/react-native` — React Native and Expo provider, hooks, native UI,
  AppState handling, and media/push adapter contracts.

The React/Next.js UI includes a customizable, responsive two-pane customer
messenger: searchable DM history with unread counts and latest-message previews
in the sidebar, plus the complete selected conversation detail. Every adapter
also exposes existing merchant conversations, available businesses, merchant
switching, and responsive list/detail navigation.

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
the local workspace packages before publication. It is configured for the live
ChatGate publishable-key flow and exercises visitor session creation, history,
text, image/file upload, browser voice recording, replies, reactions, typing,
presence, read receipts, Socket.IO acknowledgement, and merchant replies.

```bash
cd examples/nextjs
npm install
npm run verify
npm run dev
```

## Automated CI and npm publishing

GitHub Actions runs the SDK and Next.js sample checks for every pull request and
push to `main`. Publishing runs when a GitHub Release is published, or when the
`Publish npm packages` workflow is started manually.

Before the first automated release, add this trusted publisher to each of the
four `@chatgate/*` packages on npm:

- Organization or user: `Hoeur`
- Repository: `chatgate-sdk`
- Workflow filename: `publish.yml`
- Environment: leave blank

No `NPM_TOKEN` GitHub secret is needed. To publish, update the root and package
versions, run `npm run release:check`, push the commit, then publish a GitHub
Release whose tag matches the version, such as `v0.3.0`. A rerun skips package
versions that already exist on npm.
