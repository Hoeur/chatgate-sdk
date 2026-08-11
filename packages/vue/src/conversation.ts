import {
  defineComponent,
  h,
  onUnmounted,
  ref,
  type CSSProperties,
  type PropType,
  type VNodeChild,
} from "vue";
import type { ChatGateMessage, ChatGateMessageType } from "@chatgate/core";
import { useChatGate } from "./plugin.js";
import { useChatGateConversation } from "./use-conversation.js";

const rootStyle: CSSProperties = { display: "flex", flexDirection: "column", minHeight: "480px", overflow: "hidden", border: "1px solid #dbe3ef", borderRadius: "16px", background: "#fff", color: "#0f172a" };
const messagesStyle: CSSProperties = { display: "flex", flex: 1, flexDirection: "column", gap: "10px", overflowY: "auto", padding: "16px" };

function fileMessageType(file: File): Exclude<ChatGateMessageType, "encrypted"> {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("audio/")) return "voice";
  return "file";
}

function messageLabel(message: ChatGateMessage): string {
  if (message.messageType === "image") return "Photo";
  if (message.messageType === "voice") return "Voice message";
  return message.content || message.fileName || "Attachment";
}

export const ChatGateConversation = defineComponent({
  name: "ChatGateConversation",
  props: {
    conversationId: String,
    title: { type: String, default: "Support" },
    placeholder: { type: String, default: "Write a message…" },
    allowAttachments: { type: Boolean, default: true },
    allowVoice: { type: Boolean, default: true },
    acceptedFileTypes: String,
    maxFileSizeBytes: { type: Number, default: 25 * 1024 * 1024 },
    renderMessage: Function as PropType<(message: ChatGateMessage, own: boolean) => VNodeChild>,
    onBack: Function as PropType<() => void>,
  },
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
        localError.value = "The selected file is too large.";
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

    function defaultMessage(message: ChatGateMessage, own: boolean): VNodeChild {
      const children: VNodeChild[] = [];
      if (message.replyTo) {
        children.push(h("div", { style: { marginBottom: "6px", padding: "5px 7px", borderLeft: "3px solid currentColor", opacity: 0.8, fontSize: "12px" } }, messageLabel(message.replyTo)));
      }
      if (message.messageType === "image" && message.fileUrl) {
        children.push(h("a", { href: message.fileUrl, target: "_blank", rel: "noreferrer" }, [
          h("img", { src: message.fileUrl, alt: message.fileName ?? "Shared image", style: { display: "block", maxWidth: "320px", width: "100%", maxHeight: "300px", objectFit: "cover", borderRadius: "10px" } }),
        ]));
      } else if (message.messageType === "voice" && message.fileUrl) {
        children.push(h("audio", { controls: true, preload: "metadata", src: message.fileUrl, style: { width: "min(280px, 70vw)", maxWidth: "100%" } }));
      } else if (message.fileUrl) {
        children.push(h("a", { href: message.fileUrl, target: "_blank", rel: "noreferrer", download: message.fileName, style: { color: "inherit", fontWeight: 700 } }, message.fileName ?? "Download attachment"));
      }
      if (message.content && !(message.messageType === "voice" && message.content === "Voice message")) children.push(h("div", message.content));
      if (message.reactions?.length) {
        children.push(h("div", { style: { display: "flex", gap: "4px", marginTop: "5px" } }, message.reactions.map((reaction) =>
          h("button", { type: "button", onClick: () => void controller.toggleReaction(message.id, reaction.emoji) }, reaction.emoji),
        )));
      }
      return h("div", { key: message.id, style: { display: "flex", flexDirection: "column", alignSelf: own ? "flex-end" : "flex-start", alignItems: own ? "flex-end" : "flex-start", maxWidth: "82%" } }, [
        h("div", { style: { padding: "9px 12px", borderRadius: own ? "14px 14px 4px 14px" : "14px 14px 14px 4px", background: own ? "#2563eb" : "#eff4fa", color: own ? "#fff" : "#0f172a", whiteSpace: "pre-wrap" } }, children),
        h("div", { style: { display: "flex", gap: "5px", fontSize: "11px" } }, [
          h("button", { type: "button", onClick: () => { replyTo.value = message; } }, "Reply"),
          ...["👍", "❤️", "😂"].map((emoji) => h("button", { type: "button", onClick: () => void controller.toggleReaction(message.id, emoji) }, emoji)),
          own && message.messageType === "text" ? h("button", { type: "button", onClick: () => { const value = window.prompt("Edit message", message.content); if (value?.trim()) void controller.editMessage(message.id, value); } }, "Edit") : null,
          own ? h("button", { type: "button", onClick: () => { if (window.confirm("Delete this message?")) void controller.deleteMessage(message.id); } }, "Delete") : null,
        ]),
      ]);
    }

    return () => {
      const assigneeId = state.value.thread?.assigneeId ?? state.value.thread?.createdBy?.id;
      const online = assigneeId ? state.value.onlineUserIds.includes(assigneeId) : false;
      const typing = state.value.typingUsers[0];
      return h("section", { style: rootStyle, "aria-label": props.title }, [
        h("header", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", padding: "14px 16px", borderBottom: "1px solid #e2e8f0", fontWeight: 700 } }, [
          h("span", { style: { display: "flex", alignItems: "center", gap: "8px" } }, [
            props.onBack ? h("button", { type: "button", "aria-label": "Back to conversations", onClick: props.onBack, style: { width: "34px", height: "34px", border: "1px solid #dbe3ef", borderRadius: "10px", background: "#f8fafc", cursor: "pointer" } }, "‹") : null,
            props.title,
          ]),
          h("small", { style: { color: online ? "#15803d" : "#64748b" } }, online ? "Online" : "Support team"),
        ]),
        state.value.error || localError.value
          ? h("div", { role: "alert", style: { margin: "12px", padding: "10px", background: "#fef2f2", color: "#b91c1c" } }, [
              localError.value ?? state.value.error?.message,
              state.value.error ? h("button", { type: "button", onClick: () => void controller.reload() }, "Retry") : null,
            ])
          : null,
        h("div", { style: messagesStyle, "aria-live": "polite", "aria-busy": state.value.loading }, [
          state.value.thread?.nextCursor ? h("button", { type: "button", disabled: state.value.loadingOlder, onClick: () => void controller.loadOlder() }, state.value.loadingOlder ? "Loading…" : "Load earlier messages") : null,
          state.value.loading && state.value.messages.length === 0 ? h("div", { style: { margin: "auto", color: "#64748b" } }, "Loading conversation…") : null,
          !state.value.loading && state.value.messages.length === 0 ? h("div", { style: { margin: "auto", color: "#64748b" } }, "No messages yet. Start the conversation.") : null,
          ...state.value.messages.map((message) => props.renderMessage?.(message, message.senderId === client.session?.userId) ?? defaultMessage(message, message.senderId === client.session?.userId)),
        ]),
        h("div", { style: { minHeight: "18px", padding: "0 16px 6px", color: "#64748b", fontSize: "12px" } }, typing ? `${typing.username ?? "Support"} is typing…` : ""),
        h("form", { style: { display: "flex", flexDirection: "column", gap: "8px", padding: "12px", borderTop: "1px solid #e2e8f0" }, onSubmit: (event: Event) => { event.preventDefault(); void send(); } }, [
          replyTo.value ? h("div", { style: { display: "flex", justifyContent: "space-between", padding: "7px 10px", background: "#eff6ff" } }, [messageLabel(replyTo.value), h("button", { type: "button", onClick: () => { replyTo.value = undefined; } }, "Cancel")]) : null,
          h("div", { style: { display: "flex", gap: "8px" } }, [
            props.allowAttachments ? h("input", { ref: fileInput, type: "file", accept: props.acceptedFileTypes, style: { display: "none" }, onChange: selectedFile }) : null,
            props.allowAttachments ? h("button", { type: "button", disabled: state.value.sending, onClick: () => fileInput.value?.click() }, "Attach") : null,
            props.allowVoice ? h("button", { type: "button", disabled: state.value.sending && !recording.value, onClick: recording.value ? stopRecording : () => void startRecording() }, recording.value ? "Stop" : "Voice") : null,
            h("input", { value: draft.value, "aria-label": "Message", placeholder: recording.value ? "Recording voice…" : props.placeholder, disabled: state.value.sending || recording.value, style: { minWidth: 0, flex: 1, padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: "12px" }, onBlur: () => controller.setTyping(false), onInput: (event: Event) => setTyping((event.target as HTMLInputElement).value) }),
            h("button", { type: "submit", disabled: state.value.sending || recording.value || !draft.value.trim(), style: { border: 0, borderRadius: "12px", padding: "10px 16px", background: "#2563eb", color: "#fff", fontWeight: 700 } }, state.value.uploading ? "Uploading…" : state.value.sending ? "Sending…" : "Send"),
          ]),
        ]),
      ]);
    };
  },
});
