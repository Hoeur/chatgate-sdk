import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Linking,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
  type ListRenderItem,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import {
  resolveMessageRole,
  CHATGATE_ROLE_LABELS,
  type ChatGateMessage,
  type ChatGateParticipantRole,
} from "@chatgate/core";
import { useChatGate } from "./context.js";
import { AttachIcon, BackIcon, ChatIcon, FileIcon, MicIcon, PlayIcon, SendIcon } from "./icons.js";
import {
  resolveChatGateTheme,
  type ChatGateTheme,
  type ResolvedChatGateTheme,
} from "./theme.js";
import type { ChatGateMediaAdapter, ChatGateNativeAsset } from "./types.js";
import { useChatGateConversation } from "./use-conversation.js";

export interface ChatGateConversationProps {
  conversationId?: string;
  title?: string;
  placeholder?: string;
  style?: StyleProp<ViewStyle>;
  mediaAdapter?: ChatGateMediaAdapter;
  showRoleBadge?: boolean;
  roleLabels?: Partial<Record<ChatGateParticipantRole, string>>;
  /** Branding — accent, surfaces, radius. See ChatGateTheme. */
  theme?: ChatGateTheme;
  /** Header style: "full" (default), "minimal" (title only, no accent background), or "none" (hidden). */
  header?: "full" | "minimal" | "none";
  onBack?: () => void;
}

const ROLE_BADGE_COLORS: Record<ChatGateParticipantRole, { bg: string; color: string }> = {
  customer: { bg: "#eef2f7", color: "#475569" },
  merchant: { bg: "#e1f5ec", color: "#0369a1" },
  admin: { bg: "#f3e8ff", color: "#7e22ce" },
};

function roleLabel(role: ChatGateParticipantRole, overrides?: Partial<Record<ChatGateParticipantRole, string>>): string {
  return overrides?.[role] ?? CHATGATE_ROLE_LABELS[role];
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
  showRoleBadge = true,
  roleLabels,
  theme,
  header = "full",
  onBack,
}: ChatGateConversationProps) {
  const { client } = useChatGate();
  const { controller, state } = useChatGateConversation(conversationId);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<ChatGateMessage>();
  const [editing, setEditing] = useState<ChatGateMessage>();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string>();
  const listRef = useRef<FlatList<ChatGateMessage>>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const t = useMemo(() => resolveChatGateTheme(theme), [theme]);
  const styles = useMemo(() => createStyles(t), [t]);

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

  const startEdit = useCallback((message: ChatGateMessage) => {
    setReplyTo(undefined);
    setConfirmDeleteId(undefined);
    setEditing(message);
    setDraft(message.content ?? "");
  }, []);

  const cancelEdit = useCallback(() => {
    setEditing(undefined);
    setDraft("");
  }, []);

  const send = useCallback(async () => {
    const content = draft.trim();
    if (!content || state.sending) return;
    if (editing) {
      const target = editing;
      setDraft("");
      setEditing(undefined);
      try {
        await controller.editMessage(target.id, content);
      } catch {
        setDraft(content);
        setEditing(target);
      }
      return;
    }
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
  }, [controller, draft, editing, replyTo, state.sending]);

  const upload = useCallback(async (asset: ChatGateNativeAsset | null) => {
    if (!asset) return;
    let value: unknown = { uri: asset.uri, name: asset.name, type: asset.mimeType };
    if (Platform.OS === "web") {
      // The browser's FormData needs a real Blob; the React Native
      // { uri, name, type } descriptor only works with RN's own FormData.
      const response = await fetch(asset.uri);
      value = await response.blob();
    }
    await controller.uploadAndSend(
      {
        value,
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
    const role = resolveMessageRole(item, state.thread);
    const roleColor = ROLE_BADGE_COLORS[role];
    const canEdit = own && item.messageType === "text" && Boolean(item.content);
    return (
      <View style={[styles.messageRow, own ? styles.ownRow : styles.otherRow]}>
        {showRoleBadge && !own ? (
          <View style={[styles.roleBadge, { backgroundColor: roleColor.bg }]}>
            <Text style={[styles.roleBadgeText, { color: roleColor.color }]}>{roleLabel(role, roleLabels)}</Text>
          </View>
        ) : null}
        <Pressable style={[styles.bubble, own ? styles.ownBubble : styles.otherBubble, !own ? { borderLeftWidth: 3, borderLeftColor: roleColor.color } : null]} onLongPress={() => setReplyTo(item)}>
          {item.replyTo ? <Text style={own ? styles.ownReply : styles.otherReply}>{messageLabel(item.replyTo)}</Text> : null}
          {item.messageType === "image" && item.fileUrl ? (
            <Pressable accessibilityRole="imagebutton" onPress={() => void Linking.openURL(item.fileUrl!)}>
              <Image source={{ uri: item.fileUrl }} style={styles.image} resizeMode="cover" />
            </Pressable>
          ) : null}
          {item.fileUrl && item.messageType !== "image" ? (
            <Pressable
              accessibilityRole="link"
              style={styles.attachmentRow}
              onPress={() => void Linking.openURL(item.fileUrl!)}
            >
              <View style={[styles.attachmentIcon, own && styles.attachmentIconOwn]}>
                {item.messageType === "voice" ? (
                  <PlayIcon size={16} color={own ? t.accentText : t.accentDark} />
                ) : (
                  <FileIcon size={16} color={own ? t.accentText : t.accentDark} />
                )}
              </View>
              <Text numberOfLines={1} style={[styles.attachmentText, own ? styles.ownText : styles.fileText]}>
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
          {own ? (
            confirmDeleteId === item.id ? (
              <>
                <Pressable onPress={() => { setConfirmDeleteId(undefined); void controller.deleteMessage(item.id); }}>
                  <Text style={[styles.actionText, styles.dangerText]}>Confirm delete</Text>
                </Pressable>
                <Pressable onPress={() => setConfirmDeleteId(undefined)}><Text style={styles.actionText}>Cancel</Text></Pressable>
              </>
            ) : (
              <>
                {canEdit ? <Pressable onPress={() => startEdit(item)}><Text style={styles.actionText}>Edit</Text></Pressable> : null}
                <Pressable onPress={() => setConfirmDeleteId(item.id)}><Text style={[styles.actionText, styles.dangerText]}>Delete</Text></Pressable>
              </>
            )
          ) : null}
        </View>
      </View>
    );
  }, [client, controller, state.thread, showRoleBadge, roleLabels, styles, t, confirmDeleteId, startEdit]);

  const assigneeId = state.thread?.assigneeId ?? state.thread?.createdBy?.id;
  const online = assigneeId ? state.onlineUserIds.includes(assigneeId) : false;
  const typing = state.typingUsers[0];

  return (
    <View style={[styles.root, style]} accessibilityLabel={title}>
      {header === "full" ? (
        <View style={styles.header}>
          <View style={styles.headerIdentity}>
            {onBack ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Back to conversations" style={styles.backButton} onPress={onBack}>
                <BackIcon size={18} color={t.text} />
              </Pressable>
            ) : null}
            <View style={styles.headerAvatar}>
              <ChatIcon size={20} color={t.accentText} />
            </View>
            <View style={styles.headerText}>
              <Text numberOfLines={1} style={styles.headerTitle}>{title}</Text>
              <Text numberOfLines={1} style={styles.headerSubtitle}>{online ? "Usually replies instantly" : "We are here to help"}</Text>
            </View>
          </View>
          <View style={styles.presence}>
            <View style={[styles.presenceDot, online && styles.presenceDotOnline]} />
            <Text style={styles.presenceText}>{online ? "Online" : "Support team"}</Text>
          </View>
        </View>
      ) : header === "minimal" ? (
        <View style={styles.headerMinimal}>
          {onBack ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Back to conversations" style={styles.backButton} onPress={onBack}>
              <BackIcon size={18} color={t.text} />
            </Pressable>
          ) : null}
          <Text numberOfLines={1} style={styles.headerTitleMinimal}>{title}</Text>
          <View style={[styles.presenceDot, online && styles.presenceDotOnline]} />
        </View>
      ) : onBack ? (
        <View style={styles.headerBackOnly}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back to conversations" style={styles.backButton} onPress={onBack}>
            <BackIcon size={18} color={t.text} />
          </Pressable>
        </View>
      ) : null}
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
        ListEmptyComponent={state.loading ? <ActivityIndicator color={t.accent} /> : <Text style={styles.emptyText}>No messages yet. Start the conversation.</Text>}
        ListHeaderComponent={state.thread?.nextCursor ? (
          <Pressable disabled={state.loadingOlder} onPress={() => void controller.loadOlder()}>
            <Text style={styles.loadEarlier}>{state.loadingOlder ? "Loading…" : "Load earlier messages"}</Text>
          </Pressable>
        ) : null}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
      />
      <Text style={styles.typing}>{typing ? `${typing.username ?? "Support"} is typing…` : ""}</Text>
      {editing ? (
        <View style={styles.replyBanner}>
          <Text numberOfLines={1} style={styles.replyText}>Editing message</Text>
          <Pressable onPress={cancelEdit}><Text style={styles.cancelText}>Cancel</Text></Pressable>
        </View>
      ) : replyTo ? (
        <View style={styles.replyBanner}>
          <Text numberOfLines={1} style={styles.replyText}>Replying to {messageLabel(replyTo)}</Text>
          <Pressable onPress={() => setReplyTo(undefined)}><Text style={styles.cancelText}>Cancel</Text></Pressable>
        </View>
      ) : null}
      <View style={styles.composer}>
        {mediaAdapter && !editing ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Attach file" style={styles.iconButton} disabled={state.sending} onPress={() => void mediaAdapter.pickAttachment().then(upload)}>
            <AttachIcon size={19} color={t.accentDark} />
          </Pressable>
        ) : null}
        {mediaAdapter?.recordVoice && !editing ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Record voice message" style={styles.iconButton} disabled={state.sending} onPress={() => void mediaAdapter.recordVoice!().then(upload)}>
            <MicIcon size={19} color={t.accentDark} />
          </Pressable>
        ) : null}
        <TextInput
          accessibilityLabel="Message"
          style={styles.input}
          value={draft}
          placeholder={editing ? "Edit your message…" : placeholder}
          placeholderTextColor={t.muted}
          multiline
          editable={!state.sending}
          onBlur={() => controller.setTyping(false)}
          onChangeText={updateDraft}
          onSubmitEditing={() => void send()}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={editing ? "Save edit" : "Send message"}
          style={[styles.sendButton, (!draft.trim() || state.sending) && styles.disabled]}
          disabled={!draft.trim() || state.sending}
          onPress={() => void send()}
        >
          {state.uploading || state.sending ? (
            <ActivityIndicator size="small" color={t.accentText} />
          ) : (
            <SendIcon size={17} color={t.accentText} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

function createStyles(t: ResolvedChatGateTheme) {
  return {
    root: { flex: 1, minHeight: 360, overflow: "hidden", borderWidth: 1, borderColor: t.border, borderRadius: t.radius, backgroundColor: t.surface } as const,
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: t.border } as const,
    headerMinimal: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: t.border, backgroundColor: t.surface } as const,
    headerTitleMinimal: { flex: 1, color: t.text, fontSize: 15, fontWeight: "700" } as const,
    headerBackOnly: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingTop: 8 } as const,
    headerIdentity: { minWidth: 0, flex: 1, flexDirection: "row", alignItems: "center", gap: 8 } as const,
    backButton: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: t.border, borderRadius: 10, backgroundColor: t.canvas } as const,
    headerAvatar: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: t.accent } as const,
    headerText: { minWidth: 0, flex: 1, gap: 1 } as const,
    headerTitle: { color: t.text, fontSize: 16, fontWeight: "700" } as const,
    headerSubtitle: { color: t.muted, fontSize: 11 } as const,
    presence: { flexDirection: "row", alignItems: "center", gap: 6 } as const,
    presenceDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: t.muted } as const,
    presenceDotOnline: { backgroundColor: t.online } as const,
    presenceText: { color: t.muted, fontSize: 12 } as const,
    list: { flexGrow: 1, gap: 8, padding: 16 } as const,
    emptyList: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 24 } as const,
    emptyText: { color: t.muted, textAlign: "center" } as const,
    messageRow: { maxWidth: "100%", marginBottom: 4 } as const,
    ownRow: { alignItems: "flex-end" } as const,
    otherRow: { alignItems: "flex-start" } as const,
    roleBadge: { alignSelf: "flex-start", marginBottom: 3, paddingHorizontal: 8, paddingVertical: 1, borderRadius: 999 } as const,
    roleBadgeText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.3, textTransform: "uppercase" } as const,
    bubble: { maxWidth: "82%", paddingHorizontal: 12, paddingVertical: 9, borderRadius: 14, marginBottom: 4 } as const,
    ownBubble: { alignSelf: "flex-end", borderBottomRightRadius: 4, backgroundColor: t.accent } as const,
    otherBubble: { alignSelf: "flex-start", borderBottomLeftRadius: 4, backgroundColor: t.incoming } as const,
    ownText: { color: t.accentText } as const,
    otherText: { color: t.text } as const,
    ownReply: { marginBottom: 6, borderLeftWidth: 3, borderLeftColor: t.accentSoft, paddingLeft: 7, color: t.accentSoft, fontSize: 12 } as const,
    otherReply: { marginBottom: 6, borderLeftWidth: 3, borderLeftColor: t.muted, paddingLeft: 7, color: t.muted, fontSize: 12 } as const,
    ownMeta: { marginTop: 4, color: t.accentSoft, fontSize: 10, textAlign: "right" } as const,
    reactions: { flexDirection: "row", gap: 3, marginTop: 5 } as const,
    reaction: { fontSize: 12 } as const,
    actions: { flexDirection: "row", gap: 8, paddingHorizontal: 4 } as const,
    actionText: { color: t.muted, fontSize: 11 } as const,
    dangerText: { color: t.danger, fontWeight: "700" } as const,
    attachmentRow: { flexDirection: "row", alignItems: "center", gap: 8, minWidth: 150 } as const,
    attachmentIcon: { width: 30, height: 30, alignItems: "center", justifyContent: "center", borderRadius: 9, backgroundColor: t.incoming } as const,
    attachmentIconOwn: { backgroundColor: "rgba(255,255,255,.22)" } as const,
    attachmentText: { flexShrink: 1 } as const,
    fileText: { color: t.accentDark, fontWeight: "700" } as const,
    image: { width: 220, height: 160, marginBottom: 6, borderRadius: 10, backgroundColor: t.border } as const,
    typing: { minHeight: 18, paddingHorizontal: 16, color: t.muted, fontSize: 12 } as const,
    replyBanner: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginHorizontal: 10, padding: 8, borderRadius: 8, backgroundColor: t.accentSoft } as const,
    replyText: { flex: 1, color: t.accentDark, fontSize: 12 } as const,
    cancelText: { color: t.accentDark, fontWeight: "700" } as const,
    composer: { flexDirection: "row", alignItems: "flex-end", gap: 7, padding: 10, borderTopWidth: 1, borderTopColor: t.border, backgroundColor: t.surface } as const,
    input: { flex: 1, maxHeight: 120, minHeight: 42, borderWidth: 1, borderColor: t.border, borderRadius: 14, paddingHorizontal: 13, paddingVertical: 10, color: t.text, backgroundColor: t.canvas } as const,
    sendButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: t.accent } as const,
    disabled: { opacity: 0.45 } as const,
    iconButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: t.incoming } as const,
    error: { margin: 10, borderRadius: 10, padding: 10, backgroundColor: "#fef2f2" } as const,
    errorText: { color: t.danger } as const,
    loadEarlier: { padding: 8, color: t.accent, textAlign: "center" } as const,
  };
}
