# ChatGate Next.js sample

The customer integration is one component:

```tsx
import { ChatGate } from "@chatgate/react";

<ChatGate
  publicKey="cg_pub_z1lzc3otAHo_jWq0fFq8CDEV"
  organizationId="cmsesv871000cro1lf82msw20"
  userId="customer-1234"
  userName="Customer"
/>
```

No application API route or manually constructed session provider is required
for a publishable-key visitor. The library exchanges the key for a short-lived
session and manages Socket.IO, refresh, history, uploads, and conversation state.
The first screen lists all of the customer's merchant conversations and
available businesses, matching the embed-script chat flow.

The publishable key and organization ID are safe browser configuration. Never
put a `cg_live_` key or embed HMAC secret in client code. A verified signed-in
user hash must be produced by your server and can be passed as `userHash`.

## Run

Before running, register this exact origin under **ChatGate Settings -> Developer
access -> Allowed embed domains**:

```text
http://127.0.0.1:3000
```

Then run:

```bash
npm install
npm run dev
```

Open <http://127.0.0.1:3000>. Test text, image, document, browser voice
recording, replies, reactions, edit/delete, and a live merchant response.

```bash
npm run verify
```
