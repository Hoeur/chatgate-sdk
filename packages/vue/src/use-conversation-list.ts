import {
  onMounted,
  onUnmounted,
  shallowReadonly,
  shallowRef,
  type ShallowRef,
} from "vue";
import {
  createChatGateConversationListController,
  type ChatGateConversationListController,
  type ChatGateConversationListState,
} from "@chatgate/core";
import { useChatGate } from "./plugin.js";

export interface UseChatGateConversationListResult {
  controller: ChatGateConversationListController;
  state: Readonly<ShallowRef<ChatGateConversationListState>>;
}

export function useChatGateConversationList(): UseChatGateConversationListResult {
  const client = useChatGate();
  const controller = createChatGateConversationListController(client);
  const state = shallowRef(controller.getSnapshot());
  const unsubscribe = controller.subscribe(() => {
    state.value = controller.getSnapshot();
  });

  onMounted(() => void controller.start());
  onUnmounted(() => {
    unsubscribe();
    controller.stop();
  });

  return { controller, state: shallowReadonly(state) };
}
