"use client";

import { useMemo, type CSSProperties } from "react";
import type { ChatGateBusinessUnit, ChatGateConversation } from "@chatgate/core";
import {
  ChatGateConversation as ConversationView,
  type ChatGateConversationProps,
} from "./conversation.js";
import { useChatGateConversationList } from "./use-conversation-list.js";

export interface ChatGateMessengerProps
  extends Omit<ChatGateConversationProps, "onBack"> {
  showConversationList?: boolean;
  greeting?: string;
}

const styles: Record<string, CSSProperties> = {
  root: {
    display: "flex",
    minHeight: 520,
    height: "min(680px, calc(100dvh - 32px))",
    maxHeight: 760,
    flexDirection: "column",
    overflow: "hidden",
    border: "1px solid #d6e0ee",
    borderRadius: 20,
    background: "#fff",
    boxShadow: "0 18px 48px rgba(30, 64, 175, .10)",
    color: "#14213d",
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  },
  header: {
    padding: "22px 20px 18px",
    background: "linear-gradient(145deg, #2563eb, #1d4ed8)",
    color: "#fff",
  },
  title: { margin: 0, fontSize: 20, fontWeight: 780, lineHeight: 1.25 },
  greeting: { margin: "8px 0 0", color: "#dbeafe", fontSize: 13, lineHeight: 1.5 },
  online: { display: "inline-flex", alignItems: "center", gap: 7, marginTop: 12, fontSize: 11.5, fontWeight: 700 },
  onlineDot: { width: 8, height: 8, borderRadius: 999, background: "#86efac", boxShadow: "0 0 0 4px rgba(134,239,172,.18)" },
  body: { minHeight: 0, flex: 1, overflowY: "auto", padding: "18px", background: "#f7f9fc" },
  sectionTitle: { margin: "0 0 8px", color: "#64748b", fontSize: 10.5, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase" },
  list: { display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 },
  row: {
    display: "flex",
    width: "100%",
    alignItems: "center",
    gap: 11,
    padding: "11px 12px",
    border: "1px solid #dce5f1",
    borderRadius: 14,
    background: "#fff",
    color: "inherit",
    textAlign: "left",
    cursor: "pointer",
  },
  avatar: { display: "grid", flex: "0 0 auto", width: 40, height: 40, placeItems: "center", borderRadius: 13, background: "#2563eb", color: "#fff", fontSize: 15, fontWeight: 800 },
  rowMeta: { display: "flex", minWidth: 0, flex: 1, flexDirection: "column", gap: 3 },
  rowName: { overflow: "hidden", fontSize: 13.5, fontWeight: 760, textOverflow: "ellipsis", whiteSpace: "nowrap" },
  rowDescription: { overflow: "hidden", color: "#64748b", fontSize: 11.5, textOverflow: "ellipsis", whiteSpace: "nowrap" },
  unread: { display: "grid", minWidth: 24, height: 24, placeItems: "center", borderRadius: 999, background: "#2563eb", color: "#fff", fontSize: 10.5, fontWeight: 800 },
  error: { marginBottom: 12, padding: "10px 12px", border: "1px solid #fecaca", borderRadius: 12, background: "#fef2f2", color: "#b91c1c", fontSize: 12 },
  retry: { marginLeft: 8, border: 0, background: "transparent", color: "#b91c1c", fontWeight: 800, textDecoration: "underline", cursor: "pointer" },
  empty: { display: "grid", minHeight: 160, placeItems: "center", color: "#64748b", fontSize: 13, textAlign: "center" },
};

function unitName(unit: ChatGateBusinessUnit | null | undefined, fallback: string): string {
  return unit?.name?.trim() || fallback;
}

function unitDescription(unit: ChatGateBusinessUnit | null | undefined): string {
  return `${unit?.type?.trim() || "Business"} support`;
}

function ConversationRow({
  conversation,
  onSelect,
}: {
  conversation: ChatGateConversation;
  onSelect: () => void;
}) {
  const name = unitName(conversation.businessUnit, "Company support");
  const unreadCount = conversation.unreadCount ?? 0;
  return (
    <button type="button" style={styles.row} onClick={onSelect}>
      <span aria-hidden="true" style={styles.avatar}>{name.charAt(0).toUpperCase()}</span>
      <span style={styles.rowMeta}>
        <span style={styles.rowName}>{name}</span>
        <span style={styles.rowDescription}>{unitDescription(conversation.businessUnit)}</span>
      </span>
      {unreadCount > 0 ? (
        <span style={styles.unread} aria-label={`${unreadCount} unread messages`}>
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      ) : null}
    </button>
  );
}

function BusinessUnitRow({
  unit,
  disabled,
  onSelect,
}: {
  unit: ChatGateBusinessUnit;
  disabled: boolean;
  onSelect: () => void;
}) {
  const name = unitName(unit, unit.externalId);
  return (
    <button type="button" style={styles.row} disabled={disabled} onClick={onSelect}>
      <span aria-hidden="true" style={styles.avatar}>{name.charAt(0).toUpperCase()}</span>
      <span style={styles.rowMeta}>
        <span style={styles.rowName}>{name}</span>
        <span style={styles.rowDescription}>{unitDescription(unit)}</span>
      </span>
      <span aria-hidden="true">›</span>
    </button>
  );
}

function ChatGateConversationNavigator({
  title = "Support",
  greeting,
  className,
  style,
  ...conversationProps
}: Omit<ChatGateMessengerProps, "showConversationList" | "conversationId">) {
  const { controller, state } = useChatGateConversationList();
  const selectedConversation = state.conversations.find(
    (conversation) => conversation.id === state.selectedConversationId,
  );
  const availableBusinessUnits = useMemo(() => {
    const existing = new Set(
      state.conversations
        .map((conversation) => conversation.businessUnit?.externalId)
        .filter((externalId): externalId is string => Boolean(externalId)),
    );
    return state.businessUnits.filter((unit) => !existing.has(unit.externalId));
  }, [state.businessUnits, state.conversations]);

  if (state.selectedConversationId) {
    return (
      <ConversationView
        {...conversationProps}
        conversationId={state.selectedConversationId}
        title={unitName(selectedConversation?.businessUnit, title)}
        {...(className ? { className } : {})}
        {...(style ? { style } : {})}
        onBack={() => void controller.showList()}
      />
    );
  }

  return (
    <section
      data-chatgate-messenger=""
      className={className}
      style={{ ...styles.root, ...style }}
      aria-label={`${title} conversations`}
    >
      <header style={styles.header}>
        <h2 style={styles.title}>{title}</h2>
        <p style={styles.greeting}>{greeting ?? `Welcome to ${title}. Choose a conversation or start chatting with a business.`}</p>
        <span style={styles.online}><span style={styles.onlineDot} /> We&apos;re online</span>
      </header>
      <div style={styles.body} aria-busy={state.loading || state.switching}>
        {state.error ? (
          <div role="alert" style={styles.error}>
            {state.error.message}
            <button type="button" style={styles.retry} onClick={() => void controller.reload()}>Retry</button>
          </div>
        ) : null}
        {state.conversations.length > 0 ? (
          <>
            <p style={styles.sectionTitle}>Your conversations</p>
            <div style={styles.list}>
              {state.conversations.map((conversation) => (
                <ConversationRow
                  key={conversation.id}
                  conversation={conversation}
                  onSelect={() => controller.selectConversation(conversation.id)}
                />
              ))}
            </div>
          </>
        ) : null}
        {availableBusinessUnits.length > 0 ? (
          <>
            <p style={styles.sectionTitle}>Chat with a business</p>
            <div style={styles.list}>
              {availableBusinessUnits.map((unit) => (
                <BusinessUnitRow
                  key={unit.id}
                  unit={unit}
                  disabled={state.switching}
                  onSelect={() => void controller.selectBusinessUnit(unit.externalId).catch(() => undefined)}
                />
              ))}
            </div>
          </>
        ) : null}
        {!state.loading && state.conversations.length === 0 && availableBusinessUnits.length === 0 ? (
          <div style={styles.empty}>No conversations yet.</div>
        ) : null}
        {state.loading && state.conversations.length === 0 ? (
          <div style={styles.empty}>Loading conversations...</div>
        ) : null}
      </div>
    </section>
  );
}

export function ChatGateMessenger({
  showConversationList = true,
  conversationId,
  greeting,
  ...props
}: ChatGateMessengerProps) {
  if (!showConversationList || conversationId) {
    return <ConversationView {...props} {...(conversationId ? { conversationId } : {})} />;
  }
  return <ChatGateConversationNavigator {...props} {...(greeting ? { greeting } : {})} />;
}
