import type { ChatGateMessageType, ChatGateSession } from "@chatgate/core";

export interface ChatGateNativeAsset {
  uri: string;
  name: string;
  mimeType: string;
  messageType: Exclude<ChatGateMessageType, "text" | "encrypted">;
  /** Size in bytes when the picker reports it, so the UI can enforce limits. */
  sizeBytes?: number;
}

/**
 * Limits configured on the component and forwarded to the picker. Adapters that
 * cannot apply them can ignore them: the component also rejects an asset whose
 * reported `sizeBytes` exceeds `maxFileSizeBytes`.
 */
export interface ChatGateAttachmentConstraints {
  /** MIME types or extensions, in the same shape as the web `accept` attribute. */
  acceptedFileTypes?: string;
  maxFileSizeBytes?: number;
}

/** Handle returned by playVoice so the caller can halt playback. */
export interface ChatGateAudioController {
  /** Stop playback and release the audio resource. */
  stop(): Promise<void> | void;
}

export interface ChatGateMediaAdapter {
  pickAttachment(
    constraints?: ChatGateAttachmentConstraints,
  ): Promise<ChatGateNativeAsset | null>;
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
