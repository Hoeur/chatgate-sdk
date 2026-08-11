"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import {
  createChatGateConversationController,
  type ChatGateConversationController,
} from "@chatgate/core";
import { useChatGate } from "./context.js";

export interface UseChatGateConversationResult {
  controller: ChatGateConversationController;
  state: ReturnType<ChatGateConversationController["getSnapshot"]>;
}

export function useChatGateConversation(conversationId?: string): UseChatGateConversationResult {
  const { client } = useChatGate();
  const controller = useMemo(
    () => createChatGateConversationController(client, conversationId),
    [client, conversationId],
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
