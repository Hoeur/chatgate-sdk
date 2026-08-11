# `@chatgate/react-native`

React Native and Expo bindings for `@chatgate/core`.

```tsx
import { createChatGateClient } from "@chatgate/core";
import { ChatGateMessenger, ChatGateProvider } from "@chatgate/react-native";

const client = createChatGateClient({
  baseUrl: "https://api.chat-gate.com",
  sessionProvider: () =>
    fetch(`${YOUR_API}/chatgate/mobile-session`, {
      method: "POST",
      headers: { Authorization: `Bearer ${yourAppToken}` },
    }).then((response) => response.json()),
});

export function SupportScreen() {
  return (
    <ChatGateProvider client={client}>
      <ChatGateMessenger mediaAdapter={yourExpoMediaAdapter} />
    </ChatGateProvider>
  );
}
```

The package handles AppState disconnect/reconnect and accepts host-provided media
and push adapters so applications may choose Expo modules or bare React Native
native modules. Subscription keys and HMAC secrets must remain on the application
server.

The bundled native conversation UI supports history, text, image/file/voice
assets supplied by the media adapter, replies, reactions, typing, presence, read
receipts, reconnect/resync, and realtime merchant messages. For custom native
rendering, `useChatGateConversationList()` exposes merchant list/detail and
business switching, while `useChatGateConversation()` exposes one thread.
