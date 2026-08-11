"use client";

import {
  ChatGateConversation,
  ChatGateProvider,
  useChatGate,
} from "@chatgate/react";
import { chatGateClient } from "./chatgate-client";

function ConnectionStatus() {
  const { status, error } = useChatGate();
  const label = error ? `Connection error: ${error.message}` : `Socket: ${status}`;

  return (
    <p className={`connection-status connection-status--${status}`} role="status">
      <span aria-hidden="true" />
      {label}
    </p>
  );
}

export function SupportChat() {
  return (
    <section className="demo-panel" aria-labelledby="demo-heading">
      <ChatGateProvider client={chatGateClient} fallback={<div className="loading-card" role="status">Loading ChatGate…</div>}>
        <div className="demo-panel__header">
          <div>
            <p className="eyebrow">Live contract demo</p>
            <h2 id="demo-heading">Customer support conversation</h2>
          </div>
          <ConnectionStatus />
        </div>
        <ChatGateConversation
          title="ChatGate support"
          placeholder="Send a test message"
          emptyState="The conversation is ready. Send the first message."
        />
      </ChatGateProvider>
      <p className="demo-note">
        Messages are sent to your live Business Inbox. Reply there to verify the customer
        receives the merchant response over <code>new_dm</code> through Socket.IO.
      </p>
    </section>
  );
}
