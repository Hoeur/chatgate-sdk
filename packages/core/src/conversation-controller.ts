import type { ChatGateClient } from "./client.js";
import { ChatGateError } from "./errors.js";
import type {
  ChatGateConversationState,
  ChatGateMessage,
  ChatGateMessageReactionsEvent,
  ChatGateSendMessageInput,
  ChatGateTypingEvent,
  ChatGateUploadFile,
  ChatGateUploadResult,
} from "./types.js";

export type ChatGateConversationSubscriber = () => void;

function appendUnique(messages: ChatGateMessage[], message: ChatGateMessage): ChatGateMessage[] {
  const index = messages.findIndex((item) => item.id === message.id);
  if (index < 0) return [...messages, message];
  const next = [...messages];
  next[index] = message;
  return next;
}

function prependUnique(messages: ChatGateMessage[], older: ChatGateMessage[]): ChatGateMessage[] {
  const existing = new Set(messages.map((message) => message.id));
  return [...older.filter((message) => !existing.has(message.id)), ...messages];
}

function replaceMessage(
  messages: ChatGateMessage[],
  messageId: string,
  update: (message: ChatGateMessage) => ChatGateMessage,
): ChatGateMessage[] {
  return messages.map((message) => message.id === messageId ? update(message) : message);
}

function updateTypingUsers(
  typingUsers: ChatGateTypingEvent[],
  event: ChatGateTypingEvent,
): ChatGateTypingEvent[] {
  const withoutUser = typingUsers.filter((item) => item.userId !== event.userId);
  return event.isTyping ? [...withoutUser, event] : withoutUser;
}

function normalizeError(error: unknown): Error {
  return error instanceof Error
    ? error
    : new ChatGateError("CONVERSATION_FAILED", "ChatGate conversation operation failed", {
        details: error,
      });
}

export class ChatGateConversationController {
  private readonly client: ChatGateClient;
  private readonly subscribers = new Set<ChatGateConversationSubscriber>();
  private state: ChatGateConversationState;
  private cleanups: Array<() => void> = [];
  private started = false;
  private loadSequence = 0;

  constructor(client: ChatGateClient, conversationId?: string) {
    this.client = client;
    this.state = {
      ...(conversationId ? { conversationId } : {}),
      messages: [],
      onlineUserIds: [],
      typingUsers: [],
      loading: false,
      loadingOlder: false,
      sending: false,
      uploading: false,
      error: undefined,
    };
  }

  getSnapshot = (): ChatGateConversationState => this.state;

  subscribe = (subscriber: ChatGateConversationSubscriber): (() => void) => {
    this.subscribers.add(subscriber);
    return () => this.subscribers.delete(subscriber);
  };

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    this.cleanups = [
      this.client.on("message", (message) => {
        const activeId = this.state.conversationId ?? this.client.conversationId;
        if (message.inboxConversationId !== activeId) return;
        this.patch({
          messages: appendUnique(this.state.messages, message),
          typingUsers: this.state.typingUsers.filter((item) => item.userId !== message.senderId),
        });
        if (message.receiverId === this.client.session?.userId) {
          void this.markRead().catch(() => undefined);
        }
      }),
      this.client.on("messageUpdated", (message) => {
        this.patch({
          messages: replaceMessage(this.state.messages, message.id, () => message),
        });
      }),
      this.client.on("messageDeleted", ({ messageId }) => {
        this.patch({ messages: this.state.messages.filter((message) => message.id !== messageId) });
      }),
      this.client.on("messageReactions", (event) => {
        this.applyReactions(event);
      }),
      this.client.on("typing", (event) => {
        if (event.userId === this.client.session?.userId) return;
        this.patch({ typingUsers: updateTypingUsers(this.state.typingUsers, event) });
      }),
      this.client.on("presence", ({ userIds }) => {
        this.patch({ onlineUserIds: userIds });
      }),
      this.client.on("read", ({ readerId, senderId }) => {
        if (senderId !== this.client.session?.userId) return;
        this.patch({
          messages: this.state.messages.map((message) =>
            message.senderId === senderId && message.receiverId === readerId
              ? { ...message, read: true }
              : message,
          ),
        });
      }),
      this.client.on("resync", () => {
        void this.reload();
      }),
      this.client.on("embedReady", ({ conversationId }) => {
        if (!this.state.conversationId) {
          this.patch({ conversationId });
          void this.reload();
        }
      }),
    ];
    await this.reload();
  }

  stop(): void {
    this.setTyping(false);
    this.started = false;
    this.loadSequence += 1;
    for (const cleanup of this.cleanups) cleanup();
    this.cleanups = [];
  }

  async setConversation(conversationId: string): Promise<void> {
    const normalized = conversationId.trim();
    if (!normalized) throw new ChatGateError("CONVERSATION_REQUIRED", "conversationId is required");
    if (normalized === this.state.conversationId && this.state.thread) return;
    this.state = {
      conversationId: normalized,
      messages: [],
      onlineUserIds: this.state.onlineUserIds,
      typingUsers: [],
      loading: false,
      loadingOlder: false,
      sending: false,
      uploading: false,
      error: undefined,
    };
    this.notify();
    await this.reload();
  }

  async reload(): Promise<void> {
    const conversationId = this.state.conversationId ?? this.client.conversationId;
    if (!conversationId) {
      this.patch({
        loading: false,
        error: new ChatGateError("CONVERSATION_REQUIRED", "No active ChatGate conversation is available"),
      });
      return;
    }
    const sequence = ++this.loadSequence;
    this.patch({ loading: true, error: undefined, conversationId });
    try {
      const thread = await this.client.getConversation(conversationId);
      if (sequence !== this.loadSequence) return;
      this.patch({ thread, messages: thread.messages, loading: false });
      void this.markRead().catch(() => undefined);
    } catch (error) {
      if (sequence !== this.loadSequence) return;
      this.patch({ loading: false, error: normalizeError(error) });
    }
  }

  async loadOlder(): Promise<void> {
    const conversationId = this.state.conversationId ?? this.client.conversationId;
    const cursor = this.state.thread?.nextCursor;
    if (!conversationId || !cursor || this.state.loadingOlder) return;
    this.patch({ loadingOlder: true, error: undefined });
    try {
      const page = await this.client.getConversation(conversationId, { cursor });
      this.patch({
        thread: this.state.thread
          ? {
              ...this.state.thread,
              ...(page.nextCursor !== undefined ? { nextCursor: page.nextCursor } : {}),
            }
          : page,
        messages: prependUnique(this.state.messages, page.messages),
        loadingOlder: false,
      });
    } catch (error) {
      this.patch({ loadingOlder: false, error: normalizeError(error) });
    }
  }

  async sendMessage(input: ChatGateSendMessageInput): Promise<ChatGateMessage> {
    this.patch({ sending: true, error: undefined });
    try {
      const conversationId = input.conversationId ?? this.state.conversationId;
      const message = await this.client.sendMessage({
        ...input,
        ...(conversationId ? { conversationId } : {}),
      });
      this.setTyping(false);
      this.patch({ messages: appendUnique(this.state.messages, message), sending: false });
      return message;
    } catch (error) {
      const normalized = normalizeError(error);
      this.patch({ sending: false, error: normalized });
      throw normalized;
    }
  }

  async uploadAndSend(
    file: ChatGateUploadFile,
    input: Omit<ChatGateSendMessageInput, "fileUrl" | "fileName" | "fileMimeType" | "fileSize" | "fileDurationMs"> = {},
  ): Promise<{ upload: ChatGateUploadResult; message: ChatGateMessage }> {
    this.patch({ sending: true, uploading: true, error: undefined });
    try {
      const conversationId = input.conversationId ?? this.state.conversationId;
      const result = await this.client.uploadAndSend(file, {
        ...input,
        ...(conversationId ? { conversationId } : {}),
      });
      this.setTyping(false);
      this.patch({
        messages: appendUnique(this.state.messages, result.message),
        sending: false,
        uploading: false,
      });
      return result;
    } catch (error) {
      const normalized = normalizeError(error);
      this.patch({ sending: false, uploading: false, error: normalized });
      throw normalized;
    }
  }

  setTyping(isTyping: boolean): void {
    const receiverId = this.state.thread?.assigneeId ?? this.state.thread?.createdBy?.id;
    if (typeof receiverId === "string") this.client.setTyping(receiverId, isTyping);
  }

  async markRead(): Promise<number> {
    const receiverId = this.state.thread?.assigneeId ?? this.state.thread?.createdBy?.id;
    if (typeof receiverId !== "string") return 0;
    const result = await this.client.markRead(receiverId);
    return result.read;
  }

  async toggleReaction(messageId: string, emoji: string): Promise<void> {
    const result = await this.client.toggleReaction(messageId, emoji);
    this.applyReactions(result);
  }

  async editMessage(messageId: string, content: string): Promise<ChatGateMessage> {
    const message = await this.client.editMessage(messageId, content);
    this.patch({ messages: replaceMessage(this.state.messages, messageId, () => message) });
    return message;
  }

  async deleteMessage(messageId: string): Promise<void> {
    await this.client.deleteMessage(messageId);
    this.patch({ messages: this.state.messages.filter((message) => message.id !== messageId) });
  }

  clearError(): void {
    if (this.state.error) this.patch({ error: undefined });
  }

  private applyReactions(event: ChatGateMessageReactionsEvent): void {
    this.patch({
      messages: replaceMessage(this.state.messages, event.messageId, (message) => ({
        ...message,
        reactions: event.reactions,
      })),
    });
  }

  private patch(patch: Partial<ChatGateConversationState>): void {
    this.state = { ...this.state, ...patch };
    this.notify();
  }

  private notify(): void {
    for (const subscriber of this.subscribers) subscriber();
  }
}

export function createChatGateConversationController(
  client: ChatGateClient,
  conversationId?: string,
): ChatGateConversationController {
  return new ChatGateConversationController(client, conversationId);
}
