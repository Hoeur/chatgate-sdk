import assert from "node:assert/strict";
import test from "node:test";
import { createChatGateClient } from "@chatgate/core";
import {
  ChatGate,
  ChatGateConversation,
  ChatGateMessenger,
  ChatGateProvider,
  useChatGate,
  useChatGateConversationList,
} from "@chatgate/react";

test("loads the ChatGate packages through their public entry points", () => {
  assert.equal(typeof createChatGateClient, "function");
  assert.equal(typeof ChatGate, "function");
  assert.equal(typeof ChatGateConversation, "function");
  assert.equal(typeof ChatGateMessenger, "function");
  assert.equal(typeof ChatGateProvider, "function");
  assert.equal(typeof useChatGate, "function");
  assert.equal(typeof useChatGateConversationList, "function");
});
