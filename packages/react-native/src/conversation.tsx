import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Linking,
  Modal,
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
  type ChatGateReaction,
} from "@chatgate/core";
import { useChatGate } from "./context.js";
import { AttachIcon, BackIcon, ChatIcon, FileIcon, MicIcon, PlayIcon, SendIcon, StopIcon } from "./icons.js";
import {
  resolveChatGateTheme,
  type ChatGateTheme,
  type ResolvedChatGateTheme,
} from "./theme.js";
import type { ChatGateAudioController, ChatGateMediaAdapter, ChatGateNativeAsset } from "./types.js";
import { useChatGateConversation } from "./use-conversation.js";

export interface ChatGateConversationProps {
  conversationId?: string;
  title?: string;
  placeholder?: string;
  style?: StyleProp<ViewStyle>;
  mediaAdapter?: ChatGateMediaAdapter;
  /** Show the sender avatar + name above each incoming message group. Default true. */
  showRoleBadge?: boolean;
  roleLabels?: Partial<Record<ChatGateParticipantRole, string>>;
  /** Branding — accent, surfaces, radius. See ChatGateTheme. */
  theme?: ChatGateTheme;
  /** Header style: "full" (default), "minimal" (title only, no accent background), or "none" (hidden). */
  header?: "full" | "minimal" | "none";
  onBack?: () => void;
}

const QUICK_REACTIONS = ["\u{1F44D}", "❤️", "\u{1F602}", "\u{1F62E}", "\u{1F622}", "\u{1F64F}"] as const;

function roleLabel(role: ChatGateParticipantRole, overrides?: Partial<Record<ChatGateParticipantRole, string>>): string {
  return overrides?.[role] ?? CHATGATE_ROLE_LABELS[role];
}

function messageLabel(message: ChatGateMessage): string {
  if (message.messageType === "image") return "Photo";
  if (message.messageType === "voice") return "Voice message";
  return message.content || message.fileName || "Attachment";
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const meridiem = hours >= 12 ? "PM" : "AM";
  hours %= 12;
  if (hours === 0) hours = 12;
  return `${hours}:${minutes} ${meridiem}`;
}

function initialOf(name: string): string {
  const char = name.trim().charAt(0);
  return char ? char.toUpperCase() : "?";
}

function countReactions(reactions?: ChatGateReaction[] | null): Array<{ emoji: string; count: number }> {
  if (!reactions?.length) return [];
  const counts = new Map<string, number>();
  for (const reaction of reactions) counts.set(reaction.emoji, (counts.get(reaction.emoji) ?? 0) + 1);
  return Array.from(counts, ([emoji, count]) => ({ emoji, count }));
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
  const [menuFor, setMenuFor] = useState<ChatGateMessage | null>(null);
  const [menuConfirmDelete, setMenuConfirmDelete] = useState(false);
  const listRef = useRef<FlatList<ChatGateMessage>>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const playbackRef = useRef<ChatGateAudioController | null>(null);

  const t = useMemo(() => resolveChatGateTheme(theme), [theme]);
  const styles = useMemo(() => createStyles(t), [t]);
  const selfId = client.session?.userId;

  useEffect(() => () => {
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    controller.setTyping(false);
    void playbackRef.current?.stop();
  }, [controller]);

  const updateDraft = useCallback((value: string) => {
    setDraft(value);
    controller.setTyping(Boolean(value.trim()));
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => controller.setTyping(false), 2_000);
  }, [controller]);

  const startEdit = useCallback((message: ChatGateMessage) => {
    setReplyTo(undefined);
    setEditing(message);
    setDraft(message.content ?? "");
  }, []);

  const cancelEdit = useCallback(() => {
    setEditing(undefined);
    setDraft("");
  }, []);

  const openMenu = useCallback((message: ChatGateMessage) => {
    setMenuConfirmDelete(false);
    setMenuFor(message);
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
      { value, name: asset.name, mimeType: asset.mimeType },
      {
        messageType: asset.messageType,
        ...(replyTo ? { replyToId: replyTo.id } : {}),
      },
    );
    setReplyTo(undefined);
  }, [controller, replyTo]);

  const stopPlayback = useCallback(async () => {
    const active = playbackRef.current;
    playbackRef.current = null;
    setPlayingVoiceId(null);
    if (active) {
      try {
        await active.stop();
      } catch {
        // ignore stop failures
      }
    }
  }, []);

  const togglePlayVoice = useCallback(
    async (message: ChatGateMessage) => {
      const uri = message.fileUrl;
      if (!uri) return;
      if (playingVoiceId === message.id) {
        await stopPlayback();
        return;
      }
      await stopPlayback();
      if (!mediaAdapter?.playVoice) {
        void Linking.openURL(uri);
        return;
      }
      setPlayingVoiceId(message.id);
      try {
        const handle = await mediaAdapter.playVoice(uri, {
          onFinish: () => {
            playbackRef.current = null;
            setPlayingVoiceId(null);
          },
        });
        playbackRef.current = handle;
      } catch {
        setPlayingVoiceId(null);
        void Linking.openURL(uri);
      }
    },
    [mediaAdapter, playingVoiceId, stopPlayback],
  );

  const renderMessage: ListRenderItem<ChatGateMessage> = useCallback(({ item, index }) => {
    const own = item.senderId === selfId;
    const role = resolveMessageRole(item, state.thread);
    const previous = state.messages[index - 1];
    const next = state.messages[index + 1];
    const startsGroup = !previous || previous.senderId !== item.senderId;
    const endsGroup = !next || next.senderId !== item.senderId;
    const isLast = index === state.messages.length - 1;
    const senderName = item.sender?.username?.trim() || roleLabel(role, roleLabels);
    const showText = Boolean(item.content) && !(item.messageType === "voice" && item.content === "Voice message");
    const reactions = countReactions(item.reactions);

    return (
      <View style={startsGroup ? styles.groupStart : styles.groupCont}>
        {!own && startsGroup && showRoleBadge ? (
          <View style={styles.senderHeader}>
            <View style={styles.senderAvatar}>
              {item.sender?.avatarUrl ? (
                <Image source={{ uri: item.sender.avatarUrl }} style={styles.senderAvatarImg} />
              ) : (
                <Text style={styles.senderAvatarText}>{initialOf(senderName)}</Text>
              )}
            </View>
            <Text numberOfLines={1} style={styles.senderName}>{senderName}</Text>
          </View>
        ) : null}
        <Pressable
          delayLongPress={200}
          onLongPress={() => openMenu(item)}
          style={[
            styles.bubble,
            own ? styles.ownBubble : styles.otherBubble,
            own && endsGroup ? styles.ownTail : null,
            !own && endsGroup ? styles.otherTail : null,
          ]}
        >
          {item.replyTo ? (
            <View style={[styles.replyQuote, own ? styles.replyQuoteOwn : styles.replyQuoteOther]}>
              <Text numberOfLines={1} style={own ? styles.replyQuoteTextOwn : styles.replyQuoteText}>
                {messageLabel(item.replyTo)}
              </Text>
            </View>
          ) : null}
          {item.messageType === "image" && item.fileUrl ? (
            <Pressable accessibilityRole="imagebutton" accessibilityLabel="Open image" onPress={() => setViewerUri(item.fileUrl!)}>
              <Image source={{ uri: item.fileUrl }} style={styles.image} resizeMode="cover" />
            </Pressable>
          ) : null}
          {item.fileUrl && item.messageType !== "image" ? (
            <Pressable
              accessibilityRole="button"
              style={styles.attachmentRow}
              onPress={() =>
                item.messageType === "voice"
                  ? void togglePlayVoice(item)
                  : void Linking.openURL(item.fileUrl!)
              }
            >
              <View style={[styles.attachmentIcon, own && styles.attachmentIconOwn]}>
                {item.messageType === "voice" ? (
                  playingVoiceId === item.id ? (
                    <StopIcon size={13} color={own ? t.accentText : t.accentDark} />
                  ) : (
                    <PlayIcon size={15} color={own ? t.accentText : t.accentDark} />
                  )
                ) : (
                  <FileIcon size={15} color={own ? t.accentText : t.accentDark} />
                )}
              </View>
              <Text numberOfLines={1} style={[styles.attachmentText, own ? styles.ownText : styles.fileText]}>
                {item.messageType === "voice"
                  ? playingVoiceId === item.id
                    ? "Playing… tap to stop"
                    : "Voice message"
                  : item.fileName ?? "Attachment"}
              </Text>
            </Pressable>
          ) : null}
          {showText ? <Text style={own ? styles.ownText : styles.otherText}>{item.content}</Text> : null}
        </Pressable>
        {reactions.length ? (
          <View style={[styles.reactionsRow, own ? styles.reactionsOwn : styles.reactionsOther]}>
            {reactions.map((reaction) => (
              <Pressable key={reaction.emoji} style={styles.reactionChip} onPress={() => void controller.toggleReaction(item.id, reaction.emoji)}>
                <Text style={styles.reactionChipEmoji}>{reaction.emoji}</Text>
                {reaction.count > 1 ? <Text style={styles.reactionChipCount}>{reaction.count}</Text> : null}
              </Pressable>
            ))}
          </View>
        ) : null}
        {endsGroup ? (
          <Text style={[styles.metaText, own ? styles.metaOwn : styles.metaOther]}>
            {formatTime(item.createdAt)}{own && isLast ? ` · ${item.read ? "Seen" : "Sent"}` : ""}
          </Text>
        ) : null}
      </View>
    );
  }, [selfId, controller, state.thread, state.messages, showRoleBadge, roleLabels, styles, t, openMenu, togglePlayVoice, playingVoiceId]);

  const assigneeId = state.thread?.assigneeId ?? state.thread?.createdBy?.id;
  const online = assigneeId ? state.onlineUserIds.includes(assigneeId) : false;
  const typing = state.typingUsers[0];
  const menuOwn = menuFor ? menuFor.senderId === selfId : false;

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
      <Modal
        visible={viewerUri !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerUri(null)}
      >
        <Pressable style={styles.viewerBackdrop} onPress={() => setViewerUri(null)}>
          {viewerUri ? (
            <Image source={{ uri: viewerUri }} style={styles.viewerImage} resizeMode="contain" />
          ) : null}
          <View style={styles.viewerClose}>
            <Text style={styles.viewerCloseText}>✕</Text>
          </View>
        </Pressable>
      </Modal>
      <Modal
        visible={menuFor !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuFor(null)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setMenuFor(null)}>
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <View style={styles.sheetReactions}>
              {QUICK_REACTIONS.map((emoji) => (
                <Pressable
                  key={emoji}
                  style={styles.sheetReaction}
                  onPress={() => {
                    const target = menuFor;
                    setMenuFor(null);
                    if (target) void controller.toggleReaction(target.id, emoji);
                  }}
                >
                  <Text style={styles.sheetReactionText}>{emoji}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              style={styles.sheetItem}
              onPress={() => {
                const target = menuFor;
                setMenuFor(null);
                if (target) setReplyTo(target);
              }}
            >
              <Text style={styles.sheetItemText}>Reply</Text>
            </Pressable>
            {menuOwn && menuFor?.messageType === "text" && menuFor?.content ? (
              <Pressable
                style={styles.sheetItem}
                onPress={() => {
                  const target = menuFor;
                  setMenuFor(null);
                  if (target) startEdit(target);
                }}
              >
                <Text style={styles.sheetItemText}>Edit</Text>
              </Pressable>
            ) : null}
            {menuOwn ? (
              <Pressable
                style={styles.sheetItem}
                onPress={() => {
                  if (!menuConfirmDelete) {
                    setMenuConfirmDelete(true);
                    return;
                  }
                  const target = menuFor;
                  setMenuFor(null);
                  if (target) void controller.deleteMessage(target.id);
                }}
              >
                <Text style={[styles.sheetItemText, styles.dangerText]}>
                  {menuConfirmDelete ? "Tap again to confirm delete" : "Delete"}
                </Text>
              </Pressable>
            ) : null}
            <Pressable style={[styles.sheetItem, styles.sheetCancel]} onPress={() => setMenuFor(null)}>
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
    list: { flexGrow: 1, paddingHorizontal: 14, paddingVertical: 12 } as const,
    emptyList: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 24 } as const,
    emptyText: { color: t.muted, textAlign: "center" } as const,

    groupStart: { marginTop: 14 } as const,
    groupCont: { marginTop: 2 } as const,
    senderHeader: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 5, marginLeft: 2 } as const,
    senderAvatar: { width: 26, height: 26, borderRadius: 13, overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: t.accentSoft } as const,
    senderAvatarImg: { width: 26, height: 26 } as const,
    senderAvatarText: { color: t.accentDark, fontSize: 12, fontWeight: "800" } as const,
    senderName: { color: t.muted, fontSize: 12, fontWeight: "600" } as const,

    bubble: { maxWidth: "80%", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18 } as const,
    ownBubble: { alignSelf: "flex-end", backgroundColor: t.accent } as const,
    otherBubble: { alignSelf: "flex-start", backgroundColor: t.incoming } as const,
    ownTail: { borderBottomRightRadius: 5 } as const,
    otherTail: { borderBottomLeftRadius: 5 } as const,
    ownText: { color: t.accentText, fontSize: 14.5, lineHeight: 20 } as const,
    otherText: { color: t.text, fontSize: 14.5, lineHeight: 20 } as const,

    replyQuote: { marginBottom: 5, paddingLeft: 8, paddingVertical: 1, borderLeftWidth: 2, borderRadius: 2 } as const,
    replyQuoteOwn: { borderLeftColor: "rgba(255,255,255,0.6)" } as const,
    replyQuoteOther: { borderLeftColor: t.muted } as const,
    replyQuoteText: { color: t.muted, fontSize: 12 } as const,
    replyQuoteTextOwn: { color: "rgba(255,255,255,0.85)", fontSize: 12 } as const,

    attachmentRow: { flexDirection: "row", alignItems: "center", gap: 8, minWidth: 150 } as const,
    attachmentIcon: { width: 30, height: 30, alignItems: "center", justifyContent: "center", borderRadius: 9, backgroundColor: "rgba(0,0,0,0.06)" } as const,
    attachmentIconOwn: { backgroundColor: "rgba(255,255,255,0.22)" } as const,
    attachmentText: { flexShrink: 1 } as const,
    fileText: { color: t.accentDark, fontWeight: "700" } as const,
    image: { width: 210, height: 150, borderRadius: 12, backgroundColor: t.border } as const,

    reactionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 3 } as const,
    reactionsOwn: { alignSelf: "flex-end", marginRight: 2 } as const,
    reactionsOther: { alignSelf: "flex-start", marginLeft: 2 } as const,
    reactionChip: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, borderWidth: 1, borderColor: t.border, backgroundColor: t.canvas } as const,
    reactionChipEmoji: { fontSize: 12 } as const,
    reactionChipCount: { fontSize: 11, fontWeight: "700", color: t.muted } as const,

    metaText: { marginTop: 3, color: t.muted, fontSize: 10.5 } as const,
    metaOwn: { alignSelf: "flex-end", marginRight: 3 } as const,
    metaOther: { alignSelf: "flex-start", marginLeft: 4 } as const,

    typing: { minHeight: 18, paddingHorizontal: 16, color: t.muted, fontSize: 12 } as const,
    replyBanner: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginHorizontal: 10, padding: 8, borderRadius: 8, backgroundColor: t.accentSoft } as const,
    replyText: { flex: 1, color: t.accentDark, fontSize: 12 } as const,
    cancelText: { color: t.accentDark, fontWeight: "700" } as const,
    composer: { flexDirection: "row", alignItems: "flex-end", gap: 4, paddingHorizontal: 8, paddingVertical: 8, borderTopWidth: 1, borderTopColor: t.border, backgroundColor: t.surface } as const,
    input: { flex: 1, maxHeight: 120, minHeight: 44, marginHorizontal: 2, borderWidth: 1, borderColor: t.border, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 11, color: t.text, backgroundColor: t.canvas, fontSize: 15 } as const,
    sendButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22, backgroundColor: t.accent } as const,
    disabled: { opacity: 0.4 } as const,
    iconButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20, backgroundColor: "transparent" } as const,
    error: { margin: 10, borderRadius: 10, padding: 10, backgroundColor: "#fef2f2" } as const,
    errorText: { color: t.danger } as const,
    loadEarlier: { padding: 8, color: t.accent, textAlign: "center" } as const,

    viewerBackdrop: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.92)", padding: 12 } as const,
    viewerImage: { width: "100%", height: "82%" } as const,
    viewerClose: { position: "absolute", top: 44, right: 20, width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20, backgroundColor: "rgba(255,255,255,0.16)" } as const,
    viewerCloseText: { color: "#fff", fontSize: 20, fontWeight: "700" } as const,

    sheetBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.35)" } as const,
    sheet: { padding: 8, paddingBottom: 22, borderTopLeftRadius: 22, borderTopRightRadius: 22, backgroundColor: t.surface, gap: 3 } as const,
    sheetReactions: { flexDirection: "row", justifyContent: "space-around", paddingVertical: 8, marginBottom: 4 } as const,
    sheetReaction: { width: 46, height: 46, alignItems: "center", justifyContent: "center", borderRadius: 23, backgroundColor: t.canvas } as const,
    sheetReactionText: { fontSize: 24 } as const,
    sheetItem: { paddingVertical: 13, paddingHorizontal: 16, borderRadius: 12 } as const,
    sheetItemText: { color: t.text, fontSize: 15, fontWeight: "600" } as const,
    sheetCancel: { marginTop: 5, alignItems: "center", backgroundColor: t.canvas } as const,
    sheetCancelText: { color: t.muted, fontSize: 15, fontWeight: "700" } as const,
    dangerText: { color: t.danger, fontWeight: "700" } as const,
  };
}
