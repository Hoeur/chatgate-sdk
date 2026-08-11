"use client";

import { createContext, useContext } from "react";
import type { ChatGateClient } from "@chatgate/core";

export type ChatGateConnectionStatus = "idle" | "connecting" | "connected" | "disconnected" | "error";

export interface ChatGateReactContextValue {
  client: ChatGateClient;
  status: ChatGateConnectionStatus;
  error: Error | undefined;
}

export const ChatGateReactContext = createContext<ChatGateReactContextValue | undefined>(undefined);

export function useChatGate(): ChatGateReactContextValue {
  const context = useContext(ChatGateReactContext);
  if (!context) throw new Error("useChatGate must be used inside ChatGateProvider");
  return context;
}
