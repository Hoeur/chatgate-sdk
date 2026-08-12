import assert from "node:assert/strict";
import test from "node:test";
import { resolveMessageRole, CHATGATE_ROLE_LABELS } from "../dist/index.js";

const thread = {
  customerId: "cust_1",
  assigneeId: "agent_1",
  createdBy: { id: "cust_1" },
};

test("attributes the conversation customer as customer", () => {
  assert.equal(resolveMessageRole({ senderId: "cust_1" }, thread), "customer");
});

test("attributes the assignee as merchant", () => {
  assert.equal(resolveMessageRole({ senderId: "agent_1" }, thread), "merchant");
});

test("attributes the thread creator (when not the customer) as merchant", () => {
  assert.equal(
    resolveMessageRole({ senderId: "agent_2" }, { assigneeId: "agent_1", createdBy: { id: "agent_2" } }),
    "merchant",
  );
});

test("attributes any other sender as admin", () => {
  assert.equal(resolveMessageRole({ senderId: "owner_9" }, thread), "admin");
});

test("resolves via nested customer/assignee objects", () => {
  const ctx = { customer: { id: "c" }, assignee: { id: "a" } };
  assert.equal(resolveMessageRole({ senderId: "c" }, ctx), "customer");
  assert.equal(resolveMessageRole({ senderId: "a" }, ctx), "merchant");
});

test("defaults to customer without context", () => {
  assert.equal(resolveMessageRole({ senderId: "x" }), "customer");
  assert.equal(resolveMessageRole({ senderId: "" }, thread), "customer");
});

test("exposes default labels", () => {
  assert.deepEqual(CHATGATE_ROLE_LABELS, { customer: "Customer", merchant: "Merchant", admin: "Admin" });
});
