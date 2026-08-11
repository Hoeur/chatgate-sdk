# `@chatgate/react`

React and Next.js bindings for `@chatgate/core`.

## Simple integration

```tsx
import { ChatGate } from "@chatgate/react";

export default function SupportPage() {
  return (
    <ChatGate
      publicKey="cg_pub_..."
      organizationId="your-organization-id"
      userId="customer-1234"
      userName="Customer"
    />
  );
}
```

The publishable key and organization ID are safe client configuration. Never
include a `cg_live_` key or embed HMAC secret in a browser bundle. Register the
website's exact origin in ChatGate Developer Access before connecting.

`<ChatGate />` includes history, realtime messages, text, image/file uploads,
browser voice recording, replies, reactions, edit/delete, typing, presence, and
read receipts. Appearance and composer behavior can be changed with props such
as `title`, `className`, `style`, `allowAttachments`, and `allowVoice`.

## Custom authentication or UI

Advanced applications can create a core client with `sessionProvider`, mount it
with `<ChatGateProvider>`, and use `<ChatGateConversation>` or
`useChatGateConversation()` for a custom interface.
