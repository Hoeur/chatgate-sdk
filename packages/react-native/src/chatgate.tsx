import { useMemo, type ReactNode } from "react";
import { createChatGateClient } from "@chatgate/core";
import { ChatGateMessenger, type ChatGateMessengerProps } from "./messenger.js";
import { ChatGateProvider } from "./provider.js";

export interface ChatGateProps extends ChatGateMessengerProps {
  publicKey: string;
  organizationId?: string;
  userId?: string;
  userName?: string;
  userHash?: string;
  baseUrl?: string;
  socketUrl?: string;
  channel?: string;
  roomId?: string;
  businessUnitExternalId?: string;
  fallback?: ReactNode;
}

export function ChatGate({
  publicKey,
  organizationId,
  userId,
  userName,
  userHash,
  baseUrl = "https://api.chat-gate.com",
  socketUrl,
  channel,
  roomId,
  businessUnitExternalId,
  fallback,
  ...conversationProps
}: ChatGateProps) {
  const client = useMemo(
    () =>
      createChatGateClient({
        baseUrl,
        publicKey,
        ...(organizationId ? { organizationId } : {}),
        ...(userId ? { userId } : {}),
        ...(userName ? { userName } : {}),
        ...(userHash ? { userHash } : {}),
        ...(socketUrl ? { socketUrl } : {}),
        ...(channel ? { channel } : {}),
        ...(roomId ? { roomId } : {}),
        ...(businessUnitExternalId ? { businessUnitExternalId } : {}),
      }),
    [
      baseUrl,
      businessUnitExternalId,
      channel,
      organizationId,
      publicKey,
      roomId,
      socketUrl,
      userHash,
      userId,
      userName,
    ],
  );

  return (
    <ChatGateProvider client={client} fallback={fallback}>
      <ChatGateMessenger {...conversationProps} />
    </ChatGateProvider>
  );
}
