export {
  ChatGateVueKey,
  createChatGatePlugin,
  useChatGate,
  type ChatGateVuePluginOptions,
} from "./plugin.js";
export {
  ChatGateProvider,
  ChatGateConnectionKey,
  useChatGateConnection,
  type ChatGateConnectionStatus,
  type ChatGateVueConnection,
} from "./provider.js";
export { ChatGate } from "./chatgate.js";
export {
  useChatGateConversation,
  type UseChatGateConversationResult,
} from "./use-conversation.js";
export {
  useChatGateConversationList,
  type UseChatGateConversationListResult,
} from "./use-conversation-list.js";
export { ChatGateConversation, chatGateConversationProps } from "./conversation.js";
export {
  ChatGateMessenger,
  chatGateMessengerProps,
  type ChatGateMessengerLabels,
} from "./messenger.js";
export {
  createChatGateThemeVariables,
  type ChatGateTheme,
} from "./theme.js";
