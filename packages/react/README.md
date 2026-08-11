# `@chatgate/react`

React and Next.js bindings for `@chatgate/core`.

```tsx
"use client";

import { createChatGateClient } from "@chatgate/core";
import { ChatGateConversation, ChatGateProvider } from "@chatgate/react";

const client = createChatGateClient({
  baseUrl: "https://api.chat-gate.com",
  sessionProvider: () =>
    fetch("/api/chatgate/session", { method: "POST" }).then((response) => {
      if (!response.ok) throw new Error("Chat session failed");
      return response.json();
    }),
});

export function SupportChat() {
  return (
    <ChatGateProvider client={client} fallback={<p>Connecting…</p>}>
      <ChatGateConversation
        title="Support"
        allowAttachments
        allowVoice
        acceptedFileTypes="image/*,audio/*,.pdf,.doc,.docx"
      />
    </ChatGateProvider>
  );
}
```

Create the client in a client-only module and never include `cg_live_` or the
embed HMAC secret in a Next.js client bundle.

The packaged conversation UI includes history pagination, text, image/file
upload, browser voice recording, replies, reactions, edit/delete actions,
typing, presence, read receipts, reconnect/resync, and merchant realtime
messages. Use `useChatGateConversation()` when your product needs a custom UI;
the returned controller exposes the same feature set.
