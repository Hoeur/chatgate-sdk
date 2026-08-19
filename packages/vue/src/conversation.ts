import {
  defineComponent,
  h,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  watch,
  type CSSProperties,
  type PropType,
  type VNodeChild,
} from "vue";
import {
  resolveMessageRole,
  sanitizeUrl,
  CHATGATE_ROLE_LABELS,
  type ChatGateMessage,
  type ChatGateMessageType,
  type ChatGateParticipantRole,
} from "@chatgate/core";
import { icon } from "./icons.js";
import { useChatGate } from "./plugin.js";
import { createChatGateThemeVariables, type ChatGateTheme } from "./theme.js";
import { useChatGateConversation } from "./use-conversation.js";

const QUICK_REACTIONS = ["\u{1F44D}", "❤️", "\u{1F602}"] as const;

const componentCss = `
  [data-chatgate-conversation] * { box-sizing: border-box; }
  [data-chatgate-conversation] button,
  [data-chatgate-conversation] input { font: inherit; }
  [data-chatgate-conversation] button:focus-visible,
  [data-chatgate-conversation] input:focus-visible {
    outline: 3px solid color-mix(in srgb, var(--cg-accent, #2563eb) 24%, transparent);
    outline-offset: 2px;
  }
  [data-chatgate-conversation] .cg-tool-button:hover:not(:disabled),
  [data-chatgate-conversation] .cg-message-action:hover { background: #eff4fb !important; }
  [data-chatgate-conversation] .cg-send-button:hover:not(:disabled) { background: var(--cg-accent-hover, #1d4ed8) !important; }
  [data-chatgate-conversation] button:disabled { cursor: not-allowed !important; opacity: .52; }
  [data-chatgate-conversation] .cg-message-image { transition: transform 160ms ease; }
  [data-chatgate-conversation] .cg-message-image:hover { transform: scale(1.012); }
  [data-chatgate-conversation] .cg-recording { animation: cg-pulse 1.2s ease-in-out infinite; }
  @keyframes cg-pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, .35); }
    50% { box-shadow: 0 0 0 7px rgba(220, 38, 38, 0); }
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
    minHeight: "520px",
    height: "min(680px, calc(100dvh - 32px))",
    maxHeight: "760px",
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
    gap: "16px",
    minHeight: "72px",
    padding: "14px 18px",
    borderBottom: "1px solid var(--cg-border, #e5ebf4)",
    background: "var(--cg-surface, #fff)",
  },
  headerMinimal: { display: "flex", alignItems: "center", gap: "10px", padding: "11px 14px", borderBottom: "1px solid var(--cg-border, #e5ebf4)", background: "var(--cg-surface, #fff)" },
  headerBackOnly: { display: "flex", padding: "8px 12px", background: "var(--cg-surface, #fff)" },
  identity: { display: "flex", alignItems: "center", minWidth: "0", gap: "11px" },
  backButton: {
    display: "grid",
    flex: "0 0 auto",
    width: "36px",
    height: "36px",
    placeItems: "center",
    border: "1px solid #dce5f1",
    borderRadius: "12px",
    background: "#f8fafc",
    color: "#334155",
    cursor: "pointer",
  },
  avatar: {
    display: "grid",
    flex: "0 0 auto",
    width: "42px",
    height: "42px",
    placeItems: "center",
    borderRadius: "14px",
    background: "var(--cg-accent, #2563eb)",
    boxShadow: "0 8px 18px rgba(37, 99, 235, .24)",
    color: "#fff",
  },
  identityText: { display: "flex", minWidth: "0", flexDirection: "column", gap: "2px" },
  title: { overflow: "hidden", fontSize: "15px", fontWeight: "760", lineHeight: "1.3", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  subtitle: { color: "var(--cg-muted, #64748b)", fontSize: "11.5px", lineHeight: "1.4" },
  presence: {
    display: "inline-flex",
    flex: "0 0 auto",
    alignItems: "center",
    gap: "7px",
    padding: "7px 10px",
    border: "1px solid #dce5f1",
    borderRadius: "999px",
    background: "#f8fafc",
    color: "#52627a",
    fontSize: "11.5px",
    fontWeight: "700",
  },
  presenceDot: { width: "8px", height: "8px", borderRadius: "999px", background: "#94a3b8", boxShadow: "0 0 0 3px rgba(148,163,184,.14)" },
  presenceDotOnline: { background: "#22c55e", boxShadow: "0 0 0 3px rgba(34,197,94,.14)" },
  messages: {
    display: "flex",
    minHeight: "0",
    flex: "1",
    flexDirection: "column",
    gap: "8px",
    overflowY: "auto",
    padding: "20px 18px",
    background: "var(--cg-canvas, linear-gradient(180deg, #f8fbff 0%, #f4f7fb 100%))",
  },
  messageRow: { display: "flex", width: "fit-content", maxWidth: "min(78%, 460px)", flexDirection: "column", alignItems: "flex-start", gap: "3px" },
  messageRowOwn: { alignSelf: "flex-end", alignItems: "flex-end" },
  roleBadge: { display: "inline-flex", alignItems: "center", alignSelf: "flex-start", marginBottom: "4px", padding: "1px 8px", borderRadius: "999px", fontSize: "10px", fontWeight: 700, letterSpacing: "0.3px", textTransform: "uppercase" },
  bubble: {
    minWidth: "48px",
    padding: "9px 12px 8px",
    border: "1px solid #e0e7f0",
    borderRadius: "17px 17px 17px 6px",
    background: "#fff",
    boxShadow: "0 4px 14px rgba(15, 23, 42, .055)",
    color: "#172033",
    fontSize: "14px",
    lineHeight: "1.45",
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
  mediaBubble: { width: "min(370px, 72vw)", padding: "6px" },
  replyQuote: { marginBottom: "7px", padding: "7px 9px", borderLeft: "3px solid currentColor", borderRadius: "8px", background: "rgba(148,163,184,.16)", fontSize: "11.5px", opacity: "0.86" },
  imageLink: { display: "block", overflow: "hidden", borderRadius: "12px", background: "#e8eef7" },
  image: { display: "block", width: "100%", maxHeight: "310px", borderRadius: "12px", objectFit: "cover" },
  audio: { display: "block", width: "min(300px, 68vw)", maxWidth: "100%" },
  fileLink: { display: "flex", alignItems: "center", gap: "10px", minWidth: "210px", color: "inherit", fontWeight: "720", textDecoration: "none" },
  fileIcon: { display: "grid", flex: "0 0 auto", width: "36px", height: "36px", placeItems: "center", borderRadius: "10px", background: "rgba(148,163,184,.18)" },
  fileText: { display: "flex", minWidth: "0", flexDirection: "column", gap: "1px" },
  fileName: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  fileSize: { fontSize: "10.5px", fontWeight: "600", opacity: "0.7" },
  messageMeta: { display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "6px", marginTop: "5px", fontSize: "9.5px", fontWeight: "650", opacity: "0.68" },
  messageFooter: { display: "flex", alignItems: "center", gap: "6px", minHeight: "24px" },
  reactions: { display: "flex", flexWrap: "wrap", gap: "4px" },
  reaction: { minHeight: "23px", padding: "1px 7px", border: "1px solid #d8e1ee", borderRadius: "999px", background: "#fff", color: "#334155", boxShadow: "0 2px 6px rgba(15,23,42,.04)", fontSize: "11px", cursor: "pointer" },
  messageAction: { minHeight: "26px", padding: "3px 7px", border: "0", borderRadius: "8px", background: "transparent", color: "#52627a", fontSize: "11px", fontWeight: "700", cursor: "pointer" },
  loadEarlier: { alignSelf: "center", marginBottom: "4px", padding: "7px 11px", border: "1px solid #d7e1ee", borderRadius: "999px", background: "rgba(255,255,255,.88)", color: "#52627a", fontSize: "11.5px", fontWeight: "700", cursor: "pointer" },
  status: { display: "grid", margin: "auto", padding: "26px", placeItems: "center", color: "#64748b", textAlign: "center" },
  emptyIcon: { display: "grid", width: "48px", height: "48px", marginBottom: "12px", placeItems: "center", border: "1px solid #d9e4f2", borderRadius: "16px", background: "#fff", boxShadow: "0 8px 22px rgba(30,64,175,.08)", color: "#2563eb" },
  emptyTitle: { marginBottom: "4px", color: "#1e293b", fontSize: "14px", fontWeight: "760" },
  error: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", margin: "10px 12px 0", padding: "9px 11px", border: "1px solid #fecaca", borderRadius: "12px", background: "#fff1f2", color: "#b42318", fontSize: "12px" },
  retryButton: { padding: "4px 8px", border: "1px solid #fda4af", borderRadius: "8px", background: "#fff", color: "#be123c", fontSize: "11px", fontWeight: "700", cursor: "pointer" },
  typing: { minHeight: "25px", padding: "5px 16px 2px", background: "#fff", color: "#64748b", fontSize: "11.5px" },
  composer: { display: "flex", flexDirection: "column", gap: "8px", padding: "9px 12px 11px", borderTop: "1px solid #e5ebf4", background: "#fff" },
  replyBanner: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", padding: "8px 10px", border: "1px solid #dbeafe", borderRadius: "11px", background: "#eff6ff", color: "#1e40af", fontSize: "11.5px" },
  cancelReply: { padding: "3px 7px", border: "0", borderRadius: "7px", background: "transparent", color: "#1d4ed8", fontSize: "11px", fontWeight: "750", cursor: "pointer" },
  composerRow: { display: "flex", alignItems: "center", gap: "5px", minHeight: "50px", padding: "4px", border: "1px solid #d4deeb", borderRadius: "16px", background: "#f8fafc", boxShadow: "0 4px 14px rgba(15,23,42,.04)" },
  input: { minWidth: "0", height: "40px", flex: "1", padding: "0 8px", border: "0", outline: "0", background: "transparent", color: "#172033", fontSize: "13.5px" },
  toolButton: { display: "grid", flex: "0 0 auto", width: "40px", height: "40px", padding: "0", placeItems: "center", border: "0", borderRadius: "11px", background: "transparent", color: "#52627a", cursor: "pointer" },
  toolButtonRecording: { background: "#fee2e2", color: "#b91c1c" },
  sendButton: { display: "inline-flex", height: "40px", alignItems: "center", justifyContent: "center", gap: "7px", padding: "0 13px", border: "0", borderRadius: "12px", background: "var(--cg-accent, #2563eb)", color: "var(--cg-accent-text, #fff)", boxShadow: "0 6px 15px rgba(37,99,235,.22)", fontSize: "12.5px", fontWeight: "760", cursor: "pointer" },
  composerFooter: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 3px", color: "#94a3b8", fontSize: "9.5px", fontWeight: "600" },
};

function fileMessageType(file: File): Exclude<ChatGateMessageType, "encrypted"> {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("audio/")) return "voice";
  return "file";
}

function messageLabel(message: ChatGateMessage): string {
  if (message.messageType === "image") return "Photo";
  if (message.messageType === "voice") return "Voice message";
  if (message.messageType === "file") return message.fileName ?? "File";
  return message.content || message.fileName || "Message";
}

function formatFileSize(size?: number | null): string {
  if (!size) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const ROLE_BADGE_COLORS: Record<ChatGateParticipantRole, { bg: string; color: string; border: string }> = {
  customer: { bg: "#eef2f7", color: "#475569", border: "#dbe2ec" },
  merchant: { bg: "#e0f2fe", color: "#0369a1", border: "#bae6fd" },
  admin: { bg: "#f3e8ff", color: "#7e22ce", border: "#e9d5ff" },
};

function roleLabel(role: ChatGateParticipantRole, overrides?: Partial<Record<ChatGateParticipantRole, string>>): string {
  return overrides?.[role] ?? CHATGATE_ROLE_LABELS[role];
}

export const chatGateConversationProps = {
  conversationId: String,
  title: { type: String, default: "Support" },
  placeholder: { type: String, default: "Write a message…" },
  allowAttachments: { type: Boolean, default: true },
  allowVoice: { type: Boolean, default: true },
  acceptedFileTypes: String,
  maxFileSizeBytes: { type: Number, default: 25 * 1024 * 1024 },
  renderMessage: Function as PropType<(message: ChatGateMessage, own: boolean, role: ChatGateParticipantRole) => VNodeChild>,
  /** Replaces the built-in "no messages yet" panel. */
  emptyState: Function as PropType<() => VNodeChild>,
  showRoleBadge: { type: Boolean, default: true },
  roleLabels: Object as PropType<Partial<Record<ChatGateParticipantRole, string>>>,
  /** Branding tokens — compiled to the `--cg-*` custom properties. */
  theme: Object as PropType<ChatGateTheme>,
  header: { type: String as PropType<"full" | "minimal" | "none">, default: "full" },
  onBack: Function as PropType<() => void>,
} as const;

export const ChatGateConversation = defineComponent({
  name: "ChatGateConversation",
  props: chatGateConversationProps,
  setup(props) {
    const client = useChatGate();
    const { controller, state } = useChatGateConversation(() => props.conversationId);
    const draft = ref("");
    const replyTo = ref<ChatGateMessage>();
    const fileInput = ref<HTMLInputElement>();
    const recording = ref(false);
    const localError = ref<string>();
    let typingTimer: ReturnType<typeof setTimeout> | undefined;
    let recorder: MediaRecorder | undefined;
    let recordingStream: MediaStream | undefined;
    let recordingChunks: Blob[] = [];
    const messagesElement = ref<HTMLElement>();
    const previousMessages = ref<{
      conversationId: string | undefined;
      firstId: string | undefined;
      lastId: string | undefined;
      count: number;
    }>();

    function scrollMessages() {
      const element = messagesElement.value;
      if (!element) return;
      const messages = state.value.messages;
      const previous = previousMessages.value;
      const firstId = messages[0]?.id;
      const lastMessage = messages[messages.length - 1];
      const prepended = previous
        && previous.lastId === lastMessage?.id
        && previous.firstId !== firstId
        && messages.length > previous.count;
      const conversationChanged = previous?.conversationId !== state.value.conversationId;
      const newMessage = previous && previous.lastId !== lastMessage?.id && !prepended;
      const nearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
      if (!previous || conversationChanged || (newMessage && (nearBottom || lastMessage?.senderId === client.session?.userId))) {
        element.scrollTop = element.scrollHeight;
      }
      previousMessages.value = {
        conversationId: state.value.conversationId,
        firstId,
        lastId: lastMessage?.id,
        count: messages.length,
      };
    }

    function setTyping(value: string) {
      draft.value = value;
      controller.setTyping(Boolean(value.trim()));
      if (typingTimer) clearTimeout(typingTimer);
      typingTimer = setTimeout(() => controller.setTyping(false), 2_000);
    }

    async function send() {
      const content = draft.value.trim();
      if (!content || state.value.sending) return;
      draft.value = "";
      localError.value = undefined;
      try {
        await controller.sendMessage({
          content,
          messageType: "text",
          ...(replyTo.value ? { replyToId: replyTo.value.id } : {}),
        });
        replyTo.value = undefined;
      } catch {
        draft.value = content;
      }
    }

    async function upload(file: File, forcedType?: Exclude<ChatGateMessageType, "encrypted">) {
      if (file.size > props.maxFileSizeBytes) {
        localError.value = `File is larger than ${formatFileSize(props.maxFileSizeBytes)}.`;
        return;
      }
      localError.value = undefined;
      const messageType = forcedType ?? fileMessageType(file);
      try {
        await controller.uploadAndSend(
          { value: file, name: file.name, mimeType: file.type },
          {
            messageType,
            content: messageType === "voice" ? "Voice message" : draft.value.trim(),
            ...(replyTo.value ? { replyToId: replyTo.value.id } : {}),
          },
        );
        draft.value = "";
        replyTo.value = undefined;
      } catch {
        // Controller state carries the normalized error.
      }
    }

    function selectedFile(event: Event) {
      const input = event.currentTarget as HTMLInputElement;
      const file = input.files?.[0];
      input.value = "";
      if (file) void upload(file);
    }

    async function startRecording() {
      localError.value = undefined;
      if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        localError.value = "Voice recording is not supported in this browser.";
        return;
      }
      try {
        recordingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        recorder = new MediaRecorder(recordingStream);
        recordingChunks = [];
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) recordingChunks.push(event.data);
        };
        recorder.onstop = () => {
          const type = recorder?.mimeType || "audio/webm";
          const extension = type.includes("ogg") ? "ogg" : type.includes("mp4") ? "m4a" : "webm";
          const file = new File(recordingChunks, `voice-${Date.now()}.${extension}`, { type });
          recordingStream?.getTracks().forEach((track) => track.stop());
          recordingStream = undefined;
          recorder = undefined;
          recording.value = false;
          void upload(file, "voice");
        };
        recorder.start();
        recording.value = true;
      } catch (error) {
        localError.value = error instanceof Error ? error.message : "Microphone permission was denied.";
      }
    }

    function stopRecording() {
      if (recorder?.state === "recording") recorder.stop();
    }

    onUnmounted(() => {
      if (typingTimer) clearTimeout(typingTimer);
      if (recorder?.state === "recording") {
        recorder.ondataavailable = null;
        recorder.onstop = null;
        recorder.stop();
      }
      recordingStream?.getTracks().forEach((track) => track.stop());
    });
    onMounted(() => void nextTick(scrollMessages));
    watch(
      () => [state.value.conversationId, state.value.messages] as const,
      () => void nextTick(scrollMessages),
    );

    function defaultMessage(message: ChatGateMessage, own: boolean, role: ChatGateParticipantRole): VNodeChild {
      const roleColor = ROLE_BADGE_COLORS[role];
      const fileUrl = sanitizeUrl(message.fileUrl);
      const hasMedia = (message.messageType === "image" || message.messageType === "voice") && Boolean(fileUrl);
      const bubbleChildren: VNodeChild[] = [];
      if (message.replyTo) {
        bubbleChildren.push(h("div", { style: styles.replyQuote }, messageLabel(message.replyTo)));
      }
      if (message.messageType === "image" && fileUrl) {
        bubbleChildren.push(h("a", { href: fileUrl, target: "_blank", rel: "noopener noreferrer", style: styles.imageLink }, [
          h("img", { class: "cg-message-image", src: fileUrl, alt: message.fileName ?? "Shared image", style: styles.image }),
        ]));
      } else if (message.messageType === "voice" && fileUrl) {
        bubbleChildren.push(h("audio", { controls: true, preload: "metadata", src: fileUrl, style: styles.audio }));
      } else if (message.messageType === "file" && fileUrl) {
        bubbleChildren.push(h("a", { href: fileUrl, target: "_blank", rel: "noopener noreferrer", download: message.fileName ?? undefined, style: styles.fileLink }, [
          h("span", { "aria-hidden": "true", style: styles.fileIcon }, [icon("file")]),
          h("span", { style: styles.fileText }, [
            h("span", { style: styles.fileName }, message.fileName ?? "Download attachment"),
            message.fileSize ? h("span", { style: styles.fileSize }, formatFileSize(message.fileSize)) : null,
          ]),
        ]));
      }
      if (message.content && !(message.messageType === "voice" && message.content === "Voice message")) {
        bubbleChildren.push(h("div", message.content));
      }
      bubbleChildren.push(h("div", { style: { ...styles.messageMeta, color: own ? "#dbeafe" : "#64748b" } }, [
        h("span", formatTime(message.createdAt)),
        own ? h("span", message.read ? "Seen" : "Sent") : null,
      ]));

      const reactionCounts = new Map<string, number>();
      for (const reaction of message.reactions ?? []) {
        reactionCounts.set(reaction.emoji, (reactionCounts.get(reaction.emoji) ?? 0) + 1);
      }

      return h("article", {
        key: message.id,
        class: "cg-message",
        style: { ...styles.messageRow, ...(own ? styles.messageRowOwn : {}) },
        "data-role": role,
      }, [
        props.showRoleBadge && !own
          ? h("span", { class: "cg-role-badge", "data-role": role, style: { ...styles.roleBadge, background: roleColor.bg, color: roleColor.color, border: `1px solid ${roleColor.border}` } }, roleLabel(role, props.roleLabels))
          : null,
        h("div", { style: { ...styles.bubble, ...(own ? styles.bubbleOwn : { borderLeft: `3px solid ${roleColor.color}` }), ...(hasMedia ? styles.mediaBubble : {}) } }, bubbleChildren),
        h("div", { style: { ...styles.messageFooter, ...(own ? { justifyContent: "flex-end" } : {}) } }, [
          reactionCounts.size > 0
            ? h("div", { style: styles.reactions, "aria-label": "Message reactions" }, [...reactionCounts].map(([emoji, count]) =>
                h("button", { key: emoji, type: "button", style: styles.reaction, onClick: () => void controller.toggleReaction(message.id, emoji) }, `${emoji} ${count}`)))
            : null,
          h("button", { class: "cg-message-action", type: "button", style: styles.messageAction, onClick: () => { replyTo.value = message; } }, "Reply"),
          ...QUICK_REACTIONS.map((emoji) =>
            h("button", {
              class: "cg-message-action",
              key: emoji,
              type: "button",
              style: styles.messageAction,
              "aria-label": `React ${emoji}`,
              title: `React ${emoji}`,
              onClick: () => void controller.toggleReaction(message.id, emoji),
            }, emoji)),
          own && message.messageType === "text"
            ? h("button", { class: "cg-message-action", type: "button", style: styles.messageAction, onClick: () => { const value = window.prompt("Edit message", message.content); if (value?.trim()) void controller.editMessage(message.id, value); } }, "Edit")
            : null,
          own
            ? h("button", { class: "cg-message-action", type: "button", style: { ...styles.messageAction, color: "#be123c" }, onClick: () => { if (window.confirm("Delete this message?")) void controller.deleteMessage(message.id); } }, "Delete")
            : null,
        ]),
      ]);
    }

    return () => {
      const assigneeId = state.value.thread?.assigneeId ?? state.value.thread?.createdBy?.id;
      const online = assigneeId ? state.value.onlineUserIds.includes(assigneeId) : false;
      const typing = state.value.typingUsers[0];
      return h("section", {
        "data-chatgate-conversation": "",
        style: { ...styles.root, ...createChatGateThemeVariables(props.theme) },
        "aria-label": props.title,
      }, [
        h("style", componentCss),
        props.header === "none"
          ? (props.onBack
              ? h("header", { style: styles.headerBackOnly }, [
                  h("button", { type: "button", "aria-label": "Back to conversations", title: "Back to conversations", style: styles.backButton, onClick: props.onBack }, [icon("back")]),
                ])
              : null)
          : props.header === "minimal"
            ? h("header", { class: "cg-chat-header", style: styles.headerMinimal }, [
                props.onBack
                  ? h("button", { type: "button", "aria-label": "Back to conversations", title: "Back to conversations", style: styles.backButton, onClick: props.onBack }, [icon("back")])
                  : null,
                h("span", { style: { ...styles.title, flex: "1" } }, props.title),
                h("span", { "aria-hidden": "true", style: { ...styles.presenceDot, ...(online ? styles.presenceDotOnline : {}) } }),
              ])
            : h("header", { class: "cg-chat-header", style: styles.header }, [
                h("div", { style: styles.identity }, [
                  props.onBack
                    ? h("button", { type: "button", "aria-label": "Back to conversations", title: "Back to conversations", style: styles.backButton, onClick: props.onBack }, [icon("back")])
                    : null,
                  h("span", { "aria-hidden": "true", style: styles.avatar }, [icon("chat", 21)]),
                  h("span", { style: styles.identityText }, [
                    h("span", { style: styles.title }, props.title),
                    h("span", { style: styles.subtitle }, online ? "Usually replies instantly" : "We are here to help"),
                  ]),
                ]),
                h("span", { style: styles.presence }, [
                  h("span", { "aria-hidden": "true", style: { ...styles.presenceDot, ...(online ? styles.presenceDotOnline : {}) } }),
                  online ? "Online" : "Support",
                ]),
              ]),
        state.value.error || localError.value
          ? h("div", { role: "alert", style: styles.error }, [
              h("span", localError.value ?? state.value.error?.message),
              state.value.error ? h("button", { type: "button", style: styles.retryButton, onClick: () => void controller.reload() }, "Retry") : null,
            ])
          : null,
        h("div", { ref: messagesElement, class: "cg-message-list", style: styles.messages, "aria-live": "polite", "aria-busy": state.value.loading }, [
          state.value.thread?.nextCursor
            ? h("button", { type: "button", style: styles.loadEarlier, disabled: state.value.loadingOlder, onClick: () => void controller.loadOlder() }, state.value.loadingOlder ? "Loading…" : "Load earlier messages")
            : null,
          state.value.loading && state.value.messages.length === 0
            ? h("div", { style: styles.status }, "Loading conversation…")
            : null,
          !state.value.loading && state.value.messages.length === 0
            ? props.emptyState?.() ?? h("div", { style: styles.status }, [
                h("span", { "aria-hidden": "true", style: styles.emptyIcon }, [icon("chat", 22)]),
                h("strong", { style: styles.emptyTitle }, "Start a conversation"),
                h("span", "No messages yet. Start the conversation."),
              ])
            : null,
          ...state.value.messages.map((message) => {
            const own = message.senderId === client.session?.userId;
            const role = resolveMessageRole(message, state.value.thread);
            return props.renderMessage?.(message, own, role) ?? defaultMessage(message, own, role);
          }),
        ]),
        h("div", { style: styles.typing, role: "status" }, typing ? `${typing.username ?? "Support"} is typing…` : ""),
        h("form", { class: "cg-composer", style: styles.composer, onSubmit: (event: Event) => { event.preventDefault(); void send(); } }, [
          replyTo.value
            ? h("div", { style: styles.replyBanner }, [
                h("span", `Replying to ${messageLabel(replyTo.value)}`),
                h("button", { type: "button", style: styles.cancelReply, onClick: () => { replyTo.value = undefined; } }, "Cancel"),
              ])
            : null,
          h("div", { style: styles.composerRow }, [
            props.allowAttachments
              ? h("input", { ref: fileInput, type: "file", accept: props.acceptedFileTypes, style: { display: "none" }, onChange: selectedFile })
              : null,
            props.allowAttachments
              ? h("button", {
                  class: "cg-tool-button",
                  type: "button",
                  style: styles.toolButton,
                  disabled: state.value.sending || recording.value,
                  "aria-label": "Attach file",
                  title: "Attach file",
                  onClick: () => fileInput.value?.click(),
                }, [icon("attach")])
              : null,
            props.allowVoice
              ? h("button", {
                  class: recording.value ? "cg-tool-button cg-recording" : "cg-tool-button",
                  type: "button",
                  style: { ...styles.toolButton, ...(recording.value ? styles.toolButtonRecording : {}) },
                  disabled: state.value.sending && !recording.value,
                  "aria-label": recording.value ? "Stop recording" : "Record voice message",
                  "aria-pressed": recording.value,
                  title: recording.value ? "Stop recording" : "Record voice message",
                  onClick: recording.value ? stopRecording : () => void startRecording(),
                }, [icon(recording.value ? "stop" : "microphone")])
              : null,
            h("input", {
              value: draft.value,
              "aria-label": "Message",
              placeholder: recording.value ? "Recording voice…" : props.placeholder,
              disabled: state.value.sending || recording.value,
              style: styles.input,
              onBlur: () => controller.setTyping(false),
              onInput: (event: Event) => setTyping((event.target as HTMLInputElement).value),
            }),
            h("button", {
              class: "cg-send-button",
              type: "submit",
              style: styles.sendButton,
              disabled: state.value.sending || recording.value || !draft.value.trim(),
            }, [
              h("span", { class: "cg-send-label" }, state.value.uploading ? "Uploading" : state.value.sending ? "Sending" : "Send"),
              icon("send", 17),
            ]),
          ]),
          h("div", { class: "cg-composer-footer", style: styles.composerFooter }, [
            h("span", recording.value ? "Recording in progress" : "Powered by ChatGate"),
            h("span", "Press Enter to send"),
          ]),
        ]),
      ]);
    };
  },
});
