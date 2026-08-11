import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ListRenderItem,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import type { ChatGateMessage } from "@chatgate/core";
import { useChatGate } from "./context.js";
import type { ChatGateMediaAdapter, ChatGateNativeAsset } from "./types.js";
import { useChatGateConversation } from "./use-conversation.js";

export interface ChatGateConversationProps {
  conversationId?: string;
  title?: string;
  placeholder?: string;
  style?: StyleProp<ViewStyle>;
  mediaAdapter?: ChatGateMediaAdapter;
  onBack?: () => void;
}

function messageLabel(message: ChatGateMessage): string {
  if (message.messageType === "image") return "Photo";
  if (message.messageType === "voice") return "Voice message";
  return message.content || message.fileName || "Attachment";
}

export function ChatGateConversation({
  conversationId,
  title = "Support",
  placeholder = "Write a message…",
  style,
  mediaAdapter,
  onBack,
}: ChatGateConversationProps) {
  const { client } = useChatGate();
  const { controller, state } = useChatGateConversation(conversationId);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<ChatGateMessage>();
  const listRef = useRef<FlatList<ChatGateMessage>>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    controller.setTyping(false);
  }, [controller]);

  const updateDraft = useCallback((value: string) => {
    setDraft(value);
    controller.setTyping(Boolean(value.trim()));
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => controller.setTyping(false), 2_000);
  }, [controller]);

  const send = useCallback(async () => {
    const content = draft.trim();
    if (!content || state.sending) return;
    setDraft("");
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
  }, [controller, draft, replyTo, state.sending]);

  const upload = useCallback(async (asset: ChatGateNativeAsset | null) => {
    if (!asset) return;
    await controller.uploadAndSend(
      {
        value: { uri: asset.uri, name: asset.name, type: asset.mimeType },
        name: asset.name,
        mimeType: asset.mimeType,
      },
      {
        messageType: asset.messageType,
        ...(replyTo ? { replyToId: replyTo.id } : {}),
      },
    );
    setReplyTo(undefined);
  }, [controller, replyTo]);

  const renderMessage: ListRenderItem<ChatGateMessage> = useCallback(({ item }) => {
    const own = item.senderId === client.session?.userId;
    return (
      <View style={[styles.messageRow, own ? styles.ownRow : styles.otherRow]}>
        <Pressable style={[styles.bubble, own ? styles.ownBubble : styles.otherBubble]} onLongPress={() => setReplyTo(item)}>
          {item.replyTo ? <Text style={own ? styles.ownReply : styles.otherReply}>{messageLabel(item.replyTo)}</Text> : null}
          {item.messageType === "image" && item.fileUrl ? (
            <Pressable accessibilityRole="imagebutton" onPress={() => void Linking.openURL(item.fileUrl!)}>
              <Image source={{ uri: item.fileUrl }} style={styles.image} resizeMode="cover" />
            </Pressable>
          ) : null}
          {item.fileUrl && item.messageType !== "image" ? (
            <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(item.fileUrl!)}>
              <Text style={own ? styles.ownText : styles.fileText}>
                {item.messageType === "voice" ? "Play voice message" : item.fileName ?? "Open attachment"}
              </Text>
            </Pressable>
          ) : null}
          {item.content && !(item.messageType === "voice" && item.content === "Voice message") ? <Text style={own ? styles.ownText : styles.otherText}>{item.content}</Text> : null}
          {item.reactions?.length ? <View style={styles.reactions}>{item.reactions.map((reaction) => <Text key={`${reaction.userId}-${reaction.emoji}`} style={styles.reaction}>{reaction.emoji}</Text>)}</View> : null}
          {own ? <Text style={styles.ownMeta}>{item.read ? "Seen" : "Sent"}</Text> : null}
        </Pressable>
        <View style={styles.actions}>
          <Pressable onPress={() => setReplyTo(item)}><Text style={styles.actionText}>Reply</Text></Pressable>
          {(["👍", "❤️", "😂"] as const).map((emoji) => (
            <Pressable key={emoji} onPress={() => void controller.toggleReaction(item.id, emoji)}><Text style={styles.actionText}>{emoji}</Text></Pressable>
          ))}
        </View>
      </View>
    );
  }, [client, controller]);

  const assigneeId = state.thread?.assigneeId ?? state.thread?.createdBy?.id;
  const online = assigneeId ? state.onlineUserIds.includes(assigneeId) : false;
  const typing = state.typingUsers[0];

  return (
    <View style={[styles.root, style]} accessibilityLabel={title}>
      <View style={styles.header}>
        <View style={styles.headerIdentity}>
          {onBack ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Back to conversations" style={styles.backButton} onPress={onBack}>
              <Text style={styles.backText}>‹</Text>
            </Pressable>
          ) : null}
          <Text style={styles.headerTitle}>{title}</Text>
        </View>
        <View style={styles.presence}>
          <View style={[styles.presenceDot, online && styles.presenceDotOnline]} />
          <Text style={styles.presenceText}>{online ? "Online" : "Support team"}</Text>
        </View>
      </View>
      {state.error ? (
        <Pressable accessibilityRole="button" style={styles.error} onPress={() => void controller.reload()}>
          <Text style={styles.errorText}>{state.error.message} — tap to retry</Text>
        </Pressable>
      ) : null}
      <FlatList
        ref={listRef}
        data={state.messages}
        keyExtractor={(message) => message.id}
        renderItem={renderMessage}
        contentContainerStyle={state.messages.length === 0 ? styles.emptyList : styles.list}
        ListEmptyComponent={state.loading ? <ActivityIndicator /> : <Text style={styles.emptyText}>No messages yet. Start the conversation.</Text>}
        ListHeaderComponent={state.thread?.nextCursor ? (
          <Pressable disabled={state.loadingOlder} onPress={() => void controller.loadOlder()}>
            <Text style={styles.loadEarlier}>{state.loadingOlder ? "Loading…" : "Load earlier messages"}</Text>
          </Pressable>
        ) : null}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
      />
      <Text style={styles.typing}>{typing ? `${typing.username ?? "Support"} is typing…` : ""}</Text>
      {replyTo ? (
        <View style={styles.replyBanner}>
          <Text numberOfLines={1} style={styles.replyText}>Replying to {messageLabel(replyTo)}</Text>
          <Pressable onPress={() => setReplyTo(undefined)}><Text style={styles.cancelText}>Cancel</Text></Pressable>
        </View>
      ) : null}
      <View style={styles.composer}>
        {mediaAdapter ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Attach file" style={styles.iconButton} disabled={state.sending} onPress={() => void mediaAdapter.pickAttachment().then(upload)}>
            <Text style={styles.iconText}>+</Text>
          </Pressable>
        ) : null}
        {mediaAdapter?.recordVoice ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Record voice message" style={styles.iconButton} disabled={state.sending} onPress={() => void mediaAdapter.recordVoice!().then(upload)}>
            <Text style={styles.iconText}>●</Text>
          </Pressable>
        ) : null}
        <TextInput
          accessibilityLabel="Message"
          style={styles.input}
          value={draft}
          placeholder={placeholder}
          multiline
          editable={!state.sending}
          onBlur={() => controller.setTyping(false)}
          onChangeText={updateDraft}
          onSubmitEditing={() => void send()}
        />
        <Pressable accessibilityRole="button" style={[styles.sendButton, (!draft.trim() || state.sending) && styles.disabled]} disabled={!draft.trim() || state.sending} onPress={() => void send()}>
          <Text style={styles.sendText}>{state.uploading ? "Upload…" : state.sending ? "…" : "Send"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 360, overflow: "hidden", borderWidth: 1, borderColor: "#dbe3ef", borderRadius: 16, backgroundColor: "#fff" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  headerIdentity: { minWidth: 0, flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  backButton: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#dbe3ef", borderRadius: 10, backgroundColor: "#f8fafc" },
  backText: { color: "#334155", fontSize: 24, lineHeight: 26 },
  headerTitle: { color: "#0f172a", fontSize: 16, fontWeight: "700" },
  presence: { flexDirection: "row", alignItems: "center", gap: 6 },
  presenceDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#94a3b8" },
  presenceDotOnline: { backgroundColor: "#22c55e" },
  presenceText: { color: "#64748b", fontSize: 12 },
  list: { flexGrow: 1, gap: 8, padding: 16 },
  emptyList: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  emptyText: { color: "#64748b", textAlign: "center" },
  messageRow: { maxWidth: "100%", marginBottom: 4 },
  ownRow: { alignItems: "flex-end" },
  otherRow: { alignItems: "flex-start" },
  bubble: { maxWidth: "82%", paddingHorizontal: 12, paddingVertical: 9, borderRadius: 14, marginBottom: 4 },
  ownBubble: { alignSelf: "flex-end", borderBottomRightRadius: 4, backgroundColor: "#2563eb" },
  otherBubble: { alignSelf: "flex-start", borderBottomLeftRadius: 4, backgroundColor: "#eff4fa" },
  ownText: { color: "#fff" },
  otherText: { color: "#0f172a" },
  ownReply: { marginBottom: 6, borderLeftWidth: 3, borderLeftColor: "#bfdbfe", paddingLeft: 7, color: "#dbeafe", fontSize: 12 },
  otherReply: { marginBottom: 6, borderLeftWidth: 3, borderLeftColor: "#64748b", paddingLeft: 7, color: "#475569", fontSize: 12 },
  ownMeta: { marginTop: 4, color: "#dbeafe", fontSize: 10, textAlign: "right" },
  reactions: { flexDirection: "row", gap: 3, marginTop: 5 },
  reaction: { fontSize: 12 },
  actions: { flexDirection: "row", gap: 8, paddingHorizontal: 4 },
  actionText: { color: "#64748b", fontSize: 11 },
  fileText: { color: "#1d4ed8", fontWeight: "700" },
  image: { width: 220, height: 160, marginBottom: 6, borderRadius: 10, backgroundColor: "#dbe3ef" },
  typing: { minHeight: 18, paddingHorizontal: 16, color: "#64748b", fontSize: 12 },
  replyBanner: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginHorizontal: 10, padding: 8, borderRadius: 8, backgroundColor: "#eff6ff" },
  replyText: { flex: 1, color: "#1e40af", fontSize: 12 },
  cancelText: { color: "#1d4ed8", fontWeight: "700" },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: 8, padding: 10, borderTopWidth: 1, borderTopColor: "#e2e8f0" },
  input: { flex: 1, maxHeight: 120, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, color: "#0f172a" },
  sendButton: { minHeight: 42, justifyContent: "center", borderRadius: 12, paddingHorizontal: 15, backgroundColor: "#2563eb" },
  sendText: { color: "#fff", fontWeight: "700" },
  disabled: { opacity: 0.45 },
  iconButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "#eff4fa" },
  iconText: { color: "#1d4ed8", fontSize: 20, fontWeight: "700" },
  error: { margin: 10, borderRadius: 10, padding: 10, backgroundColor: "#fef2f2" },
  errorText: { color: "#b91c1c" },
  loadEarlier: { padding: 8, color: "#2563eb", textAlign: "center" },
});
