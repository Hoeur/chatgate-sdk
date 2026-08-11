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

The packaged Vue component supports history, text, images/files, browser voice
recording, replies, reactions, typing, presence, read receipts, edits/deletes,
realtime merchant messages, all merchant histories, unread counts, available
businesses, and business-unit switching.
