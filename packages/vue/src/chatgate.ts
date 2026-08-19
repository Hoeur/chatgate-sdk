import { computed, defineComponent, h } from "vue";
import { createChatGateClient } from "@chatgate/core";
import { ChatGateMessenger, chatGateMessengerProps } from "./messenger.js";
import { ChatGateProvider } from "./provider.js";

/**
 * Single-component entry point: creates the client from a publishable key and
 * renders the messenger inside its own provider. Use `ChatGateProvider` or
 * `createChatGatePlugin` when the app needs the client for anything else.
 */
export const ChatGate = defineComponent({
  name: "ChatGate",
  props: {
    ...chatGateMessengerProps,
    /** Browser-safe publishable key. Never a cg_live_ key. */
    publicKey: { type: String, required: true },
    organizationId: String,
    userId: String,
    userName: String,
    /** HMAC produced by your server for a verified signed-in user. */
    userHash: String,
    baseUrl: { type: String, default: "https://api.chat-gate.com" },
    socketUrl: String,
    channel: String,
    roomId: String,
    businessUnitExternalId: String,
    autoStart: { type: Boolean, default: true },
    stopOnUnmount: { type: Boolean, default: true },
  } as const,
  setup(props, { slots }) {
    const client = computed(() => createChatGateClient({
      baseUrl: props.baseUrl,
      publicKey: props.publicKey,
      ...(props.organizationId ? { organizationId: props.organizationId } : {}),
      ...(props.userId ? { userId: props.userId } : {}),
      ...(props.userName ? { userName: props.userName } : {}),
      ...(props.userHash ? { userHash: props.userHash } : {}),
      ...(props.socketUrl ? { socketUrl: props.socketUrl } : {}),
      ...(props.channel ? { channel: props.channel } : {}),
      ...(props.roomId ? { roomId: props.roomId } : {}),
      ...(props.businessUnitExternalId
        ? { businessUnitExternalId: props.businessUnitExternalId }
        : {}),
    }));

    const messengerProps = computed(() => ({
      showConversationList: props.showConversationList,
      showSearch: props.showSearch,
      header: props.header,
      title: props.title,
      placeholder: props.placeholder,
      allowAttachments: props.allowAttachments,
      allowVoice: props.allowVoice,
      maxFileSizeBytes: props.maxFileSizeBytes,
      showRoleBadge: props.showRoleBadge,
      ...(props.conversationId ? { conversationId: props.conversationId } : {}),
      ...(props.greeting ? { greeting: props.greeting } : {}),
      ...(props.acceptedFileTypes ? { acceptedFileTypes: props.acceptedFileTypes } : {}),
      ...(props.renderMessage ? { renderMessage: props.renderMessage } : {}),
      ...(props.emptyState ? { emptyState: props.emptyState } : {}),
      ...(props.roleLabels ? { roleLabels: props.roleLabels } : {}),
      ...(props.theme ? { theme: props.theme } : {}),
      ...(props.labels ? { labels: props.labels } : {}),
    }));

    return () => h(
      ChatGateProvider,
      {
        client: client.value,
        autoStart: props.autoStart,
        stopOnUnmount: props.stopOnUnmount,
      },
      {
        default: () => h(ChatGateMessenger, messengerProps.value),
        ...(slots.fallback ? { fallback: slots.fallback } : {}),
      },
    );
  },
});
