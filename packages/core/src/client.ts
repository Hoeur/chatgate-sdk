import { io } from "socket.io-client";
import { ChatGateError } from "./errors.js";
import { getJwtExpirationMs } from "./jwt.js";
import type {
  ChatGateClientOptions,
  ChatGateConversation,
  ChatGateConversationFilters,
  ChatGateConversationThread,
  ChatGateEventListener,
  ChatGateEventMap,
  ChatGateEventName,
  ChatGateFetch,
  ChatGateMessage,
  ChatGateMessageDeletedEvent,
  ChatGateMessageReactionsEvent,
  ChatGateRequestInit,
  ChatGateResponse,
  ChatGateSendMessageInput,
  ChatGateSession,
  ChatGateSessionContext,
  ChatGateSessionProvider,
  ChatGateSocket,
  ChatGateSocketFactory,
  ChatGateUploadFile,
  ChatGateUploadResult,
} from "./types.js";

type Listener = (value: unknown) => void;
const MAX_TIMER_DELAY_MS = 2_147_483_647;

function trimTrailingSlash(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function defaultFetch(url: string, init?: ChatGateRequestInit): Promise<ChatGateResponse> {
  const fetchFunction = (globalThis as { fetch?: ChatGateFetch }).fetch;
  if (!fetchFunction) {
    throw new ChatGateError(
      "FETCH_UNAVAILABLE",
      "This runtime has no fetch implementation. Pass options.fetch to createChatGateClient().",
    );
  }
  return fetchFunction(url, init);
}

function defaultSocketFactory(socketUrl: string, accessToken: string): ChatGateSocket {
  return io(socketUrl, {
    autoConnect: false,
    reconnection: true,
    reconnectionDelay: 1_000,
    auth: { token: accessToken },
  }) as unknown as ChatGateSocket;
}

function randomId(): string {
  const cryptoObject = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (cryptoObject?.randomUUID) return cryptoObject.randomUUID();
  return `cg_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function storedId(storage: Storage | undefined, key: string, prefix: string): string {
  try {
    const existing = storage?.getItem(key);
    if (existing) return existing;
    const generated = `${prefix}_${randomId()}`;
    storage?.setItem(key, generated);
    return generated;
  } catch {
    return `${prefix}_${randomId()}`;
  }
}

function browserStorage(name: "localStorage" | "sessionStorage"): Storage | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window[name];
  } catch {
    return undefined;
  }
}

function browserVisitorContext(): Record<string, string | number | undefined> {
  // React Native defines `window` but not `window.location` / `document`,
  // so a bare `typeof window` check is not enough to detect a real browser DOM.
  if (
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    typeof navigator === "undefined" ||
    !window.location
  ) {
    return {};
  }
  return {
    pageUrl: `${window.location.origin}${window.location.pathname}`,
    pageTitle: document.title,
    pageReferrer: document.referrer || undefined,
    browserTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    browserLanguage: navigator.language,
    browserPlatform: navigator.platform,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
  };
}

function createQuery(values: Record<string, string | number | undefined>): string {
  const entries = Object.entries(values).filter((entry): entry is [string, string | number] => entry[1] !== undefined);
  if (entries.length === 0) return "";
  return `?${entries.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`).join("&")}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function responseError(response: ChatGateResponse): Promise<ChatGateError> {
  let details: unknown;
  try {
    details = await response.json();
  } catch {
    try {
      details = await response.text();
    } catch {
      details = undefined;
    }
  }
  const code = isRecord(details) && typeof details.code === "string" ? details.code : "HTTP_ERROR";
  const message = isRecord(details) && typeof details.message === "string"
    ? details.message
    : `ChatGate request failed with status ${response.status}`;
  return new ChatGateError(code, message, { status: response.status, details });
}

export class ChatGateClient {
  readonly baseUrl: string;
  readonly socketUrl: string;

  private readonly sessionProvider: ChatGateSessionProvider;
  private readonly fetchFunction: ChatGateFetch;
  private readonly socketFactory: ChatGateSocketFactory;
  private readonly logger: ChatGateClientOptions["logger"];
  private readonly refreshLeewayMs: number;
  private readonly sendTimeoutMs: number;
  private readonly listeners = new Map<ChatGateEventName, Set<Listener>>();
  private sessionValue: ChatGateSession | undefined;
  private sessionPromise: Promise<ChatGateSession> | undefined;
  private sessionPromiseContext: ChatGateSessionContext | undefined;
  private socket: ChatGateSocket | undefined;
  private refreshTimer: ReturnType<typeof setTimeout> | undefined;
  private activeBusinessUnitExternalId?: string;
  private lastSocketRefreshAt = 0;

  constructor(options: ChatGateClientOptions) {
    if (!options.baseUrl.trim()) throw new ChatGateError("INVALID_CONFIG", "baseUrl is required");
    this.baseUrl = trimTrailingSlash(options.baseUrl);
    this.socketUrl = trimTrailingSlash(options.socketUrl ?? options.baseUrl);
    this.fetchFunction = options.fetch ?? defaultFetch;
    this.sessionProvider = options.sessionProvider ?? this.createPublicKeySessionProvider(options);
    this.socketFactory = options.socketFactory ?? defaultSocketFactory;
    this.logger = options.logger;
    this.refreshLeewayMs = options.refreshLeewayMs ?? 60_000;
    this.sendTimeoutMs = options.sendTimeoutMs ?? 15_000;
  }

  private createPublicKeySessionProvider(
    options: ChatGateClientOptions,
  ): NonNullable<ChatGateClientOptions["sessionProvider"]> {
    const publicKey = options.publicKey?.trim();
    if (!publicKey) {
      throw new ChatGateError(
        "INVALID_CONFIG",
        "Provide publicKey for a browser embed session or sessionProvider for custom authentication",
      );
    }

    const userId = options.userId?.trim() || storedId(
      browserStorage("localStorage"),
      `chatgate:visitor:${publicKey}`,
      "visitor",
    );
    const visitorSessionId = storedId(
      browserStorage("sessionStorage"),
      `chatgate:session:${publicKey}`,
      "session",
    );
    const visitorEventId = `${visitorSessionId}:started`;

    return async ({ businessUnitExternalId }) => {
      const response = await this.fetchFunction(`${this.baseUrl}/api/gateway/embed/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicKey,
          organizationId: options.organizationId,
          roomId: options.roomId,
          businessUnitExternalId: businessUnitExternalId ?? options.businessUnitExternalId,
          channel: options.channel ?? "WEB_WIDGET",
          externalUserId: userId,
          name: options.userName,
          userHash: options.userHash,
          visitorSessionId,
          visitorEventId,
          ...browserVisitorContext(),
        }),
      });
      if (!response.ok) throw await responseError(response);
      return await response.json() as ChatGateSession;
    };
  }

  get session(): Readonly<ChatGateSession> | undefined {
    return this.sessionValue;
  }

  get connected(): boolean {
    return this.socket?.connected === true;
  }

  get conversationId(): string | undefined {
    return this.sessionValue?.conversationId;
  }

  on<K extends ChatGateEventName>(event: K, listener: ChatGateEventListener<K>): () => void {
    const listeners = this.listeners.get(event) ?? new Set<Listener>();
    listeners.add(listener as Listener);
    this.listeners.set(event, listeners);
    return () => this.off(event, listener);
  }

  off<K extends ChatGateEventName>(event: K, listener: ChatGateEventListener<K>): void {
    this.listeners.get(event)?.delete(listener as Listener);
  }

  async start(): Promise<ChatGateSession> {
    const session = await this.refreshSession(false);
    this.connectSocket(session);
    return session;
  }

  stop(): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = undefined;
    this.socket?.disconnect();
    this.socket = undefined;
  }

  async refreshSession(forceRefresh = true): Promise<ChatGateSession> {
    const context = {
      forceRefresh,
      ...(this.activeBusinessUnitExternalId
        ? { businessUnitExternalId: this.activeBusinessUnitExternalId }
        : {}),
    };
    if (this.sessionPromise) {
      const sameContext = this.sessionPromiseContext?.forceRefresh === false
        && context.forceRefresh === false
        && this.sessionPromiseContext.businessUnitExternalId === context.businessUnitExternalId;
      if (sameContext) return this.sessionPromise;
      await this.sessionPromise.catch(() => undefined);
      return this.refreshSession(forceRefresh);
    }
    if (!forceRefresh && this.sessionValue && !this.sessionNeedsRefresh(this.sessionValue)) {
      return this.sessionValue;
    }

    this.sessionPromiseContext = context;
    this.sessionPromise = this.sessionProvider(context)
      .then((session) => {
        this.validateSession(session);
        this.sessionValue = { ...session };
        this.scheduleRefresh(session);
        this.emit("session", session);
        if (this.socket) {
          this.socket.auth = { token: session.accessToken };
        }
        return session;
      })
      .catch((error: unknown) => {
        const normalized = error instanceof Error
          ? error
          : new ChatGateError("SESSION_FAILED", "ChatGate session provider failed", { details: error });
        this.emit("error", normalized);
        throw normalized;
      })
      .finally(() => {
        this.sessionPromise = undefined;
        this.sessionPromiseContext = undefined;
      });
    return this.sessionPromise;
  }

  async switchBusinessUnit(businessUnitExternalId: string): Promise<ChatGateSession> {
    const normalized = businessUnitExternalId.trim();
    if (!normalized) throw new ChatGateError("INVALID_BUSINESS_UNIT", "businessUnitExternalId is required");
    this.activeBusinessUnitExternalId = normalized;
    const session = await this.refreshSession(true);
    if (this.socket) {
      this.socket.disconnect();
      this.socket.auth = { token: session.accessToken };
      this.socket.connect();
    } else {
      this.connectSocket(session);
    }
    return session;
  }

  async listConversations(filters: ChatGateConversationFilters = {}): Promise<ChatGateConversation[]> {
    const query = createQuery({
      status: filters.status,
      businessUnitId: filters.businessUnitId,
    });
    return this.request<ChatGateConversation[]>(`/inbox/conversations${query}`);
  }

  async getConversation(
    conversationId = this.requireConversationId(),
    options: { cursor?: string; limit?: number } = {},
  ): Promise<ChatGateConversationThread> {
    const query = createQuery({ cursor: options.cursor, limit: options.limit ?? 50 });
    return this.request<ChatGateConversationThread>(
      `/inbox/conversations/${encodeURIComponent(conversationId)}${query}`,
    );
  }

  async sendMessage(input: ChatGateSendMessageInput): Promise<ChatGateMessage> {
    if (!input.content?.trim() && !input.fileUrl) {
      throw new ChatGateError("EMPTY_MESSAGE", "A message needs content or an uploaded file");
    }
    const session = await this.ensureSession();
    const socket = this.socket;
    if (!socket?.connected) {
      throw new ChatGateError("SOCKET_DISCONNECTED", "ChatGate realtime connection is not connected");
    }
    const conversationId = input.conversationId ?? session.conversationId;
    if (!conversationId) {
      throw new ChatGateError("CONVERSATION_REQUIRED", "No active ChatGate conversation is available");
    }
    const { conversationId: _ignoredConversationId, ...rest } = input;
    const payload = {
      ...rest,
      inboxConversationId: conversationId,
      messageType: input.messageType ?? "text",
      clientMessageId: input.clientMessageId ?? randomId(),
    };

    return new Promise<ChatGateMessage>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new ChatGateError("SEND_TIMEOUT", "ChatGate did not acknowledge the message in time"));
      }, this.sendTimeoutMs);
      const acknowledge = (result: unknown) => {
        clearTimeout(timeout);
        if (isRecord(result) && isRecord(result.message)) {
          resolve(result.message as unknown as ChatGateMessage);
          return;
        }
        const message = isRecord(result) && typeof result.message === "string"
          ? result.message
          : "ChatGate rejected the message";
        reject(new ChatGateError("SEND_REJECTED", message, { details: result }));
      };
      socket.emit("send_message", payload, acknowledge);
    });
  }

  async upload(file: ChatGateUploadFile): Promise<ChatGateUploadResult> {
    const FormDataConstructor = (globalThis as { FormData?: new () => { append(name: string, value: unknown, fileName?: string): void } }).FormData;
    if (!FormDataConstructor) {
      throw new ChatGateError("FORM_DATA_UNAVAILABLE", "This runtime has no FormData implementation");
    }
    const form = new FormDataConstructor();
    if (file.name) form.append("file", file.value, file.name);
    else form.append("file", file.value);
    return this.request<ChatGateUploadResult>("/uploads", {
      method: "POST",
      body: form,
    });
  }

  async uploadAndSend(
    file: ChatGateUploadFile,
    input: Omit<ChatGateSendMessageInput, "fileUrl" | "fileName" | "fileMimeType" | "fileSize" | "fileDurationMs"> = {},
  ): Promise<{ upload: ChatGateUploadResult; message: ChatGateMessage }> {
    const upload = await this.upload(file);
    const message = await this.sendMessage({
      ...input,
      fileUrl: upload.url,
      fileName: upload.fileName,
      fileMimeType: upload.mimeType,
      fileSize: upload.size,
      ...(upload.durationMs !== undefined ? { fileDurationMs: upload.durationMs } : {}),
    });
    return { upload, message };
  }

  setTyping(receiverId: string, isTyping: boolean): void {
    if (!receiverId.trim() || !this.socket?.connected) return;
    this.socket.emit(isTyping ? "dm_typing_start" : "dm_typing_stop", {
      receiverId,
    });
  }

  async markRead(receiverId: string): Promise<{ read: number }> {
    if (!receiverId.trim()) {
      throw new ChatGateError("RECIPIENT_REQUIRED", "receiverId is required");
    }
    return this.request<{ read: number }>(`/dm/${encodeURIComponent(receiverId)}/read`, {
      method: "POST",
    });
  }

  async toggleReaction(messageId: string, emoji: string): Promise<ChatGateMessageReactionsEvent> {
    if (!messageId.trim() || !emoji.trim()) {
      throw new ChatGateError("REACTION_REQUIRED", "messageId and emoji are required");
    }
    return this.request<ChatGateMessageReactionsEvent>(
      `/dm/messages/${encodeURIComponent(messageId)}/reactions`,
      { method: "POST", body: { emoji } },
    );
  }

  async editMessage(messageId: string, content: string): Promise<ChatGateMessage> {
    if (!messageId.trim() || !content.trim()) {
      throw new ChatGateError("MESSAGE_REQUIRED", "messageId and content are required");
    }
    return this.request<ChatGateMessage>(`/dm/messages/${encodeURIComponent(messageId)}`, {
      method: "PATCH",
      body: { content: content.trim() },
    });
  }

  async deleteMessage(messageId: string): Promise<void> {
    if (!messageId.trim()) {
      throw new ChatGateError("MESSAGE_REQUIRED", "messageId is required");
    }
    await this.request<void>(`/dm/messages/${encodeURIComponent(messageId)}`, {
      method: "DELETE",
    });
  }

  async request<T>(path: string, init: ChatGateRequestInit = {}): Promise<T> {
    return this.requestAttempt<T>(path, init, false);
  }

  private async requestAttempt<T>(
    path: string,
    init: ChatGateRequestInit,
    retried: boolean,
  ): Promise<T> {
    const session = await this.ensureSession();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${session.accessToken}`,
      "X-Organization-Id": session.organizationId,
      ...init.headers,
    };
    const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;
    let body = init.body;
    if (body !== undefined && !isFormData) {
      headers["Content-Type"] ??= "application/json";
      if (headers["Content-Type"].includes("application/json") && typeof body !== "string") {
        body = JSON.stringify(body);
      }
    }
    const response = await this.fetchFunction(`${this.baseUrl}/api${path}`, {
      ...init,
      headers,
      body,
    });
    if (response.status === 401 && !retried) {
      await this.refreshSession(true);
      return this.requestAttempt<T>(path, init, true);
    }
    if (!response.ok) throw await responseError(response);
    if (response.status === 204) return undefined as T;
    return await response.json() as T;
  }

  private async ensureSession(): Promise<ChatGateSession> {
    if (!this.sessionValue || this.sessionNeedsRefresh(this.sessionValue)) {
      return this.refreshSession(Boolean(this.sessionValue));
    }
    return this.sessionValue;
  }

  private connectSocket(session: ChatGateSession): void {
    if (this.socket) {
      this.socket.auth = { token: session.accessToken };
      if (!this.socket.connected) this.socket.connect();
      return;
    }
    const socket = this.socketFactory(this.socketUrl, session.accessToken);
    this.socket = socket;
    socket.on("connect", () => this.emit("connected", undefined));
    socket.on("disconnect", (reason) => {
      this.emit("disconnected", typeof reason === "string" ? { reason } : {});
    });
    socket.on("connect_error", (error) => {
      this.emit("connectionError", error);
      const now = Date.now();
      if (now - this.lastSocketRefreshAt < 10_000) return;
      this.lastSocketRefreshAt = now;
      void this.refreshSession(true)
        .then((nextSession) => {
          socket.auth = { token: nextSession.accessToken };
          if (!socket.connected) socket.connect();
        })
        .catch((refreshError: unknown) => this.logger?.warn?.("Socket session refresh failed", refreshError));
    });
    socket.on("embed_ready", (value) => {
      if (!isRecord(value) || typeof value.conversationId !== "string") return;
      if (this.sessionValue) this.sessionValue = { ...this.sessionValue, conversationId: value.conversationId };
      this.emit("embedReady", { conversationId: value.conversationId });
    });
    socket.on("new_dm", (value) => {
      if (!isRecord(value) || !isRecord(value.dm)) return;
      this.emit("message", value.dm as unknown as ChatGateMessage);
    });
    socket.on("dm_updated", (value) => {
      if (!isRecord(value) || !isRecord(value.dm)) return;
      this.emit("messageUpdated", value.dm as unknown as ChatGateMessage);
    });
    socket.on("dm_deleted", (value) => {
      if (!isRecord(value) || typeof value.messageId !== "string") return;
      this.emit("messageDeleted", value as unknown as ChatGateMessageDeletedEvent);
    });
    socket.on("dm_reactions", (value) => {
      if (!isRecord(value) || typeof value.messageId !== "string" || !Array.isArray(value.reactions)) return;
      this.emit("messageReactions", value as unknown as ChatGateMessageReactionsEvent);
    });
    socket.on("dm_typing", (value) => {
      if (!isRecord(value) || typeof value.userId !== "string" || typeof value.isTyping !== "boolean") return;
      this.emit("typing", {
        userId: value.userId,
        ...(typeof value.username === "string" ? { username: value.username } : {}),
        isTyping: value.isTyping,
      });
    });
    socket.on("presence_state", (value) => {
      if (!isRecord(value) || !Array.isArray(value.userIds)) return;
      this.emit("presence", { userIds: value.userIds.filter((id): id is string => typeof id === "string") });
    });
    socket.on("dm_read", (value) => {
      if (!isRecord(value) || typeof value.readerId !== "string" || typeof value.senderId !== "string") return;
      this.emit("read", { readerId: value.readerId, senderId: value.senderId });
    });
    socket.on("resync", (value) => {
      if (!isRecord(value) || typeof value.reason !== "string" || typeof value.missed !== "number") return;
      this.emit("resync", { reason: value.reason, missed: value.missed });
    });
    socket.connect();
  }

  private scheduleRefresh(session: ChatGateSession): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    const expiresAt = session.expiresAt ?? getJwtExpirationMs(session.accessToken);
    if (!expiresAt) return;
    const remaining = expiresAt - Date.now() - this.refreshLeewayMs;
    const delay = Math.min(MAX_TIMER_DELAY_MS, Math.max(5_000, remaining));
    this.refreshTimer = setTimeout(() => {
      if (expiresAt - Date.now() > this.refreshLeewayMs) {
        this.scheduleRefresh(session);
        return;
      }
      void this.refreshSession(true).catch((error: unknown) => {
        this.logger?.warn?.("Scheduled ChatGate session refresh failed", error);
      });
    }, delay);
    const nodeTimer = this.refreshTimer as unknown as { unref?: () => void };
    nodeTimer.unref?.();
  }

  private sessionNeedsRefresh(session: ChatGateSession): boolean {
    const expiresAt = session.expiresAt ?? getJwtExpirationMs(session.accessToken);
    return expiresAt !== undefined && expiresAt - Date.now() <= this.refreshLeewayMs;
  }

  private validateSession(session: ChatGateSession): void {
    if (!session.accessToken || !session.organizationId || !session.userId) {
      throw new ChatGateError(
        "INVALID_SESSION",
        "The session provider must return accessToken, organizationId, and userId",
        { details: session },
      );
    }
  }

  private requireConversationId(): string {
    const id = this.sessionValue?.conversationId;
    if (!id) throw new ChatGateError("CONVERSATION_REQUIRED", "No active ChatGate conversation is available");
    return id;
  }

  private emit<K extends ChatGateEventName>(event: K, value: ChatGateEventMap[K]): void {
    for (const listener of this.listeners.get(event) ?? []) {
      try {
        listener(value);
      } catch (error) {
        this.logger?.error?.(`ChatGate ${event} listener failed`, error);
      }
    }
  }
}

export function createChatGateClient(options: ChatGateClientOptions): ChatGateClient {
  return new ChatGateClient(options);
}
