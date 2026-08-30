import { createContext, useContext } from "react";
import type { ChatGateClient } from "@chatgate/core";

export type ChatGateNativeStatus = "idle" | "connecting" | "connected" | "disconnected" | "background" | "error";

export interface ChatGateNativeContextValue {
  client: ChatGateClient;
  status: ChatGateNativeStatus;
  error: Error | undefined;
}

export const ChatGateNativeContext = createContext<ChatGateNativeContextValue | undefined>(undefined);

export function useChatGate(): ChatGateNativeContextValue {
  const value = useContext(ChatGateNativeContext);
  if (!value) throw new Error("useChatGate must be used inside ChatGateProvider");
  return value;
}
