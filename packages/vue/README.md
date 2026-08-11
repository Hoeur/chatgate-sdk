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

Then render `<ChatGateConversation title="Support" />` or use
`useChatGateConversation()` to build a custom interface.

The packaged Vue component supports history, text, images/files, browser voice
recording, replies, reactions, typing, presence, read receipts, edits/deletes,
and realtime merchant messages. The composable exposes the same controller for
custom product UIs.
