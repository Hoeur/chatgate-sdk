"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  resolveMessageRole,
  sanitizeUrl,
  CHATGATE_ROLE_LABELS,
  type ChatGateMessage,
  type ChatGateMessageType,
  type ChatGateParticipantRole,
} from "@chatgate/core";
import { useChatGate } from "./context.js";
import {
  createChatGateThemeVariables,
  type ChatGateTheme,
} from "./theme.js";
import { useChatGateConversation } from "./use-conversation.js";

export interface ChatGateConversationProps {
  conversationId?: string;
  title?: string;
  placeholder?: string;
  emptyState?: ReactNode;
  className?: string;
  style?: CSSProperties;
  allowAttachments?: boolean;
  allowVoice?: boolean;
  acceptedFileTypes?: string;
  maxFileSizeBytes?: number;
  renderMessage?: (message: ChatGateMessage, own: boolean, role: ChatGateParticipantRole) => ReactNode;
  /** Show a role badge (Customer / Merchant / Admin) on incoming messages. Default true. */
  showRoleBadge?: boolean;
  /** Override the default role labels. */
  roleLabels?: Partial<Record<ChatGateParticipantRole, string>>;
  onBack?: () => void;
  theme?: ChatGateTheme;
  /**
   * Header display mode.
   * - "full" (default): avatar + title + subtitle + presence badge on a solid bar.
   * - "minimal": just the title (optional back control + tiny presence dot), transparent — no background band.
   * - "none": no header at all (a bare back control still appears on mobile when onBack is set).
   */
  header?: "full" | "minimal" | "none";
}

type IconName = "attach" | "back" | "chat" | "file" | "image" | "microphone" | "more" | "send" | "stop";

const QUICK_REACTIONS = ["\u{1F44D}", "\u2764\uFE0F", "\u{1F602}"] as const;

const iconPaths: Record<IconName, ReactNode> = {
  attach: <path d="M20.5 11.5 12 20a6 6 0 0 1-8.5-8.5l9-9a4 4 0 0 1 5.7 5.7l-9 9a2 2 0 0 1-2.9-2.8l8.3-8.3" />,
  back: <><path d="m15 18-6-6 6-6" /><path d="M9 12h10" /></>,
  chat: <><path d="M20 15a3 3 0 0 1-3 3H9l-5 3V7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3Z" /><path d="M8 9h8M8 13h5" /></>,
  file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6M8 13h8M8 17h5" /></>,
  image: <><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="9" cy="9" r="1.6" /><path d="m21 15-4.2-4.2a1.5 1.5 0 0 0-2.1 0L6 19.5" /></>,
  microphone: <><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10v1a7 7 0 0 0 14 0v-1M12 18v4M8 22h8" /></>,
  more: <><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" /></>,
  send: <><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>,
  stop: <rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" stroke="none" />,
};

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {iconPaths[name]}
    </svg>
  );
}

const componentCss = `
  [data-chatgate-conversation] * { box-sizing: border-box; }
  [data-chatgate-conversation] button,
  [data-chatgate-conversation] input { font: inherit; }
  [data-chatgate-conversation] button:focus-visible,
  [data-chatgate-conversation] input:focus-visible,
  [data-chatgate-conversation] summary:focus-visible {
    outline: 3px solid color-mix(in srgb, var(--cg-accent, #2563eb) 24%, transparent);
    outline-offset: 2px;
  }
  [data-chatgate-conversation] .cg-message-menu summary { list-style: none; }
  [data-chatgate-conversation] .cg-message-menu summary::-webkit-details-marker { display: none; }
  [data-chatgate-conversation] .cg-message-menu[open] > summary {
    background: #e8effb !important;
    color: var(--cg-accent-hover, #1d4ed8) !important;
  }
  [data-chatgate-conversation] .cg-message-menu__panel {
    animation: cg-menu-in 130ms ease-out;
  }
  [data-chatgate-conversation] .cg-message-action:hover,
  [data-chatgate-conversation] .cg-tool-button:hover:not(:disabled) { background: #eff4fb !important; }
  [data-chatgate-conversation] .cg-send-button:hover:not(:disabled) { background: var(--cg-accent-hover, #1d4ed8) !important; }
  [data-chatgate-conversation] button:disabled { cursor: not-allowed !important; opacity: .52; }
  [data-chatgate-conversation] .cg-message-image { transition: transform 160ms ease; }
  [data-chatgate-conversation] .cg-message-image:hover { transform: scale(1.012); }
  @keyframes cg-menu-in {
    from { opacity: 0; transform: translateY(4px) scale(.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
  [data-chatgate-conversation] .cg-recording { animation: cg-pulse 1.2s ease-in-out infinite; }
  [data-chatgate-conversation] .cg-recording-dot { animation: cg-blink 1s ease-in-out infinite; }
  @keyframes cg-pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, .35); }
    50% { box-shadow: 0 0 0 7px rgba(220, 38, 38, 0); }
  }
  @keyframes cg-blink {
    0%, 100% { opacity: 1; }
    50% { opacity: .35; }
  }
  @media (max-width: 560px) {
    [data-chatgate-conversation] .cg-chat-header { padding: 13px 14px !important; }
    [data-chatgate-conversation] .cg-message-list { padding: 16px 12px !important; }
    [data-chatgate-conversation] .cg-message { max-width: 88% !important; }
    [data-chatgate-conversation] .cg-composer { padding: 10px !important; }
    [data-chatgate-conversation] .cg-send-label { display: none; }
    [data-chatgate-conversation] .cg-send-button { width: 42px !important; padding: 0 !important; }
    [data-chatgate-conversation] .cg-composer-footer { display: none !important; }
  }
  @media (prefers-reduced-motion: reduce) {
    [data-chatgate-conversation] *,
    [data-chatgate-conversation] *::before,
    [data-chatgate-conversation] *::after { animation: none !important; transition: none !important; }
  }
`;

const styles: Record<string, CSSProperties> = {
  root: {
    display: "flex",
    flexDirection: "column",
    minHeight: 520,
    height: "min(680px, calc(100dvh - 32px))",
    maxHeight: 760,
    overflow: "hidden",
    border: "1px solid var(--cg-border, #d6e0ee)",
    borderRadius: "var(--cg-radius, 20px)",
    background: "var(--cg-surface, #fff)",
    boxShadow: "0 18px 48px rgba(30, 64, 175, .10)",
    color: "var(--cg-text, #14213d)",
    fontFamily: "var(--cg-font, Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    minHeight: 72,
    padding: "14px 18px",
    borderBottom: "1px solid var(--cg-border, #e5ebf4)",
    background: "var(--cg-surface, #fff)",
  },
  backButton: {
    display: "grid",
    flex: "0 0 auto",
    width: 36,
    height: 36,
    placeItems: "center",
    border: "1px solid #dce5f1",
    borderRadius: 12,
    background: "#f8fafc",
    color: "#334155",
    cursor: "pointer",
  },
  headerMinimal: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    minHeight: 46,
    padding: "11px 16px",
    background: "transparent",
    borderBottom: "1px solid var(--cg-border, #eef2f8)",
  },
  headerMinimalTitle: {
    overflow: "hidden",
    flex: 1,
    fontSize: 14.5,
    fontWeight: 750,
    lineHeight: 1.3,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "var(--cg-text, #14213d)",
  },
  headerBackOnly: {
    display: "flex",
    alignItems: "center",
    padding: "7px 12px",
    background: "transparent",
  },
  backButtonGhost: {
    display: "grid",
    flex: "0 0 auto",
    width: 34,
    height: 34,
    placeItems: "center",
    border: 0,
    borderRadius: 10,
    background: "transparent",
    color: "var(--cg-muted, #64748b)",
    cursor: "pointer",
  },
  minimalDot: { width: 8, height: 8, flex: "0 0 auto", borderRadius: 999, background: "#cbd5e1" },
  identity: { display: "flex", alignItems: "center", minWidth: 0, gap: 11 },
  avatar: {
    display: "grid",
    flex: "0 0 auto",
    width: 42,
    height: 42,
    placeItems: "center",
    borderRadius: 14,
    background: "var(--cg-accent, #2563eb)",
    boxShadow: "0 8px 18px rgba(37, 99, 235, .24)",
    color: "#fff",
  },
  identityText: { display: "flex", minWidth: 0, flexDirection: "column", gap: 2 },
  title: { overflow: "hidden", fontSize: 15, fontWeight: 760, lineHeight: 1.3, textOverflow: "ellipsis", whiteSpace: "nowrap" },
  subtitle: { color: "var(--cg-muted, #64748b)", fontSize: 11.5, lineHeight: 1.4 },
  presence: {
    display: "inline-flex",
    flex: "0 0 auto",
    alignItems: "center",
    gap: 7,
    padding: "7px 10px",
    border: "1px solid #dce5f1",
    borderRadius: 999,
    background: "#f8fafc",
    color: "#52627a",
    fontSize: 11.5,
    fontWeight: 700,
  },
  presenceDot: { width: 8, height: 8, borderRadius: 999, background: "#94a3b8", boxShadow: "0 0 0 3px rgba(148,163,184,.14)" },
  messages: {
    display: "flex",
    minHeight: 0,
    flex: 1,
    flexDirection: "column",
    gap: 8,
    overflowY: "auto",
    padding: "20px 18px",
    background: "var(--cg-canvas, linear-gradient(180deg, #f8fbff 0%, #f4f7fb 100%))",
    scrollbarGutter: "stable",
  },
  messageRow: { display: "flex", width: "fit-content", maxWidth: "min(78%, 460px)", flexDirection: "column", alignItems: "flex-start", gap: 3 },
  messageRowOwn: { alignSelf: "flex-end", alignItems: "flex-end" },
  roleBadge: { display: "inline-flex", alignItems: "center", alignSelf: "flex-start", marginBottom: 4, padding: "1px 8px", borderRadius: 999, fontSize: 10, fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase" },
  bubble: {
    minWidth: 48,
    padding: "9px 12px 8px",
    border: "1px solid #e0e7f0",
    borderRadius: "17px 17px 17px 6px",
    background: "#fff",
    boxShadow: "0 4px 14px rgba(15, 23, 42, .055)",
    color: "#172033",
    fontSize: 14,
    lineHeight: 1.45,
    overflowWrap: "anywhere",
    whiteSpace: "pre-wrap",
  },
  bubbleOwn: {
    borderColor: "var(--cg-accent, #2563eb)",
    borderRadius: "17px 17px 6px 17px",
    background: "var(--cg-accent, #2563eb)",
    boxShadow: "0 7px 18px rgba(37, 99, 235, .19)",
    color: "#fff",
  },
  mediaBubble: { width: "min(370px, 72vw)", padding: 6 },
  replyQuote: { marginBottom: 7, padding: "7px 9px", borderLeft: "3px solid currentColor", borderRadius: 8, background: "rgba(148,163,184,.16)", fontSize: 11.5, opacity: 0.86 },
  imageLink: { display: "block", overflow: "hidden", borderRadius: 12, background: "#e8eef7" },
  image: { display: "block", width: "100%", maxHeight: 310, borderRadius: 12, objectFit: "cover" },
  audio: { display: "block", width: "min(300px, 68vw)", maxWidth: "100%" },
  fileLink: { display: "flex", alignItems: "center", gap: 10, minWidth: 210, color: "inherit", fontWeight: 720, textDecoration: "none" },
  fileIcon: { display: "grid", flex: "0 0 auto", width: 36, height: 36, placeItems: "center", borderRadius: 10, background: "rgba(148,163,184,.18)" },
  fileText: { display: "flex", minWidth: 0, flexDirection: "column", gap: 1 },
  fileName: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  fileSize: { fontSize: 10.5, fontWeight: 600, opacity: 0.7 },
  messageText: { padding: "1px 1px 0" },
  messageMeta: { display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6, marginTop: 5, fontSize: 9.5, fontWeight: 650, opacity: 0.68 },
  messageFooter: { display: "flex", alignItems: "center", gap: 6, minHeight: 24 },
  reactions: { display: "flex", flexWrap: "wrap", gap: 4 },
  reaction: { minHeight: 23, padding: "1px 7px", border: "1px solid #d8e1ee", borderRadius: 999, background: "#fff", color: "#334155", boxShadow: "0 2px 6px rgba(15,23,42,.04)", fontSize: 11, cursor: "pointer" },
  messageMenu: { position: "relative" },
  messageMenuTrigger: { display: "grid", width: 28, height: 24, padding: 0, placeItems: "center", border: 0, borderRadius: 8, background: "transparent", color: "#7b8ba3", cursor: "pointer" },
  messageMenuPanel: { position: "absolute", zIndex: 8, bottom: "calc(100% + 6px)", display: "flex", alignItems: "center", gap: 3, width: "max-content", padding: 5, border: "1px solid #dbe4f0", borderRadius: 12, background: "rgba(255,255,255,.98)", boxShadow: "0 14px 35px rgba(15, 23, 42, .16)", backdropFilter: "blur(12px)" },
  messageAction: { minHeight: 30, padding: "5px 8px", border: 0, borderRadius: 8, background: "transparent", color: "#52627a", fontSize: 11, fontWeight: 700, cursor: "pointer" },
  reactionAction: { display: "grid", width: 30, minHeight: 30, padding: 0, placeItems: "center", border: 0, borderRadius: 8, background: "transparent", cursor: "pointer" },
  loadEarlier: { alignSelf: "center", marginBottom: 4, padding: "7px 11px", border: "1px solid #d7e1ee", borderRadius: 999, background: "rgba(255,255,255,.88)", color: "#52627a", fontSize: 11.5, fontWeight: 700, cursor: "pointer" },
  status: { display: "grid", margin: "auto", padding: 26, placeItems: "center", color: "#64748b", textAlign: "center" },
  emptyIcon: { display: "grid", width: 48, height: 48, marginBottom: 12, placeItems: "center", border: "1px solid #d9e4f2", borderRadius: 16, background: "#fff", boxShadow: "0 8px 22px rgba(30,64,175,.08)", color: "#2563eb" },
  emptyTitle: { marginBottom: 4, color: "#1e293b", fontSize: 14, fontWeight: 760 },
  error: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, margin: "10px 12px 0", padding: "9px 11px", border: "1px solid #fecaca", borderRadius: 12, background: "#fff1f2", color: "#b42318", fontSize: 12 },
  retryButton: { padding: "4px 8px", border: "1px solid #fda4af", borderRadius: 8, background: "#fff", color: "#be123c", fontSize: 11, fontWeight: 700, cursor: "pointer" },
  typing: { minHeight: 25, padding: "5px 16px 2px", background: "#fff", color: "#64748b", fontSize: 11.5 },
  composer: { display: "flex", flexDirection: "column", gap: 8, padding: "9px 12px 11px", borderTop: "1px solid #e5ebf4", background: "#fff" },
  replyBanner: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "8px 10px", border: "1px solid #dbeafe", borderRadius: 11, background: "#eff6ff", color: "#1e40af", fontSize: 11.5 },
  cancelReply: { padding: "3px 7px", border: 0, borderRadius: 7, background: "transparent", color: "#1d4ed8", fontSize: 11, fontWeight: 750, cursor: "pointer" },
  composerRow: { display: "flex", alignItems: "center", gap: 5, minHeight: 50, padding: 4, border: "1px solid #d4deeb", borderRadius: 16, background: "#f8fafc", boxShadow: "0 4px 14px rgba(15,23,42,.04)" },
  input: { minWidth: 0, height: 40, flex: 1, padding: "0 8px", border: 0, outline: 0, background: "transparent", color: "#172033", fontSize: 13.5 },
  sendButton: { display: "inline-flex", height: 40, alignItems: "center", justifyContent: "center", gap: 7, padding: "0 13px", border: 0, borderRadius: 12, background: "var(--cg-accent, #2563eb)", color: "var(--cg-accent-text, #fff)", boxShadow: "0 6px 15px rgba(37,99,235,.22)", fontSize: 12.5, fontWeight: 760, cursor: "pointer" },
  toolButton: { display: "grid", flex: "0 0 auto", width: 40, height: 40, padding: 0, placeItems: "center", border: 0, borderRadius: 11, background: "transparent", color: "#52627a", cursor: "pointer" },
  composerFooter: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 3px", color: "#94a3b8", fontSize: 9.5, fontWeight: 600 },
};

const ROLE_BADGE_COLORS: Record<ChatGateParticipantRole, { bg: string; color: string; border: string }> = {
  customer: { bg: "#eef2f7", color: "#475569", border: "#dbe2ec" },
  merchant: { bg: "#e0f2fe", color: "#0369a1", border: "#bae6fd" },
  admin: { bg: "#f3e8ff", color: "#7e22ce", border: "#e9d5ff" },
};

function roleLabel(role: ChatGateParticipantRole, overrides?: Partial<Record<ChatGateParticipantRole, string>>): string {
  return overrides?.[role] ?? CHATGATE_ROLE_LABELS[role];
}

function attachmentLabel(message: ChatGateMessage): string {
  if (message.messageType === "image") return "Photo";
  if (message.messageType === "voice") return "Voice message";
  if (message.messageType === "file") return message.fileName ?? "File";
  return message.content || "Message";
}

function messageTypeForFile(file: File): Exclude<ChatGateMessageType, "encrypted"> {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("audio/")) return "voice";
  return "file";
}

function formatFileSize(size?: number | null): string {
  if (!size) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function DefaultMessage({
  message,
  own,
  role,
  showRoleBadge,
  roleLabels,
  onReply,
  onReact,
  onEdit,
  onDelete,
}: {
  message: ChatGateMessage;
  own: boolean;
  role: ChatGateParticipantRole;
  showRoleBadge: boolean;
  roleLabels: Partial<Record<ChatGateParticipantRole, string>> | undefined;
  onReply: () => void;
  onReact: (emoji: string) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const roleColor = ROLE_BADGE_COLORS[role];
  const reactionCounts = new Map<string, number>();
  for (const reaction of message.reactions ?? []) {
    reactionCounts.set(reaction.emoji, (reactionCounts.get(reaction.emoji) ?? 0) + 1);
  }
  const fileUrl = sanitizeUrl(message.fileUrl);
  const hasMedia = (message.messageType === "image" || message.messageType === "voice") && Boolean(fileUrl);

  return (
    <article className="cg-message" data-role={role} style={{ ...styles.messageRow, ...(own ? styles.messageRowOwn : {}) }}>
      {showRoleBadge && !own ? (
        <span
          className="cg-role-badge"
          data-role={role}
          style={{ ...styles.roleBadge, background: roleColor.bg, color: roleColor.color, border: `1px solid ${roleColor.border}` }}
        >
          {roleLabel(role, roleLabels)}
        </span>
      ) : null}
      <div
        style={{
          ...styles.bubble,
          ...(own ? styles.bubbleOwn : { borderLeft: `3px solid ${roleColor.color}` }),
          ...(hasMedia ? styles.mediaBubble : {}),
        }}
      >
        {message.replyTo ? <div style={styles.replyQuote}>{attachmentLabel(message.replyTo)}</div> : null}
        {message.messageType === "image" && fileUrl ? (
          <a href={fileUrl} target="_blank" rel="noopener noreferrer" style={styles.imageLink}>
            <img className="cg-message-image" src={fileUrl} alt={message.fileName ?? "Shared image"} style={styles.image} />
          </a>
        ) : null}
        {message.messageType === "voice" && fileUrl ? (
          <audio controls preload="metadata" src={fileUrl} style={styles.audio}>
            <a href={fileUrl} target="_blank" rel="noopener noreferrer">Download voice message</a>
          </audio>
        ) : null}
        {message.messageType === "file" && fileUrl ? (
          <a href={fileUrl} target="_blank" rel="noopener noreferrer" download={message.fileName ?? undefined} style={styles.fileLink}>
            <span aria-hidden="true" style={styles.fileIcon}><Icon name="file" /></span>
            <span style={styles.fileText}>
              <span style={styles.fileName}>{message.fileName ?? "Download attachment"}</span>
              {message.fileSize ? <span style={styles.fileSize}>{formatFileSize(message.fileSize)}</span> : null}
            </span>
          </a>
        ) : null}
        {message.content && !(message.messageType === "voice" && message.content === "Voice message") ? (
          <div style={styles.messageText}>{message.content}</div>
        ) : null}
        <div style={{ ...styles.messageMeta, ...(own ? { color: "#dbeafe" } : { color: "#64748b" }) }}>
          <span>{formatTime(message.createdAt)}</span>
          {own ? <span>{message.read ? "Seen" : "Sent"}</span> : null}
        </div>
      </div>
      <div style={{ ...styles.messageFooter, ...(own ? { justifyContent: "flex-end" } : {}) }}>
        {reactionCounts.size > 0 ? (
          <div style={styles.reactions} aria-label="Message reactions">
            {[...reactionCounts].map(([emoji, count]) => (
              <button key={emoji} type="button" style={styles.reaction} onClick={() => onReact(emoji)}>{emoji} {count}</button>
            ))}
          </div>
        ) : null}
        <details className="cg-message-menu" style={styles.messageMenu}>
          <summary style={styles.messageMenuTrigger} aria-label="Message actions" title="Message actions">
            <Icon name="more" />
          </summary>
          <div
            className="cg-message-menu__panel"
            style={{ ...styles.messageMenuPanel, ...(own ? { right: 0 } : { left: 0 }) }}
          >
            <button className="cg-message-action" type="button" style={styles.messageAction} onClick={onReply}>Reply</button>
            {QUICK_REACTIONS.map((emoji) => (
              <button
                className="cg-message-action"
                key={emoji}
                type="button"
                style={styles.reactionAction}
                aria-label={`React ${emoji}`}
                title={`React ${emoji}`}
                onClick={() => onReact(emoji)}
              >
                {emoji}
              </button>
            ))}
            {own && message.messageType === "text" ? (
              <button className="cg-message-action" type="button" style={styles.messageAction} onClick={onEdit}>Edit</button>
            ) : null}
            {own ? (
              <button className="cg-message-action" type="button" style={{ ...styles.messageAction, color: "#be123c" }} onClick={onDelete}>Delete</button>
            ) : null}
          </div>
        </details>
      </div>
    </article>
  );
}

export function ChatGateConversation({
  conversationId,
  title = "Support",
  placeholder = "Write a message...",
  emptyState = "No messages yet. Start the conversation.",
  className,
  style,
  allowAttachments = true,
  allowVoice = true,
  acceptedFileTypes,
  maxFileSizeBytes = 25 * 1024 * 1024,
  renderMessage,
  showRoleBadge = true,
  roleLabels,
  onBack,
  theme,
  header = "full",
}: ChatGateConversationProps) {
  const { client } = useChatGate();
  const { controller, state } = useChatGateConversation(conversationId);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<ChatGateMessage>();
  const [recording, setRecording] = useState(false);
  const [localError, setLocalError] = useState<string>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const recorderRef = useRef<MediaRecorder | undefined>(undefined);
  const recordingStreamRef = useRef<MediaStream | undefined>(undefined);
  const recordingChunksRef = useRef<Blob[]>([]);
  const messagesRef = useRef<HTMLDivElement>(null);
  const previousMessagesRef = useRef<{
    conversationId: string | undefined;
    firstId: string | undefined;
    lastId: string | undefined;
    count: number;
  }>(undefined);
  const assigneeId = state.thread?.assigneeId ?? state.thread?.createdBy?.id;
  const agentOnline = assigneeId ? state.onlineUserIds.includes(assigneeId) : false;

  useEffect(() => () => {
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.ondataavailable = null;
      recorderRef.current.onstop = null;
      recorderRef.current.stop();
    }
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  useEffect(() => {
    const element = messagesRef.current;
    const messages = state.messages;
    if (!element) return;
    const previous = previousMessagesRef.current;
    const firstId = messages[0]?.id;
    const lastMessage = messages[messages.length - 1];
    const prepended = previous
      && previous.lastId === lastMessage?.id
      && previous.firstId !== firstId
      && messages.length > previous.count;
    const conversationChanged = previous?.conversationId !== state.conversationId;
    const newMessage = previous && previous.lastId !== lastMessage?.id && !prepended;
    const nearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!previous || conversationChanged || (newMessage && (nearBottom || lastMessage?.senderId === client.session?.userId))) {
      element.scrollTo({ top: element.scrollHeight, behavior: reducedMotion ? "auto" : "smooth" });
    }
    previousMessagesRef.current = {
      conversationId: state.conversationId,
      firstId,
      lastId: lastMessage?.id,
      count: messages.length,
    };
  }, [client.session?.userId, state.conversationId, state.messages]);

  function notifyTyping(value: string) {
    setDraft(value);
    controller.setTyping(Boolean(value.trim()));
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => controller.setTyping(false), 2_000);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || state.sending) return;
    setDraft("");
    setLocalError(undefined);
    try {
      await controller.sendMessage({
        content,
        messageType: "text",
        ...(replyTo ? { replyToId: replyTo.id } : {}),
      });
      setReplyTo(undefined);
    } catch {
      setDraft(content);
    }
  }

  async function uploadFile(file: File, forcedType?: Exclude<ChatGateMessageType, "encrypted">) {
    if (file.size > maxFileSizeBytes) {
      setLocalError(`File is larger than ${formatFileSize(maxFileSizeBytes)}.`);
      return;
    }
    setLocalError(undefined);
    const messageType = forcedType ?? messageTypeForFile(file);
    try {
      await controller.uploadAndSend(
        { value: file, name: file.name, mimeType: file.type },
        {
          content: messageType === "voice" ? "Voice message" : draft.trim(),
          messageType,
          ...(replyTo ? { replyToId: replyTo.id } : {}),
        },
      );
      setDraft("");
      setReplyTo(undefined);
    } catch {
      // The controller exposes the normalized error in state.error.
    }
  }

  function onFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (file) void uploadFile(file);
  }

  async function startRecording() {
    setLocalError(undefined);
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setLocalError("Voice recording is not supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recordingStreamRef.current = stream;
      recorderRef.current = recorder;
      recordingChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordingChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const type = recorder.mimeType || "audio/webm";
        const extension = type.includes("ogg") ? "ogg" : type.includes("mp4") ? "m4a" : "webm";
        const file = new File(recordingChunksRef.current, `voice-${Date.now()}.${extension}`, { type });
        recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
        recordingStreamRef.current = undefined;
        recorderRef.current = undefined;
        setRecording(false);
        void uploadFile(file, "voice");
      };
      recorder.start();
      setRecording(true);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Microphone permission was denied.");
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  const typingLabel = state.typingUsers.length > 0
    ? `${state.typingUsers[0]?.username ?? "Support"} is typing...`
    : "";

  return (
    <section
      data-chatgate-conversation
      className={className}
      style={{ ...styles.root, ...createChatGateThemeVariables(theme), ...style }}
      aria-label={title}
    >
      <style>{componentCss}</style>
      {header === "full" ? (
        <header className="cg-chat-header" style={styles.header}>
          <div style={styles.identity}>
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                aria-label="Back to conversations"
                title="Back to conversations"
                style={styles.backButton}
              >
                <Icon name="back" />
              </button>
            ) : null}
            <span aria-hidden="true" style={styles.avatar}><Icon name="chat" size={21} /></span>
            <span style={styles.identityText}>
              <span style={styles.title}>{title}</span>
              <span style={styles.subtitle}>{agentOnline ? "Usually replies instantly" : "We are here to help"}</span>
            </span>
          </div>
          <span style={styles.presence}>
            <span
              aria-hidden="true"
              style={{
                ...styles.presenceDot,
                ...(agentOnline ? { background: "var(--cg-online, #22c55e)", boxShadow: "0 0 0 3px color-mix(in srgb, var(--cg-online, #22c55e) 14%, transparent)" } : {}),
              }}
            />
            {agentOnline ? "Online" : "Support"}
          </span>
        </header>
      ) : header === "minimal" ? (
        <header className="cg-chat-header" style={styles.headerMinimal}>
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              aria-label="Back to conversations"
              title="Back to conversations"
              style={styles.backButtonGhost}
            >
              <Icon name="back" />
            </button>
          ) : null}
          <span style={styles.headerMinimalTitle}>{title}</span>
          <span
            aria-hidden="true"
            title={agentOnline ? "Online" : "Support"}
            style={{
              ...styles.minimalDot,
              ...(agentOnline ? { background: "var(--cg-online, #22c55e)", boxShadow: "0 0 0 3px color-mix(in srgb, var(--cg-online, #22c55e) 14%, transparent)" } : {}),
            }}
          />
        </header>
      ) : onBack ? (
        <div className="cg-chat-header" style={styles.headerBackOnly}>
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to conversations"
            title="Back to conversations"
            style={styles.backButtonGhost}
          >
            <Icon name="back" />
          </button>
        </div>
      ) : null}
      {state.error || localError ? (
        <div style={styles.error} role="alert">
          <span>{localError ?? state.error?.message}</span>
          {state.error ? <button type="button" style={styles.retryButton} onClick={() => void controller.reload()}>Retry</button> : null}
        </div>
      ) : null}
      <div ref={messagesRef} className="cg-message-list" style={styles.messages} aria-live="polite" aria-busy={state.loading}>
        {state.thread?.nextCursor ? (
          <button style={styles.loadEarlier} type="button" disabled={state.loadingOlder} onClick={() => void controller.loadOlder()}>
            {state.loadingOlder ? "Loading..." : "Load earlier messages"}
          </button>
        ) : null}
        {state.loading && state.messages.length === 0 ? <div style={styles.status}>Loading conversation...</div> : null}
        {!state.loading && state.messages.length === 0 ? (
          <div style={styles.status}>
            <span aria-hidden="true" style={styles.emptyIcon}><Icon name="chat" size={22} /></span>
            <strong style={styles.emptyTitle}>Start a conversation</strong>
            <span>{emptyState}</span>
          </div>
        ) : null}
        {state.messages.map((message) => {
          const own = message.senderId === client.session?.userId;
          const role = resolveMessageRole(message, state.thread);
          return renderMessage ? (
            <div key={message.id}>{renderMessage(message, own, role)}</div>
          ) : (
            <DefaultMessage
              key={message.id}
              message={message}
              own={own}
              role={role}
              showRoleBadge={showRoleBadge}
              roleLabels={roleLabels}
              onReply={() => setReplyTo(message)}
              onReact={(emoji) => void controller.toggleReaction(message.id, emoji)}
              onEdit={() => {
                const next = window.prompt("Edit message", message.content);
                if (next?.trim()) void controller.editMessage(message.id, next);
              }}
              onDelete={() => {
                if (window.confirm("Delete this message?")) void controller.deleteMessage(message.id);
              }}
            />
          );
        })}
      </div>
      <div style={styles.typing} role="status">{typingLabel}</div>
      <form className="cg-composer" style={styles.composer} onSubmit={submit}>
        {replyTo ? (
          <div style={styles.replyBanner}>
            <span>Replying to {attachmentLabel(replyTo)}</span>
            <button type="button" style={styles.cancelReply} onClick={() => setReplyTo(undefined)}>Cancel</button>
          </div>
        ) : null}
        <div style={styles.composerRow}>
          {allowAttachments ? (
            <>
              <input ref={fileInputRef} type="file" accept={acceptedFileTypes} hidden onChange={onFileSelected} />
              <input ref={imageInputRef} type="file" accept="image/*" hidden onChange={onFileSelected} />
              <button
                className="cg-tool-button"
                type="button"
                style={styles.toolButton}
                disabled={state.sending || recording}
                onClick={() => fileInputRef.current?.click()}
                aria-label="Attach file"
                title="Attach file"
              >
                <Icon name="attach" />
              </button>
              <button
                className="cg-tool-button"
                type="button"
                style={styles.toolButton}
                disabled={state.sending || recording}
                onClick={() => imageInputRef.current?.click()}
                aria-label="Send a photo"
                title="Send a photo"
              >
                <Icon name="image" />
              </button>
            </>
          ) : null}
          {allowVoice ? (
            <button
              className={recording ? "cg-tool-button cg-recording" : "cg-tool-button"}
              type="button"
              style={{ ...styles.toolButton, ...(recording ? { background: "color-mix(in srgb, var(--cg-danger, #ef4444) 10%, transparent)", color: "var(--cg-danger, #b91c1c)" } : {}) }}
              disabled={state.sending && !recording}
              onClick={recording ? stopRecording : () => void startRecording()}
              aria-label={recording ? "Stop recording" : "Record voice message"}
              aria-pressed={recording}
              title={recording ? "Stop recording" : "Record voice message"}
            >
              <Icon name={recording ? "stop" : "microphone"} />
            </button>
          ) : null}
          <input
            aria-label="Message"
            style={styles.input}
            value={draft}
            placeholder={recording ? "Recording voice..." : placeholder}
            disabled={state.sending || recording}
            onBlur={() => controller.setTyping(false)}
            onChange={(event) => notifyTyping(event.currentTarget.value)}
          />
          <button
            className="cg-send-button"
            style={styles.sendButton}
            type="submit"
            disabled={state.sending || recording || !draft.trim()}
          >
            <span className="cg-send-label">{state.uploading ? "Uploading" : state.sending ? "Sending" : "Send"}</span>
            <Icon name="send" size={17} />
          </button>
        </div>
        <div className="cg-composer-footer" style={styles.composerFooter}>
          {recording ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "var(--cg-danger, #b91c1c)", fontWeight: 700 }}>
              <span className="cg-recording-dot" aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 999, background: "var(--cg-danger, #dc2626)" }} />
              Recording voice message…
            </span>
          ) : (
            <span>Powered by ChatGate</span>
          )}
          <span>Press Enter to send</span>
        </div>
      </form>
    </section>
  );
}
