import type { ChatGateMessage } from "./types.js";

/**
 * Participant role a message can be attributed to inside a conversation.
 *
 * - `customer` — the end customer / visitor (client) who owns the conversation.
 * - `merchant` — the business side replying (the assigned agent / merchant).
 * - `admin`    — an organization owner or staff member who is neither the
 *                customer nor the current assignee.
 */
export type ChatGateParticipantRole = "customer" | "merchant" | "admin";

/**
 * Minimal shape needed to attribute a message to a role. Both
 * `ChatGateConversation` and `ChatGateConversationThread` satisfy it, so the
 * conversation thread can be passed directly.
 */
export interface ChatGateRoleContext {
  customerId?: string | null;
  customer?: { id: string } | null;
  assigneeId?: string | null;
  assignee?: { id: string } | null;
  createdBy?: { id: string } | null;
}

/**
 * Derive the participant role of a message from the conversation it belongs to.
 *
 * The role is inferred client-side (no backend change required):
 *   1. sender is the conversation customer             -> `customer`
 *   2. sender is the assignee or created the thread     -> `merchant`
 *   3. any other sender                                 -> `admin`
 *
 * When no context is available the message is treated as coming from the
 * `customer`, which is the safe default for a visitor-facing widget.
 */
export function resolveMessageRole(
  message: Pick<ChatGateMessage, "senderId">,
  context?: ChatGateRoleContext | null,
): ChatGateParticipantRole {
  const senderId = message.senderId;
  if (!senderId || !context) return "customer";

  const customerId = context.customerId ?? context.customer?.id ?? null;
  if (customerId && senderId === customerId) return "customer";

  const assigneeId = context.assigneeId ?? context.assignee?.id ?? null;
  if (assigneeId && senderId === assigneeId) return "merchant";

  const creatorId = context.createdBy?.id ?? null;
  if (creatorId && senderId === creatorId) return "merchant";

  return "admin";
}

/** Human-readable label for a participant role. */
export function getRoleLabel(role: ChatGateParticipantRole): string {
  return CHATGATE_ROLE_LABELS[role];
}

/** Default human-readable labels for each role. */
export const CHATGATE_ROLE_LABELS: Record<ChatGateParticipantRole, string> = {
  customer: "Customer",
  merchant: "Merchant",
  admin: "Admin",
};
