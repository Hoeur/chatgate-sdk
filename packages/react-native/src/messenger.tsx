import { useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { ChatGateBusinessUnit, ChatGateConversation as ConversationModel } from "@chatgate/core";
import {
  ChatGateConversation,
  type ChatGateConversationProps,
} from "./conversation.js";
import { useChatGateConversationList } from "./use-conversation-list.js";

export interface ChatGateMessengerProps
  extends Omit<ChatGateConversationProps, "onBack"> {
  showConversationList?: boolean;
  greeting?: string;
}

function unitName(unit: ChatGateBusinessUnit | null | undefined, fallback: string): string {
  return unit?.name?.trim() || fallback;
}

function ConversationRow({
  conversation,
  onPress,
}: {
  conversation: ConversationModel;
  onPress: () => void;
}) {
  const name = unitName(conversation.businessUnit, "Company support");
  const unreadCount = conversation.unreadCount ?? 0;
  return (
    <Pressable accessibilityRole="button" style={styles.row} onPress={onPress}>
      <View style={styles.avatar}><Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text></View>
      <View style={styles.rowMeta}>
        <Text numberOfLines={1} style={styles.rowName}>{name}</Text>
        <Text numberOfLines={1} style={styles.rowDescription}>{conversation.businessUnit?.type || "Business"} support</Text>
      </View>
      {unreadCount > 0 ? (
        <View accessibilityLabel={`${unreadCount} unread messages`} style={styles.unread}>
          <Text style={styles.unreadText}>{unreadCount > 99 ? "99+" : unreadCount}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function BusinessUnitRow({
  unit,
  disabled,
  onPress,
}: {
  unit: ChatGateBusinessUnit;
  disabled: boolean;
  onPress: () => void;
}) {
  const name = unitName(unit, unit.externalId);
  return (
    <Pressable accessibilityRole="button" style={styles.row} disabled={disabled} onPress={onPress}>
      <View style={styles.avatar}><Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text></View>
      <View style={styles.rowMeta}>
        <Text numberOfLines={1} style={styles.rowName}>{name}</Text>
        <Text numberOfLines={1} style={styles.rowDescription}>{unit.type || "Business"} support</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

function ChatGateConversationNavigator({
  title = "Support",
  greeting,
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
      <ChatGateConversation
        {...conversationProps}
        conversationId={state.selectedConversationId}
        title={unitName(selectedConversation?.businessUnit, title)}
        style={style}
        onBack={() => void controller.showList()}
      />
    );
  }

  return (
    <View style={[styles.root, style]} accessibilityLabel={`${title} conversations`}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.greeting}>{greeting ?? `Welcome to ${title}. Choose a conversation or start chatting with a business.`}</Text>
        <Text style={styles.online}>● We&apos;re online</Text>
      </View>
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {state.error ? (
          <Pressable accessibilityRole="button" style={styles.error} onPress={() => void controller.reload()}>
            <Text style={styles.errorText}>{state.error.message} — tap to retry</Text>
          </Pressable>
        ) : null}
        {state.conversations.length > 0 ? <Text style={styles.sectionTitle}>Your conversations</Text> : null}
        {state.conversations.map((conversation) => (
          <ConversationRow
            key={conversation.id}
            conversation={conversation}
            onPress={() => controller.selectConversation(conversation.id)}
          />
        ))}
        {availableBusinessUnits.length > 0 ? <Text style={[styles.sectionTitle, styles.businessSection]}>Chat with a business</Text> : null}
        {availableBusinessUnits.map((unit) => (
          <BusinessUnitRow
            key={unit.id}
            unit={unit}
            disabled={state.switching}
            onPress={() => void controller.selectBusinessUnit(unit.externalId).catch(() => undefined)}
          />
        ))}
        {state.loading && state.conversations.length === 0 ? <ActivityIndicator style={styles.loading} /> : null}
        {!state.loading && state.conversations.length === 0 && availableBusinessUnits.length === 0 ? <Text style={styles.empty}>No conversations yet.</Text> : null}
      </ScrollView>
    </View>
  );
}

export function ChatGateMessenger({
  showConversationList = true,
  conversationId,
  greeting,
  ...props
}: ChatGateMessengerProps) {
  if (!showConversationList || conversationId) {
    return <ChatGateConversation {...props} {...(conversationId ? { conversationId } : {})} />;
  }
  return <ChatGateConversationNavigator {...props} {...(greeting ? { greeting } : {})} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 360, overflow: "hidden", borderWidth: 1, borderColor: "#dbe3ef", borderRadius: 16, backgroundColor: "#fff" },
  header: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 18, backgroundColor: "#2563eb" },
  title: { color: "#fff", fontSize: 20, fontWeight: "800" },
  greeting: { marginTop: 8, color: "#dbeafe", fontSize: 13, lineHeight: 20 },
  online: { marginTop: 12, color: "#dcfce7", fontSize: 12, fontWeight: "700" },
  body: { flex: 1, backgroundColor: "#f7f9fc" },
  bodyContent: { flexGrow: 1, padding: 18 },
  sectionTitle: { marginBottom: 8, color: "#64748b", fontSize: 11, fontWeight: "800", letterSpacing: 1.1, textTransform: "uppercase" },
  businessSection: { marginTop: 18 },
  row: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 8, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: "#dce5f1", borderRadius: 14, backgroundColor: "#fff" },
  avatar: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: "#2563eb" },
  avatarText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  rowMeta: { minWidth: 0, flex: 1, gap: 3 },
  rowName: { color: "#0f172a", fontSize: 14, fontWeight: "700" },
  rowDescription: { color: "#64748b", fontSize: 12 },
  unread: { minWidth: 24, height: 24, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "#2563eb", paddingHorizontal: 5 },
  unreadText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  chevron: { color: "#64748b", fontSize: 22 },
  error: { marginBottom: 12, borderRadius: 10, padding: 10, backgroundColor: "#fef2f2" },
  errorText: { color: "#b91c1c" },
  loading: { flex: 1, marginVertical: 48 },
  empty: { flex: 1, marginVertical: 48, color: "#64748b", textAlign: "center" },
});
