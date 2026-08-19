# `@chatgate/vue`

Vue 3 bindings for `@chatgate/core`.

```ts
import { createApp } from "vue";
import { createChatGateClient } from "@chatgate/core";
import { createChatGatePlugin } from "@chatgate/vue";

const client = createChatGateClient({
  baseUrl: "https://api.chat-gate.com",
  sessionProvider: () => fetch("/api/chatgate/session", { method: "POST" }).then((response) => response.json()),
});

createApp(App).use(createChatGatePlugin({ client })).mount("#app");
```

Then render `<ChatGateMessenger title="Support" />` for the full merchant list
and conversation flow. Use `<ChatGateConversation>` for one thread,
`useChatGateConversationList()` for custom list/detail navigation, or
`useChatGateConversation()` for a custom conversation interface.

## Drop-in widget

`<ChatGate>` creates the client for you from a publishable key:

```ts
import { ChatGate } from "@chatgate/vue";

h(ChatGate, { publicKey: "cg_pk_…", userId: "customer-42", title: "Support" });
```

For a client scoped to one subtree (instead of `app.use(...)`), use
`<ChatGateProvider :client="client">`; it accepts a `fallback` slot rendered
until the first session arrives, and `useChatGateConnection()` exposes its
`status`/`error` refs.

## Theming and copy

Pass `theme` to `<ChatGateMessenger>` or `<ChatGateConversation>` instead of
hand-writing CSS variables — the tokens compile to the same `--cg-*` custom
properties:

```ts
h(ChatGateMessenger, {
  theme: { accentColor: "#7c3aed", borderRadius: 12, fontFamily: "Inter" },
  labels: { searchPlaceholder: "Rechercher", noConversations: "Aucune conversation" },
});
```

`labels` overrides the conversation-list copy, `roleLabels` the role badges, and
`emptyState` replaces the built-in "no messages yet" panel.

The packaged Vue component supports history, text, images/files, browser voice
recording, replies, reactions, typing, presence, read receipts, edits/deletes,
realtime merchant messages, all merchant histories, unread counts, available
businesses, and business-unit switching.
