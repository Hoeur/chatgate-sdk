import type { ChatGateMessageType, ChatGateSession } from "@chatgate/core";

export interface ChatGateNativeAsset {
  uri: string;
  name: string;
  mimeType: string;
  messageType: Exclude<ChatGateMessageType, "text" | "encrypted">;
}

export interface ChatGateMediaAdapter {
  pickAttachment(): Promise<ChatGateNativeAsset | null>;
  recordVoice?(): Promise<ChatGateNativeAsset | null>;
}

export interface ChatGatePushToken {
  token: string;
  platform: "ios" | "android";
  provider: "apns" | "fcm" | "expo";
}

export interface ChatGatePushAdapter {
  getToken(): Promise<ChatGatePushToken | null>;
  registerToken(token: ChatGatePushToken, session: ChatGateSession): Promise<void>;
}
