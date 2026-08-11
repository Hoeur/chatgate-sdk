"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { ChatGateClient } from "@chatgate/core";
import {
  ChatGateReactContext,
  type ChatGateConnectionStatus,
} from "./context.js";

export interface ChatGateProviderProps {
  client: ChatGateClient;
  children: ReactNode;
  autoStart?: boolean;
  stopOnUnmount?: boolean;
  fallback?: ReactNode;
}

export function ChatGateProvider({
  client,
  children,
  autoStart = true,
  stopOnUnmount = true,
  fallback,
}: ChatGateProviderProps) {
  const [status, setStatus] = useState<ChatGateConnectionStatus>(
    client.connected ? "connected" : "idle",
  );
  const [error, setError] = useState<Error>();

  useEffect(() => {
    let active = true;
    const cleanups = [
      client.on("connected", () => {
        if (active) setStatus("connected");
      }),
      client.on("disconnected", () => {
        if (active) setStatus("disconnected");
      }),
      client.on("connectionError", (cause) => {
        if (!active) return;
        setStatus("error");
        setError(cause instanceof Error ? cause : new Error("ChatGate connection failed"));
      }),
      client.on("error", (nextError) => {
        if (!active) return;
        setStatus("error");
        setError(nextError);
      }),
    ];

    if (autoStart) {
      setStatus("connecting");
      void client.start().catch((cause: unknown) => {
        if (!active) return;
        setStatus("error");
        setError(cause instanceof Error ? cause : new Error("ChatGate failed to start"));
      });
    }

    return () => {
      active = false;
      for (const cleanup of cleanups) cleanup();
      if (stopOnUnmount) client.stop();
    };
  }, [autoStart, client, stopOnUnmount]);

  const value = useMemo(() => ({ client, status, error }), [client, status, error]);
  if (fallback !== undefined && status === "connecting" && !client.session) return fallback;
  return <ChatGateReactContext.Provider value={value}>{children}</ChatGateReactContext.Provider>;
}
