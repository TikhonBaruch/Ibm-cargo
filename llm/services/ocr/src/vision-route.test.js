import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveVisionProvider } from "./vision-route.js";
import { buildDeepseekDescribeMessages, deepseekVisionConfig } from "./deepseek-session.js";

describe("vision-route", () => {
  it("maps chain 3 / deepseek to deepseek provider", () => {
    assert.equal(resolveVisionProvider({ chainId: 3 }, {}), "deepseek");
    assert.equal(resolveVisionProvider({ chainId: "deepseek" }, {}), "deepseek");
    assert.equal(resolveVisionProvider({}, { AI_CHAIN_ID: "3" }), "deepseek");
  });

  it("defaults to qwen for chain 2 and unknown", () => {
    assert.equal(resolveVisionProvider({}, {}), "qwen");
    assert.equal(resolveVisionProvider({ chainId: 2 }, {}), "qwen");
    assert.equal(resolveVisionProvider({ chainId: 1 }, { AI_CHAIN_ID: "3" }), "qwen");
  });
});

describe("deepseek-session", () => {
  it("describe messages are a single user turn without session_id", () => {
    const msgs = buildDeepseekDescribeMessages({ imageB64: "aaa", mime: "image/jpeg", hint: "майка" });
    assert.equal(msgs.length, 1);
    assert.equal(msgs[0].role, "user");
    assert.ok(Array.isArray(msgs[0].content));
    const json = JSON.stringify(msgs);
    assert.equal(json.includes("session_id"), false);
  });

  it("config is unset without key", () => {
    assert.equal(deepseekVisionConfig({ DEEPSEEK_API_KEY: "" }).configured, false);
  });
});
