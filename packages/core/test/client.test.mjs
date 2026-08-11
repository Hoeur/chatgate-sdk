import assert from "node:assert/strict";
import test from "node:test";
import {
  ChatGateError,
  createChatGateClient,
  createChatGateConversationController,
  createChatGateConversationListController,
} from "../dist/index.js";

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return body; },
    async text() { return JSON.stringify(body); },
  };
}

class FakeSocket {
  connected = false;
  auth = {};
  listeners = new Map();
  emitted = [];

  connect() {
    this.connected = true;
    this.trigger("connect");
    return this;
  }

  disconnect() {
    this.connected = false;
    this.trigger("disconnect", "client disconnect");
    return this;
  }

  on(event, listener) {
    const listeners = this.listeners.get(event) ?? [];
    listeners.push(listener);
    this.listeners.set(event, listeners);
    return this;
  }

  off(event, listener) {
    if (!listener) this.listeners.delete(event);
    else this.listeners.set(event, (this.listeners.get(event) ?? []).filter((item) => item !== listener));
    return this;
  }

  emit(event, ...args) {
    this.emitted.push([event, ...args]);
    if (event === "send_message") {
      const payload = args[0];
      const acknowledge = args[1];
      acknowledge({
        event: "message_sent",
        message: {
          id: "message-1",
          content: payload.content,
          messageType: payload.messageType,
          senderId: "visitor-1",
          receiverId: "agent-1",
          inboxConversationId: payload.inboxConversationId,
          read: false,
          createdAt: new Date(0).toISOString(),
        },
      });
    }
    return this;
  }

  trigger(event, value) {
    for (const listener of this.listeners.get(event) ?? []) listener(value);
  }
}

const session = {
  accessToken: "header.eyJleHAiOjQxMDI0NDQ4MDB9.signature",
  organizationId: "org-1",
  userId: "visitor-1",
  conversationId: "conversation-1",
};

test("starts a visitor session and connects the socket", async () => {
  const socket = new FakeSocket();
  const contexts = [];
  const client = createChatGateClient({
    baseUrl: "https://api.example.test/",
    sessionProvider: async (context) => {
      contexts.push(context);
      return session;
    },
    socketFactory: (_url, token) => {
      socket.auth = { token };
      return socket;
    },
    fetch: async () => response(200, {}),
  });

  const connected = new Promise((resolve) => client.on("connected", resolve));
  await client.start();
  await connected;

  assert.equal(client.connected, true);
  assert.equal(client.baseUrl, "https://api.example.test");
  assert.deepEqual(socket.auth, { token: session.accessToken });
  assert.deepEqual(contexts, [{ forceRefresh: false }]);
  client.stop();
});

test("creates a visitor session directly from a publishable key", async () => {
  const requests = [];
  const client = createChatGateClient({
    baseUrl: "https://api.example.test",
    publicKey: "cg_pub_example",
    organizationId: "org-1",
    userId: "customer-123",
    userName: "Customer",
    channel: "WEB_WIDGET",
    fetch: async (url, init) => {
      requests.push({ url, init });
      return response(200, session);
    },
    socketFactory: () => new FakeSocket(),
  });

  await client.start();

  assert.equal(requests[0].url, "https://api.example.test/api/gateway/embed/token");
  assert.deepEqual(JSON.parse(requests[0].init.body), {
    publicKey: "cg_pub_example",
    organizationId: "org-1",
    channel: "WEB_WIDGET",
    externalUserId: "customer-123",
    name: "Customer",
    visitorSessionId: JSON.parse(requests[0].init.body).visitorSessionId,
    visitorEventId: `${JSON.parse(requests[0].init.body).visitorSessionId}:started`,
  });
  client.stop();
});

test("requires either a publishable key or a custom session provider", () => {
  assert.throws(
    () => createChatGateClient({ baseUrl: "https://api.example.test" }),
    (error) => error instanceof ChatGateError && error.code === "INVALID_CONFIG",
  );
});

test("adds authorization and organization headers", async () => {
  const requests = [];
  const client = createChatGateClient({
    baseUrl: "https://api.example.test",
    sessionProvider: async () => session,
    socketFactory: () => new FakeSocket(),
    fetch: async (url, init) => {
      requests.push({ url, init });
      return response(200, [{ id: "conversation-1" }]);
    },
  });

  await client.listConversations({ status: "OPEN" });

  assert.equal(requests[0].url, "https://api.example.test/api/inbox/conversations?status=OPEN");
  assert.equal(requests[0].init.headers.Authorization, `Bearer ${session.accessToken}`);
  assert.equal(requests[0].init.headers["X-Organization-Id"], "org-1");
  client.stop();
});

test("refreshes the session once and retries a 401 request", async () => {
  let sessionCalls = 0;
  let requestCalls = 0;
  const client = createChatGateClient({
    baseUrl: "https://api.example.test",
    sessionProvider: async ({ forceRefresh }) => {
      sessionCalls += 1;
      return { ...session, accessToken: forceRefresh ? "fresh-token" : "old-token" };
    },
    socketFactory: () => new FakeSocket(),
    fetch: async () => {
      requestCalls += 1;
      return requestCalls === 1 ? response(401, { code: "UNAUTHORIZED" }) : response(200, []);
    },
  });

  const conversations = await client.listConversations();

  assert.deepEqual(conversations, []);
  assert.equal(sessionCalls, 2);
  assert.equal(requestCalls, 2);
  assert.equal(client.session.accessToken, "fresh-token");
  client.stop();
});

test("sends a visitor message through the inbox socket contract", async () => {
  const socket = new FakeSocket();
  const client = createChatGateClient({
    baseUrl: "https://api.example.test",
    sessionProvider: async () => session,
    socketFactory: () => socket,
    fetch: async () => response(200, {}),
  });
  await client.start();

  const message = await client.sendMessage({ content: "Hello from mobile" });

  assert.equal(message.content, "Hello from mobile");
  const send = socket.emitted.find(([event]) => event === "send_message");
  assert.equal(send[1].inboxConversationId, "conversation-1");
  assert.equal(send[1].messageType, "text");
  assert.equal(typeof send[1].clientMessageId, "string");
  assert.ok(send[1].clientMessageId.length > 10);
  client.stop();
});

test("emits only direct messages that arrive through new_dm", async () => {
  const socket = new FakeSocket();
  const client = createChatGateClient({
    baseUrl: "https://api.example.test",
    sessionProvider: async () => session,
    socketFactory: () => socket,
    fetch: async () => response(200, {}),
  });
  await client.start();

  const received = new Promise((resolve) => client.on("message", resolve));
  socket.trigger("new_dm", {
    dm: {
      id: "message-2",
      content: "Agent reply",
      messageType: "text",
      senderId: "agent-1",
      receiverId: "visitor-1",
      inboxConversationId: "conversation-1",
      read: false,
      createdAt: new Date(0).toISOString(),
    },
  });

  assert.equal((await received).content, "Agent reply");
  client.stop();
});

test("surfaces direct-message presence, typing, read, update, reaction, and delete events", async () => {
  const socket = new FakeSocket();
  const client = createChatGateClient({
    baseUrl: "https://api.example.test",
    sessionProvider: async () => session,
    socketFactory: () => socket,
    fetch: async () => response(200, {}),
  });
  await client.start();

  const seen = {};
  client.on("presence", (value) => { seen.presence = value; });
  client.on("typing", (value) => { seen.typing = value; });
  client.on("read", (value) => { seen.read = value; });
  client.on("messageUpdated", (value) => { seen.updated = value; });
  client.on("messageReactions", (value) => { seen.reactions = value; });
  client.on("messageDeleted", (value) => { seen.deleted = value; });

  socket.trigger("presence_state", { userIds: ["agent-1", 42] });
  socket.trigger("dm_typing", { userId: "agent-1", username: "Agent", isTyping: true });
  socket.trigger("dm_read", { readerId: "agent-1", senderId: "visitor-1" });
  socket.trigger("dm_updated", { dm: { id: "message-1", content: "Edited" } });
  socket.trigger("dm_reactions", { messageId: "message-1", reactions: [{ emoji: "👍", userId: "agent-1" }] });
  socket.trigger("dm_deleted", { messageId: "message-1", senderId: "visitor-1", receiverId: "agent-1" });

  assert.deepEqual(seen.presence, { userIds: ["agent-1"] });
  assert.equal(seen.typing.username, "Agent");
  assert.deepEqual(seen.read, { readerId: "agent-1", senderId: "visitor-1" });
  assert.equal(seen.updated.content, "Edited");
  assert.equal(seen.reactions.reactions[0].emoji, "👍");
  assert.equal(seen.deleted.messageId, "message-1");
  client.stop();
});

test("serializes mutation bodies and emits typing state", async () => {
  const socket = new FakeSocket();
  const requests = [];
  const client = createChatGateClient({
    baseUrl: "https://api.example.test",
    sessionProvider: async () => session,
    socketFactory: () => socket,
    fetch: async (url, init) => {
      requests.push({ url, init });
      if (url.endsWith("/reactions")) {
        return response(200, { messageId: "message-1", reactions: [{ emoji: "❤️", userId: "visitor-1" }] });
      }
      if (init.method === "PATCH") return response(200, { id: "message-1", content: "Edited" });
      if (init.method === "DELETE") return response(204, undefined);
      return response(200, { read: 2 });
    },
  });
  await client.start();

  client.setTyping("agent-1", true);
  assert.deepEqual(socket.emitted.at(-1), ["dm_typing_start", { receiverId: "agent-1" }]);
  assert.equal((await client.markRead("agent-1")).read, 2);
  await client.toggleReaction("message-1", "❤️");
  await client.editMessage("message-1", "Edited");
  await client.deleteMessage("message-1");

  const reactionRequest = requests.find(({ url }) => url.endsWith("/reactions"));
  assert.equal(reactionRequest.init.body, JSON.stringify({ emoji: "❤️" }));
  assert.equal(reactionRequest.init.headers["Content-Type"], "application/json");
  client.stop();
});

test("uploads a browser file and sends the returned attachment metadata", async () => {
  const socket = new FakeSocket();
  const requests = [];
  const client = createChatGateClient({
    baseUrl: "https://api.example.test",
    sessionProvider: async () => session,
    socketFactory: () => socket,
    fetch: async (url, init) => {
      requests.push({ url, init });
      return response(201, {
        url: "https://cdn.example.test/photo.webp",
        fileName: "photo.webp",
        mimeType: "image/webp",
        size: 42,
      });
    },
  });
  await client.start();

  const file = new File([new Uint8Array([1, 2, 3])], "photo.png", { type: "image/png" });
  const result = await client.uploadAndSend(
    { value: file, name: file.name, mimeType: file.type },
    { messageType: "image", content: "Screenshot" },
  );

  assert.equal(result.upload.mimeType, "image/webp");
  assert.equal(requests[0].url, "https://api.example.test/api/uploads");
  assert.ok(requests[0].init.body instanceof FormData);
  const send = socket.emitted.find(([event]) => event === "send_message");
  assert.equal(send[1].fileUrl, "https://cdn.example.test/photo.webp");
  assert.equal(send[1].messageType, "image");
  client.stop();
});

test("rejects invalid sessions before making requests", async () => {
  const client = createChatGateClient({
    baseUrl: "https://api.example.test",
    sessionProvider: async () => ({ accessToken: "", organizationId: "org-1", userId: "visitor-1" }),
    socketFactory: () => new FakeSocket(),
    fetch: async () => response(200, {}),
  });

  await assert.rejects(
    () => client.listConversations(),
    (error) => error instanceof ChatGateError && error.code === "INVALID_SESSION",
  );
});

test("conversation controller loads, deduplicates, and sends messages", async () => {
  const socket = new FakeSocket();
  const client = createChatGateClient({
    baseUrl: "https://api.example.test",
    sessionProvider: async () => session,
    socketFactory: () => socket,
    fetch: async (_url) => response(200, {
      id: "conversation-1",
      status: "OPEN",
      subject: null,
      createdAt: new Date(0).toISOString(),
      lastMessageAt: new Date(0).toISOString(),
      unreadCount: 0,
      messageCount: 0,
      messages: [],
      nextCursor: null,
    }),
  });
  await client.start();
  const controller = createChatGateConversationController(client);
  await controller.start();

  const sent = await controller.sendMessage({ content: "Controller message" });
  socket.trigger("new_dm", { dm: sent });

  assert.equal(controller.getSnapshot().messages.length, 1);
  assert.equal(controller.getSnapshot().messages[0].content, "Controller message");
  controller.stop();
  client.stop();
});

test("conversation list controller loads merchants, switches conversations, and tracks unread messages", async () => {
  const socket = new FakeSocket();
  const contexts = [];
  let activeConversationId = "conversation-1";
  const businessUnits = [
    { id: "unit-1", externalId: "merchant-one", name: "Merchant One", type: "MERCHANT" },
    { id: "unit-2", externalId: "merchant-two", name: "Merchant Two", type: "MERCHANT" },
  ];
  const conversations = [
    {
      id: "conversation-1",
      status: "OPEN",
      createdAt: new Date(0).toISOString(),
      lastMessageAt: new Date(0).toISOString(),
      unreadCount: 0,
      messageCount: 1,
      businessUnit: businessUnits[0],
    },
    {
      id: "conversation-2",
      status: "OPEN",
      createdAt: new Date(0).toISOString(),
      lastMessageAt: new Date(0).toISOString(),
      unreadCount: 0,
      messageCount: 0,
      businessUnit: businessUnits[1],
    },
  ];
  const client = createChatGateClient({
    baseUrl: "https://api.example.test",
    sessionProvider: async (context) => {
      contexts.push(context);
      if (context.businessUnitExternalId === "merchant-two") activeConversationId = "conversation-2";
      return { ...session, conversationId: activeConversationId, businessUnits };
    },
    socketFactory: () => socket,
    fetch: async (url) => url.endsWith("/inbox/conversations")
      ? response(200, conversations)
      : response(200, {}),
  });
  await client.start();
  const controller = createChatGateConversationListController(client);
  await controller.start();

  assert.equal(controller.getSnapshot().conversations.length, 2);
  assert.equal(controller.getSnapshot().businessUnits[1].name, "Merchant Two");

  socket.trigger("new_dm", {
    dm: {
      id: "message-list-1",
      content: "New merchant reply",
      messageType: "text",
      senderId: "agent-1",
      receiverId: "visitor-1",
      inboxConversationId: "conversation-1",
      read: false,
      createdAt: new Date(1_000).toISOString(),
    },
  });
  assert.equal(controller.getSnapshot().conversations[0].unreadCount, 1);
  assert.equal(controller.getSnapshot().conversations[0].lastMessage.content, "New merchant reply");

  controller.selectConversation("conversation-1");
  assert.equal(controller.getSnapshot().selectedConversationId, "conversation-1");
  await controller.selectBusinessUnit("merchant-two");
  assert.equal(controller.getSnapshot().selectedConversationId, "conversation-2");
  assert.equal(contexts.at(-1).businessUnitExternalId, "merchant-two");

  await controller.showList();
  assert.equal(controller.getSnapshot().selectedConversationId, undefined);
  controller.stop();
  client.stop();
});
