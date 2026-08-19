import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeUrl, isSafeUrl } from "../dist/index.js";

test("keeps http, https, mailto and tel URLs", () => {
  assert.equal(sanitizeUrl("https://cdn.example.test/a.png"), "https://cdn.example.test/a.png");
  assert.equal(sanitizeUrl("http://cdn.example.test/a.png"), "http://cdn.example.test/a.png");
  assert.equal(sanitizeUrl("mailto:support@example.test"), "mailto:support@example.test");
  assert.equal(sanitizeUrl("tel:+15551234"), "tel:+15551234");
});

test("rejects script-bearing and unlisted schemes", () => {
  assert.equal(sanitizeUrl("javascript:alert(1)"), undefined);
  assert.equal(sanitizeUrl("JavaScript:alert(1)"), undefined);
  assert.equal(sanitizeUrl("  javascript:alert(1)"), undefined);
  assert.equal(sanitizeUrl("java\u0000script:alert(1)"), undefined);
  assert.equal(sanitizeUrl("java\nscript:alert(1)"), undefined);
  assert.equal(sanitizeUrl("data:text/html;base64,PHNjcmlwdD4="), undefined);
  assert.equal(sanitizeUrl("vbscript:msgbox(1)"), undefined);
  assert.equal(sanitizeUrl("file:///etc/passwd"), undefined);
});

test("rejects schemes hidden behind invisible formatting marks", () => {
  for (const mark of ["\u200b", "\u200c", "\u200d", "\u200e", "\u200f", "\u202e", "\u2066", "\u00ad", "\ufeff"]) {
    assert.equal(sanitizeUrl(`${mark}javascript:alert(1)`), undefined, `leading ${JSON.stringify(mark)}`);
    assert.equal(sanitizeUrl(`java${mark}script:alert(1)`), undefined, `embedded ${JSON.stringify(mark)}`);
  }
});

test("rejects empty and non-string values", () => {
  assert.equal(sanitizeUrl(undefined), undefined);
  assert.equal(sanitizeUrl(null), undefined);
  assert.equal(sanitizeUrl("   "), undefined);
});

test("allows relative references unless disabled", () => {
  assert.equal(sanitizeUrl("/uploads/a.png"), "/uploads/a.png");
  assert.equal(sanitizeUrl("//cdn.example.test/a.png"), "//cdn.example.test/a.png");
  assert.equal(sanitizeUrl("/uploads/a.png", { allowRelative: false }), undefined);
});

test("honours a custom scheme allowlist", () => {
  assert.equal(sanitizeUrl("mailto:a@b.test", { schemes: ["https:"] }), undefined);
  assert.equal(isSafeUrl("https://a.test", { schemes: ["https:"] }), true);
});
