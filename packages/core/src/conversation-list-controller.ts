import type { ChatGateClient } from "./client.js";
import { ChatGateError } from "./errors.js";
import type {
  ChatGateBusinessUnit,
  ChatGateConversation,
  ChatGateMessage,
  ChatGateSession,
} from "./types.js";

export interface ChatGateConversationListState {
  conversations: ChatGateConversation[];
  businessUnits: ChatGateBusinessUnit[];
  selectedConversationId: string | undefined;
  loading: boolean;
  switching: boolean;
  error: Error | undefined;
}

export type ChatGateConversationListSubscriber = () => void;

function normalizeError(error: unknown): Error {
  return error instanceof Error
    ? error
    : new ChatGateError(
        "CONVERSATION_LIST_FAILED",
        "ChatGate conversation list operation failed",
        { details: error },
      );
}

function sessionBusinessUnits(session?: Readonly<ChatGateSession>): ChatGateBusinessUnit[] {
  return session?.businessUnits?.filter((unit) => unit.isActive !== false) ?? [];
}

function updateConversationFromMessage(
  conversation: ChatGateConversation,
  message: ChatGateMessage,
  currentUserId: string | undefined,
  selectedConversationId: string | undefined,
): ChatGateConversation {
  if (conversation.id !== message.inboxConversationId) return conversation;
  const isIncoming = message.senderId !== currentUserId;
  const isOpen = conversation.id === selectedConversationId;
  return {
    ...conversation,
    lastMessageAt: message.createdAt,
    messageCount: (conversation.messageCount ?? 0) + 1,
    unreadCount: isIncoming && !isOpen ? (conversation.unreadCount ?? 0) + 1 : 0,
  };
}

export class ChatGateConversationListController {
  private readonly client: ChatGateClient;
  private readonly subscribers = new Set<ChatGateConversationListSubscriber>();
  private state: ChatGateConversationListState;
  private cleanups: Array<() => void> = [];
  private started = false;
  private loadSequence = 0;

  constructor(client: ChatGateClient) {
    this.client = client;
    this.state = {
      conversations: [],
      businessUnits: sessionBusinessUnits(client.session),
      selectedConversationId: undefined,
      loading: false,
      switching: false,
      error: undefined,
    };
  }

  getSnapshot = (): ChatGateConversationListState => this.state;

  subscribe = (subscriber: ChatGateConversationListSubscriber): (() => void) => {
    this.subscribers.add(subscriber);
    return () => this.subscribers.delete(subscriber);
  };

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    this.cleanups = [
      this.client.on("session", (session) => {
        this.patch({ businessUnits: sessionBusinessUnits(session) });
      }),
      this.client.on("message", (message) => {
        const knownConversation = this.state.conversations.some(
          (conversation) => conversation.id === message.inboxConversationId,
        );
        if (!knownConversation) {
          void this.reload();
          return;
        }
        this.patch({
          conversations: this.state.conversations.map((conversation) =>
            updateConversationFromMessage(
              conversation,
              message,
              this.client.session?.userId,
              this.state.selectedConversationId,
            ),
          ),
        });
      }),
      this.client.on("resync", () => {
        void this.reload();
      }),
      this.client.on("embedReady", () => {
        void this.reload();
      }),
    ];
    await this.reload();
  }

  stop(): void {
    this.started = false;
    this.loadSequence += 1;
    for (const cleanup of this.cleanups) cleanup();
    this.cleanups = [];
  }

  async reload(): Promise<void> {
    const sequence = ++this.loadSequence;
    this.patch({ loading: true, error: undefined });
    try {
      const conversations = await this.client.listConversations();
      if (sequence !== this.loadSequence) return;
      this.patch({
        conversations,
        businessUnits: sessionBusinessUnits(this.client.session),
        loading: false,
      });
    } catch (error) {
      if (sequence !== this.loadSequence) return;
      this.patch({ loading: false, error: normalizeError(error) });
    }
  }

  selectConversation(conversationId: string): void {
    const normalized = conversationId.trim();
    if (!normalized) {
      throw new ChatGateError("CONVERSATION_REQUIRED", "conversationId is required");
    }
    this.patch({ selectedConversationId: normalized, error: undefined });
  }

  async showList(): Promise<void> {
    this.patch({ selectedConversationId: undefined, error: undefined });
    await this.reload();
  }

  async selectBusinessUnit(businessUnitExternalId: string): Promise<string | undefined> {
    const normalized = businessUnitExternalId.trim();
    if (!normalized) {
      throw new ChatGateError(
        "INVALID_BUSINESS_UNIT",
        "businessUnitExternalId is required",
      );
    }
    this.patch({ switching: true, error: undefined });
    try {
      const session = await this.client.switchBusinessUnit(normalized);
      const conversations = await this.client.listConversations();
      const selectedConversationId = session.conversationId
        ?? conversations.find(
          (conversation) => conversation.businessUnit?.externalId === normalized,
        )?.id;
      this.patch({
        conversations,
        businessUnits: sessionBusinessUnits(session),
        selectedConversationId,
        switching: false,
      });
      return selectedConversationId;
    } catch (error) {
      const normalizedError = normalizeError(error);
      this.patch({ switching: false, error: normalizedError });
      throw normalizedError;
    }
  }

  clearError(): void {
    if (this.state.error) this.patch({ error: undefined });
  }

  private patch(patch: Partial<ChatGateConversationListState>): void {
    this.state = { ...this.state, ...patch };
    this.notify();
  }

  private notify(): void {
    for (const subscriber of this.subscribers) subscriber();
  }
}

export function createChatGateConversationListController(
  client: ChatGateClient,
): ChatGateConversationListController {
  return new ChatGateConversationListController(client);
}
