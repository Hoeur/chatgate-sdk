"use client";

import { useMemo, useState, type CSSProperties } from "react";
import type {
  ChatGateBusinessUnit,
  ChatGateConversation,
  ChatGateMessage,
} from "@chatgate/core";
import {
  ChatGateConversation as ConversationView,
  type ChatGateConversationProps,
} from "./conversation.js";
import {
  createChatGateThemeVariables,
  type ChatGateTheme,
} from "./theme.js";
import { useChatGateConversationList } from "./use-conversation-list.js";

export interface ChatGateMessengerLabels {
  conversations?: string;
  businesses?: string;
  searchPlaceholder?: string;
  noConversations?: string;
  noSearchResults?: string;
  selectConversation?: string;
  online?: string;
  retry?: string;
}

export interface ChatGateMessengerProps
  extends Omit<ChatGateConversationProps, "onBack" | "theme"> {
  showConversationList?: boolean;
  showBusinessDirectory?: boolean;
  greeting?: string;
  sidebarWidth?: number | string;
  labels?: ChatGateMessengerLabels;
  theme?: ChatGateTheme;
}

const DEFAULT_LABELS: Required<ChatGateMessengerLabels> = {
  conversations: "Messages",
  businesses: "Start a conversation",
  searchPlaceholder: "Search conversations",
  noConversations: "No conversations yet.",
  noSearchResults: "No matching conversations.",
  selectConversation: "Select a conversation to see its full message history.",
  online: "We're online",
  retry: "Retry",
};

const messengerCss = `
  [data-chatgate-messenger] * { box-sizing: border-box; }
  [data-chatgate-messenger] button,
  [data-chatgate-messenger] input { font: inherit; }
  [data-chatgate-messenger] button:focus-visible,
  [data-chatgate-messenger] input:focus-visible {
    outline: 3px solid color-mix(in srgb, var(--cg-accent, #2563eb) 24%, transparent);
    outline-offset: 2px;
  }
  [data-chatgate-messenger] .cg-messenger-row:hover {
    background: color-mix(in srgb, var(--cg-accent, #2563eb) 7%, var(--cg-surface, #fff)) !important;
    border-color: color-mix(in srgb, var(--cg-accent, #2563eb) 28%, var(--cg-border, #dce5f1)) !important;
  }
  [data-chatgate-messenger] .cg-chat-header button[aria-label="Back to conversations"] {
    display: none !important;
  }
  @container chatgate-messenger (max-width: 720px) {
    [data-chatgate-messenger][data-chatgate-has-selection="true"] .cg-messenger-sidebar { display: none !important; }
    [data-chatgate-messenger][data-chatgate-has-selection="false"] .cg-messenger-detail { display: none !important; }
    [data-chatgate-messenger] .cg-messenger-sidebar { width: 100% !important; border-right: 0 !important; }
    [data-chatgate-messenger] .cg-chat-header button[aria-label="Back to conversations"] { display: grid !important; }
  }
  @media (max-width: 720px) {
    [data-chatgate-messenger][data-chatgate-has-selection="true"] .cg-messenger-sidebar { display: none !important; }
    [data-chatgate-messenger][data-chatgate-has-selection="false"] .cg-messenger-detail { display: none !important; }
    [data-chatgate-messenger] .cg-messenger-sidebar { width: 100% !important; border-right: 0 !important; }
    [data-chatgate-messenger] .cg-chat-header button[aria-label="Back to conversations"] { display: grid !important; }
  }
`;

const styles: Record<string, CSSProperties> = {
  root: {
    display: "flex",
    width: "100%",
    minWidth: 0,
    minHeight: 560,
    height: "min(720px, calc(100dvh - 32px))",
    maxHeight: 800,
    overflow: "hidden",
    containerName: "chatgate-messenger",
    containerType: "inline-size",
    border: "1px solid var(--cg-border, #d6e0ee)",
    borderRadius: "var(--cg-radius, 20px)",
    background: "var(--cg-surface, #fff)",
    boxShadow: "0 18px 48px rgba(30, 64, 175, .10)",
    color: "var(--cg-text, #14213d)",
    fontFamily: "var(--cg-font, Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif)",
  },
  sidebar: {
    display: "flex",
    minWidth: 260,
    flex: "0 0 var(--cg-sidebar-width, 320px)",
    flexDirection: "column",
    borderRight: "1px solid var(--cg-border, #dce5f1)",
    background: "var(--cg-surface, #fff)",
  },
  sidebarHeader: {
    padding: "20px 18px 16px",
    borderBottom: "1px solid var(--cg-border, #e5ebf4)",
    background: "var(--cg-surface, #fff)",
  },
  sidebarHeaderMinimal: {
    padding: "16px 18px 15px",
    borderBottom: "1px solid var(--cg-border, #eef2f8)",
    background: "transparent",
  },
  titleMinimal: { margin: 0, fontSize: 16, fontWeight: 800, lineHeight: 1.25 },
  searchOnly: {
    padding: "15px 18px",
    borderBottom: "1px solid var(--cg-border, #e5ebf4)",
    background: "var(--cg-surface, #fff)",
  },
  brandRow: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  title: { margin: 0, fontSize: 19, fontWeight: 800, lineHeight: 1.25 },
  greeting: { margin: "6px 0 0", color: "var(--cg-muted, #64748b)", fontSize: 12, lineHeight: 1.45 },
  online: { display: "inline-flex", alignItems: "center", gap: 6, color: "var(--cg-muted, #64748b)", fontSize: 10.5, fontWeight: 750, whiteSpace: "nowrap" },
  onlineDot: { width: 7, height: 7, borderRadius: 999, background: "#22c55e", boxShadow: "0 0 0 3px rgba(34,197,94,.13)" },
  searchWrap: { position: "relative", marginTop: 15 },
  searchIcon: { position: "absolute", top: "50%", left: 12, color: "var(--cg-muted, #64748b)", transform: "translateY(-50%)", pointerEvents: "none" },
  search: { width: "100%", height: 40, padding: "0 12px 0 36px", border: "1px solid var(--cg-border, #dce5f1)", borderRadius: 12, outline: 0, background: "var(--cg-canvas, #f7f9fc)", color: "var(--cg-text, #14213d)", fontSize: 12.5 },
  body: { minHeight: 0, flex: 1, overflowY: "auto", padding: "14px", background: "var(--cg-canvas, #f7f9fc)", scrollbarGutter: "stable" },
  sectionHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, margin: "2px 2px 9px" },
  sectionTitle: { margin: 0, color: "var(--cg-muted, #64748b)", fontSize: 10.5, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase" },
  count: { display: "grid", minWidth: 22, height: 22, padding: "0 6px", placeItems: "center", borderRadius: 999, background: "color-mix(in srgb, var(--cg-accent, #2563eb) 10%, transparent)", color: "var(--cg-accent, #2563eb)", fontSize: 10, fontWeight: 800 },
  list: { display: "flex", flexDirection: "column", gap: 7, marginBottom: 18 },
  row: { display: "flex", width: "100%", minWidth: 0, alignItems: "center", gap: 10, padding: "10px", border: "1px solid transparent", borderRadius: 14, background: "transparent", color: "inherit", textAlign: "left", cursor: "pointer", transition: "background 140ms ease, border-color 140ms ease" },
  rowSelected: { borderColor: "color-mix(in srgb, var(--cg-accent, #2563eb) 28%, var(--cg-border, #dce5f1))", background: "color-mix(in srgb, var(--cg-accent, #2563eb) 9%, var(--cg-surface, #fff))" },
  avatar: { display: "grid", flex: "0 0 auto", width: 42, height: 42, placeItems: "center", borderRadius: 13, background: "var(--cg-accent, #2563eb)", color: "var(--cg-accent-text, #fff)", fontSize: 15, fontWeight: 800 },
  rowMeta: { display: "flex", minWidth: 0, flex: 1, flexDirection: "column", gap: 3 },
  rowTop: { display: "flex", minWidth: 0, alignItems: "center", justifyContent: "space-between", gap: 8 },
  rowName: { overflow: "hidden", fontSize: 13.5, fontWeight: 760, textOverflow: "ellipsis", whiteSpace: "nowrap" },
  rowTime: { flex: "0 0 auto", color: "var(--cg-muted, #64748b)", fontSize: 9.5 },
  rowBottom: { display: "flex", minWidth: 0, alignItems: "center", justifyContent: "space-between", gap: 8 },
  rowDescription: { overflow: "hidden", color: "var(--cg-muted, #64748b)", fontSize: 11.5, textOverflow: "ellipsis", whiteSpace: "nowrap" },
  unread: { display: "grid", minWidth: 22, height: 22, padding: "0 5px", placeItems: "center", borderRadius: 999, background: "var(--cg-accent, #2563eb)", color: "var(--cg-accent-text, #fff)", fontSize: 9.5, fontWeight: 800 },
  error: { marginBottom: 12, padding: "10px 12px", border: "1px solid #fecaca", borderRadius: 12, background: "#fef2f2", color: "#b91c1c", fontSize: 12 },
  retry: { marginLeft: 8, border: 0, background: "transparent", color: "#b91c1c", fontWeight: 800, textDecoration: "underline", cursor: "pointer" },
  empty: { display: "grid", minHeight: 120, placeItems: "center", padding: 18, color: "var(--cg-muted, #64748b)", fontSize: 12.5, lineHeight: 1.5, textAlign: "center" },
  detail: { display: "flex", minWidth: 0, flex: 1, background: "var(--cg-surface, #fff)" },
  detailEmpty: { display: "grid", width: "100%", placeItems: "center", padding: 32, background: "var(--cg-canvas, #f7f9fc)", color: "var(--cg-muted, #64748b)", textAlign: "center" },
  detailEmptyIcon: { display: "grid", width: 58, height: 58, margin: "0 auto 15px", placeItems: "center", border: "1px solid var(--cg-border, #dce5f1)", borderRadius: 18, background: "var(--cg-surface, #fff)", color: "var(--cg-accent, #2563eb)", boxShadow: "0 10px 26px rgba(30,64,175,.08)" },
  detailEmptyTitle: { display: "block", color: "var(--cg-text, #14213d)", fontSize: 15, fontWeight: 780 },
  detailEmptyText: { display: "block", maxWidth: 330, marginTop: 6, fontSize: 12.5, lineHeight: 1.55 },
};

function Icon({ name }: { name: "chat" | "search" }) {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {name === "search" ? (
        <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></>
      ) : (
        <><path d="M20 15a3 3 0 0 1-3 3H9l-5 3V7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3Z" /><path d="M8 9h8M8 13h5" /></>
      )}
    </svg>
  );
}

function unitName(unit: ChatGateBusinessUnit | null | undefined, fallback: string): string {
  return unit?.name?.trim() || fallback;
}

function messagePreview(message: ChatGateMessage | null | undefined, fallback: string): string {
  if (!message) return fallback;
  if (message.content?.trim()) return message.content.trim();
  if (message.messageType === "voice") return "Voice message";
  if (message.messageType === "image") return "Image";
  if (message.fileName?.trim()) return message.fileName;
  if (message.messageType === "encrypted") return "Encrypted message";
  return "Attachment";
}

function conversationPreview(conversation: ChatGateConversation): string {
  return messagePreview(
    conversation.lastMessage,
    conversation.subject?.trim() || `${conversation.messageCount ?? 0} messages`,
  );
}

function shortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
  }
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

function ConversationRow({
  conversation,
  selected,
  onSelect,
}: {
  conversation: ChatGateConversation;
  selected: boolean;
  onSelect: () => void;
}) {
  const name = unitName(conversation.businessUnit, "Company support");
  const unreadCount = conversation.unreadCount ?? 0;
  return (
    <button
      type="button"
      className="cg-messenger-row"
      style={{ ...styles.row, ...(selected ? styles.rowSelected : {}) }}
      aria-current={selected ? "page" : undefined}
      onClick={onSelect}
    >
      <span aria-hidden="true" style={styles.avatar}>{name.charAt(0).toUpperCase()}</span>
      <span style={styles.rowMeta}>
        <span style={styles.rowTop}>
          <span style={styles.rowName}>{name}</span>
          <time style={styles.rowTime} dateTime={conversation.lastMessageAt}>{shortDate(conversation.lastMessageAt)}</time>
        </span>
        <span style={styles.rowBottom}>
          <span style={styles.rowDescription}>{conversationPreview(conversation)}</span>
          {unreadCount > 0 ? (
            <span style={styles.unread} aria-label={`${unreadCount} unread messages`}>
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
        </span>
      </span>
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
    <button type="button" className="cg-messenger-row" style={styles.row} disabled={disabled} onClick={onSelect}>
      <span aria-hidden="true" style={styles.avatar}>{name.charAt(0).toUpperCase()}</span>
      <span style={styles.rowMeta}>
        <span style={styles.rowName}>{name}</span>
        <span style={styles.rowDescription}>{`${unit.type?.trim() || "Business"} support`}</span>
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
  theme,
  sidebarWidth = 320,
  labels: labelOverrides,
  showBusinessDirectory = true,
  header = "full",
  ...conversationProps
}: Omit<ChatGateMessengerProps, "showConversationList" | "conversationId">) {
  const { controller, state } = useChatGateConversationList();
  const [search, setSearch] = useState("");
  const labels = { ...DEFAULT_LABELS, ...labelOverrides };
  const selectedConversation = state.conversations.find(
    (conversation) => conversation.id === state.selectedConversationId,
  );
  const availableBusinessUnits = useMemo(() => {
    if (!showBusinessDirectory) return [];
    const existing = new Set(
      state.conversations
        .map((conversation) => conversation.businessUnit?.externalId)
        .filter((externalId): externalId is string => Boolean(externalId)),
    );
    return state.businessUnits.filter((unit) => !existing.has(unit.externalId));
  }, [showBusinessDirectory, state.businessUnits, state.conversations]);
  const filteredConversations = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return state.conversations;
    return state.conversations.filter((conversation) => [
      unitName(conversation.businessUnit, "Company support"),
      conversation.subject ?? "",
      conversationPreview(conversation),
    ].some((value) => value.toLocaleLowerCase().includes(query)));
  }, [search, state.conversations]);
  const rootVariables = createChatGateThemeVariables(theme);
  rootVariables["--cg-sidebar-width"] = typeof sidebarWidth === "number"
    ? `${sidebarWidth}px`
    : sidebarWidth;

  const searchField = (
    <div style={styles.searchWrap}>
      <span style={styles.searchIcon}><Icon name="search" /></span>
      <input
        type="search"
        value={search}
        onChange={(event) => setSearch(event.currentTarget.value)}
        placeholder={labels.searchPlaceholder}
        aria-label={labels.searchPlaceholder}
        style={styles.search}
      />
    </div>
  );

  return (
    <section
      data-chatgate-messenger=""
      data-chatgate-has-selection={state.selectedConversationId ? "true" : "false"}
      className={className}
      style={{ ...styles.root, ...rootVariables, ...style }}
      aria-label={`${title} conversations`}
    >
      <style>{messengerCss}</style>
      <aside className="cg-messenger-sidebar" style={styles.sidebar} aria-label={labels.conversations}>
        {header === "full" ? (
          <header style={styles.sidebarHeader}>
            <div style={styles.brandRow}>
              <div>
                <h2 style={styles.title}>{title}</h2>
                <p style={styles.greeting}>{greeting ?? `Your conversations with ${title}.`}</p>
              </div>
              <span style={styles.online}><span aria-hidden="true" style={styles.onlineDot} />{labels.online}</span>
            </div>
            {searchField}
          </header>
        ) : header === "minimal" ? (
          <header style={styles.sidebarHeaderMinimal}>
            <h2 style={styles.titleMinimal}>{title}</h2>
            {searchField}
          </header>
        ) : (
          <div style={styles.searchOnly}>{searchField}</div>
        )}
        <div style={styles.body} aria-busy={state.loading || state.switching}>
          {state.error ? (
            <div role="alert" style={styles.error}>
              {state.error.message}
              <button type="button" style={styles.retry} onClick={() => void controller.reload()}>{labels.retry}</button>
            </div>
          ) : null}
          <div style={styles.sectionHeader}>
            <p style={styles.sectionTitle}>{labels.conversations}</p>
            <span style={styles.count}>{state.conversations.length}</span>
          </div>
          {filteredConversations.length > 0 ? (
            <div style={styles.list}>
              {filteredConversations.map((conversation) => (
                <ConversationRow
                  key={conversation.id}
                  conversation={conversation}
                  selected={conversation.id === state.selectedConversationId}
                  onSelect={() => controller.selectConversation(conversation.id)}
                />
              ))}
            </div>
          ) : (
            <div style={styles.empty}>
              {state.loading ? "Loading conversations..." : search ? labels.noSearchResults : labels.noConversations}
            </div>
          )}
          {availableBusinessUnits.length > 0 ? (
            <>
              <div style={styles.sectionHeader}><p style={styles.sectionTitle}>{labels.businesses}</p></div>
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
        </div>
      </aside>
      <main className="cg-messenger-detail" style={styles.detail}>
        {state.selectedConversationId ? (
          <ConversationView
            {...conversationProps}
            conversationId={state.selectedConversationId}
            title={unitName(selectedConversation?.businessUnit, title)}
            {...(theme ? { theme } : {})}
            header={header}
            style={{ width: "100%", minHeight: 0, height: "100%", maxHeight: "none", border: 0, borderRadius: 0, boxShadow: "none" }}
            onBack={() => void controller.showList()}
          />
        ) : (
          <div style={styles.detailEmpty}>
            <div>
              <span style={styles.detailEmptyIcon}><Icon name="chat" /></span>
              <span style={styles.detailEmptyTitle}>{labels.conversations}</span>
              <span style={styles.detailEmptyText}>{labels.selectConversation}</span>
            </div>
          </div>
        )}
      </main>
    </section>
  );
}

export function ChatGateMessenger({
  showConversationList = true,
  conversationId,
  greeting,
  theme,
  ...props
}: ChatGateMessengerProps) {
  if (!showConversationList || conversationId) {
    return <ConversationView {...props} {...(conversationId ? { conversationId } : {})} {...(theme ? { theme } : {})} />;
  }
  return <ChatGateConversationNavigator {...props} {...(greeting ? { greeting } : {})} {...(theme ? { theme } : {})} />;
}
