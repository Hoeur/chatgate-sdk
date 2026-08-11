import { useEffect, useMemo, useSyncExternalStore } from "react";
import {
  createChatGateConversationListController,
  type ChatGateConversationListController,
} from "@chatgate/core";
import { useChatGate } from "./context.js";

export interface UseChatGateConversationListResult {
  controller: ChatGateConversationListController;
  state: ReturnType<ChatGateConversationListController["getSnapshot"]>;
}

export function useChatGateConversationList(): UseChatGateConversationListResult {
  const { client } = useChatGate();
  const controller = useMemo(
    () => createChatGateConversationListController(client),
    [client],
  );
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );

  useEffect(() => {
    void controller.start();
    return () => controller.stop();
  }, [controller]);

  return { controller, state };
}
