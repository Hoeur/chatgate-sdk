import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AppState, type AppStateStatus } from "react-native";
import type { ChatGateClient } from "@chatgate/core";
import { ChatGateNativeContext, type ChatGateNativeStatus } from "./context.js";
import type { ChatGatePushAdapter } from "./types.js";

export interface ChatGateProviderProps {
  client: ChatGateClient;
  children: ReactNode;
  autoStart?: boolean;
  disconnectOnBackground?: boolean;
  stopOnUnmount?: boolean;
  pushAdapter?: ChatGatePushAdapter;
  fallback?: ReactNode;
}

export function ChatGateProvider({
  client,
  children,
  autoStart = true,
  disconnectOnBackground = true,
  stopOnUnmount = true,
  pushAdapter,
  fallback,
}: ChatGateProviderProps) {
  const [status, setStatus] = useState<ChatGateNativeStatus>(
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

    async function start() {
      if (!active) return;
      setStatus("connecting");
      try {
        const session = await client.start();
        if (pushAdapter) {
          const token = await pushAdapter.getToken();
          if (token) await pushAdapter.registerToken(token, session);
        }
      } catch (cause) {
        if (!active) return;
        setStatus("error");
        setError(cause instanceof Error ? cause : new Error("ChatGate failed to start"));
      }
    }

    function handleAppState(nextState: AppStateStatus) {
      if (nextState === "active") void start();
      else if (disconnectOnBackground) {
        client.stop();
        if (active) setStatus("background");
      }
    }

    const appStateSubscription = AppState.addEventListener("change", handleAppState);
    if (autoStart) void start();

    return () => {
      active = false;
      appStateSubscription.remove();
      for (const cleanup of cleanups) cleanup();
      if (stopOnUnmount) client.stop();
    };
  }, [autoStart, client, disconnectOnBackground, pushAdapter, stopOnUnmount]);

  const value = useMemo(() => ({ client, status, error }), [client, status, error]);
  if (fallback !== undefined && status === "connecting" && !client.session) return fallback;
  return <ChatGateNativeContext.Provider value={value}>{children}</ChatGateNativeContext.Provider>;
}
