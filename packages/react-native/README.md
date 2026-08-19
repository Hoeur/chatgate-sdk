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

## Composer and rendering options

`<ChatGateMessenger>` and `<ChatGateConversation>` accept the same composer
options as the web package:

```tsx
<ChatGateMessenger
  mediaAdapter={yourExpoMediaAdapter}
  allowVoice={false}
  acceptedFileTypes="image/*,application/pdf"
  maxFileSizeBytes={5 * 1024 * 1024}
  emptyState="Ask us anything"
  renderMessage={(message, own) => <YourBubble message={message} own={own} />}
/>
```

`acceptedFileTypes` and `maxFileSizeBytes` are passed to
`mediaAdapter.pickAttachment(constraints)`; adapters that cannot apply them may
ignore them, and the component still rejects an asset whose reported `sizeBytes`
exceeds the limit.

The bundled native conversation UI supports history, text, image/file/voice
assets supplied by the media adapter, replies, reactions, typing, presence, read
receipts, reconnect/resync, and realtime merchant messages. For custom native
rendering, `useChatGateConversationList()` exposes merchant list/detail and
business switching, while `useChatGateConversation()` exposes one thread.
