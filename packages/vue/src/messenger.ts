import {
  defineComponent,
  h,
  ref,
  type CSSProperties,
  type PropType,
  type VNodeChild,
} from "vue";
import { createChatGateSchemeCss } from "@chatgate/core";
import type {
  ChatGateBusinessUnit,
  ChatGateConversation as ChatGateConversationModel,
  ChatGateMessage,
  ChatGateParticipantRole,
} from "@chatgate/core";
import { ChatGateConversation } from "./conversation.js";
import { createChatGateThemeVariables, type ChatGateTheme } from "./theme.js";
import { useChatGateConversationList } from "./use-conversation-list.js";

/**
 * The messenger root had no stylesheet of its own until dark mode arrived: its
 * colours are all inline. `colorScheme: "auto"` needs a `prefers-color-scheme`
 * block, which an inline style cannot express, so the component now injects one
 * — scoped to its own `[data-chatgate-messenger]` attribute.
 */
const messengerCss = createChatGateSchemeCss("[data-chatgate-messenger]");

/** Overridable copy for the conversation list, for localized apps. */
export interface ChatGateMessengerLabels {
  conversations?: string;
  businesses?: string;
  searchPlaceholder?: string;
  noConversations?: string;
  noSearchResults?: string;
  online?: string;
  retry?: string;
  loading?: string;
  emptyPreview?: string;
  businessStart?: string;
  businessFallback?: string;
}

const DEFAULT_LABELS: Required<ChatGateMessengerLabels> = {
  conversations: "Conversations",
  businesses: "Chat with a business",
  searchPlaceholder: "Search conversations",
  noConversations: "No conversations yet.",
  noSearchResults: "No matches.",
  online: "We're online",
  retry: "Retry",
  loading: "Loading conversations...",
  emptyPreview: "Tap to start the conversation",
  businessStart: "{type} · start a chat",
  businessFallback: "Business",
};

/*
 * The list uses the same CSS custom properties as ChatGateConversation
 * (--cg-accent, --cg-surface, --cg-canvas, --cg-border, --cg-text, --cg-muted,
 * --cg-radius), so setting those variables on a wrapper themes the whole
 * messenger — list and thread — together.
 */
const rootStyle: CSSProperties = {
  display: "flex",
  minHeight: "480px",
  flexDirection: "column",
  overflow: "hidden",
  border: "1px solid var(--cg-border, #d6e0ee)",
  borderRadius: "var(--cg-radius, 20px)",
  background: "var(--cg-surface, #fff)",
  color: "var(--cg-text, #14213d)",
  fontFamily: "var(--cg-font, Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif)",
};
const headerStyle: CSSProperties = { padding: "22px 20px 18px", background: "linear-gradient(145deg, var(--cg-accent, #2563eb), var(--cg-accent-hover, #1d4ed8))", color: "var(--cg-accent-text, #fff)" };
const headerMinimalStyle: CSSProperties = { padding: "14px 16px 12px", borderBottom: "1px solid var(--cg-border, #e5ebf4)", background: "var(--cg-surface, #fff)" };
const headerTitleMinimalStyle: CSSProperties = { margin: 0, fontSize: "18px", fontWeight: 800, color: "var(--cg-text, #14213d)" };
const searchWrapStyle: CSSProperties = { display: "flex", alignItems: "center", gap: "8px", margin: "12px 14px 0", padding: "0 12px", height: "40px", border: "1px solid var(--cg-border, #dce5f1)", borderRadius: "12px", background: "var(--cg-surface, #fff)" };
const searchInputStyle: CSSProperties = { minWidth: "0", flex: "1", height: "100%", border: "0", outline: "0", background: "transparent", color: "var(--cg-text, #14213d)", fontSize: "13.5px" };
const bodyStyle: CSSProperties = { minHeight: 0, flex: 1, overflowY: "auto", padding: "14px", background: "var(--cg-canvas, #f7f9fc)" };
const rowStyle: CSSProperties = { display: "flex", width: "100%", alignItems: "center", gap: "11px", marginBottom: "8px", padding: "11px 12px", border: "1px solid var(--cg-border, #dce5f1)", borderRadius: "14px", background: "var(--cg-surface, #fff)", color: "inherit", textAlign: "left", cursor: "pointer" };
const avatarStyle: CSSProperties = { display: "grid", width: "44px", height: "44px", flex: "0 0 auto", placeItems: "center", borderRadius: "14px", background: "var(--cg-accent, #2563eb)", color: "var(--cg-accent-text, #fff)", fontWeight: 800 };
const sectionStyle: CSSProperties = { margin: "4px 0 8px", color: "var(--cg-muted, #64748b)", fontSize: "10.5px", fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase" };
const lineStyle: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" };
const nameStyle: CSSProperties = { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 700 };
const previewStyle: CSSProperties = { minWidth: 0, overflow: "hidden", color: "var(--cg-muted, #64748b)", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "12.5px" };
const timeStyle: CSSProperties = { flex: "0 0 auto", color: "var(--cg-muted, #64748b)", fontSize: "11px" };

function unitName(unit: ChatGateBusinessUnit | null | undefined, fallback: string): string {
  return unit?.name?.trim() || fallback;
}

function previewFor(conversation: ChatGateConversationModel, fallback: string): string {
  const message = conversation.lastMessage;
  if (!message) return fallback;
  if (message.messageType === "image") return "Photo";
  if (message.messageType === "voice") return "Voice message";
  return message.content?.trim() || message.fileName || "Attachment";
}

function relativeTime(iso?: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const diff = Date.now() - then;
  const min = 60_000;
  const hr = 3_600_000;
  const day = 86_400_000;
  if (diff < min) return "now";
  if (diff < hr) return `${Math.floor(diff / min)}m`;
  if (diff < day) return `${Math.floor(diff / hr)}h`;
  const date = new Date(then);
  if (diff < 7 * day) return date.toLocaleDateString(undefined, { weekday: "short" });
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function conversationRow(
  conversation: ChatGateConversationModel,
  labels: Required<ChatGateMessengerLabels>,
  onSelect: () => void,
): VNodeChild {
  const name = unitName(conversation.businessUnit, "Company support");
  const unreadCount = conversation.unreadCount ?? 0;
  const time = relativeTime(conversation.lastMessageAt);
  return h("button", { key: conversation.id, type: "button", style: rowStyle, onClick: onSelect }, [
    h("span", { "aria-hidden": "true", style: avatarStyle }, name.charAt(0).toUpperCase()),
    h("span", { style: { display: "flex", minWidth: 0, flex: 1, flexDirection: "column", gap: "3px" } }, [
      h("span", { style: lineStyle }, [
        h("strong", { style: nameStyle }, name),
        time ? h("small", { style: timeStyle }, time) : null,
      ]),
      h("span", { style: lineStyle }, [
        h("small", { style: previewStyle }, previewFor(conversation, labels.emptyPreview)),
        unreadCount > 0
          ? h("span", { "aria-label": `${unreadCount} unread messages`, style: { display: "grid", minWidth: "22px", height: "22px", flex: "0 0 auto", placeItems: "center", borderRadius: "999px", background: "var(--cg-accent, #2563eb)", color: "var(--cg-accent-text, #fff)", fontSize: "10.5px", fontWeight: 800, padding: "0 6px" } }, unreadCount > 99 ? "99+" : String(unreadCount))
          : null,
      ]),
    ]),
  ]);
}

function businessUnitRow(
  unit: ChatGateBusinessUnit,
  labels: Required<ChatGateMessengerLabels>,
  disabled: boolean,
  onSelect: () => void,
): VNodeChild {
  const name = unitName(unit, unit.externalId);
  const preview = labels.businessStart.replace(
    "{type}",
    unit.type?.trim() || labels.businessFallback,
  );
  return h("button", { key: unit.id, type: "button", style: rowStyle, disabled, onClick: onSelect }, [
    h("span", { "aria-hidden": "true", style: { ...avatarStyle, background: "color-mix(in srgb, var(--cg-accent, #2563eb) 14%, var(--cg-surface, #fff))", color: "var(--cg-accent, #2563eb)" } }, name.charAt(0).toUpperCase()),
    h("span", { style: { display: "flex", minWidth: 0, flex: 1, flexDirection: "column", gap: "3px" } }, [
      h("strong", { style: nameStyle }, name),
      h("small", { style: previewStyle }, preview),
    ]),
    h("span", { "aria-hidden": "true", style: { color: "var(--cg-muted, #64748b)" } }, "›"),
  ]);
}

export const chatGateMessengerProps = {
  conversationId: String,
  showConversationList: { type: Boolean, default: true },
  showBusinessDirectory: { type: Boolean, default: true },
  showSearch: { type: Boolean, default: true },
  header: { type: String as PropType<"full" | "minimal" | "none">, default: "full" },
  title: { type: String, default: "Support" },
  greeting: String,
  placeholder: { type: String, default: "Write a message…" },
  allowAttachments: { type: Boolean, default: true },
  allowVoice: { type: Boolean, default: true },
  acceptedFileTypes: String,
  maxFileSizeBytes: { type: Number, default: 25 * 1024 * 1024 },
  renderMessage: Function as PropType<(message: ChatGateMessage, own: boolean, role: ChatGateParticipantRole) => VNodeChild>,
  emptyState: Function as PropType<() => VNodeChild>,
  showRoleBadge: { type: Boolean, default: true },
  roleLabels: Object as PropType<Partial<Record<ChatGateParticipantRole, string>>>,
  /** Branding tokens — compiled to the `--cg-*` custom properties. */
  theme: Object as PropType<ChatGateTheme>,
  /** Overrides for the conversation-list copy. */
  labels: Object as PropType<ChatGateMessengerLabels>,
} as const;

export const ChatGateMessenger = defineComponent({
  name: "ChatGateMessenger",
  props: chatGateMessengerProps,
  setup(props) {
    const { controller, state } = useChatGateConversationList();
    const query = ref("");

    return () => {
      const labels = { ...DEFAULT_LABELS, ...props.labels };
      const selectedConversationId = props.conversationId ?? state.value.selectedConversationId;
      const selectedConversation = state.value.conversations.find(
        (conversation) => conversation.id === selectedConversationId,
      );
      const conversationProps = {
        ...(selectedConversationId ? { conversationId: selectedConversationId } : {}),
        title: unitName(selectedConversation?.businessUnit, props.title),
        placeholder: props.placeholder,
        header: props.header,
        allowAttachments: props.allowAttachments,
        allowVoice: props.allowVoice,
        maxFileSizeBytes: props.maxFileSizeBytes,
        showRoleBadge: props.showRoleBadge,
        ...(props.acceptedFileTypes ? { acceptedFileTypes: props.acceptedFileTypes } : {}),
        ...(props.renderMessage ? { renderMessage: props.renderMessage } : {}),
        ...(props.emptyState ? { emptyState: props.emptyState } : {}),
        ...(props.roleLabels ? { roleLabels: props.roleLabels } : {}),
        ...(props.theme ? { theme: props.theme } : {}),
      };
      if (!props.showConversationList || props.conversationId) {
        return h(ChatGateConversation, conversationProps);
      }
      if (selectedConversationId) {
        return h(ChatGateConversation, {
          ...conversationProps,
          onBack: () => void controller.showList(),
        });
      }

      const availableBusinessUnits = props.showBusinessDirectory
        ? state.value.businessUnits.filter((unit) =>
            !state.value.conversations.some(
              (conversation) => conversation.businessUnit?.externalId === unit.externalId,
            )
          )
        : [];

      const term = query.value.trim().toLowerCase();
      const conversations = term
        ? state.value.conversations.filter((conversation) => {
            const name = unitName(conversation.businessUnit, "").toLowerCase();
            return name.includes(term)
              || previewFor(conversation, labels.emptyPreview).toLowerCase().includes(term);
          })
        : state.value.conversations;
      const businessUnits = term
        ? availableBusinessUnits.filter((unit) =>
            unitName(unit, unit.externalId).toLowerCase().includes(term),
          )
        : availableBusinessUnits;

      return h("section", {
        "data-chatgate-messenger": "",
        "data-cg-scheme": props.theme?.colorScheme,
        style: { ...rootStyle, ...createChatGateThemeVariables(props.theme) },
        "aria-label": `${props.title} conversations`,
      }, [
        h("style", messengerCss),
        props.header === "none"
          ? null
          : props.header === "minimal"
            ? h("header", { style: headerMinimalStyle }, [h("h2", { style: headerTitleMinimalStyle }, props.title)])
            : h("header", { style: headerStyle }, [
                h("h2", { style: { margin: 0, fontSize: "20px" } }, props.title),
                h("p", { style: { margin: "8px 0 0", color: "var(--cg-accent-text, #fff)", opacity: 0.85, fontSize: "13px", lineHeight: 1.5 } }, props.greeting ?? `Welcome to ${props.title}. Choose a conversation or start chatting with a business.`),
                h("small", { style: { display: "inline-flex", alignItems: "center", gap: "6px", marginTop: "12px", color: "var(--cg-accent-text, #fff)", opacity: 0.92, fontWeight: 700 } }, [
                  h("span", { "aria-hidden": "true", style: { width: "8px", height: "8px", borderRadius: "999px", background: "var(--cg-online, #4ade80)", boxShadow: "0 0 0 3px color-mix(in srgb, var(--cg-online, #4ade80) 13%, transparent)" } }),
                  labels.online,
                ]),
              ]),
        props.showSearch
          ? h("div", { style: searchWrapStyle }, [
              h("span", { "aria-hidden": "true", style: { color: "var(--cg-muted, #64748b)", fontSize: "14px" } }, "⌕"),
              h("input", {
                type: "search",
                "aria-label": labels.searchPlaceholder,
                placeholder: labels.searchPlaceholder,
                value: query.value,
                style: searchInputStyle,
                onInput: (event: Event) => { query.value = (event.target as HTMLInputElement).value; },
              }),
            ])
          : null,
        h("div", { style: bodyStyle, "aria-busy": state.value.loading || state.value.switching }, [
          state.value.error ? h("div", { role: "alert", style: { marginBottom: "12px", padding: "10px", borderRadius: "10px", border: "1px solid color-mix(in srgb, var(--cg-danger, #ef4444) 20%, transparent)", background: "color-mix(in srgb, var(--cg-danger, #ef4444) 7%, transparent)", color: "var(--cg-danger, #b91c1c)" } }, [state.value.error.message, h("button", { type: "button", style: { marginLeft: "8px", border: 0, background: "transparent", color: "var(--cg-danger, #b91c1c)", fontWeight: 700, textDecoration: "underline" }, onClick: () => void controller.reload() }, labels.retry)]) : null,
          conversations.length > 0 ? h("p", { style: sectionStyle }, labels.conversations) : null,
          ...conversations.map((conversation) => conversationRow(conversation, labels, () => controller.selectConversation(conversation.id))),
          businessUnits.length > 0 ? h("p", { style: { ...sectionStyle, marginTop: "18px" } }, labels.businesses) : null,
          ...businessUnits.map((unit) => businessUnitRow(unit, labels, state.value.switching, () => void controller.selectBusinessUnit(unit.externalId).catch(() => undefined))),
          !state.value.loading && conversations.length === 0 && businessUnits.length === 0 ? h("div", { style: { display: "grid", minHeight: "160px", placeItems: "center", color: "var(--cg-muted, #64748b)" } }, term ? labels.noSearchResults : labels.noConversations) : null,
          state.value.loading && state.value.conversations.length === 0 ? h("div", { style: { display: "grid", minHeight: "160px", placeItems: "center", color: "var(--cg-muted, #64748b)" } }, labels.loading) : null,
        ]),
      ]);
    };
  },
});
