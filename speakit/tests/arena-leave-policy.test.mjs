import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);
const jiti = require("jiti")(__filename);

const {
  FORFEIT_PENALTY_COINS,
  MAX_FORFEITS_BEFORE_FREEZE,
  MAX_FORFEITS_AFTER_FIRST_FREEZE,
  PERMANENT_FREEZE_ISO,
  REASON_MIN_LENGTH,
  REASON_MAX_LENGTH,
  ADMIN_PENALTY_MAX_COINS,
  forfeitsRemaining,
  freezeMinutesForStrike,
  evaluateForfeit,
  isFrozen,
  validateReason,
  clampPenalty,
} = jiti(resolve(__dirname, "../lib/arena-leave-policy.ts"));

const { getVietnameseGloss } = jiti(
  resolve(__dirname, "../lib/beginner-glossary.ts")
);

test("Arena leave policy constants match configured limits and coin penalty", () => {
  assert.equal(FORFEIT_PENALTY_COINS, 3);
  assert.equal(MAX_FORFEITS_BEFORE_FREEZE, 10);
  assert.equal(MAX_FORFEITS_AFTER_FIRST_FREEZE, 5);
  assert.equal(REASON_MIN_LENGTH, 15);
  assert.equal(REASON_MAX_LENGTH, 300);
  assert.equal(ADMIN_PENALTY_MAX_COINS, 50);
  assert.equal(PERMANENT_FREEZE_ISO, "2099-12-31T23:59:59.000Z");
});

test("evaluateForfeit allows 10 leaves before strike 1, then escalates 30m -> 6h -> 24h -> permanent", () => {
  const now = Date.UTC(2026, 10, 17, 12, 0, 0);

  for (let prev = 0; prev < MAX_FORFEITS_BEFORE_FREEZE; prev += 1) {
    const res = evaluateForfeit({ leaveCount: prev, freezeStrikes: 0 }, now);
    assert.equal(res.leaveCount, prev + 1);
    assert.equal(res.freezeStrikes, 0);
    assert.equal(res.frozenUntilIso, null);
    assert.equal(res.permanent, false);
    assert.equal(res.freezeMinutes, 0);
  }

  // 11th abrupt quit triggers strike 1 (30 minutes freeze, counter resets to 0)
  const strike1 = evaluateForfeit({ leaveCount: 10, freezeStrikes: 0 }, now);
  assert.equal(strike1.leaveCount, 0);
  assert.equal(strike1.freezeStrikes, 1);
  assert.equal(strike1.freezeMinutes, 30);
  assert.equal(strike1.permanent, false);
  assert.equal(strike1.frozenUntilMs, now + 30 * 60 * 1000);

  // After strike 1, limit drops to 5 before next freeze
  for (let prev = 0; prev < MAX_FORFEITS_AFTER_FIRST_FREEZE; prev += 1) {
    const res = evaluateForfeit({ leaveCount: prev, freezeStrikes: 1 }, now);
    assert.equal(res.leaveCount, prev + 1);
    assert.equal(res.freezeStrikes, 1);
    assert.equal(res.frozenUntilIso, null);
  }

  const strike2 = evaluateForfeit({ leaveCount: 5, freezeStrikes: 1 }, now);
  assert.equal(strike2.freezeStrikes, 2);
  assert.equal(strike2.freezeMinutes, 360);
  assert.equal(strike2.permanent, false);

  const strike3 = evaluateForfeit({ leaveCount: 5, freezeStrikes: 2 }, now);
  assert.equal(strike3.freezeStrikes, 3);
  assert.equal(strike3.freezeMinutes, 1440);
  assert.equal(strike3.permanent, false);

  const strike4 = evaluateForfeit({ leaveCount: 5, freezeStrikes: 3 }, now);
  assert.equal(strike4.freezeStrikes, 4);
  assert.equal(strike4.permanent, true);
  assert.equal(strike4.frozenUntilIso, PERMANENT_FREEZE_ISO);
});

test("forfeitsRemaining, freezeMinutesForStrike, and isFrozen compute state accurately", () => {
  assert.deepEqual(forfeitsRemaining({ leaveCount: 4, freezeStrikes: 0 }), {
    limit: 10,
    remaining: 6,
  });
  assert.deepEqual(forfeitsRemaining({ leaveCount: 3, freezeStrikes: 2 }), {
    limit: 5,
    remaining: 2,
  });

  assert.deepEqual(freezeMinutesForStrike(1), { minutes: 30, permanent: false });
  assert.deepEqual(freezeMinutesForStrike(2), { minutes: 360, permanent: false });
  assert.deepEqual(freezeMinutesForStrike(3), { minutes: 1440, permanent: false });
  assert.deepEqual(freezeMinutesForStrike(4), { minutes: 0, permanent: true });

  const now = Date.UTC(2026, 10, 17, 12, 0, 0);
  assert.equal(isFrozen(null, now).frozen, false);
  assert.equal(isFrozen(new Date(now - 1000).toISOString(), now).frozen, false);

  const active = isFrozen(new Date(now + 12 * 60 * 1000).toISOString(), now);
  assert.equal(active.frozen, true);
  assert.equal(active.permanent, false);
  assert.equal(active.remainingMinutes, 12);

  const perm = isFrozen(PERMANENT_FREEZE_ISO, now);
  assert.equal(perm.frozen, true);
  assert.equal(perm.permanent, true);
});

test("validateReason and clampPenalty enforce bounds cleanly", () => {
  assert.equal(validateReason(null).valid, false);
  assert.equal(validateReason("too short").valid, false);

  const valid = validateReason("   Em bị rớt mạng wifi ký túc xá giữa chừng   ");
  assert.equal(valid.valid, true);
  assert.equal(valid.cleaned, "Em bị rớt mạng wifi ký túc xá giữa chừng");

  const tooLong = "x".repeat(REASON_MAX_LENGTH + 1);
  assert.equal(validateReason(tooLong).valid, false);

  assert.equal(clampPenalty(undefined), FORFEIT_PENALTY_COINS);
  assert.equal(clampPenalty(-10), 0);
  assert.equal(clampPenalty(7.6), 8);
  assert.equal(clampPenalty(999), ADMIN_PENALTY_MAX_COINS);
});

test("getVietnameseGloss resolves core terms, punctuation, and inflected forms", () => {
  assert.ok(getVietnameseGloss("rollback")?.includes("quay lại"));
  assert.ok(getVietnameseGloss("latency")?.includes("độ trễ"));
  assert.ok(getVietnameseGloss("bottleneck")?.includes("cổ chai"));
  assert.ok(getVietnameseGloss("Bugs,")?.includes("lỗi"));
  assert.ok(getVietnameseGloss("crashed!")?.includes("sập"));
  assert.ok(getVietnameseGloss("refactoring")?.includes("viết lại"));
  assert.equal(getVietnameseGloss("xyzunknownword123"), null);
  assert.equal(getVietnameseGloss(""), null);
});
