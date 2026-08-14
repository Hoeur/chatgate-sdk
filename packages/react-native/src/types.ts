import type { ChatGateMessageType, ChatGateSession } from "@chatgate/core";

export interface ChatGateNativeAsset {
  uri: string;
  name: string;
  mimeType: string;
  messageType: Exclude<ChatGateMessageType, "text" | "encrypted">;
}

/** Handle returned by playVoice so the caller can halt playback. */
export interface ChatGateAudioController {
  /** Stop playback and release the audio resource. */
  stop(): Promise<void> | void;
}

export interface ChatGateMediaAdapter {
  pickAttachment(): Promise<ChatGateNativeAsset | null>;
  recordVoice?(): Promise<ChatGateNativeAsset | null>;
  /**
   * Play a remote audio clip in-app (e.g. via expo-av). Resolve with a
   * controller whose stop() halts playback; call callbacks.onFinish when the
   * clip finishes on its own. If omitted, voice messages fall back to opening
   * the file URL externally.
   */
  playVoice?(
    uri: string,
    callbacks?: { onFinish?: () => void },
  ): Promise<ChatGateAudioController>;
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
