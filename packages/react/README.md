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
read receipts. On desktop it renders a two-pane messenger with a searchable DM
history sidebar and the selected conversation detail. Narrow containers switch
to list/detail navigation automatically. The sidebar includes unread counts,
latest-message previews, timestamps, and every available business the customer
can start a chat with.

Customize branding, sizing, wording, and composer behavior with typed props:

```tsx
<ChatGate
  publicKey="cg_pub_..."
  organizationId="your-organization-id"
  userId="customer-1234"
  title="Acme Care"
  sidebarWidth={340}
  labels={{ conversations: "Your chats", businesses: "New message" }}
  theme={{
    accentColor: "#7c3aed",
    accentHoverColor: "#6d28d9",
    surfaceColor: "#ffffff",
    canvasColor: "#f8fafc",
    borderRadius: 24,
  }}
  style={{ width: "100%", height: 680 }}
/>
```

`className`, `style`, `allowAttachments`, `allowVoice`,
`showBusinessDirectory`, and `renderMessage` provide additional control.

Set `showConversationList={false}` to preserve a single-thread view, or pass a
specific `conversationId`. Advanced applications can import
`ChatGateMessenger`, `useChatGateConversationList()`, or the single-thread
`ChatGateConversation` directly.

## Custom authentication or UI

Advanced applications can create a core client with `sessionProvider`, mount it
with `<ChatGateProvider>`, and use the packaged messenger or composable hooks for
a custom interface.
