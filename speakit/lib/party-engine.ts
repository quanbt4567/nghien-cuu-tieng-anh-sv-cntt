import { randomBytes } from "crypto";
import { getDbClient } from "./db";
import { ensureSchema } from "./db/neon";
import { scoreLocally } from "./localScorer";
import {
  findPartyScenarioById,
  PARTY_SCENARIOS,
  PartyPlayerSlot,
  PartyRoomState,
  PartyRoomStatus,
  PartyScenario,
  PlayerRole,
  TurnEvaluation,
} from "./party-scenarios";

export const PARTY_ROLES: readonly PlayerRole[] = ["frontend", "backend", "devops"];
export const VIETNAMESE_PENALTY_SECONDS = 15;
export const PARTY_WIN_COINS = 15;
export const PARTY_MVP_BONUS_COINS = 10;

const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const VIETNAMESE_DIACRITIC_REGEX =
  /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;

const VIETNAMESE_ASCII_WORDS = new Set([
  "khong",
  "duoc",
  "nhung",
  "nhieu",
  "nguoi",
  "biet",
  "hieu",
  "tieng",
  "viet",
  "chao",
  "giup",
  "minh",
  "cua",
  "voi",
  "neu",
  "roi",
  "nhe",
  "nha",
  "vay",
  "chua",
  "dang",
  "phai",
  "muon",
  "thay",
  "nua",
  "luon",
  "xin",
  "toi",
  "xong",
  "chac",
  "kiem",
  "tra",
  "sua",
  "thu",
  "troi",
]);

export interface VietnamesePenaltyResult {
  detected: boolean;
  matchedTokens: string[];
  penaltySeconds: number;
}

export interface PartyRoomSnapshot extends PartyRoomState {
  resolutionProgress: number;
  remainingSeconds: number;
  totalPenaltySeconds: number;
  mvpPlayerId: string | null;
  mvpDisplayName: string | null;
  rewardsAwarded: boolean;
}

export interface VictoryRewardSummary {
  winCoins: number;
  mvpBonusCoins: number;
  totalMvpCoins: number;
  mvpPlayerId: string | null;
  mvpDisplayName: string | null;
}

const globalForParty = globalThis as typeof globalThis & {
  __speakitPartyRooms?: Map<string, PartyRoomSnapshot>;
};

function getMemoryRoomStore(): Map<string, PartyRoomSnapshot> {
  if (!globalForParty.__speakitPartyRooms) {
    globalForParty.__speakitPartyRooms = new Map<string, PartyRoomSnapshot>();
  }
  return globalForParty.__speakitPartyRooms;
}

export function generatePartyRoomCode(): string {
  const bytes = randomBytes(6);
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += ROOM_CODE_ALPHABET[bytes[i] % ROOM_CODE_ALPHABET.length];
  }
  return code;
}

export function normalizeRoomCode(code: unknown): string | null {
  if (typeof code !== "string") return null;
  const cleaned = code.trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(cleaned)) return null;
  return cleaned;
}

export function isValidPartyRole(role: unknown): role is PlayerRole {
  return role === "frontend" || role === "backend" || role === "devops";
}

export function detectVietnamesePenalty(transcript: string): VietnamesePenaltyResult {
  if (typeof transcript !== "string" || !transcript.trim()) {
    return { detected: false, matchedTokens: [], penaltySeconds: 0 };
  }

  const rawTokens = transcript
    .trim()
    .split(/[\s,.;:!?()"'\/\\-]+/)
    .filter(Boolean);

  const matched = new Set<string>();
  for (const token of rawTokens) {
    if (VIETNAMESE_DIACRITIC_REGEX.test(token)) {
      matched.add(token);
      continue;
    }
    const lower = token.toLowerCase();
    if (VIETNAMESE_ASCII_WORDS.has(lower)) {
      matched.add(token);
    }
  }

  if (matched.size === 0) {
    return { detected: false, matchedTokens: [], penaltySeconds: 0 };
  }

  return {
    detected: true,
    matchedTokens: Array.from(matched),
    penaltySeconds: VIETNAMESE_PENALTY_SECONDS,
  };
}

export function createPartyRoom(options?: {
  scenarioId?: string;
  roomCode?: string;
  hostPlayer?: {
    id: string;
    displayName: string;
    role?: PlayerRole;
  };
}): PartyRoomSnapshot {
  const scenario =
    (options?.scenarioId ? findPartyScenarioById(options.scenarioId) : undefined) ??
    PARTY_SCENARIOS[0];
  const roomCode = normalizeRoomCode(options?.roomCode) ?? generatePartyRoomCode();
  const now = new Date().toISOString();

  const players: PartyPlayerSlot[] = [];
  if (options?.hostPlayer) {
    const role = isValidPartyRole(options.hostPlayer.role)
      ? options.hostPlayer.role
      : "frontend";
    players.push({
      id: options.hostPlayer.id,
      displayName: options.hostPlayer.displayName || "Host Engineer",
      role,
      isReady: true,
    });
  }

  return {
    roomCode,
    scenarioId: scenario.id,
    status: "lobby",
    currentTurnRole: null,
    players,
    evaluations: [],
    teamScore: 0,
    resolutionProgress: 0,
    remainingSeconds: scenario.estimatedMinutes * 60,
    totalPenaltySeconds: 0,
    mvpPlayerId: null,
    mvpDisplayName: null,
    rewardsAwarded: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function joinPartyRoom(
  room: PartyRoomSnapshot,
  player: {
    id: string;
    displayName: string;
    role?: PlayerRole;
  }
): PartyRoomSnapshot {
  const now = new Date().toISOString();
  const existingIndex = room.players.findIndex((p) => p.id === player.id);

  const takenRoles = new Set(
    room.players
      .filter((p) => p.id !== player.id && !p.id.startsWith("ai-"))
      .map((p) => p.role)
  );

  const firstFreeRole =
    PARTY_ROLES.find((r) => !room.players.some((p) => p.role === r && p.id !== player.id)) ??
    PARTY_ROLES.find((r) => !takenRoles.has(r)) ??
    "frontend";

  const targetRole = isValidPartyRole(player.role) ? player.role : firstFreeRole;

  const filteredPlayers = room.players.filter((p) => {
    if (p.id === player.id) return false;
    if (p.id.startsWith("ai-") && p.role === targetRole) return false;
    return true;
  });

  const existingSlot = existingIndex >= 0 ? room.players[existingIndex] : undefined;
  const nextSlot: PartyPlayerSlot = {
    id: player.id,
    displayName: player.displayName || existingSlot?.displayName || "Engineer",
    role: targetRole,
    isReady: true,
    transcript: existingSlot?.transcript,
    score: existingSlot?.score,
  };

  return {
    ...room,
    players: [...filteredPlayers, nextSlot],
    updatedAt: now,
  };
}

const AI_TEAMMATE_NAMES: Record<PlayerRole, string> = {
  frontend: "Alex (AI Frontend)",
  backend: "Sam (AI Backend)",
  devops: "Jordan (AI DevOps)",
};

export function fillWithAiTeammates(room: PartyRoomSnapshot): PartyRoomSnapshot {
  const now = new Date().toISOString();
  const occupiedRoles = new Set(room.players.map((p) => p.role));
  const nextPlayers = [...room.players];

  for (const role of PARTY_ROLES) {
    if (!occupiedRoles.has(role)) {
      nextPlayers.push({
        id: `ai-${role}`,
        displayName: AI_TEAMMATE_NAMES[role],
        role,
        isReady: true,
      });
    }
  }

  return {
    ...room,
    players: nextPlayers,
    updatedAt: now,
  };
}

export function evaluateTurnLocal(input: {
  transcript: string;
  role: PlayerRole;
  scenario: PartyScenario;
  playerId: string;
  durationMs?: number;
}): TurnEvaluation & { penalty: VietnamesePenaltyResult } {
  const clue = input.scenario.clues[input.role];
  const expectedKeywords = Array.from(
    new Set([...clue.targetKeywords, ...input.scenario.targetKeywords])
  );

  const localResult = scoreLocally({
    transcript: input.transcript,
    expectedKeywords,
  });

  const penalty = detectVietnamesePenalty(input.transcript);
  const adjustedScore = penalty.detected
    ? Math.max(0, localResult.score - 10)
    : localResult.score;

  const matchedKeywords = localResult.keywordsUsed;
  const missingKeywords = clue.targetKeywords.filter(
    (kw) => !matchedKeywords.includes(kw)
  );

  const feedbackParts: string[] = [];
  if (matchedKeywords.length > 0) {
    feedbackParts.push(
      `Good technical coverage on ${matchedKeywords.slice(0, 3).join(", ")}.`
    );
  }
  if (missingKeywords.length > 0) {
    feedbackParts.push(
      `Consider mentioning ${missingKeywords.slice(0, 2).join(", ")} for your ${clue.roleLabel} report.`
    );
  }
  if (penalty.detected) {
    feedbackParts.push(
      `Vietnamese detected (${penalty.matchedTokens.slice(0, 3).join(", ")}): -15s incident clock penalty.`
    );
  }

  return {
    playerId: input.playerId,
    role: input.role,
    transcript: input.transcript,
    score: adjustedScore,
    matchedKeywords,
    missingKeywords,
    feedback:
      feedbackParts.join(" ") ||
      "Clear incident update. Keep coordinating with your squad.",
    durationMs: input.durationMs ?? 0,
    penalty,
  };
}

export function computeTeamResolutionProgress(
  room: Pick<PartyRoomState, "evaluations">
): number {
  let total = 0;

  for (const role of PARTY_ROLES) {
    const roleEvals = room.evaluations.filter((e) => e.role === role);
    if (roleEvals.length === 0) continue;
    const bestScore = Math.max(...roleEvals.map((e) => e.score));
    if (bestScore >= 55) {
      total += 34;
    } else {
      total += Math.round((bestScore / 55) * 33);
    }
  }

  return Math.min(100, Math.max(0, total));
}

export function computeTeamScore(evaluations: TurnEvaluation[]): number {
  if (evaluations.length === 0) return 0;
  const bestByRole: number[] = [];
  for (const role of PARTY_ROLES) {
    const roleEvals = evaluations.filter((e) => e.role === role);
    if (roleEvals.length > 0) {
      bestByRole.push(Math.max(...roleEvals.map((e) => e.score)));
    }
  }
  if (bestByRole.length === 0) return 0;
  const sum = bestByRole.reduce((acc, s) => acc + s, 0);
  return Math.round(sum / bestByRole.length);
}

export function getNextTurnRole(room: PartyRoomSnapshot): PlayerRole | null {
  const evaluatedRoles = new Set(
    room.evaluations.filter((e) => e.score >= 55).map((e) => e.role)
  );
  const pendingRole = PARTY_ROLES.find(
    (role) =>
      room.players.some((p) => p.role === role) && !evaluatedRoles.has(role)
  );
  if (pendingRole) return pendingRole;
  const anyPending = PARTY_ROLES.find((role) => !evaluatedRoles.has(role));
  return anyPending ?? null;
}

export function buildAiTeammateTranscript(
  scenario: PartyScenario,
  role: PlayerRole
): string {
  const clue = scenario.clues[role];
  const kw = clue.targetKeywords.join(", ");
  return `${clue.summary} From the ${clue.roleLabel} side, ${clue.suspectedCause} Key signals include ${kw}.`;
}

export async function recordPartyArenaRun(input: {
  roomCode: string;
  scenarioId: string;
  score: number;
  progressPercent: number;
  durationSec: number;
  role?: string | null;
  playerId: string;
  playerName?: string | null;
  transferCode?: string | null;
}): Promise<void> {
  const sql = getDbClient();
  if (!sql) return;
  const ready = await ensureSchema();
  if (!ready) return;
  const id = `party-${input.roomCode}-${input.playerId}`.slice(0, 120);
  const safeScore = Math.max(0, Math.round(input.score));
  const safeProgress = Math.max(
    0,
    Math.min(100, Math.round(input.progressPercent))
  );
  const safeDuration = Math.max(0, Math.round(input.durationSec));
  try {
    await sql`
      INSERT INTO speakit_arena_runs (
        id, game_id, score, accuracy_or_words, duration_sec, role, player_name, transfer_code, created_at
      )
      VALUES (
        ${id},
        ${`party:${input.scenarioId}`},
        ${safeScore},
        ${safeProgress},
        ${safeDuration},
        ${input.role ?? null},
        ${input.playerName ?? null},
        ${input.transferCode ?? null},
        NOW()
      )
      ON CONFLICT (id) DO NOTHING
    `;
  } catch {
  }
}

export function calculateVictoryRewards(
  room: Pick<PartyRoomSnapshot, "players" | "evaluations">
): VictoryRewardSummary {
  const scoreByPlayer = new Map<string, number>();

  for (const player of room.players) {
    if (typeof player.score === "number") {
      scoreByPlayer.set(player.id, player.score);
    }
  }

  for (const ev of room.evaluations) {
    const prev = scoreByPlayer.get(ev.playerId) ?? -1;
    if (ev.score > prev) {
      scoreByPlayer.set(ev.playerId, ev.score);
    }
  }

  let mvpPlayer: PartyPlayerSlot | null = null;
  let bestScore = -1;

  for (const player of room.players) {
    const score = scoreByPlayer.get(player.id) ?? 0;
    const isHuman = !player.id.startsWith("ai-");
    const mvpIsHuman = mvpPlayer ? !mvpPlayer.id.startsWith("ai-") : false;
    if (
      score > bestScore ||
      (score === bestScore && isHuman && !mvpIsHuman)
    ) {
      bestScore = score;
      mvpPlayer = player;
    }
  }

  return {
    winCoins: PARTY_WIN_COINS,
    mvpBonusCoins: PARTY_MVP_BONUS_COINS,
    totalMvpCoins: PARTY_WIN_COINS + PARTY_MVP_BONUS_COINS,
    mvpPlayerId: mvpPlayer?.id ?? null,
    mvpDisplayName: mvpPlayer?.displayName ?? null,
  };
}

export function startPartyRoom(room: PartyRoomSnapshot): PartyRoomSnapshot {
  const now = new Date().toISOString();
  const firstRole = room.players[0]?.role ?? "frontend";
  return {
    ...room,
    status: "speaking" as PartyRoomStatus,
    currentTurnRole: firstRole,
    updatedAt: now,
  };
}

export function resetPartyRoom(room: PartyRoomSnapshot): PartyRoomSnapshot {
  const now = new Date().toISOString();
  const scenario =
    findPartyScenarioById(room.scenarioId) ?? PARTY_SCENARIOS[0];
  return {
    ...room,
    status: "lobby",
    currentTurnRole: null,
    players: room.players.map((p) => ({
      ...p,
      transcript: undefined,
      score: undefined,
    })),
    evaluations: [],
    teamScore: 0,
    resolutionProgress: 0,
    remainingSeconds: scenario.estimatedMinutes * 60,
    totalPenaltySeconds: 0,
    mvpPlayerId: null,
    mvpDisplayName: null,
    rewardsAwarded: false,
    updatedAt: now,
  };
}

async function ensurePartyRoomsTable(): Promise<boolean> {
  const sql = getDbClient();
  if (!sql) return false;

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS party_rooms (
        room_code TEXT PRIMARY KEY,
        scenario_id TEXT NOT NULL,
        status TEXT NOT NULL,
        state_json JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    return true;
  } catch {
    return false;
  }
}

export async function savePartyRoom(
  room: PartyRoomSnapshot
): Promise<PartyRoomSnapshot> {
  getMemoryRoomStore().set(room.roomCode, room);

  const sql = getDbClient();
  if (!sql) return room;

  const ready = await ensurePartyRoomsTable();
  if (!ready) return room;

  try {
    const serialized = JSON.stringify(room);
    await sql`
      INSERT INTO party_rooms (room_code, scenario_id, status, state_json, created_at, updated_at)
      VALUES (${room.roomCode}, ${room.scenarioId}, ${room.status}, ${serialized}::jsonb, NOW(), NOW())
      ON CONFLICT (room_code) DO UPDATE SET
        scenario_id = EXCLUDED.scenario_id,
        status = EXCLUDED.status,
        state_json = EXCLUDED.state_json,
        updated_at = NOW()
    `;
  } catch {
    return room;
  }

  return room;
}

export async function loadPartyRoom(
  code: string
): Promise<PartyRoomSnapshot | null> {
  const normalized = normalizeRoomCode(code);
  if (!normalized) return null;

  const sql = getDbClient();
  if (sql) {
    const ready = await ensurePartyRoomsTable();
    if (ready) {
      try {
        const rows = (await sql`
          SELECT state_json
          FROM party_rooms
          WHERE room_code = ${normalized}
          LIMIT 1
        `) as Array<{ state_json: PartyRoomSnapshot | string }>;

        if (rows.length > 0) {
          const raw = rows[0].state_json;
          const parsed =
            typeof raw === "string"
              ? (JSON.parse(raw) as PartyRoomSnapshot)
              : raw;
          if (parsed && parsed.roomCode) {
            getMemoryRoomStore().set(normalized, parsed);
            return parsed;
          }
        }
      } catch {
        return getMemoryRoomStore().get(normalized) ?? null;
      }
    }
  }

  return getMemoryRoomStore().get(normalized) ?? null;
}
