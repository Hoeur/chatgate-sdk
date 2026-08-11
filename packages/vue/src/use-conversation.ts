import {
  onMounted,
  onUnmounted,
  shallowReadonly,
  shallowRef,
  toValue,
  watch,
  type MaybeRefOrGetter,
  type ShallowRef,
} from "vue";
import {
  createChatGateConversationController,
  type ChatGateConversationController,
  type ChatGateConversationState,
} from "@chatgate/core";
import { useChatGate } from "./plugin.js";

export interface UseChatGateConversationResult {
  controller: ChatGateConversationController;
  state: Readonly<ShallowRef<ChatGateConversationState>>;
}

export function useChatGateConversation(
  conversationId?: MaybeRefOrGetter<string | undefined>,
): UseChatGateConversationResult {
  const client = useChatGate();
  const controller = createChatGateConversationController(
    client,
    conversationId === undefined ? undefined : toValue(conversationId),
  );
  const state = shallowRef(controller.getSnapshot());
  const unsubscribe = controller.subscribe(() => {
    state.value = controller.getSnapshot();
  });

  if (conversationId !== undefined) {
    watch(
      () => toValue(conversationId),
      (nextId) => {
        if (nextId) void controller.setConversation(nextId);
      },
    );
  }

  onMounted(() => void controller.start());
  onUnmounted(() => {
    unsubscribe();
    controller.stop();
  });

  return { controller, state: shallowReadonly(state) };
}
