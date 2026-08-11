import {
  defineComponent,
  h,
  type CSSProperties,
  type PropType,
  type VNodeChild,
} from "vue";
import type {
  ChatGateBusinessUnit,
  ChatGateConversation as ChatGateConversationModel,
  ChatGateMessage,
} from "@chatgate/core";
import { ChatGateConversation } from "./conversation.js";
import { useChatGateConversationList } from "./use-conversation-list.js";

const rootStyle: CSSProperties = {
  display: "flex",
  minHeight: "480px",
  flexDirection: "column",
  overflow: "hidden",
  border: "1px solid #dbe3ef",
  borderRadius: "16px",
  background: "#fff",
  color: "#0f172a",
};
const headerStyle: CSSProperties = { padding: "22px 20px 18px", background: "linear-gradient(145deg, #2563eb, #1d4ed8)", color: "#fff" };
const bodyStyle: CSSProperties = { minHeight: 0, flex: 1, overflowY: "auto", padding: "18px", background: "#f7f9fc" };
const rowStyle: CSSProperties = { display: "flex", width: "100%", alignItems: "center", gap: "11px", marginBottom: "8px", padding: "11px 12px", border: "1px solid #dce5f1", borderRadius: "14px", background: "#fff", color: "inherit", textAlign: "left", cursor: "pointer" };
const avatarStyle: CSSProperties = { display: "grid", width: "40px", height: "40px", flex: "0 0 auto", placeItems: "center", borderRadius: "13px", background: "#2563eb", color: "#fff", fontWeight: 800 };
const sectionStyle: CSSProperties = { margin: "0 0 8px", color: "#64748b", fontSize: "10.5px", fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase" };

function unitName(unit: ChatGateBusinessUnit | null | undefined, fallback: string): string {
  return unit?.name?.trim() || fallback;
}

function conversationRow(
  conversation: ChatGateConversationModel,
  onSelect: () => void,
): VNodeChild {
  const name = unitName(conversation.businessUnit, "Company support");
  const unreadCount = conversation.unreadCount ?? 0;
  return h("button", { key: conversation.id, type: "button", style: rowStyle, onClick: onSelect }, [
    h("span", { "aria-hidden": "true", style: avatarStyle }, name.charAt(0).toUpperCase()),
    h("span", { style: { display: "flex", minWidth: 0, flex: 1, flexDirection: "column", gap: "3px" } }, [
      h("strong", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, name),
      h("small", { style: { overflow: "hidden", color: "#64748b", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, `${conversation.businessUnit?.type || "Business"} support`),
    ]),
    unreadCount > 0 ? h("span", { "aria-label": `${unreadCount} unread messages`, style: { display: "grid", minWidth: "24px", height: "24px", placeItems: "center", borderRadius: "999px", background: "#2563eb", color: "#fff", fontSize: "11px", fontWeight: 800 } }, unreadCount > 99 ? "99+" : String(unreadCount)) : null,
  ]);
}

function businessUnitRow(
  unit: ChatGateBusinessUnit,
  disabled: boolean,
  onSelect: () => void,
): VNodeChild {
  const name = unitName(unit, unit.externalId);
  return h("button", { key: unit.id, type: "button", style: rowStyle, disabled, onClick: onSelect }, [
    h("span", { "aria-hidden": "true", style: avatarStyle }, name.charAt(0).toUpperCase()),
    h("span", { style: { display: "flex", minWidth: 0, flex: 1, flexDirection: "column", gap: "3px" } }, [
      h("strong", name),
      h("small", { style: { color: "#64748b" } }, `${unit.type || "Business"} support`),
    ]),
    h("span", { "aria-hidden": "true" }, "›"),
  ]);
}

export const ChatGateMessenger = defineComponent({
  name: "ChatGateMessenger",
  props: {
    conversationId: String,
    showConversationList: { type: Boolean, default: true },
    title: { type: String, default: "Support" },
    greeting: String,
    placeholder: { type: String, default: "Write a message…" },
    allowAttachments: { type: Boolean, default: true },
    allowVoice: { type: Boolean, default: true },
    acceptedFileTypes: String,
    maxFileSizeBytes: { type: Number, default: 25 * 1024 * 1024 },
    renderMessage: Function as PropType<(message: ChatGateMessage, own: boolean) => VNodeChild>,
  },
  setup(props) {
    const { controller, state } = useChatGateConversationList();

    return () => {
      const selectedConversationId = props.conversationId ?? state.value.selectedConversationId;
      const selectedConversation = state.value.conversations.find(
        (conversation) => conversation.id === selectedConversationId,
      );
      const conversationProps = {
        ...(selectedConversationId ? { conversationId: selectedConversationId } : {}),
        title: unitName(selectedConversation?.businessUnit, props.title),
        placeholder: props.placeholder,
        allowAttachments: props.allowAttachments,
        allowVoice: props.allowVoice,
        maxFileSizeBytes: props.maxFileSizeBytes,
        ...(props.acceptedFileTypes ? { acceptedFileTypes: props.acceptedFileTypes } : {}),
        ...(props.renderMessage ? { renderMessage: props.renderMessage } : {}),
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

      const existingExternalIds = new Set(
        state.value.conversations
          .map((conversation) => conversation.businessUnit?.externalId)
          .filter((externalId): externalId is string => Boolean(externalId)),
      );
      const availableBusinessUnits = state.value.businessUnits.filter(
        (unit) => !existingExternalIds.has(unit.externalId),
      );

      return h("section", { style: rootStyle, "aria-label": `${props.title} conversations` }, [
        h("header", { style: headerStyle }, [
          h("h2", { style: { margin: 0, fontSize: "20px" } }, props.title),
          h("p", { style: { margin: "8px 0 0", color: "#dbeafe", fontSize: "13px", lineHeight: 1.5 } }, props.greeting ?? `Welcome to ${props.title}. Choose a conversation or start chatting with a business.`),
          h("small", { style: { display: "block", marginTop: "12px", color: "#dcfce7", fontWeight: 700 } }, "● We're online"),
        ]),
        h("div", { style: bodyStyle, "aria-busy": state.value.loading || state.value.switching }, [
          state.value.error ? h("div", { role: "alert", style: { marginBottom: "12px", padding: "10px", borderRadius: "10px", background: "#fef2f2", color: "#b91c1c" } }, [state.value.error.message, h("button", { type: "button", onClick: () => void controller.reload() }, "Retry")]) : null,
          state.value.conversations.length > 0 ? h("p", { style: sectionStyle }, "Your conversations") : null,
          ...state.value.conversations.map((conversation) => conversationRow(conversation, () => controller.selectConversation(conversation.id))),
          availableBusinessUnits.length > 0 ? h("p", { style: { ...sectionStyle, marginTop: "18px" } }, "Chat with a business") : null,
          ...availableBusinessUnits.map((unit) => businessUnitRow(unit, state.value.switching, () => void controller.selectBusinessUnit(unit.externalId).catch(() => undefined))),
          !state.value.loading && state.value.conversations.length === 0 && availableBusinessUnits.length === 0 ? h("div", { style: { display: "grid", minHeight: "160px", placeItems: "center", color: "#64748b" } }, "No conversations yet.") : null,
          state.value.loading && state.value.conversations.length === 0 ? h("div", { style: { display: "grid", minHeight: "160px", placeItems: "center", color: "#64748b" } }, "Loading conversations...") : null,
        ]),
      ]);
    };
  },
});
