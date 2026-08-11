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
read receipts. Its first screen lists all existing merchant conversations and
unread counts, plus every available business the customer can start a chat
with. Selecting a merchant opens that thread; the header back button returns to
the list. Appearance and composer behavior can be changed with props such as
`title`, `className`, `style`, `allowAttachments`, and `allowVoice`.

Set `showConversationList={false}` to preserve a single-thread view, or pass a
specific `conversationId`. Advanced applications can import
`ChatGateMessenger`, `useChatGateConversationList()`, or the single-thread
`ChatGateConversation` directly.

## Custom authentication or UI

Advanced applications can create a core client with `sessionProvider`, mount it
with `<ChatGateProvider>`, and use the packaged messenger or composable hooks for
a custom interface.
