# ChatGate Next.js sample

A standalone consumer project that installs the local ChatGate 0.2 package
sources while the release is being verified. After publishing 0.2, replace the
file dependencies with normal npm versions.

The sample is configured for this live customer integration:

- API and Socket.IO host: `https://api.chat-gate.com`
- Publishable key: `cg_pub_z1lzc3otAHo_jWq0fFq8CDEV`
- Organization: `cmsesv871000cro1lf82msw20`
- Customer: `customer-1234` (`Customer`)
- Channel: `WEB_WIDGET`

The application-owned `POST /api/chatgate/session` route exchanges the public
key for a short-lived visitor token while forwarding the exact browser origin
to ChatGate. Never add a `cg_live_` key or embed HMAC secret to
`NEXT_PUBLIC_*` variables.

## Run

```bash
npm install
npm run dev
```

Open <http://127.0.0.1:3000>. Test text, image, document, browser voice
recording, reply, reaction, edit/delete, and a live agent response.

Before running, add this exact origin under **ChatGate Settings → Developer
access → Allowed embed domains**:

```text
http://127.0.0.1:3000
```

Origins are exact, so `http://localhost:3000` is a separate entry from
`http://127.0.0.1:3000`.

## Verify

```bash
npm run verify
```

Override the defaults with `NEXT_PUBLIC_CHATGATE_URL`, `CHATGATE_API_URL`,
`CHATGATE_PUBLIC_KEY`, `CHATGATE_ORG_ID`, `CHATGATE_USER_ID`, and
`CHATGATE_USER_NAME`.

This sample intentionally mirrors the public-key widget flow and treats
`customer-1234` as an anonymous stable visitor. For a verified signed-in
customer, compute `userHash = HMAC_SHA256(embedSecret, externalUserId)` in an
application-owned server endpoint; never compute or expose that secret here.
