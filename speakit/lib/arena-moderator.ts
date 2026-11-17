import { randomBytes } from "crypto";
import { extractFirstJsonObject, requestAiWaterfallText } from "./ai-waterfall";
import { assertArenaAccess } from "./arena-leave-policy";
import { EquippedCosmetics } from "./cosmetics";
import { getDbClient, PublicGuestPlayer } from "./db";
import { ensureSchema } from "./db/neon";
import { matchesKeyword, normalizeTextForMatching, stemWord } from "./localScorer";
import {
  DuelStance,
  DuelTopic,
  DYNAMIC_FUSE_RULES,
  findDuelTopicById,
  findTabooCardById,
  isItChainTerm,
  normalizeChainWord,
  pickBotChainWord,
  SEED_STARTING_WORDS,
  TABOO_CARDS,
  TabooCard,
} from "./arena-three-games-data";
import { ScoringProvider } from "./types";

export type ArenaGameType = "duel" | "taboo" | "word-chain";
export type ArenaRoomStatus = "lobby" | "active" | "finished";

export interface ArenaPlayer {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
  equippedTitle?: string;
  equippedRing?: string;
  equippedCosmetics?: EquippedCosmetics;
  isBot: boolean;
  isHost?: boolean;
  stance?: DuelStance;
  alive?: boolean;
  score: number;
  streak: number;
  fouls: number;
  criticalHits?: number;
  itTermsCount?: number;
}

export interface VietnameseFoulResult {
  detected: boolean;
  matchedTokens: string[];
}

export interface TabooViolationResult {
  violated: boolean;
  matchedWords: string[];
}

export interface DuelTurnLog {
  id: string;
  playerId: string;
  displayName: string;
  stance: DuelStance;
  isBot: boolean;
  transcript: string;
  sharpnessScore: number;
  damageDealt: number;
  criticalHit: boolean;
  foulDetected: boolean;
  matchedKeywords: string[];
  feedback: string;
  provider: ScoringProvider;
  timestamp: string;
}

export interface DuelRoomState {
  roomCode: string;
  gameType: "duel";
  status: ArenaRoomStatus;
  topicId: string;
  players: ArenaPlayer[];
  authorHp: number;
  reviewerHp: number;
  momentum: number;
  round: number;
  maxRounds: number;
  turnSeconds: number;
  currentTurnPlayerId: string | null;
  currentTurnStance: DuelStance;
  winnerId: string | null;
  winnerStance: DuelStance | null;
  history: DuelTurnLog[];
  rewardsAwarded: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TabooFeedEntry {
  id: string;
  playerId: string;
  displayName: string;
  cardId: string;
  cardTerm: string;
  clue: string;
  aiGuess: string;
  guessedCorrectly: boolean;
  tabooViolated: boolean;
  violatedWords: string[];
  foulDetected: boolean;
  feverMode: boolean;
  multiplier: 1 | 2;
  pointsAwarded: number;
  reaction: string;
  timestamp: string;
}

export interface TabooRoomState {
  roomCode: string;
  gameType: "taboo";
  status: ArenaRoomStatus;
  players: ArenaPlayer[];
  deckCardIds: string[];
  currentCardIndex: number;
  currentCardId: string;
  targetCards: number;
  solvedCount: number;
  foulCount: number;
  streak: number;
  maxStreak: number;
  feverMode: boolean;
  score: number;
  turnSeconds: number;
  currentTurnPlayerId: string | null;
  winnerId: string | null;
  feed: TabooFeedEntry[];
  rewardsAwarded: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WordChainMove {
  id: string;
  playerId: string;
  displayName: string;
  word: string;
  isBot: boolean;
  isItTerm: boolean;
  streak: number;
  multiplier: 1 | 2;
  pointsEarned: number;
  fuseAssigned: number;
  comboTriggered: boolean;
  timestamp: string;
}

export interface WordChainRoomState {
  roomCode: string;
  gameType: "word-chain";
  status: ArenaRoomStatus;
  players: ArenaPlayer[];
  currentWord: string;
  requiredChar: string;
  usedWords: string[];
  turnCount: number;
  targetTurns: number;
  fuseSeconds: number;
  lastAttackFuseSeconds: number | null;
  itComboStreak: number;
  maxItStreak: number;
  currentTurnPlayerId: string | null;
  winnerId: string | null;
  explodedPlayerId: string | null;
  history: WordChainMove[];
  rewardsAwarded: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ArenaRoomState = DuelRoomState | TabooRoomState | WordChainRoomState;

export interface ArenaRewardSummary {
  awardedPoints: number;
  awardedCoins: number;
}

export type RewardPracticePointsFn = (
  scenarioId: string,
  rawScore: number,
  backupTransferCode?: string
) => Promise<{
  ok: boolean;
  mode: "online" | "offline";
  awardedPoints: number;
  player: PublicGuestPlayer | null;
}>;

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
  "troi",
  "chuan",
  "nhanh",
  "khac",
  "viec",
  "chinh",
  "ngay",
  "buoc",
  "phat",
  "thieu",
  "giong",
  "chuong",
  "trinh",
  "thuat",
  "nhau",
  "hoac",
  "giai",
  "thich",
  "nghia",
  "xai",
  "cai",
  "nay",
  "cung",
  "thoi",
  "nham",
  "chay",
]);

const VIETNAMESE_BIGRAM_PATTERNS: readonly RegExp[] = [
  /\b(ko|hok)\s+(biet|duoc|co|lam|dc|chay)\b/i,
  /\b(lam|the)\s+(sao|nao)\b/i,
  /\b(bi|sua)\s+(loi|roi)\b/i,
];

const DUEL_GENERAL_KEYWORDS = [
  "tradeoff",
  "latency",
  "production",
  "rollback",
  "coverage",
  "maintainability",
  "bottleneck",
  "metric",
  "security",
  "scale",
  "incident",
  "regression",
  "audit",
  "contract",
  "reliability",
];

const TABOO_STOPWORDS = new Set(["a", "an", "the", "of", "in", "on", "to", "for", "and", "or"]);

const CHAIN_FILLER_TOKENS = new Set(["um", "uh", "erm", "like", "word", "is", "the", "a", "an"]);

const GIBBERISH_VOWEL_REGEX = /[aeiouy]/;

const globalForArena = globalThis as typeof globalThis & {
  __speakitArenaGameRooms?: Map<string, ArenaRoomState>;
};

function getMemoryArenaStore(): Map<string, ArenaRoomState> {
  if (!globalForArena.__speakitArenaGameRooms) {
    globalForArena.__speakitArenaGameRooms = new Map<string, ArenaRoomState>();
  }
  return globalForArena.__speakitArenaGameRooms;
}

export function generateArenaRoomCode(): string {
  const bytes = randomBytes(6);
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += ROOM_CODE_ALPHABET[bytes[i] % ROOM_CODE_ALPHABET.length];
  }
  return code;
}

export function normalizeArenaRoomCode(code: unknown): string | null {
  if (typeof code !== "string") return null;
  const cleaned = code.trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(cleaned)) return null;
  return cleaned;
}

function makeEventId(prefix: string): string {
  return `${prefix}-${Date.now()}-${randomBytes(3).toString("hex")}`;
}

function toArenaPlayer(
  input: {
    id: string;
    displayName: string;
    avatarUrl?: string | null;
    equippedTitle?: string;
    equippedRing?: string;
    equippedCosmetics?: EquippedCosmetics;
  },
  extra?: Partial<ArenaPlayer>
): ArenaPlayer {
  return {
    id: input.id,
    displayName: input.displayName || "Engineer",
    avatarUrl: input.avatarUrl ?? null,
    equippedTitle: input.equippedTitle ?? "Junior Speaker",
    equippedRing: input.equippedRing ?? "default",
    equippedCosmetics: input.equippedCosmetics,
    isBot: false,
    score: 0,
    streak: 0,
    fouls: 0,
    ...extra,
  };
}

export function detectVietnameseFoul(text: string): VietnameseFoulResult {
  if (typeof text !== "string" || !text.trim()) {
    return { detected: false, matchedTokens: [] };
  }

  const rawTokens = text
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

  for (const pattern of VIETNAMESE_BIGRAM_PATTERNS) {
    const found = text.match(pattern);
    if (found?.[0]) {
      matched.add(found[0]);
    }
  }

  return {
    detected: matched.size > 0,
    matchedTokens: Array.from(matched),
  };
}

function tabooStem(raw: string): string {
  const clean = raw.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (clean.length <= 3) return clean;
  const extendedSuffixes: Array<[string, number]> = [
    ["izations", 4],
    ["ization", 4],
    ["isations", 4],
    ["isation", 4],
    ["abilities", 4],
    ["ability", 4],
    ["ations", 4],
    ["ation", 4],
    ["itions", 4],
    ["ition", 4],
    ["ments", 4],
    ["ment", 4],
    ["ness", 4],
    ["ities", 4],
    ["ity", 4],
    ["ables", 4],
    ["able", 4],
    ["ibles", 4],
    ["ible", 4],
    ["ions", 4],
    ["ion", 4],
    ["ives", 4],
    ["ive", 4],
    ["izes", 4],
    ["ize", 4],
    ["ises", 4],
    ["ise", 4],
    ["ests", 4],
    ["est", 4],
    ["ings", 3],
    ["ing", 3],
    ["ers", 4],
    ["er", 4],
    ["ors", 4],
    ["or", 4],
    ["ied", 3],
    ["ies", 3],
    ["es", 3],
    ["ed", 3],
    ["ly", 3],
    ["s", 3],
  ];

  for (const [suffix, minStem] of extendedSuffixes) {
    if (clean.endsWith(suffix) && clean.length - suffix.length >= minStem) {
      let base = clean.slice(0, clean.length - suffix.length);
      if (suffix === "ied" || suffix === "ies") {
        base += "y";
      } else if (base.length >= 4 && base[base.length - 1] === base[base.length - 2]) {
        base = base.slice(0, -1);
      }
      if (base.endsWith("e") && base.length > 4) {
        base = base.slice(0, -1);
      }
      return base;
    }
  }

  return clean.endsWith("e") && clean.length > 4 ? clean.slice(0, -1) : clean;
}

function wordsMatchTabooStem(token: string, forbidden: string): boolean {
  const a = token.toLowerCase().trim();
  const b = forbidden.toLowerCase().trim();
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length < 3 || b.length < 3) return false;
  if (stemWord(a) === stemWord(b)) return true;
  if (tabooStem(a) === tabooStem(b)) return true;
  return false;
}

export function detectTabooViolation(
  clue: string,
  card: TabooCard
): TabooViolationResult {
  if (typeof clue !== "string" || !clue.trim()) {
    return { violated: false, matchedWords: [] };
  }

  const normalized = normalizeTextForMatching(clue);
  const tokens = normalized.split(" ").filter(Boolean);
  if (tokens.length === 0) {
    return { violated: false, matchedWords: [] };
  }

  const termWords = normalizeTextForMatching(card.term)
    .split(" ")
    .filter((w) => w.length >= 2 && !TABOO_STOPWORDS.has(w));
  const forbiddenItems = Array.from(new Set([...card.tabooWords, ...termWords]));
  const matched = new Set<string>();
  const paddedPhrase = ` ${normalized} `;

  for (const forbidden of forbiddenItems) {
    const normForbidden = normalizeTextForMatching(forbidden);
    if (!normForbidden) continue;
    const subTokens = normForbidden.split(" ").filter(Boolean);

    if (subTokens.length > 1) {
      if (paddedPhrase.includes(` ${normForbidden} `)) {
        matched.add(forbidden);
        continue;
      }
      if (
        subTokens.every((st) => tokens.some((ct) => wordsMatchTabooStem(ct, st)))
      ) {
        matched.add(forbidden);
      }
      continue;
    }

    if (tokens.some((ct) => wordsMatchTabooStem(ct, normForbidden))) {
      matched.add(forbidden);
    }
  }

  return {
    violated: matched.size > 0,
    matchedWords: Array.from(matched),
  };
}

async function ensureArenaGameRoomsTable(): Promise<boolean> {
  const sql = getDbClient();
  if (!sql) return false;

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS arena_game_rooms (
        room_code TEXT PRIMARY KEY,
        game_type TEXT NOT NULL,
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

export async function saveArenaRoom<T extends ArenaRoomState>(room: T): Promise<T> {
  getMemoryArenaStore().set(room.roomCode, room);

  const sql = getDbClient();
  if (!sql) return room;

  const ready = await ensureArenaGameRoomsTable();
  if (!ready) return room;

  try {
    const serialized = JSON.stringify(room);
    await sql`
      INSERT INTO arena_game_rooms (room_code, game_type, status, state_json, created_at, updated_at)
      VALUES (${room.roomCode}, ${room.gameType}, ${room.status}, ${serialized}::jsonb, NOW(), NOW())
      ON CONFLICT (room_code) DO UPDATE SET
        game_type = EXCLUDED.game_type,
        status = EXCLUDED.status,
        state_json = EXCLUDED.state_json,
        updated_at = NOW()
    `;
  } catch {
    return room;
  }

  return room;
}

export async function loadArenaRoom<T extends ArenaRoomState>(
  code: string,
  expectedGameType?: ArenaGameType
): Promise<T | null> {
  const normalized = normalizeArenaRoomCode(code);
  if (!normalized) return null;

  const sql = getDbClient();
  if (sql) {
    const ready = await ensureArenaGameRoomsTable();
    if (ready) {
      try {
        const rows = (await sql`
          SELECT state_json
          FROM arena_game_rooms
          WHERE room_code = ${normalized}
          LIMIT 1
        `) as Array<{ state_json: ArenaRoomState | string }>;

        if (rows.length > 0) {
          const raw = rows[0].state_json;
          const parsed =
            typeof raw === "string"
              ? (JSON.parse(raw) as ArenaRoomState)
              : raw;
          if (parsed && parsed.roomCode) {
            getMemoryArenaStore().set(normalized, parsed);
            if (!expectedGameType || parsed.gameType === expectedGameType) {
              return parsed as T;
            }
            return null;
          }
        }
      } catch {
        const mem = getMemoryArenaStore().get(normalized) ?? null;
        if (mem && (!expectedGameType || mem.gameType === expectedGameType)) {
          return mem as T;
        }
        return null;
      }
    }
  }

  const cached = getMemoryArenaStore().get(normalized) ?? null;
  if (!cached) return null;
  if (expectedGameType && cached.gameType !== expectedGameType) return null;
  return cached as T;
}

export async function recordArenaRunTelemetry(input: {
  gameType: ArenaGameType;
  roomCode: string;
  score: number;
  metric: number;
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

  const id = `${input.gameType}-${input.roomCode}-${input.playerId}`.slice(0, 120);
  try {
    await sql`
      INSERT INTO speakit_arena_runs (
        id, game_id, score, accuracy_or_words, duration_sec, role, player_name, transfer_code, created_at
      )
      VALUES (
        ${id},
        ${`arena:${input.gameType}`},
        ${Math.max(0, Math.round(input.score))},
        ${Math.max(0, Math.round(input.metric))},
        ${Math.max(0, Math.round(input.durationSec))},
        ${input.role ?? null},
        ${input.playerName ?? null},
        ${input.transferCode ?? null},
        NOW()
      )
      ON CONFLICT (id) DO NOTHING
    `;
  } catch {
    return;
  }
}

export async function payoutArenaPointsWith(
  rewardFn: RewardPracticePointsFn,
  scenarioKey: string,
  totalPoints: number,
  backupTransferCode?: string
): Promise<{ player: PublicGuestPlayer | null; reward: ArenaRewardSummary }> {
  const safeTotal = Math.max(0, Math.min(12000, Math.round(totalPoints)));
  if (safeTotal <= 0) {
    return { player: null, reward: { awardedPoints: 0, awardedCoins: 0 } };
  }

  let remaining = safeTotal;
  let latestPlayer: PublicGuestPlayer | null = null;
  let awardedPoints = 0;

  while (remaining > 0) {
    const chunk = Math.min(10000, remaining);
    const res = await rewardFn(scenarioKey, chunk, backupTransferCode);
    if (res.player) {
      latestPlayer = res.player;
    }
    if (res.ok) {
      awardedPoints += res.awardedPoints;
    }
    remaining -= chunk;
  }

  return {
    player: latestPlayer,
    reward: {
      awardedPoints,
      awardedCoins: Math.floor(awardedPoints / 1000),
    },
  };
}

export function createDuelRoom(options?: {
  roomCode?: string;
  topicId?: string;
  hostPlayer?: {
    id: string;
    displayName: string;
    stance?: DuelStance;
    avatarUrl?: string | null;
    equippedTitle?: string;
    equippedRing?: string;
    equippedCosmetics?: EquippedCosmetics;
  };
}): DuelRoomState {
  const topic = findDuelTopicById(options?.topicId);
  const roomCode = normalizeArenaRoomCode(options?.roomCode) ?? generateArenaRoomCode();
  const now = new Date().toISOString();
  const players: ArenaPlayer[] = [];

  if (options?.hostPlayer) {
    const stance: DuelStance =
      options.hostPlayer.stance === "reviewer" ? "reviewer" : "author";
    players.push(
      toArenaPlayer(options.hostPlayer, {
        isHost: true,
        stance,
        criticalHits: 0,
      })
    );
  }

  return {
    roomCode,
    gameType: "duel",
    status: "lobby",
    topicId: topic.id,
    players,
    authorHp: 100,
    reviewerHp: 100,
    momentum: 50,
    round: 0,
    maxRounds: 6,
    turnSeconds: 45,
    currentTurnPlayerId: players[0]?.id ?? null,
    currentTurnStance: players[0]?.stance ?? "author",
    winnerId: null,
    winnerStance: null,
    history: [],
    rewardsAwarded: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function joinDuelRoom(
  room: DuelRoomState,
  player: {
    id: string;
    displayName: string;
    stance?: DuelStance;
    avatarUrl?: string | null;
    equippedTitle?: string;
    equippedRing?: string;
    equippedCosmetics?: EquippedCosmetics;
  }
): DuelRoomState {
  const existing = room.players.find((p) => p.id === player.id);
  const oppositeStance: DuelStance =
    room.players.some((p) => !p.isBot && p.id !== player.id && p.stance === "author")
      ? "reviewer"
      : "author";
  const targetStance: DuelStance =
    player.stance === "author" || player.stance === "reviewer"
      ? player.stance
      : existing?.stance ?? oppositeStance;

  const filtered = room.players.filter((p) => {
    if (p.id === player.id) return false;
    if (p.isBot && p.stance === targetStance) return false;
    return true;
  });

  if (filtered.length >= 2 && !existing) {
    return room;
  }

  const nextSlot = toArenaPlayer(player, {
    isHost: existing?.isHost ?? filtered.length === 0,
    stance: targetStance,
    score: existing?.score ?? 0,
    streak: existing?.streak ?? 0,
    fouls: existing?.fouls ?? 0,
    criticalHits: existing?.criticalHits ?? 0,
  });

  return {
    ...room,
    players: [...filtered, nextSlot],
    updatedAt: new Date().toISOString(),
  };
}

export function fillDuelBot(room: DuelRoomState): DuelRoomState {
  if (room.players.length >= 2) {
    return room;
  }
  const hasAuthor = room.players.some((p) => p.stance === "author");
  const botStance: DuelStance = hasAuthor ? "reviewer" : "author";
  const botPlayer: ArenaPlayer = {
    id: `bot-duel-${botStance}`,
    displayName:
      botStance === "reviewer" ? "Victor (Staff Reviewer Bot)" : "Alex (PR Author Bot)",
    avatarUrl: null,
    equippedTitle: "Principal AI Critic",
    equippedRing: "neon",
    isBot: true,
    stance: botStance,
    score: 0,
    streak: 0,
    fouls: 0,
    criticalHits: 0,
  };

  return {
    ...room,
    players: [...room.players, botPlayer],
    updatedAt: new Date().toISOString(),
  };
}

export function startDuelRoom(room: DuelRoomState): DuelRoomState {
  const ordered = [...room.players].sort((a, b) =>
    a.stance === b.stance ? 0 : a.stance === "author" ? -1 : 1
  );
  const firstPlayer = ordered[0] ?? null;

  return {
    ...room,
    status: "active",
    players: ordered.map((p) => ({
      ...p,
      score: 0,
      streak: 0,
      fouls: 0,
      criticalHits: 0,
    })),
    authorHp: 100,
    reviewerHp: 100,
    momentum: 50,
    round: 1,
    currentTurnPlayerId: firstPlayer?.id ?? null,
    currentTurnStance: firstPlayer?.stance ?? "author",
    winnerId: null,
    winnerStance: null,
    history: [],
    rewardsAwarded: false,
    updatedAt: new Date().toISOString(),
  };
}

export function evaluateDuelArgumentLocal(input: {
  transcript: string;
  stance: DuelStance;
  topic: DuelTopic;
}): {
  sharpnessScore: number;
  damageDealt: number;
  criticalHit: boolean;
  foulDetected: boolean;
  matchedKeywords: string[];
  feedback: string;
} {
  const foul = detectVietnameseFoul(input.transcript);
  if (foul.detected) {
    return {
      sharpnessScore: 0,
      damageDealt: 0,
      criticalHit: false,
      foulDetected: true,
      matchedKeywords: [],
      feedback: `Foul! Vietnamese detected (${foul.matchedTokens.slice(0, 3).join(", ")}). You lose -18 HP credibility!`,
    };
  }

  const normalized = normalizeTextForMatching(input.transcript);
  const words = normalized.split(" ").filter(Boolean);
  const matchedTopic = input.topic.criticalKeywords.filter((kw) =>
    matchesKeyword(words, kw)
  );
  const matchedGeneral = DUEL_GENERAL_KEYWORDS.filter((kw) =>
    matchesKeyword(words, kw)
  );
  const matchedKeywords = Array.from(new Set([...matchedTopic, ...matchedGeneral]));

  const wordScore = Math.min(40, words.length * 3);
  const keywordScore = Math.min(48, matchedTopic.length * 16 + matchedGeneral.length * 8);
  const reasoningBonus =
    /\b(because|therefore|instead|however|while|whereas|if|unless)\b/i.test(
      input.transcript
    )
      ? 12
      : 0;
  const sharpnessScore = Math.max(
    18,
    Math.min(98, wordScore + keywordScore + reasoningBonus)
  );
  const criticalHit =
    sharpnessScore >= 72 ||
    matchedTopic.length >= 2 ||
    (words.length >= 10 && matchedTopic.length >= 1);
  const damageDealt = criticalHit
    ? Math.min(40, 26 + matchedTopic.length * 4)
    : Math.max(12, Math.min(24, Math.round(sharpnessScore / 4)));

  const feedback = criticalHit
    ? `CRITICAL HIT! Sharp ${input.stance} rebuttal citing ${matchedKeywords.slice(0, 3).join(", ") || "strong engineering tradeoffs"}.`
    : `Solid ${input.stance} point (${damageDealt} DMG). Mention ${input.topic.criticalKeywords.slice(0, 2).join(" or ")} to land a Critical Hit.`;

  return {
    sharpnessScore,
    damageDealt,
    criticalHit,
    foulDetected: false,
    matchedKeywords,
    feedback,
  };
}

function resolveDuelWinner(room: DuelRoomState): {
  winnerId: string | null;
  winnerStance: DuelStance | null;
} {
  let winnerStance: DuelStance;
  if (room.authorHp > room.reviewerHp) {
    winnerStance = "author";
  } else if (room.reviewerHp > room.authorHp) {
    winnerStance = "reviewer";
  } else {
    winnerStance = room.momentum >= 50 ? "author" : "reviewer";
  }
  const winner = room.players.find((p) => p.stance === winnerStance) ?? room.players[0];
  return {
    winnerId: winner?.id ?? null,
    winnerStance: winner?.stance ?? winnerStance,
  };
}

function buildBotDuelCounterTurn(
  room: DuelRoomState,
  botPlayer: ArenaPlayer,
  topic: DuelTopic,
  provider: ScoringProvider,
  overrideText?: string
): DuelTurnLog {
  const botStance: DuelStance = botPlayer.stance ?? "reviewer";
  const botPool = topic.botArguments[botStance];
  const botArgIdx = Math.floor(room.history.length / 2) % botPool.length;
  const botTranscript = overrideText ?? botPool[botArgIdx];
  const botDamage = 15 + ((room.history.length * 3) % 8);
  const botCritical = botDamage >= 22;

  return {
    id: makeEventId("duel-bot"),
    playerId: botPlayer.id,
    displayName: botPlayer.displayName,
    stance: botStance,
    isBot: true,
    transcript: botTranscript,
    sharpnessScore: botDamage * 3 + 15,
    damageDealt: botDamage,
    criticalHit: botCritical,
    foulDetected: false,
    matchedKeywords: topic.criticalKeywords.slice(0, 2),
    feedback: botCritical
      ? `${botPlayer.displayName} countered sharply for ${botDamage} DMG!`
      : `${botPlayer.displayName} pushed back for ${botDamage} DMG.`,
    provider,
    timestamp: new Date().toISOString(),
  };
}

function applyDuelLogToRoom(
  room: DuelRoomState,
  log: DuelTurnLog
): DuelRoomState {
  let authorHp = room.authorHp;
  let reviewerHp = room.reviewerHp;
  let momentum = room.momentum;

  if (log.foulDetected) {
    if (log.stance === "author") {
      authorHp = Math.max(0, authorHp - 18);
      momentum = Math.max(0, momentum - 12);
    } else {
      reviewerHp = Math.max(0, reviewerHp - 18);
      momentum = Math.min(100, momentum + 12);
    }
  } else if (log.stance === "author") {
    reviewerHp = Math.max(0, reviewerHp - log.damageDealt);
    momentum = Math.min(100, momentum + Math.round(log.damageDealt * 0.8));
  } else {
    authorHp = Math.max(0, authorHp - log.damageDealt);
    momentum = Math.max(0, momentum - Math.round(log.damageDealt * 0.8));
  }

  const pointsDelta = log.foulDetected
    ? 0
    : log.damageDealt * 12 + (log.criticalHit ? 150 : 0);

  const nextPlayers = room.players.map((p) => {
    if (p.id !== log.playerId) return p;
    return {
      ...p,
      score: p.score + pointsDelta,
      streak: log.foulDetected ? 0 : p.streak + 1,
      fouls: log.foulDetected ? p.fouls + 1 : p.fouls,
      criticalHits: (p.criticalHits ?? 0) + (log.criticalHit ? 1 : 0),
    };
  });

  const nextHistory = [...room.history, log];
  const nextRound = nextHistory.length + 1;
  const reachedFinish =
    authorHp <= 0 || reviewerHp <= 0 || nextHistory.length >= room.maxRounds;

  const opponent = nextPlayers.find((p) => p.id !== log.playerId);
  const draft: DuelRoomState = {
    ...room,
    players: nextPlayers,
    authorHp,
    reviewerHp,
    momentum,
    round: reachedFinish ? nextHistory.length : nextRound,
    status: reachedFinish ? "finished" : "active",
    currentTurnPlayerId: reachedFinish ? null : opponent?.id ?? log.playerId,
    currentTurnStance: reachedFinish
      ? log.stance
      : opponent?.stance ?? (log.stance === "author" ? "reviewer" : "author"),
    history: nextHistory,
    updatedAt: log.timestamp,
  };

  if (reachedFinish) {
    const resolved = resolveDuelWinner(draft);
    return {
      ...draft,
      winnerId: resolved.winnerId,
      winnerStance: resolved.winnerStance,
    };
  }

  return draft;
}

export async function moderateDuelTurn(input: {
  room: DuelRoomState;
  playerId: string;
  transcript: string;
}): Promise<{
  room: DuelRoomState;
  playerTurn: DuelTurnLog;
  botTurn: DuelTurnLog | null;
}> {
  const topic = findDuelTopicById(input.room.topicId);
  const activePlayer =
    input.room.players.find((p) => p.id === input.playerId) ??
    input.room.players.find((p) => !p.isBot) ??
    input.room.players[0];
  const stance: DuelStance = activePlayer?.stance ?? input.room.currentTurnStance;
  const now = new Date().toISOString();

  const localFoul = detectVietnameseFoul(input.transcript);
  let evaluated: {
    sharpnessScore: number;
    damageDealt: number;
    criticalHit: boolean;
    foulDetected: boolean;
    matchedKeywords: string[];
    feedback: string;
    provider: ScoringProvider;
    botCounterArgument?: string;
  };

  if (localFoul.detected) {
    const localEval = evaluateDuelArgumentLocal({
      transcript: input.transcript,
      stance,
      topic,
    });
    evaluated = { ...localEval, provider: "local" };
  } else {
    const opponentStance: DuelStance = stance === "author" ? "reviewer" : "author";
    const opponentIsBot = input.room.players.some(
      (p) => p.id !== activePlayer?.id && p.isBot
    );

    const aiRes = await requestAiWaterfallText({
      systemInstruction:
        "You are a senior Staff Engineer moderating a live Code Review Duel. Evaluate the player's English argument strictly in JSON: { sharpnessScore: number (0-100), isCriticalHit: boolean, vietnameseFoul: boolean, matchedKeywords: string[], feedback: string (concise 1-sentence judge feedback), counterArgument: string (1-2 sharp spoken English rebuttal sentences from the opposing stance) }.",
      userPrompt: JSON.stringify({
        topic: topic.title,
        playerStance: stance,
        opponentStance,
        criticalKeywords: topic.criticalKeywords,
        playerArgument: input.transcript,
        generateCounter: opponentIsBot,
      }),
      temperature: 0.35,
      maxTokens: 320,
      jsonMode: true,
      timeoutMs: 2000,
    });

    const parsed = aiRes ? extractFirstJsonObject(aiRes.text) : null;
    if (
      aiRes &&
      parsed &&
      typeof parsed.sharpnessScore === "number" &&
      Number.isFinite(parsed.sharpnessScore)
    ) {
      const vietFoul = parsed.vietnameseFoul === true;
      if (vietFoul) {
        evaluated = {
          sharpnessScore: 0,
          damageDealt: 0,
          criticalHit: false,
          foulDetected: true,
          matchedKeywords: [],
          feedback: "Foul! Non-English phrasing detected — credibility damaged (-18 HP).",
          provider: aiRes.provider,
        };
      } else {
        const sharpnessScore = Math.max(
          15,
          Math.min(100, Math.round(parsed.sharpnessScore))
        );
        const matchedKeywords = Array.isArray(parsed.matchedKeywords)
          ? parsed.matchedKeywords.filter((k): k is string => typeof k === "string")
          : [];
        const criticalHit =
          parsed.isCriticalHit === true || sharpnessScore >= 75;
        const damageDealt = criticalHit
          ? Math.min(40, 26 + Math.min(4, matchedKeywords.length) * 3)
          : Math.max(12, Math.min(24, Math.round(sharpnessScore / 4)));
        const feedback =
          typeof parsed.feedback === "string" && parsed.feedback.trim()
            ? parsed.feedback.trim()
            : criticalHit
              ? "CRITICAL HIT! Crisp technical reasoning landed."
              : "Solid engineering point delivered.";
        const botCounterArgument =
          typeof parsed.counterArgument === "string" &&
          parsed.counterArgument.trim() &&
          !detectVietnameseFoul(parsed.counterArgument).detected
            ? parsed.counterArgument.trim()
            : undefined;
        evaluated = {
          sharpnessScore,
          damageDealt,
          criticalHit,
          foulDetected: false,
          matchedKeywords,
          feedback,
          provider: aiRes.provider,
          botCounterArgument,
        };
      }
    } else {
      const localEval = evaluateDuelArgumentLocal({
        transcript: input.transcript,
        stance,
        topic,
      });
      evaluated = { ...localEval, provider: "local" };
    }
  }

  const playerTurn: DuelTurnLog = {
    id: makeEventId("duel"),
    playerId: activePlayer?.id ?? input.playerId,
    displayName: activePlayer?.displayName ?? "Challenger",
    stance,
    isBot: false,
    transcript: input.transcript.trim(),
    sharpnessScore: evaluated.sharpnessScore,
    damageDealt: evaluated.damageDealt,
    criticalHit: evaluated.criticalHit,
    foulDetected: evaluated.foulDetected,
    matchedKeywords: evaluated.matchedKeywords,
    feedback: evaluated.feedback,
    provider: evaluated.provider,
    timestamp: now,
  };

  let nextRoom = applyDuelLogToRoom(input.room, playerTurn);
  let botTurn: DuelTurnLog | null = null;

  if (nextRoom.status === "active") {
    const botPlayer = nextRoom.players.find(
      (p) => p.id === nextRoom.currentTurnPlayerId && p.isBot
    );
    if (botPlayer) {
      botTurn = buildBotDuelCounterTurn(
        nextRoom,
        botPlayer,
        topic,
        evaluated.provider,
        evaluated.botCounterArgument
      );
      nextRoom = applyDuelLogToRoom(nextRoom, botTurn);
    }
  }

  return { room: nextRoom, playerTurn, botTurn };
}

export function applyDuelTimeout(
  room: DuelRoomState,
  playerId?: string
): DuelRoomState {
  if (room.status !== "active") return room;
  const target =
    room.players.find((p) => p.id === (playerId ?? room.currentTurnPlayerId)) ??
    room.players.find((p) => p.stance === room.currentTurnStance) ??
    room.players[0];
  if (!target) return room;

  const stance: DuelStance = target.stance ?? room.currentTurnStance;
  const timeoutLog: DuelTurnLog = {
    id: makeEventId("duel-timeout"),
    playerId: target.id,
    displayName: target.displayName,
    stance,
    isBot: target.isBot,
    transcript: "[Turn timer expired]",
    sharpnessScore: 0,
    damageDealt: 0,
    criticalHit: false,
    foulDetected: true,
    matchedKeywords: [],
    feedback: `${target.displayName} ran out of time (-18 HP penalty).`,
    provider: "local",
    timestamp: new Date().toISOString(),
  };

  let nextRoom = applyDuelLogToRoom(room, timeoutLog);
  if (nextRoom.status === "active") {
    const botPlayer = nextRoom.players.find(
      (p) => p.id === nextRoom.currentTurnPlayerId && p.isBot
    );
    if (botPlayer) {
      const topic = findDuelTopicById(nextRoom.topicId);
      const botTurn = buildBotDuelCounterTurn(nextRoom, botPlayer, topic, "local");
      nextRoom = applyDuelLogToRoom(nextRoom, botTurn);
    }
  }

  return nextRoom;
}

export function resetDuelRoom(
  room: DuelRoomState,
  topicId?: string
): DuelRoomState {
  const topic = findDuelTopicById(topicId ?? room.topicId);
  return {
    ...room,
    status: "lobby",
    topicId: topic.id,
    players: room.players.map((p) => ({
      ...p,
      score: 0,
      streak: 0,
      fouls: 0,
      criticalHits: 0,
    })),
    authorHp: 100,
    reviewerHp: 100,
    momentum: 50,
    round: 0,
    currentTurnPlayerId: room.players[0]?.id ?? null,
    currentTurnStance: room.players[0]?.stance ?? "author",
    winnerId: null,
    winnerStance: null,
    history: [],
    rewardsAwarded: false,
    updatedAt: new Date().toISOString(),
  };
}

export function calculateDuelRewardPoints(
  room: DuelRoomState,
  playerId: string,
  reason: "finish" | "leave"
): number {
  const player =
    room.players.find((p) => p.id === playerId) ??
    room.players.find((p) => !p.isBot);
  if (!player) return 0;

  if (reason === "leave") {
    if (player.score <= 0) return 0;
    return Math.min(5000, Math.max(1000, Math.floor(player.score / 200) * 1000));
  }

  const isWinner = room.winnerId === player.id;
  if (isWinner) {
    const myHp = player.stance === "author" ? room.authorHp : room.reviewerHp;
    const critBonus = (player.criticalHits ?? 0) * 1000;
    const hpBonus = Math.floor(myHp / 25) * 1000;
    return Math.max(5000, Math.min(12000, 6000 + critBonus + hpBonus));
  }

  if (player.score >= 300) {
    return Math.min(4000, Math.max(1000, Math.floor(player.score / 250) * 1000));
  }
  return 1000;
}

function buildShuffledTabooDeck(startCardId?: string): string[] {
  const ids = TABOO_CARDS.map((c) => c.id);
  const shuffled = [...ids];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = randomBytes(1)[0] % (i + 1);
    const tmp = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = tmp;
  }
  if (startCardId && shuffled.includes(startCardId)) {
    const rest = shuffled.filter((id) => id !== startCardId);
    return [startCardId, ...rest].slice(0, 12);
  }
  return shuffled.slice(0, 12);
}

export function createTabooRoom(options?: {
  roomCode?: string;
  cardId?: string;
  targetCards?: number;
  hostPlayer?: {
    id: string;
    displayName: string;
    avatarUrl?: string | null;
    equippedTitle?: string;
    equippedRing?: string;
    equippedCosmetics?: EquippedCosmetics;
  };
}): TabooRoomState {
  const roomCode = normalizeArenaRoomCode(options?.roomCode) ?? generateArenaRoomCode();
  const deckCardIds = buildShuffledTabooDeck(options?.cardId);
  const firstCard = findTabooCardById(deckCardIds[0]);
  const now = new Date().toISOString();
  const targetCards =
    typeof options?.targetCards === "number" && Number.isFinite(options.targetCards)
      ? Math.max(3, Math.min(10, Math.round(options.targetCards)))
      : 5;

  const players: ArenaPlayer[] = options?.hostPlayer
    ? [toArenaPlayer(options.hostPlayer, { isHost: true })]
    : [];

  return {
    roomCode,
    gameType: "taboo",
    status: "lobby",
    players,
    deckCardIds,
    currentCardIndex: 0,
    currentCardId: firstCard.id,
    targetCards,
    solvedCount: 0,
    foulCount: 0,
    streak: 0,
    maxStreak: 0,
    feverMode: false,
    score: 0,
    turnSeconds: 150,
    currentTurnPlayerId: players[0]?.id ?? null,
    winnerId: null,
    feed: [],
    rewardsAwarded: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function joinTabooRoom(
  room: TabooRoomState,
  player: {
    id: string;
    displayName: string;
    avatarUrl?: string | null;
    equippedTitle?: string;
    equippedRing?: string;
    equippedCosmetics?: EquippedCosmetics;
  }
): TabooRoomState {
  const existing = room.players.find((p) => p.id === player.id);
  const filtered = room.players.filter((p) => p.id !== player.id);
  const nextSlot = toArenaPlayer(player, {
    isHost: existing?.isHost ?? filtered.length === 0,
    score: existing?.score ?? 0,
    streak: existing?.streak ?? 0,
    fouls: existing?.fouls ?? 0,
  });

  return {
    ...room,
    players: [...filtered, nextSlot],
    updatedAt: new Date().toISOString(),
  };
}

export function fillTabooBot(room: TabooRoomState): TabooRoomState {
  if (room.players.some((p) => p.isBot)) {
    return room;
  }
  const botPlayer: ArenaPlayer = {
    id: "bot-taboo-guesser",
    displayName: "ByteBot (AI Guesser)",
    avatarUrl: null,
    equippedTitle: "Rapid Concept Solver",
    equippedRing: "cyber",
    isBot: true,
    score: 0,
    streak: 0,
    fouls: 0,
  };
  return {
    ...room,
    players: [...room.players, botPlayer],
    updatedAt: new Date().toISOString(),
  };
}

export function startTabooRoom(room: TabooRoomState): TabooRoomState {
  const deckCardIds =
    room.deckCardIds.length > 0 ? room.deckCardIds : buildShuffledTabooDeck();
  const firstHuman = room.players.find((p) => !p.isBot) ?? room.players[0] ?? null;

  return {
    ...room,
    status: "active",
    deckCardIds,
    currentCardIndex: 0,
    currentCardId: deckCardIds[0] ?? TABOO_CARDS[0].id,
    solvedCount: 0,
    foulCount: 0,
    streak: 0,
    maxStreak: 0,
    feverMode: false,
    score: 0,
    players: room.players.map((p) => ({
      ...p,
      score: 0,
      streak: 0,
      fouls: 0,
    })),
    currentTurnPlayerId: firstHuman?.id ?? null,
    winnerId: null,
    feed: [],
    rewardsAwarded: false,
    updatedAt: new Date().toISOString(),
  };
}

export function evaluateTabooClueLocal(input: {
  clue: string;
  card: TabooCard;
}): {
  guessedCorrectly: boolean;
  aiGuess: string;
  reaction: string;
  tabooViolated: boolean;
  violatedWords: string[];
  foulDetected: boolean;
  foulType: "none" | "vietnamese" | "taboo";
} {
  const viet = detectVietnameseFoul(input.clue);
  if (viet.detected) {
    return {
      guessedCorrectly: false,
      aiGuess: "",
      reaction: `Foul! Vietnamese detected (${viet.matchedTokens.slice(0, 3).join(", ")}). Streak broken!`,
      tabooViolated: false,
      violatedWords: [],
      foulDetected: true,
      foulType: "vietnamese",
    };
  }

  const taboo = detectTabooViolation(input.clue, input.card);
  if (taboo.violated) {
    return {
      guessedCorrectly: false,
      aiGuess: "",
      reaction: `BUZZER! You used forbidden word(s): ${taboo.matchedWords.join(", ")}! Card burned.`,
      tabooViolated: true,
      violatedWords: taboo.matchedWords,
      foulDetected: true,
      foulType: "taboo",
    };
  }

  const normalized = normalizeTextForMatching(input.clue);
  const words = normalized.split(" ").filter(Boolean);
  const matchedClues = input.card.acceptableClues.filter((c) =>
    matchesKeyword(words, c)
  );

  if (matchedClues.length >= 1 || words.length >= 5) {
    return {
      guessedCorrectly: true,
      aiGuess: input.card.term,
      reaction: `Got it! Is it ${input.card.term}? Nice clean clue!`,
      tabooViolated: false,
      violatedWords: [],
      foulDetected: false,
      foulType: "none",
    };
  }

  const wrongGuesses = [
    "Kubernetes CronJob",
    "TCP Handshake",
    "CSS Grid",
    "Event Loop",
    "Connection Pool",
  ];
  const pickWrong =
    wrongGuesses[words.length % wrongGuesses.length] || "Distributed Lock";

  return {
    guessedCorrectly: false,
    aiGuess: pickWrong,
    reaction: `Hmm, is it ${pickWrong}? Give me a slightly clearer English clue!`,
    tabooViolated: false,
    violatedWords: [],
    foulDetected: false,
    foulType: "none",
  };
}

export async function moderateTabooTurn(input: {
  room: TabooRoomState;
  playerId: string;
  clue: string;
  guess?: string;
  skip?: boolean;
}): Promise<{
  room: TabooRoomState;
  currentCard: TabooCard;
  turnResult: {
    guessedCorrectly: boolean;
    aiGuess: string;
    reaction: string;
    tabooViolated: boolean;
    violatedWords: string[];
    foulDetected: boolean;
    foulType: "none" | "vietnamese" | "taboo";
    streak: number;
    feverMode: boolean;
    multiplier: 1 | 2;
    pointsAwarded: number;
    cardAdvanced: boolean;
  };
}> {
  const card = findTabooCardById(input.room.currentCardId);
  const player =
    input.room.players.find((p) => p.id === input.playerId) ??
    input.room.players.find((p) => !p.isBot) ??
    input.room.players[0];
  const now = new Date().toISOString();

  if (input.skip) {
    const nextIdx = input.room.currentCardIndex + 1;
    const finished = nextIdx >= input.room.deckCardIds.length;
    const nextCardId = finished
      ? card.id
      : input.room.deckCardIds[nextIdx] ?? card.id;
    const nextRoom: TabooRoomState = {
      ...input.room,
      currentCardIndex: finished ? input.room.currentCardIndex : nextIdx,
      currentCardId: nextCardId,
      streak: 0,
      feverMode: false,
      status: finished ? "finished" : "active",
      winnerId: finished ? player?.id ?? null : null,
      updatedAt: now,
    };
    return {
      room: nextRoom,
      currentCard: findTabooCardById(nextCardId),
      turnResult: {
        guessedCorrectly: false,
        aiGuess: "",
        reaction: "Card skipped! Streak reset to 0.",
        tabooViolated: false,
        violatedWords: [],
        foulDetected: false,
        foulType: "none",
        streak: 0,
        feverMode: false,
        multiplier: 1,
        pointsAwarded: 0,
        cardAdvanced: !finished,
      },
    };
  }

  let evalOut = evaluateTabooClueLocal({ clue: input.clue, card });

  if (!evalOut.foulDetected && input.guess && input.guess.trim()) {
    const guessNorm = normalizeTextForMatching(input.guess);
    const termNorm = normalizeTextForMatching(card.term);
    const directHit =
      guessNorm === termNorm ||
      wordsMatchTabooStem(guessNorm, termNorm);
    evalOut = {
      ...evalOut,
      guessedCorrectly: directHit,
      aiGuess: input.guess.trim(),
      reaction: directHit
        ? `Direct hit! ${card.term}!`
        : `Guessed "${input.guess.trim()}" — keep refining your clue!`,
    };
  } else if (!evalOut.foulDetected) {
    const aiRes = await requestAiWaterfallText({
      systemInstruction:
        "You are an enthusiastic IT teammate playing Tech Taboo (Explain Like I'm 5). Given the target IT term, acceptable clues, and the player's English explanation, decide if a sharp engineer could guess the target concept from that clue. Respond strictly in JSON: { vietnameseFoul: boolean, guessedCorrectly: boolean, aiGuess: string, reaction: string (short playful 1-sentence reaction) }.",
      userPrompt: JSON.stringify({
        targetTerm: card.term,
        category: card.category,
        acceptableClues: card.acceptableClues,
        clue: input.clue,
      }),
      temperature: 0.3,
      maxTokens: 200,
      jsonMode: true,
      timeoutMs: 1800,
    });

    const parsed = aiRes ? extractFirstJsonObject(aiRes.text) : null;
    if (parsed) {
      if (parsed.vietnameseFoul === true) {
        evalOut = {
          guessedCorrectly: false,
          aiGuess: "",
          reaction: "Foul! Non-English phrasing detected — streak reset!",
          tabooViolated: false,
          violatedWords: [],
          foulDetected: true,
          foulType: "vietnamese",
        };
      } else if (typeof parsed.guessedCorrectly === "boolean") {
        evalOut = {
          ...evalOut,
          guessedCorrectly: parsed.guessedCorrectly,
          aiGuess:
            typeof parsed.aiGuess === "string" && parsed.aiGuess.trim()
              ? parsed.aiGuess.trim()
              : parsed.guessedCorrectly
                ? card.term
                : evalOut.aiGuess,
          reaction:
            typeof parsed.reaction === "string" && parsed.reaction.trim()
              ? parsed.reaction.trim()
              : evalOut.reaction,
        };
      }
    }
  }

  let nextStreak = input.room.streak;
  let nextSolved = input.room.solvedCount;
  let nextFoulCount = input.room.foulCount;
  let nextScore = input.room.score;
  let nextCardIdx = input.room.currentCardIndex;
  let cardAdvanced = false;
  let pointsAwarded = 0;

  if (evalOut.foulDetected) {
    nextStreak = 0;
    nextFoulCount += 1;
    nextScore = Math.max(0, nextScore - (evalOut.tabooViolated ? 100 : 50));
    if (evalOut.tabooViolated) {
      nextCardIdx += 1;
      cardAdvanced = true;
    }
  } else if (evalOut.guessedCorrectly) {
    nextStreak += 1;
    nextSolved += 1;
    const fever = nextStreak >= 3;
    const multiplier: 1 | 2 = fever ? 2 : 1;
    pointsAwarded = 250 * multiplier;
    nextScore += pointsAwarded;
    nextCardIdx += 1;
    cardAdvanced = true;
  }

  const feverMode = nextStreak >= 3;
  const multiplier: 1 | 2 = feverMode ? 2 : 1;
  const maxStreak = Math.max(input.room.maxStreak, nextStreak);
  const finished =
    nextSolved >= input.room.targetCards ||
    nextCardIdx >= input.room.deckCardIds.length;
  const nextCardId = finished
    ? card.id
    : input.room.deckCardIds[nextCardIdx] ?? card.id;

  const feedEntry: TabooFeedEntry = {
    id: makeEventId("taboo"),
    playerId: player?.id ?? input.playerId,
    displayName: player?.displayName ?? "Explainer",
    cardId: card.id,
    cardTerm: card.term,
    clue: input.clue.trim(),
    aiGuess: evalOut.aiGuess,
    guessedCorrectly: evalOut.guessedCorrectly,
    tabooViolated: evalOut.tabooViolated,
    violatedWords: evalOut.violatedWords,
    foulDetected: evalOut.foulDetected,
    feverMode,
    multiplier,
    pointsAwarded,
    reaction: evalOut.reaction,
    timestamp: now,
  };

  const nextPlayers = input.room.players.map((p) => {
    if (p.id !== (player?.id ?? input.playerId)) return p;
    return {
      ...p,
      score: Math.max(0, p.score + pointsAwarded),
      streak: nextStreak,
      fouls: evalOut.foulDetected ? p.fouls + 1 : p.fouls,
    };
  });

  const nextRoom: TabooRoomState = {
    ...input.room,
    status: finished ? "finished" : "active",
    players: nextPlayers,
    currentCardIndex: finished ? input.room.currentCardIndex : nextCardIdx,
    currentCardId: nextCardId,
    solvedCount: nextSolved,
    foulCount: nextFoulCount,
    streak: nextStreak,
    maxStreak,
    feverMode,
    score: nextScore,
    winnerId: finished ? player?.id ?? input.room.players[0]?.id ?? null : null,
    feed: [...input.room.feed, feedEntry],
    updatedAt: now,
  };

  return {
    room: nextRoom,
    currentCard: findTabooCardById(nextCardId),
    turnResult: {
      ...evalOut,
      streak: nextStreak,
      feverMode,
      multiplier,
      pointsAwarded,
      cardAdvanced,
    },
  };
}

export function applyTabooTimeout(room: TabooRoomState): TabooRoomState {
  if (room.status !== "active") return room;
  const human = room.players.find((p) => !p.isBot) ?? room.players[0];
  return {
    ...room,
    status: "finished",
    winnerId: room.solvedCount > 0 ? human?.id ?? null : null,
    updatedAt: new Date().toISOString(),
  };
}

export function resetTabooRoom(room: TabooRoomState): TabooRoomState {
  const deckCardIds = buildShuffledTabooDeck();
  const firstCard = findTabooCardById(deckCardIds[0]);
  return {
    ...room,
    status: "lobby",
    deckCardIds,
    currentCardIndex: 0,
    currentCardId: firstCard.id,
    solvedCount: 0,
    foulCount: 0,
    streak: 0,
    maxStreak: 0,
    feverMode: false,
    score: 0,
    players: room.players.map((p) => ({
      ...p,
      score: 0,
      streak: 0,
      fouls: 0,
    })),
    winnerId: null,
    feed: [],
    rewardsAwarded: false,
    updatedAt: new Date().toISOString(),
  };
}

export function calculateTabooRewardPoints(
  room: TabooRoomState,
  reason: "finish" | "leave"
): number {
  if (reason === "leave") {
    if (room.solvedCount <= 0) return 0;
    return Math.min(5000, room.solvedCount * 1000);
  }
  if (room.solvedCount <= 0) return 0;
  if (room.solvedCount >= room.targetCards) {
    const feverBonus = room.maxStreak >= 3 ? 2000 : 0;
    const cleanBonus = room.foulCount === 0 ? 1000 : 0;
    const scoreBonus = Math.floor(room.score / 500) * 1000;
    return Math.max(5000, Math.min(12000, 5000 + feverBonus + cleanBonus + scoreBonus));
  }
  return Math.min(5000, room.solvedCount * 1000);
}

export function computeWordChainFuseSeconds(input: {
  turnCount: number;
  comboTriggered: boolean;
}): number {
  if (input.comboTriggered) {
    return DYNAMIC_FUSE_RULES.comboFuseSeconds;
  }
  const steps = Math.floor(
    Math.max(0, input.turnCount) / DYNAMIC_FUSE_RULES.stepIntervalTurns
  );
  return Math.max(
    DYNAMIC_FUSE_RULES.minFuseSeconds + 2,
    DYNAMIC_FUSE_RULES.baseFuseSeconds - steps * DYNAMIC_FUSE_RULES.turnStepReductionSeconds
  );
}

function pickSeedWord(preferred?: string): string {
  const norm = preferred ? normalizeChainWord(preferred) : "";
  if (norm && isItChainTerm(norm)) return norm;
  const idx = randomBytes(1)[0] % SEED_STARTING_WORDS.length;
  return SEED_STARTING_WORDS[idx];
}

export function createWordChainRoom(options?: {
  roomCode?: string;
  seedWord?: string;
  targetTurns?: number;
  hostPlayer?: {
    id: string;
    displayName: string;
    avatarUrl?: string | null;
    equippedTitle?: string;
    equippedRing?: string;
    equippedCosmetics?: EquippedCosmetics;
  };
}): WordChainRoomState {
  const roomCode = normalizeArenaRoomCode(options?.roomCode) ?? generateArenaRoomCode();
  const seed = pickSeedWord(options?.seedWord);
  const now = new Date().toISOString();
  const players: ArenaPlayer[] = options?.hostPlayer
    ? [toArenaPlayer(options.hostPlayer, { isHost: true, alive: true, itTermsCount: 0 })]
    : [];

  return {
    roomCode,
    gameType: "word-chain",
    status: "lobby",
    players,
    currentWord: seed,
    requiredChar: seed[seed.length - 1].toUpperCase(),
    usedWords: [seed],
    turnCount: 0,
    targetTurns:
      typeof options?.targetTurns === "number" && Number.isFinite(options.targetTurns)
        ? Math.max(6, Math.min(24, Math.round(options.targetTurns)))
        : 12,
    fuseSeconds: DYNAMIC_FUSE_RULES.baseFuseSeconds,
    lastAttackFuseSeconds: null,
    itComboStreak: 0,
    maxItStreak: 0,
    currentTurnPlayerId: players[0]?.id ?? null,
    winnerId: null,
    explodedPlayerId: null,
    history: [],
    rewardsAwarded: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function joinWordChainRoom(
  room: WordChainRoomState,
  player: {
    id: string;
    displayName: string;
    avatarUrl?: string | null;
    equippedTitle?: string;
    equippedRing?: string;
    equippedCosmetics?: EquippedCosmetics;
  }
): WordChainRoomState {
  const existing = room.players.find((p) => p.id === player.id);
  const filtered = room.players.filter((p) => p.id !== player.id);
  const nextSlot = toArenaPlayer(player, {
    isHost: existing?.isHost ?? filtered.length === 0,
    alive: existing?.alive ?? true,
    score: existing?.score ?? 0,
    streak: existing?.streak ?? 0,
    fouls: existing?.fouls ?? 0,
    itTermsCount: existing?.itTermsCount ?? 0,
  });

  return {
    ...room,
    players: [...filtered, nextSlot],
    updatedAt: new Date().toISOString(),
  };
}

export function fillWordChainBot(room: WordChainRoomState): WordChainRoomState {
  if (room.players.some((p) => p.isBot)) {
    return room;
  }
  const botPlayer: ArenaPlayer = {
    id: "bot-syntax-bomb",
    displayName: "Syntax Bot",
    avatarUrl: null,
    equippedTitle: "Lexicon Reactor",
    equippedRing: "crimson",
    isBot: true,
    alive: true,
    score: 0,
    streak: 0,
    fouls: 0,
    itTermsCount: 0,
  };

  return {
    ...room,
    players: [...room.players, botPlayer],
    updatedAt: new Date().toISOString(),
  };
}

export function startWordChainRoom(room: WordChainRoomState): WordChainRoomState {
  const seed = pickSeedWord();
  const ordered = room.players.map((p) => ({
    ...p,
    alive: true,
    score: 0,
    streak: 0,
    fouls: 0,
    itTermsCount: 0,
  }));
  const firstPlayer = ordered.find((p) => !p.isBot) ?? ordered[0] ?? null;

  return {
    ...room,
    status: "active",
    players: ordered,
    currentWord: seed,
    requiredChar: seed[seed.length - 1].toUpperCase(),
    usedWords: [seed],
    turnCount: 0,
    fuseSeconds: DYNAMIC_FUSE_RULES.baseFuseSeconds,
    lastAttackFuseSeconds: null,
    itComboStreak: 0,
    maxItStreak: 0,
    currentTurnPlayerId: firstPlayer?.id ?? null,
    winnerId: null,
    explodedPlayerId: null,
    history: [],
    rewardsAwarded: false,
    updatedAt: new Date().toISOString(),
  };
}

function extractChainCandidate(rawInput: string): string | null {
  const cleaned = rawInput
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, " ")
    .trim();
  if (!cleaned) return null;
  const parts = cleaned
    .split(/\s+/)
    .filter((token) => token && !CHAIN_FILLER_TOKENS.has(token));
  if (parts.length === 1) {
    return normalizeChainWord(parts[0]);
  }
  if (parts.length === 0) {
    const rawParts = cleaned.split(/\s+/).filter(Boolean);
    return rawParts.length === 1 ? normalizeChainWord(rawParts[0]) : null;
  }
  return null;
}

function isPlausibleEnglishWordLocal(word: string): boolean {
  if (!/^[a-z]{2,}$/.test(word)) return false;
  if (/(.)\1\1/.test(word)) return false;
  if (!GIBBERISH_VOWEL_REGEX.test(word)) return false;
  return true;
}

export function evaluateWordChainTurnLocal(input: {
  rawInput: string;
  requiredChar: string;
  usedWords: readonly string[];
  currentStreak: number;
  turnCount: number;
}): {
  valid: boolean;
  word: string;
  isItTerm: boolean;
  foulDetected: boolean;
  reason: string;
  nextStreak: number;
  multiplier: 1 | 2;
  pointsEarned: number;
  comboTriggered: boolean;
  nextFuseSeconds: number;
} {
  const foul = detectVietnameseFoul(input.rawInput);
  if (foul.detected) {
    return {
      valid: false,
      word: "",
      isItTerm: false,
      foulDetected: true,
      reason: `Foul! Vietnamese detected (${foul.matchedTokens.slice(0, 3).join(", ")}). Fuse penalized!`,
      nextStreak: 0,
      multiplier: 1,
      pointsEarned: 0,
      comboTriggered: false,
      nextFuseSeconds: Math.max(5, DYNAMIC_FUSE_RULES.baseFuseSeconds - 4),
    };
  }

  const word = extractChainCandidate(input.rawInput);
  if (!word || !/^[a-z]{2,}$/.test(word)) {
    return {
      valid: false,
      word: "",
      isItTerm: false,
      foulDetected: false,
      reason: `Enter a single English word starting with '${input.requiredChar.toUpperCase()}'.`,
      nextStreak: input.currentStreak,
      multiplier: 1,
      pointsEarned: 0,
      comboTriggered: false,
      nextFuseSeconds: computeWordChainFuseSeconds({
        turnCount: input.turnCount,
        comboTriggered: false,
      }),
    };
  }

  const req = input.requiredChar.toLowerCase();
  if (!word.startsWith(req)) {
    return {
      valid: false,
      word,
      isItTerm: false,
      foulDetected: false,
      reason: `'${word}' must start with '${req.toUpperCase()}'.`,
      nextStreak: input.currentStreak,
      multiplier: 1,
      pointsEarned: 0,
      comboTriggered: false,
      nextFuseSeconds: computeWordChainFuseSeconds({
        turnCount: input.turnCount,
        comboTriggered: false,
      }),
    };
  }

  const usedSet = new Set(input.usedWords.map((w) => normalizeChainWord(w)));
  if (usedSet.has(word)) {
    return {
      valid: false,
      word,
      isItTerm: false,
      foulDetected: false,
      reason: `'${word}' was already used in this chain.`,
      nextStreak: input.currentStreak,
      multiplier: 1,
      pointsEarned: 0,
      comboTriggered: false,
      nextFuseSeconds: computeWordChainFuseSeconds({
        turnCount: input.turnCount,
        comboTriggered: false,
      }),
    };
  }

  const isItTerm = isItChainTerm(word);
  if (!isItTerm && !isPlausibleEnglishWordLocal(word)) {
    return {
      valid: false,
      word,
      isItTerm: false,
      foulDetected: false,
      reason: `'${word}' does not look like a valid English word.`,
      nextStreak: input.currentStreak,
      multiplier: 1,
      pointsEarned: 0,
      comboTriggered: false,
      nextFuseSeconds: computeWordChainFuseSeconds({
        turnCount: input.turnCount,
        comboTriggered: false,
      }),
    };
  }

  const nextStreak = isItTerm ? input.currentStreak + 1 : 0;
  const multiplier: 1 | 2 = isItTerm ? DYNAMIC_FUSE_RULES.itTermMultiplier : 1;
  const comboTriggered =
    isItTerm && nextStreak >= DYNAMIC_FUSE_RULES.comboStreakThreshold;
  const pointsEarned = (100 + word.length * 10) * multiplier;
  const nextFuseSeconds = computeWordChainFuseSeconds({
    turnCount: input.turnCount + 1,
    comboTriggered,
  });

  const reason = comboTriggered
    ? `IT-TERM x2 COMBO (${nextStreak}x)! '${word}' cuts opponent fuse to 5s!`
    : isItTerm
      ? `IT Term! '${word}' scored x2 points (${nextStreak}/2 toward 5s Fuse Bomb).`
      : `Accepted '${word}'. Chain an IT term next for x2 points!`;

  return {
    valid: true,
    word,
    isItTerm,
    foulDetected: false,
    reason,
    nextStreak,
    multiplier,
    pointsEarned,
    comboTriggered,
    nextFuseSeconds,
  };
}

function getNextAlivePlayer(
  players: readonly ArenaPlayer[],
  afterPlayerId: string
): ArenaPlayer | null {
  const alive = players.filter((p) => p.alive !== false);
  if (alive.length === 0) return null;
  const idx = alive.findIndex((p) => p.id === afterPlayerId);
  if (idx < 0) return alive[0];
  return alive[(idx + 1) % alive.length];
}

export async function moderateWordChainTurn(input: {
  room: WordChainRoomState;
  playerId: string;
  wordInput: string;
}): Promise<{
  room: WordChainRoomState;
  turnResult: {
    valid: boolean;
    word: string;
    isItTerm: boolean;
    foulDetected: boolean;
    reason: string;
    streak: number;
    multiplier: 1 | 2;
    pointsEarned: number;
    comboTriggered: boolean;
    nextFuseSeconds: number;
    botMove: WordChainMove | null;
    explodedPlayerId: string | null;
    winnerId: string | null;
  };
}> {
  const player =
    input.room.players.find((p) => p.id === input.playerId) ??
    input.room.players.find((p) => !p.isBot) ??
    input.room.players[0];
  const currentStreak = player?.streak ?? input.room.itComboStreak;

  let localEval = evaluateWordChainTurnLocal({
    rawInput: input.wordInput,
    requiredChar: input.room.requiredChar,
    usedWords: input.room.usedWords,
    currentStreak,
    turnCount: input.room.turnCount,
  });

  if (localEval.valid && !localEval.isItTerm) {
    const aiRes = await requestAiWaterfallText({
      systemInstruction:
        "You are a Word Chain referee. Verify if the single lowercase token is a real English word and whether it is a software/IT term. Respond strictly in JSON: { validEnglish: boolean, isItTerm: boolean, reason: string }.",
      userPrompt: JSON.stringify({ word: localEval.word }),
      temperature: 0.1,
      maxTokens: 120,
      jsonMode: true,
      timeoutMs: 1400,
    });

    const parsed = aiRes ? extractFirstJsonObject(aiRes.text) : null;
    if (parsed && parsed.validEnglish === false) {
      localEval = {
        ...localEval,
        valid: false,
        reason:
          typeof parsed.reason === "string" && parsed.reason.trim()
            ? parsed.reason.trim()
            : `'${localEval.word}' is not a valid English word.`,
        pointsEarned: 0,
      };
    }
  }

  if (!localEval.valid) {
    const nextPlayers = localEval.foulDetected
      ? input.room.players.map((p) =>
          p.id === player?.id
            ? { ...p, streak: 0, fouls: p.fouls + 1 }
            : p
        )
      : input.room.players;
    const nextRoom: WordChainRoomState = {
      ...input.room,
      players: nextPlayers,
      fuseSeconds: localEval.foulDetected
        ? Math.max(3, input.room.fuseSeconds - 3)
        : input.room.fuseSeconds,
      itComboStreak: localEval.foulDetected ? 0 : input.room.itComboStreak,
      updatedAt: new Date().toISOString(),
    };
    return {
      room: nextRoom,
      turnResult: {
        valid: false,
        word: localEval.word,
        isItTerm: false,
        foulDetected: localEval.foulDetected,
        reason: localEval.reason,
        streak: localEval.foulDetected ? 0 : currentStreak,
        multiplier: 1,
        pointsEarned: 0,
        comboTriggered: false,
        nextFuseSeconds: nextRoom.fuseSeconds,
        botMove: null,
        explodedPlayerId: null,
        winnerId: null,
      },
    };
  }

  const now = new Date().toISOString();
  const humanMove: WordChainMove = {
    id: makeEventId("chain"),
    playerId: player?.id ?? input.playerId,
    displayName: player?.displayName ?? "Player",
    word: localEval.word,
    isBot: false,
    isItTerm: localEval.isItTerm,
    streak: localEval.nextStreak,
    multiplier: localEval.multiplier,
    pointsEarned: localEval.pointsEarned,
    fuseAssigned: localEval.nextFuseSeconds,
    comboTriggered: localEval.comboTriggered,
    timestamp: now,
  };

  let usedWords = [...input.room.usedWords, localEval.word];
  let history = [...input.room.history, humanMove];
  let turnCount = input.room.turnCount + 1;
  let requiredChar = localEval.word[localEval.word.length - 1].toUpperCase();
  let currentWord = localEval.word;
  let fuseSeconds = localEval.nextFuseSeconds;
  let nextPlayers = input.room.players.map((p) => {
    if (p.id !== (player?.id ?? input.playerId)) return p;
    return {
      ...p,
      score: p.score + localEval.pointsEarned,
      streak: localEval.nextStreak,
      itTermsCount: (p.itTermsCount ?? 0) + (localEval.isItTerm ? 1 : 0),
    };
  });

  const nextCandidate = getNextAlivePlayer(nextPlayers, humanMove.playerId);
  let botMove: WordChainMove | null = null;
  let explodedPlayerId: string | null = null;
  let winnerId: string | null = null;
  let status: ArenaRoomStatus = "active";

  if (nextCandidate?.isBot) {
    const botOverloaded =
      turnCount >= input.room.targetTurns ||
      (localEval.comboTriggered && turnCount >= Math.max(6, input.room.targetTurns - 4));
    const botWord = botOverloaded ? null : pickBotChainWord(requiredChar, usedWords);

    if (!botWord) {
      status = "finished";
      explodedPlayerId = nextCandidate.id;
      nextPlayers = nextPlayers.map((p) =>
        p.id === nextCandidate.id ? { ...p, alive: false } : p
      );
      winnerId = humanMove.playerId;
    } else {
      turnCount += 1;
      usedWords = [...usedWords, botWord];
      currentWord = botWord;
      requiredChar = botWord[botWord.length - 1].toUpperCase();
      const humanReturnFuse = computeWordChainFuseSeconds({
        turnCount,
        comboTriggered: false,
      });
      fuseSeconds = humanReturnFuse;
      botMove = {
        id: makeEventId("chain-bot"),
        playerId: nextCandidate.id,
        displayName: nextCandidate.displayName,
        word: botWord,
        isBot: true,
        isItTerm: true,
        streak: (nextCandidate.streak ?? 0) + 1,
        multiplier: 2,
        pointsEarned: (100 + botWord.length * 10) * 2,
        fuseAssigned: humanReturnFuse,
        comboTriggered: false,
        timestamp: new Date().toISOString(),
      };
      history = [...history, botMove];
      nextPlayers = nextPlayers.map((p) =>
        p.id === nextCandidate.id
          ? {
              ...p,
              score: p.score + botMove!.pointsEarned,
              streak: botMove!.streak,
              itTermsCount: (p.itTermsCount ?? 0) + 1,
            }
          : p
      );
    }
  }

  const nextActivePlayer =
    status === "finished"
      ? null
      : getNextAlivePlayer(nextPlayers, botMove ? botMove.playerId : humanMove.playerId);

  const nextRoom: WordChainRoomState = {
    ...input.room,
    status,
    players: nextPlayers,
    currentWord,
    requiredChar,
    usedWords,
    turnCount,
    fuseSeconds,
    lastAttackFuseSeconds: localEval.comboTriggered
      ? DYNAMIC_FUSE_RULES.comboFuseSeconds
      : null,
    itComboStreak: localEval.nextStreak,
    maxItStreak: Math.max(input.room.maxItStreak, localEval.nextStreak),
    currentTurnPlayerId: nextActivePlayer?.id ?? null,
    winnerId,
    explodedPlayerId,
    history,
    updatedAt: new Date().toISOString(),
  };

  return {
    room: nextRoom,
    turnResult: {
      valid: true,
      word: localEval.word,
      isItTerm: localEval.isItTerm,
      foulDetected: false,
      reason: botMove === null && explodedPlayerId
        ? `${localEval.reason} Syntax Bot failed to respond in time — SEGFAULT!`
        : localEval.reason,
      streak: localEval.nextStreak,
      multiplier: localEval.multiplier,
      pointsEarned: localEval.pointsEarned,
      comboTriggered: localEval.comboTriggered,
      nextFuseSeconds: localEval.nextFuseSeconds,
      botMove,
      explodedPlayerId,
      winnerId,
    },
  };
}

export function applyWordChainTimeout(
  room: WordChainRoomState,
  playerId?: string
): WordChainRoomState {
  if (room.status !== "active") return room;
  const targetId = playerId ?? room.currentTurnPlayerId;
  const nextPlayers = room.players.map((p) =>
    p.id === targetId ? { ...p, alive: false } : p
  );
  const alive = nextPlayers.filter((p) => p.alive !== false);
  const finished = alive.length <= 1;
  const winnerId = finished ? alive[0]?.id ?? null : null;
  const nextTurn = finished ? null : getNextAlivePlayer(nextPlayers, targetId ?? "");

  return {
    ...room,
    status: finished ? "finished" : "active",
    players: nextPlayers,
    explodedPlayerId: targetId ?? null,
    winnerId,
    currentTurnPlayerId: nextTurn?.id ?? null,
    updatedAt: new Date().toISOString(),
  };
}

export function resetWordChainRoom(room: WordChainRoomState): WordChainRoomState {
  const seed = pickSeedWord();
  return {
    ...room,
    status: "lobby",
    players: room.players.map((p) => ({
      ...p,
      alive: true,
      score: 0,
      streak: 0,
      fouls: 0,
      itTermsCount: 0,
    })),
    currentWord: seed,
    requiredChar: seed[seed.length - 1].toUpperCase(),
    usedWords: [seed],
    turnCount: 0,
    fuseSeconds: DYNAMIC_FUSE_RULES.baseFuseSeconds,
    lastAttackFuseSeconds: null,
    itComboStreak: 0,
    maxItStreak: 0,
    currentTurnPlayerId: room.players[0]?.id ?? null,
    winnerId: null,
    explodedPlayerId: null,
    history: [],
    rewardsAwarded: false,
    updatedAt: new Date().toISOString(),
  };
}

export function calculateWordChainRewardPoints(
  room: WordChainRoomState,
  playerId: string,
  reason: "finish" | "leave"
): number {
  const player =
    room.players.find((p) => p.id === playerId) ??
    room.players.find((p) => !p.isBot);
  if (!player) return 0;

  const humanMoves = room.history.filter((m) => m.playerId === player.id).length;
  if (reason === "leave") {
    if (humanMoves < 2) return 0;
    return Math.min(5000, Math.floor(humanMoves / 2) * 1000);
  }

  if (room.winnerId === player.id) {
    const itBonus = Math.min(5000, (player.itTermsCount ?? 0) * 1000);
    const streakBonus = room.maxItStreak >= 2 ? 2000 : 0;
    return Math.max(5000, Math.min(12000, 5000 + itBonus + streakBonus));
  }

  if (humanMoves >= 2) {
    return Math.min(5000, Math.floor(humanMoves / 2) * 1000);
  }
  return 0;
}

export interface ArenaActionPayload {
  action?: string;
  code?: string;
  roomCode?: string;
  topicId?: string;
  stance?: DuelStance;
  cardId?: string;
  targetCards?: number;
  seedWord?: string;
  targetTurns?: number;
  autoFillBot?: boolean;
  transcript?: string;
  argument?: string;
  text?: string;
  clue?: string;
  guess?: string;
  skip?: boolean;
  word?: string;
  displayName?: string;
  playerId?: string;
  backupTransferCode?: string;
}

function pickSessionInfo(
  body: ArenaActionPayload,
  sessionPlayer: PublicGuestPlayer | null
) {
  const playerId =
    sessionPlayer?.id ??
    (typeof body.playerId === "string" && body.playerId.trim()
      ? body.playerId.trim().slice(0, 64)
      : "guest-local");
  const displayName =
    sessionPlayer?.displayName ??
    (typeof body.displayName === "string" && body.displayName.trim()
      ? body.displayName.trim().slice(0, 48)
      : "Guest Engineer");
  return {
    id: playerId,
    displayName,
    avatarUrl: sessionPlayer?.avatarUrl ?? null,
    equippedTitle: sessionPlayer?.equippedTitle,
    equippedRing: sessionPlayer?.equippedRing,
    equippedCosmetics: sessionPlayer?.equippedCosmetics,
  };
}

function roomMetaFields(room: ArenaRoomState) {
  if (room.gameType === "duel") {
    return { topic: findDuelTopicById(room.topicId) };
  }
  if (room.gameType === "taboo") {
    return { currentCard: findTabooCardById(room.currentCardId) };
  }
  return {};
}

function computeFinishOrLeaveRewardPoints(
  room: ArenaRoomState,
  playerId: string,
  reason: "finish" | "leave"
): number {
  if (room.gameType === "duel") {
    return calculateDuelRewardPoints(room, playerId, reason);
  }
  if (room.gameType === "taboo") {
    return calculateTabooRewardPoints(room, reason);
  }
  return calculateWordChainRewardPoints(room, playerId, reason);
}

function computeRoomScoreMetric(room: ArenaRoomState, playerId: string): {
  score: number;
  metric: number;
  durationSec: number;
} {
  const player =
    room.players.find((p) => p.id === playerId) ??
    room.players.find((p) => !p.isBot);
  const elapsedMs = Math.max(
    0,
    Date.now() - (Date.parse(room.createdAt) || Date.now())
  );
  const durationSec = Math.round(elapsedMs / 1000);
  if (room.gameType === "duel") {
    return {
      score: player?.score ?? 0,
      metric: player?.criticalHits ?? 0,
      durationSec,
    };
  }
  if (room.gameType === "taboo") {
    return {
      score: room.score,
      metric: room.solvedCount,
      durationSec,
    };
  }
  return {
    score: player?.score ?? 0,
    metric: player?.itTermsCount ?? 0,
    durationSec,
  };
}

export async function getArenaRoomResponse(
  gameType: ArenaGameType,
  rawCode: string | null,
  sessionPlayer: PublicGuestPlayer | null
): Promise<{ status: number; body: Record<string, unknown> }> {
  const code = normalizeArenaRoomCode(rawCode);
  if (!code) {
    return { status: 400, body: { error: "Invalid 6-character room code." } };
  }

  const room = await loadArenaRoom(code, gameType);
  if (!room) {
    return { status: 404, body: { error: "Arena room not found." } };
  }

  return {
    status: 200,
    body: {
      ok: true,
      room,
      ...roomMetaFields(room),
      player: sessionPlayer,
    },
  };
}

export async function executeArenaAction(input: {
  gameType: ArenaGameType;
  body: ArenaActionPayload;
  sessionPlayer: PublicGuestPlayer | null;
  rewardPracticePointsFn: RewardPracticePointsFn;
}): Promise<{ status: number; body: Record<string, unknown> }> {
  const { gameType, body, sessionPlayer, rewardPracticePointsFn } = input;
  const action = body.action;
  if (!action) {
    return { status: 400, body: { error: "Missing arena action." } };
  }

  if (
    (action === "create" || action === "join" || action === "start") &&
    sessionPlayer?.id
  ) {
    const access = await assertArenaAccess(sessionPlayer.id);
    if (!access.allowed) {
      return {
        status: 403,
        body: {
          error:
            access.message ||
            "Tài khoản đang bị khóa tạm thời vào Arena do thoát ngang quá nhiều lần.",
          frozenUntil: access.frozenUntil,
          permanent: access.permanent,
        },
      };
    }
  }

  const playerInfo = pickSessionInfo(body, sessionPlayer);

  if (action === "create") {
    let created: ArenaRoomState;
    if (gameType === "duel") {
      created = createDuelRoom({
        topicId: body.topicId,
        hostPlayer: { ...playerInfo, stance: body.stance },
      });
    } else if (gameType === "taboo") {
      created = createTabooRoom({
        cardId: body.cardId,
        targetCards: body.targetCards,
        hostPlayer: playerInfo,
      });
    } else {
      created = createWordChainRoom({
        seedWord: body.seedWord,
        targetTurns: body.targetTurns,
        hostPlayer: playerInfo,
      });
    }

    await saveArenaRoom(created);
    return {
      status: 200,
      body: {
        ok: true,
        room: created,
        ...roomMetaFields(created),
        player: sessionPlayer,
      },
    };
  }

  const code = normalizeArenaRoomCode(body.code ?? body.roomCode);
  if (!code) {
    return { status: 400, body: { error: "Invalid 6-character room code." } };
  }

  const existingRoom = await loadArenaRoom(code, gameType);
  if (!existingRoom) {
    return { status: 404, body: { error: "Arena room not found." } };
  }

  let updatedRoom: ArenaRoomState = existingRoom;
  let activePlayer = sessionPlayer;
  let turnResult: unknown = undefined;
  let rewardSummary: ArenaRewardSummary | null = null;
  const actorPlayerId =
    typeof body.playerId === "string" &&
    body.playerId.trim() &&
    existingRoom.players.some((p) => p.id === body.playerId!.trim())
      ? body.playerId.trim()
      : playerInfo.id;

  const finalizeRewardIfNeeded = async (
    targetRoom: ArenaRoomState,
    reason: "finish" | "leave"
  ): Promise<ArenaRoomState> => {
    if (targetRoom.rewardsAwarded) return targetRoom;
    const pts = computeFinishOrLeaveRewardPoints(targetRoom, actorPlayerId, reason);
    if (pts <= 0) return targetRoom;

    const payout = await payoutArenaPointsWith(
      rewardPracticePointsFn,
      `arena-${targetRoom.gameType}`,
      pts,
      body.backupTransferCode
    );
    if (payout.player) {
      activePlayer = payout.player;
    }
    rewardSummary = payout.reward;

    const stats = computeRoomScoreMetric(targetRoom, actorPlayerId);
    await recordArenaRunTelemetry({
      gameType: targetRoom.gameType,
      roomCode: targetRoom.roomCode,
      score: stats.score,
      metric: stats.metric,
      durationSec: stats.durationSec,
      playerId: activePlayer?.id ?? actorPlayerId,
      playerName: activePlayer?.displayName ?? playerInfo.displayName,
      transferCode: activePlayer?.transferCode ?? body.backupTransferCode ?? null,
    });

    return {
      ...targetRoom,
      rewardsAwarded: true,
      updatedAt: new Date().toISOString(),
    };
  };

  if (action === "join") {
    if (existingRoom.gameType === "duel") {
      updatedRoom = joinDuelRoom(existingRoom, {
        ...playerInfo,
        stance: body.stance,
      });
    } else if (existingRoom.gameType === "taboo") {
      updatedRoom = joinTabooRoom(existingRoom, playerInfo);
    } else {
      updatedRoom = joinWordChainRoom(existingRoom, playerInfo);
    }
  } else if (action === "fill_bot") {
    if (existingRoom.gameType === "duel") {
      updatedRoom = fillDuelBot(existingRoom);
    } else if (existingRoom.gameType === "taboo") {
      updatedRoom = fillTabooBot(existingRoom);
    } else {
      updatedRoom = fillWordChainBot(existingRoom);
    }
  } else if (action === "start") {
    let roomToStart = existingRoom;
    if (roomToStart.players.length < 2 && body.autoFillBot) {
      roomToStart =
        roomToStart.gameType === "duel"
          ? fillDuelBot(roomToStart)
          : roomToStart.gameType === "taboo"
            ? fillTabooBot(roomToStart)
            : fillWordChainBot(roomToStart);
    }
    if (roomToStart.players.length < 2) {
      return {
        status: 400,
        body: { error: "Need 2 participants (or fill with AI Bot) to start." },
      };
    }
    updatedRoom =
      roomToStart.gameType === "duel"
        ? startDuelRoom(roomToStart)
        : roomToStart.gameType === "taboo"
          ? startTabooRoom(roomToStart)
          : startWordChainRoom(roomToStart);
  } else if (action === "turn") {
    if (existingRoom.status !== "active") {
      return {
        status: 400,
        body: { error: "Match is not active. Start the match first." },
      };
    }
    if (existingRoom.gameType === "duel") {
      const transcript = (body.transcript ?? body.argument ?? body.text ?? "").trim();
      if (!transcript) {
        return {
          status: 400,
          body: { error: "Speak or enter an English debate argument." },
        };
      }
      const res = await moderateDuelTurn({
        room: existingRoom,
        playerId: actorPlayerId,
        transcript,
      });
      updatedRoom = res.room;
      turnResult = {
        playerTurn: res.playerTurn,
        botTurn: res.botTurn,
        criticalHit: res.playerTurn.criticalHit,
        foulDetected: res.playerTurn.foulDetected,
        winnerId: res.room.winnerId,
      };
    } else if (existingRoom.gameType === "taboo") {
      const clue = (body.clue ?? body.transcript ?? body.text ?? "").trim();
      if (!clue && !body.skip) {
        return {
          status: 400,
          body: { error: "Speak or enter an English clue for your concept." },
        };
      }
      const res = await moderateTabooTurn({
        room: existingRoom,
        playerId: actorPlayerId,
        clue,
        guess: body.guess,
        skip: body.skip,
      });
      updatedRoom = res.room;
      turnResult = res.turnResult;
    } else {
      const wordInput = (body.word ?? body.transcript ?? body.text ?? "").trim();
      if (!wordInput) {
        return {
          status: 400,
          body: { error: "Speak or enter a single English word." },
        };
      }
      const res = await moderateWordChainTurn({
        room: existingRoom,
        playerId: actorPlayerId,
        wordInput,
      });
      updatedRoom = res.room;
      turnResult = res.turnResult;
    }

    if (updatedRoom.status === "finished") {
      updatedRoom = await finalizeRewardIfNeeded(updatedRoom, "finish");
    }
  } else if (action === "timeout") {
    if (existingRoom.gameType === "duel") {
      updatedRoom = applyDuelTimeout(existingRoom, actorPlayerId);
    } else if (existingRoom.gameType === "taboo") {
      updatedRoom = applyTabooTimeout(existingRoom);
    } else {
      updatedRoom = applyWordChainTimeout(existingRoom, actorPlayerId);
    }
    if (updatedRoom.status === "finished") {
      updatedRoom = await finalizeRewardIfNeeded(updatedRoom, "finish");
    }
  } else if (action === "leave") {
    updatedRoom = await finalizeRewardIfNeeded(existingRoom, "leave");
    if (updatedRoom.status === "active") {
      updatedRoom = {
        ...updatedRoom,
        status: "finished",
        updatedAt: new Date().toISOString(),
      };
    }
  } else if (action === "reset") {
    await finalizeRewardIfNeeded(existingRoom, "leave");
    updatedRoom =
      existingRoom.gameType === "duel"
        ? resetDuelRoom(existingRoom, body.topicId)
        : existingRoom.gameType === "taboo"
          ? resetTabooRoom(existingRoom)
          : resetWordChainRoom(existingRoom);
  } else {
    return { status: 400, body: { error: "Unsupported arena action." } };
  }

  await saveArenaRoom(updatedRoom);

  return {
    status: 200,
    body: {
      ok: true,
      room: updatedRoom,
      ...roomMetaFields(updatedRoom),
      turnResult,
      reward: rewardSummary,
      player: activePlayer,
    },
  };
}
