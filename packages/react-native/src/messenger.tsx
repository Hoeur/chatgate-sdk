import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import type {
  ChatGateBusinessUnit,
  ChatGateConversation as ConversationModel,
} from "@chatgate/core";
import {
  ChatGateConversation,
  type ChatGateConversationProps,
} from "./conversation.js";
import { SearchIcon } from "./icons.js";
import {
  formatRelativeTime,
  resolveChatGateTheme,
  type ResolvedChatGateTheme,
} from "./theme.js";
import { useChatGateConversationList } from "./use-conversation-list.js";

export interface ChatGateMessengerProps
  extends Omit<ChatGateConversationProps, "onBack"> {
  showConversationList?: boolean;
  showBusinessDirectory?: boolean;
  greeting?: string;
  /** Show the search field above the conversation list. Default true. */
  showSearch?: boolean;
}

function unitName(unit: ChatGateBusinessUnit | null | undefined, fallback: string): string {
  return unit?.name?.trim() || fallback;
}

function previewFor(conversation: ConversationModel): string {
  const message = conversation.lastMessage;
  if (!message) return "Tap to start the conversation";
  if (message.messageType === "image") return "Photo";
  if (message.messageType === "voice") return "Voice message";
  return message.content?.trim() || message.fileName || "Attachment";
}

function ConversationRow({
  conversation,
  theme,
  onPress,
}: {
  conversation: ConversationModel;
  theme: ResolvedChatGateTheme;
  onPress: () => void;
}) {
  const name = unitName(conversation.businessUnit, "Company support");
  const unreadCount = conversation.unreadCount ?? 0;
  const unread = unreadCount > 0;
  const time = formatRelativeTime(conversation.lastMessageAt);
  const s = rowStyles(theme);
  return (
    <Pressable accessibilityRole="button" style={s.row} onPress={onPress}>
      <View style={s.avatar}>
        <Text style={s.avatarText}>{name.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={s.meta}>
        <View style={s.line}>
          <Text numberOfLines={1} style={[s.name, unread && s.nameUnread]}>{name}</Text>
          {time ? <Text style={s.time}>{time}</Text> : null}
        </View>
        <View style={s.line}>
          <Text numberOfLines={1} style={[s.preview, unread && s.previewUnread]}>
            {previewFor(conversation)}
          </Text>
          {unread ? (
            <View accessibilityLabel={`${unreadCount} unread messages`} style={s.unread}>
              <Text style={s.unreadText}>{unreadCount > 99 ? "99+" : unreadCount}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

function BusinessUnitRow({
  unit,
  theme,
  disabled,
  onPress,
}: {
  unit: ChatGateBusinessUnit;
  theme: ResolvedChatGateTheme;
  disabled: boolean;
  onPress: () => void;
}) {
  const name = unitName(unit, unit.externalId);
  const s = rowStyles(theme);
  return (
    <Pressable accessibilityRole="button" style={s.row} disabled={disabled} onPress={onPress}>
      <View style={[s.avatar, s.avatarSoft]}>
        <Text style={[s.avatarText, s.avatarSoftText]}>{name.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={s.meta}>
        <Text numberOfLines={1} style={s.name}>{name}</Text>
        <Text numberOfLines={1} style={s.preview}>{unit.type || "Business"} · start a chat</Text>
      </View>
      <Text style={s.chevron}>›</Text>
    </Pressable>
  );
}

function ChatGateConversationNavigator({
  title = "Support",
  greeting,
  style,
  theme,
  header = "full",
  showSearch = true,
  showBusinessDirectory = true,
  ...conversationProps
}: Omit<ChatGateMessengerProps, "showConversationList" | "conversationId">) {
  const { controller, state } = useChatGateConversationList();
  const [query, setQuery] = useState("");
  const c = useMemo(() => resolveChatGateTheme(theme), [theme]);
  const styles = useMemo(() => navStyles(c), [c]);

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

  const term = query.trim().toLowerCase();
  const conversations = term
    ? state.conversations.filter((conversation) => {
        const name = unitName(conversation.businessUnit, "").toLowerCase();
        return name.includes(term) || previewFor(conversation).toLowerCase().includes(term);
      })
    : state.conversations;
  const businessUnits = term
    ? availableBusinessUnits.filter((unit) =>
        unitName(unit, unit.externalId).toLowerCase().includes(term),
      )
    : availableBusinessUnits;

  if (state.selectedConversationId) {
    return (
      <ChatGateConversation
        {...conversationProps}
        {...(theme ? { theme } : {})}
        header={header}
        conversationId={state.selectedConversationId}
        title={unitName(selectedConversation?.businessUnit, title)}
        style={style}
        onBack={() => void controller.showList()}
      />
    );
  }

  const visibleBusinessUnits = showBusinessDirectory ? businessUnits : [];

  const nothingToShow =
    !state.loading && conversations.length === 0 && visibleBusinessUnits.length === 0;

  return (
    <View style={[styles.root, style]} accessibilityLabel={`${title} conversations`}>
      {header === "full" ? (
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.greeting}>
            {greeting ?? `Welcome to ${title}. Choose a conversation or start chatting with a business.`}
          </Text>
          <View style={styles.onlineRow}>
            <View style={styles.onlineDot} />
            <Text style={styles.online}>We&apos;re online</Text>
          </View>
        </View>
      ) : header === "minimal" ? (
        <View style={styles.headerMinimal}>
          <Text style={styles.headerTitleMinimal}>{title}</Text>
        </View>
      ) : null}

      {showSearch ? (
        <View style={styles.searchWrap}>
          <SearchIcon size={15} color={c.muted} />
          <TextInput
            accessibilityLabel="Search conversations"
            style={styles.search}
            placeholder="Search conversations"
            placeholderTextColor={c.muted}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
          />
        </View>
      ) : null}

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {state.error ? (
          <Pressable accessibilityRole="button" style={styles.error} onPress={() => void controller.reload()}>
            <Text style={styles.errorText}>{state.error.message} — tap to retry</Text>
          </Pressable>
        ) : null}

        {conversations.length > 0 ? <Text style={styles.sectionTitle}>Conversations</Text> : null}
        {conversations.map((conversation) => (
          <ConversationRow
            key={conversation.id}
            conversation={conversation}
            theme={c}
            onPress={() => controller.selectConversation(conversation.id)}
          />
        ))}

        {visibleBusinessUnits.length > 0 ? (
          <Text style={[styles.sectionTitle, styles.businessSection]}>Chat with a business</Text>
        ) : null}
        {visibleBusinessUnits.map((unit) => (
          <BusinessUnitRow
            key={unit.id}
            unit={unit}
            theme={c}
            disabled={state.switching}
            onPress={() => void controller.selectBusinessUnit(unit.externalId).catch(() => undefined)}
          />
        ))}

        {state.loading && state.conversations.length === 0 ? (
          <ActivityIndicator color={c.accent} style={styles.loading} />
        ) : null}
        {nothingToShow ? (
          <Text style={styles.empty}>{term ? "No matches." : "No conversations yet."}</Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

export function ChatGateMessenger({
  showConversationList = true,
  showBusinessDirectory = true,
  conversationId,
  greeting,
  ...props
}: ChatGateMessengerProps) {
  if (!showConversationList || conversationId) {
    return <ChatGateConversation {...props} {...(conversationId ? { conversationId } : {})} />;
  }
  return (
    <ChatGateConversationNavigator
      {...props}
      {...(greeting ? { greeting } : {})}
      showBusinessDirectory={showBusinessDirectory}
    />
  );
}

function navStyles(t: ResolvedChatGateTheme) {
  return {
    root: { flex: 1, minHeight: 360, overflow: "hidden", borderWidth: 1, borderColor: t.border, borderRadius: t.radius, backgroundColor: t.surface } as const,
    header: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 18, backgroundColor: t.accent } as const,
    headerMinimal: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: t.border, backgroundColor: t.surface } as const,
    headerTitleMinimal: { color: t.text, fontSize: 18, fontWeight: "800" } as const,
    title: { color: t.accentText, fontSize: 20, fontWeight: "800" } as const,
    greeting: { marginTop: 8, color: t.accentSoft, fontSize: 13, lineHeight: 20 } as const,
    onlineRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12 } as const,
    onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: t.online } as const,
    online: { color: t.accentText, opacity: 0.9, fontSize: 12, fontWeight: "700" } as const,
    searchWrap: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 14, marginTop: 12, paddingHorizontal: 12, height: 40, borderWidth: 1, borderColor: t.border, borderRadius: 12, backgroundColor: t.surface } as const,
    search: { flex: 1, color: t.text, fontSize: 14, padding: 0 } as const,
    body: { flex: 1, backgroundColor: t.canvas } as const,
    bodyContent: { flexGrow: 1, padding: 14 } as const,
    sectionTitle: { marginBottom: 8, marginTop: 4, color: t.muted, fontSize: 11, fontWeight: "800", letterSpacing: 1.1, textTransform: "uppercase" } as const,
    businessSection: { marginTop: 18 } as const,
    error: { marginBottom: 12, borderRadius: 10, padding: 10, backgroundColor: "#fef2f2" } as const,
    errorText: { color: t.danger } as const,
    loading: { flex: 1, marginVertical: 48 } as const,
    empty: { flex: 1, marginVertical: 48, color: t.muted, textAlign: "center" } as const,
  };
}

function rowStyles(t: ResolvedChatGateTheme) {
  return {
    row: { minHeight: 66, flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 8, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: t.border, borderRadius: 14, backgroundColor: t.surface } as const,
    avatar: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: t.accent } as const,
    avatarSoft: { backgroundColor: t.accentSoft } as const,
    avatarText: { color: t.accentText, fontSize: 16, fontWeight: "800" } as const,
    avatarSoftText: { color: t.accentDark } as const,
    meta: { minWidth: 0, flex: 1, gap: 3 } as const,
    line: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 } as const,
    name: { minWidth: 0, flexShrink: 1, color: t.text, fontSize: 14, fontWeight: "700" } as const,
    nameUnread: { fontWeight: "800" } as const,
    time: { color: t.muted, fontSize: 11 } as const,
    preview: { minWidth: 0, flexShrink: 1, color: t.muted, fontSize: 12.5 } as const,
    previewUnread: { color: t.text, fontWeight: "600" } as const,
    unread: { minWidth: 22, height: 22, alignItems: "center", justifyContent: "center", borderRadius: 11, backgroundColor: t.accent, paddingHorizontal: 6 } as const,
    unreadText: { color: t.accentText, fontSize: 10, fontWeight: "800" } as const,
    chevron: { color: t.muted, fontSize: 22 } as const,
  };
}
