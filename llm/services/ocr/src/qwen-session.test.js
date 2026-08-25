import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDescribeMessages, buildResetMessages, qwenVisionConfig } from "./qwen-session.js";

describe("qwen-session", () => {
  it("describe messages are a single user turn without session_id", () => {
    const msgs = buildDescribeMessages({ imageB64: "aaa", mime: "image/jpeg", hint: "майка" });
    assert.equal(msgs.length, 1);
    assert.equal(msgs[0].role, "user");
    assert.ok(Array.isArray(msgs[0].content));
    const json = JSON.stringify(msgs);
    assert.equal(json.includes("session_id"), false);
    assert.equal(json.includes("conversation_id"), false);
    const second = buildDescribeMessages({ imageB64: "bbb", mime: "image/png", hint: "ноутбук" });
    assert.notEqual(JSON.stringify(msgs), JSON.stringify(second));
  });

  it("reset messages have no image", () => {
    const msgs = buildResetMessages();
    assert.equal(msgs.length, 1);
    assert.equal(typeof msgs[0].content, "string");
    assert.equal(JSON.stringify(msgs).includes("image_url"), false);
  });

  it("config is unset without key", () => {
    const cfg = qwenVisionConfig({ QWEN_API_KEY: "" });
    assert.equal(cfg.configured, false);
  });
});
