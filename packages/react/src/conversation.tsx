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
import type { ChatGateMessage, ChatGateMessageType } from "@chatgate/core";
import { useChatGate } from "./context.js";
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
  renderMessage?: (message: ChatGateMessage, own: boolean) => ReactNode;
}

const styles: Record<string, CSSProperties> = {
  root: { display: "flex", flexDirection: "column", minHeight: 480, overflow: "hidden", border: "1px solid #dbe3ef", borderRadius: 16, background: "#fff", color: "#0f172a" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 16px", borderBottom: "1px solid #e2e8f0", fontWeight: 700 },
  presence: { display: "flex", alignItems: "center", gap: 6, color: "#64748b", fontSize: 12, fontWeight: 600 },
  presenceDot: { width: 8, height: 8, borderRadius: 999, background: "#94a3b8" },
  messages: { display: "flex", flex: 1, flexDirection: "column", gap: 10, overflowY: "auto", padding: 16, minHeight: 280 },
  messageRow: { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4 },
  messageRowOwn: { alignItems: "flex-end" },
  own: { maxWidth: "82%", padding: "9px 12px", borderRadius: "14px 14px 4px 14px", background: "#2563eb", color: "#fff", whiteSpace: "pre-wrap", overflowWrap: "anywhere" },
  other: { maxWidth: "82%", padding: "9px 12px", borderRadius: "14px 14px 14px 4px", background: "#eff4fa", color: "#0f172a", whiteSpace: "pre-wrap", overflowWrap: "anywhere" },
  replyQuote: { marginBottom: 7, padding: "6px 8px", borderLeft: "3px solid currentColor", borderRadius: 6, background: "rgba(148,163,184,.18)", fontSize: 12, opacity: 0.85 },
  image: { display: "block", width: "min(100%, 320px)", maxHeight: 300, borderRadius: 10, objectFit: "cover" },
  audio: { display: "block", width: "min(280px, 70vw)", maxWidth: "100%" },
  fileLink: { display: "inline-flex", alignItems: "center", gap: 6, color: "inherit", fontWeight: 700 },
  messageMeta: { display: "flex", alignItems: "center", gap: 6, marginTop: 5, fontSize: 10, opacity: 0.72 },
  actions: { display: "flex", gap: 4, padding: "0 3px" },
  action: { border: 0, background: "transparent", color: "#64748b", padding: "2px 4px", fontSize: 11, cursor: "pointer" },
  reactions: { display: "flex", flexWrap: "wrap", gap: 3, marginTop: 5 },
  reaction: { border: "1px solid rgba(148,163,184,.45)", borderRadius: 999, background: "rgba(255,255,255,.25)", color: "inherit", padding: "1px 6px", fontSize: 11, cursor: "pointer" },
  composer: { display: "flex", flexDirection: "column", gap: 8, padding: 12, borderTop: "1px solid #e2e8f0" },
  replyBanner: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "7px 10px", borderRadius: 10, background: "#eff6ff", color: "#1e40af", fontSize: 12 },
  composerRow: { display: "flex", alignItems: "center", gap: 8 },
  input: { minWidth: 0, flex: 1, border: "1px solid #cbd5e1", borderRadius: 12, padding: "10px 12px", font: "inherit" },
  button: { border: 0, borderRadius: 12, padding: "10px 16px", background: "#2563eb", color: "#fff", fontWeight: 700, cursor: "pointer" },
  toolButton: { border: "1px solid #cbd5e1", borderRadius: 10, padding: "9px 10px", background: "#fff", color: "#334155", fontWeight: 700, cursor: "pointer" },
  status: { margin: "auto", padding: 24, color: "#64748b", textAlign: "center" },
  error: { margin: 12, padding: 10, borderRadius: 10, background: "#fef2f2", color: "#b91c1c" },
  typing: { minHeight: 18, padding: "0 16px 7px", color: "#64748b", fontSize: 12 },
};

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
  onReply,
  onReact,
  onEdit,
  onDelete,
}: {
  message: ChatGateMessage;
  own: boolean;
  onReply: () => void;
  onReact: (emoji: string) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const reactionCounts = new Map<string, number>();
  for (const reaction of message.reactions ?? []) {
    reactionCounts.set(reaction.emoji, (reactionCounts.get(reaction.emoji) ?? 0) + 1);
  }

  return (
    <div style={{ ...styles.messageRow, ...(own ? styles.messageRowOwn : {}) }}>
      <div style={own ? styles.own : styles.other}>
        {message.replyTo ? <div style={styles.replyQuote}>{attachmentLabel(message.replyTo)}</div> : null}
        {message.messageType === "image" && message.fileUrl ? (
          <a href={message.fileUrl} target="_blank" rel="noreferrer">
            <img src={message.fileUrl} alt={message.fileName ?? "Shared image"} style={styles.image} />
          </a>
        ) : null}
        {message.messageType === "voice" && message.fileUrl ? (
          <audio controls preload="metadata" src={message.fileUrl} style={styles.audio}>
            <a href={message.fileUrl}>Download voice message</a>
          </audio>
        ) : null}
        {message.messageType === "file" && message.fileUrl ? (
          <a href={message.fileUrl} target="_blank" rel="noreferrer" download={message.fileName ?? undefined} style={styles.fileLink}>
            <span aria-hidden="true">&#128206;</span>
            <span>{message.fileName ?? "Download attachment"}{message.fileSize ? ` · ${formatFileSize(message.fileSize)}` : ""}</span>
          </a>
        ) : null}
        {message.content && !(message.messageType === "voice" && message.content === "Voice message") ? <div>{message.content}</div> : null}
        {reactionCounts.size > 0 ? (
          <div style={styles.reactions} aria-label="Message reactions">
            {[...reactionCounts].map(([emoji, count]) => (
              <button key={emoji} type="button" style={styles.reaction} onClick={() => onReact(emoji)}>{emoji} {count}</button>
            ))}
          </div>
        ) : null}
        <div style={styles.messageMeta}>
          <span>{formatTime(message.createdAt)}</span>
          {own ? <span>{message.read ? "Seen" : "Sent"}</span> : null}
        </div>
      </div>
      <div style={styles.actions}>
        <button type="button" style={styles.action} onClick={onReply}>Reply</button>
        {(["👍", "❤️", "😂"] as const).map((emoji) => (
          <button key={emoji} type="button" style={styles.action} aria-label={`React ${emoji}`} onClick={() => onReact(emoji)}>{emoji}</button>
        ))}
        {own && message.messageType === "text" ? <button type="button" style={styles.action} onClick={onEdit}>Edit</button> : null}
        {own ? <button type="button" style={styles.action} onClick={onDelete}>Delete</button> : null}
      </div>
    </div>
  );
}

export function ChatGateConversation({
  conversationId,
  title = "Support",
  placeholder = "Write a message…",
  emptyState = "No messages yet. Start the conversation.",
  className,
  style,
  allowAttachments = true,
  allowVoice = true,
  acceptedFileTypes,
  maxFileSizeBytes = 25 * 1024 * 1024,
  renderMessage,
}: ChatGateConversationProps) {
  const { client } = useChatGate();
  const { controller, state } = useChatGateConversation(conversationId);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<ChatGateMessage>();
  const [recording, setRecording] = useState(false);
  const [localError, setLocalError] = useState<string>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const recorderRef = useRef<MediaRecorder | undefined>(undefined);
  const recordingStreamRef = useRef<MediaStream | undefined>(undefined);
  const recordingChunksRef = useRef<Blob[]>([]);
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
    ? `${state.typingUsers[0]?.username ?? "Support"} is typing…`
    : "";

  return (
    <section className={className} style={{ ...styles.root, ...style }} aria-label={title}>
      <header style={styles.header}>
        <span>{title}</span>
        <span style={styles.presence}>
          <span aria-hidden="true" style={{ ...styles.presenceDot, background: agentOnline ? "#22c55e" : "#94a3b8" }} />
          {agentOnline ? "Online" : "Support team"}
        </span>
      </header>
      {state.error || localError ? (
        <div style={styles.error} role="alert">
          {localError ?? state.error?.message}{" "}
          {state.error ? <button type="button" onClick={() => void controller.reload()}>Retry</button> : null}
        </div>
      ) : null}
      <div style={styles.messages} aria-live="polite" aria-busy={state.loading}>
        {state.thread?.nextCursor ? (
          <button type="button" disabled={state.loadingOlder} onClick={() => void controller.loadOlder()}>
            {state.loadingOlder ? "Loading…" : "Load earlier messages"}
          </button>
        ) : null}
        {state.loading && state.messages.length === 0 ? <div style={styles.status}>Loading conversation…</div> : null}
        {!state.loading && state.messages.length === 0 ? <div style={styles.status}>{emptyState}</div> : null}
        {state.messages.map((message) => {
          const own = message.senderId === client.session?.userId;
          return (
            <div key={message.id}>
              {renderMessage ? renderMessage(message, own) : (
                <DefaultMessage
                  message={message}
                  own={own}
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
              )}
            </div>
          );
        })}
      </div>
      <div style={styles.typing} role="status">{typingLabel}</div>
      <form style={styles.composer} onSubmit={submit}>
        {replyTo ? (
          <div style={styles.replyBanner}>
            <span>Replying to {attachmentLabel(replyTo)}</span>
            <button type="button" style={styles.action} onClick={() => setReplyTo(undefined)}>Cancel</button>
          </div>
        ) : null}
        <div style={styles.composerRow}>
          {allowAttachments ? (
            <>
              <input ref={fileInputRef} type="file" accept={acceptedFileTypes} hidden onChange={onFileSelected} />
              <button type="button" style={styles.toolButton} disabled={state.sending || recording} onClick={() => fileInputRef.current?.click()} aria-label="Attach file">
                Attach
              </button>
            </>
          ) : null}
          {allowVoice ? (
            <button type="button" style={{ ...styles.toolButton, ...(recording ? { background: "#fee2e2", color: "#b91c1c" } : {}) }} disabled={state.sending && !recording} onClick={recording ? stopRecording : () => void startRecording()}>
              {recording ? "Stop" : "Voice"}
            </button>
          ) : null}
          <input
            aria-label="Message"
            style={styles.input}
            value={draft}
            placeholder={recording ? "Recording voice…" : placeholder}
            disabled={state.sending || recording}
            onBlur={() => controller.setTyping(false)}
            onChange={(event) => notifyTyping(event.currentTarget.value)}
          />
          <button style={styles.button} type="submit" disabled={state.sending || recording || !draft.trim()}>
            {state.uploading ? "Uploading…" : state.sending ? "Sending…" : "Send"}
          </button>
        </div>
      </form>
    </section>
  );
}
