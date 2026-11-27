"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Award,
  Check,
  Coins,
  Compass,
  Flame,
  Gift,
  Lock,
  Play,
  Sparkles,
  Target,
} from "lucide-react";
import { rewardPracticePoints } from "../../app/actions/leaderboard";
import {
  GAMIFICATION_STORAGE_KEY,
  GAMIFICATION_UPDATED_EVENT,
  POINTS_PER_COIN,
  getGamificationState,
} from "../../lib/gamification";
import {
  readBackupSessionToken,
  readBackupTransferCode,
  syncGuestProfileFromServer,
} from "../../lib/guestClient";
import {
  DAILY_QUESTS,
  STORY_CHAPTERS,
  computeQuestStats,
  readClaimedQuestIds,
  saveClaimedQuestIds,
} from "../../lib/questPath";
import type { GamificationState } from "../../lib/types";

const PLACEMENT_STORAGE_KEY = "speakit_placement_v1";
const VOCAB_MASTERED_STORAGE_KEY = "speakit_vocab_mastered_v1";
const ATTEMPTS_STORAGE_KEY = "speakit_attempts_v1";

function getLocalTodayKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function DuolingoQuestPath() {
  const [hydrated, setHydrated] = useState(false);
  const [gamification, setGamification] = useState<GamificationState>(() =>
    getGamificationState()
  );
  const [hasPlacement, setHasPlacement] = useState(false);
  const [masteredCount, setMasteredCount] = useState(0);
  const [attemptScenarios, setAttemptScenarios] = useState<string[]>([]);
  const [attemptDates, setAttemptDates] = useState<string[]>([]);
  const [claimedIds, setClaimedIds] = useState<string[]>([]);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [claimNotice, setClaimNotice] = useState<string | null>(null);

  useEffect(() => {
    const syncAll = () => {
      setGamification(getGamificationState());
      setClaimedIds(readClaimedQuestIds());
      try {
        setHasPlacement(Boolean(window.localStorage.getItem(PLACEMENT_STORAGE_KEY)));
        const rawMastered = window.localStorage.getItem(VOCAB_MASTERED_STORAGE_KEY);
        if (rawMastered) {
          const parsed = JSON.parse(rawMastered);
          setMasteredCount(Array.isArray(parsed) ? parsed.length : 0);
        } else {
          setMasteredCount(0);
        }
        const rawAttempts = window.localStorage.getItem(ATTEMPTS_STORAGE_KEY);
        if (rawAttempts) {
          const parsedAttempts = JSON.parse(rawAttempts);
          if (Array.isArray(parsedAttempts)) {
            setAttemptScenarios(
              parsedAttempts
                .map((a) => (typeof a?.scenario === "string" ? a.scenario : ""))
                .filter(Boolean)
            );
            setAttemptDates(
              parsedAttempts
                .map((a) => (typeof a?.createdAt === "string" ? a.createdAt : ""))
                .filter(Boolean)
            );
          }
        }
      } catch {
        setHasPlacement(false);
        setMasteredCount(0);
        setAttemptScenarios([]);
        setAttemptDates([]);
      }
      setHydrated(true);
    };

    syncAll();
    window.addEventListener(GAMIFICATION_UPDATED_EVENT, syncAll);
    window.addEventListener("storage", syncAll);
    return () => {
      window.removeEventListener(GAMIFICATION_UPDATED_EVENT, syncAll);
      window.removeEventListener("storage", syncAll);
    };
  }, []);

  const stats = useMemo(
    () =>
      computeQuestStats({
        gamification,
        hasPlacement,
        masteredVocabCount: masteredCount,
        attemptScenarios,
        attemptDates,
      }),
    [attemptDates, attemptScenarios, gamification, hasPlacement, masteredCount]
  );

  const chapterStates = useMemo(() => {
    return STORY_CHAPTERS.map((chapter) => {
      const nodes = chapter.nodes.map((node) => ({
        ...node,
        done: hydrated ? node.isCompleted(stats) : false,
      }));
      const completedCount = nodes.filter((n) => n.done).length;
      const isChapterDone = completedCount === nodes.length;
      const chestClaimKey = `chest:${chapter.id}`;
      const isChestClaimed = claimedIds.includes(chestClaimKey);
      return {
        ...chapter,
        nodes,
        completedCount,
        isChapterDone,
        chestClaimKey,
        isChestClaimed,
      };
    });
  }, [claimedIds, hydrated, stats]);

  const allNodes = useMemo(
    () => chapterStates.flatMap((c) => c.nodes),
    [chapterStates]
  );
  const totalDoneNodes = allNodes.filter((n) => n.done).length;
  const nextNode = allNodes.find((n) => !n.done) ?? allNodes[allNodes.length - 1];
  const claimableChest = chapterStates.find(
    (c) => c.isChapterDone && !c.isChestClaimed
  );
  const unlockedBadges = chapterStates.filter((c) => c.isChapterDone);
  const todayKey = getLocalTodayKey();

  const handleClaimReward = async (
    claimKey: string,
    rewardCoins: number,
    label: string
  ) => {
    if (claimingId || claimedIds.includes(claimKey)) return;
    setClaimingId(claimKey);
    setClaimNotice(null);
    const bonusPoints = rewardCoins * POINTS_PER_COIN;

    try {
      const nextClaimed = [...claimedIds, claimKey];
      setClaimedIds(nextClaimed);
      saveClaimedQuestIds(nextClaimed);

      const currentLocal = getGamificationState();
      const updatedLocal: GamificationState = {
        ...currentLocal,
        totalPoints: currentLocal.totalPoints + bonusPoints,
        lastPracticeDate: todayKey,
      };
      try {
        window.localStorage.setItem(
          GAMIFICATION_STORAGE_KEY,
          JSON.stringify(updatedLocal)
        );
        window.dispatchEvent(new CustomEvent(GAMIFICATION_UPDATED_EVENT));
      } catch {}
      setGamification(updatedLocal);

      const res = await rewardPracticePoints(
        `quest-${claimKey.replace(/[^a-zA-Z0-9_-]/g, "-")}`,
        bonusPoints,
        readBackupTransferCode(),
        readBackupSessionToken()
      );
      if (res.mode === "online" && res.player) {
        syncGuestProfileFromServer(res.player);
      }
      setClaimNotice(`Đã nhận +${rewardCoins} IT-Coin từ ${label}!`);
    } catch {
      setClaimNotice(`Đã cộng +${rewardCoins} IT-Coin cục bộ từ ${label}.`);
    } finally {
      setClaimingId(null);
    }
  };

  return (
    <section
      aria-label="Lộ trình học theo cốt truyện và nhiệm vụ"
      className="space-y-4"
    >
      <div className="liquid-glass-card p-5 sm:p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <div className="inline-flex items-center gap-2 text-xs font-mono font-bold text-blue-700 dark:text-blue-300">
              <Compass className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Lộ trình cốt truyện IT · Bước tiếp theo của bạn</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-50 leading-tight text-balance">
              {claimableChest
                ? `Mở rương ${claimableChest.title}`
                : nextNode
                  ? `${nextNode.order}. ${nextNode.title}`
                  : "Hoàn thành lộ trình SpeakIT"}
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
              {claimableChest
                ? `Bạn đã xong 3 bước của Chương ${claimableChest.chapterNumber}. Nhận ngay +${claimableChest.rewardCoins} IT-Coin và huy hiệu "${claimableChest.achievementTitle}".`
                : nextNode?.subtitle}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {claimableChest ? (
              <button
                type="button"
                disabled={claimingId === claimableChest.chestClaimKey}
                onClick={() =>
                  void handleClaimReward(
                    claimableChest.chestClaimKey,
                    claimableChest.rewardCoins,
                    `Rương Chương ${claimableChest.chapterNumber}`
                  )
                }
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm transition-colors focus-visible:ring-2 focus-visible:ring-amber-500 disabled:opacity-60"
              >
                <Gift className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>
                  {claimingId === claimableChest.chestClaimKey
                    ? "Đang nhận…"
                    : `Nhận rương +${claimableChest.rewardCoins} IT-Coin`}
                </span>
              </button>
            ) : (
              nextNode && (
                <Link
                  href={nextNode.href}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl liquid-btn-primary text-sm font-bold focus-visible:ring-2 focus-visible:ring-blue-600"
                >
                  <Play className="w-4 h-4 fill-white shrink-0" aria-hidden="true" />
                  <span>Làm ngay ({nextNode.durationLabel})</span>
                </Link>
              )
            )}
          </div>
        </div>

        <div className="space-y-2 pt-2 border-t border-slate-200/80 dark:border-white/10">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
            <span className="text-slate-700 dark:text-slate-200 font-semibold">
              Tiến độ cốt truyện: {totalDoneNodes}/{allNodes.length} chặng
            </span>
            <span className="inline-flex items-center gap-3 tabular-nums text-slate-600 dark:text-slate-300">
              <span className="inline-flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                <span>
                  {unlockedBadges.length}/{STORY_CHAPTERS.length} huy hiệu
                </span>
              </span>
              <span className="inline-flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" aria-hidden="true" />
                <span>{stats.streakDays} ngày streak</span>
              </span>
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500 transition-transform duration-300 origin-left"
              style={{
                transform: `scaleX(${Math.max(0.04, totalDoneNodes / allNodes.length)})`,
              }}
            />
          </div>
        </div>

        {claimNotice && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-xl border border-emerald-200 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/15 px-3.5 py-2.5 text-sm font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{claimNotice}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        <div className="lg:col-span-8 space-y-3">
          {chapterStates.map((chapter) => (
            <div
              key={chapter.id}
              className="liquid-glass-card p-4 sm:p-5 space-y-3.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-mono font-bold text-blue-700 dark:text-blue-300">
                    Chương {chapter.chapterNumber} · {chapter.completedCount}/{chapter.nodes.length} bước
                  </div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-50">
                    {chapter.title}
                  </h2>
                </div>

                {chapter.isChapterDone ? (
                  chapter.isChestClaimed ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-400/40 text-xs font-mono font-bold text-emerald-700 dark:text-emerald-300 shrink-0">
                      <Check className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Đã nhận · {chapter.achievementTitle}</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={claimingId === chapter.chestClaimKey}
                      onClick={() =>
                        void handleClaimReward(
                          chapter.chestClaimKey,
                          chapter.rewardCoins,
                          `Rương Chương ${chapter.chapterNumber}`
                        )
                      }
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors focus-visible:ring-2 focus-visible:ring-amber-500 shrink-0"
                    >
                      <Gift className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Nhận rương +{chapter.rewardCoins} Coin</span>
                    </button>
                  )
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-xs font-mono text-slate-600 dark:text-slate-300 shrink-0">
                    <Lock className="w-3 h-3" aria-hidden="true" />
                    <span>+{chapter.rewardCoins} Coin</span>
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {chapter.nodes.map((node) => {
                  const isCurrent = nextNode?.id === node.id && !node.done;
                  return (
                    <Link
                      key={node.id}
                      href={node.href}
                      className={`group rounded-xl p-3.5 border transition-colors flex flex-col justify-between gap-2.5 focus-visible:ring-2 focus-visible:ring-blue-600 ${
                        node.done
                          ? "bg-emerald-50/70 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-400/35"
                          : isCurrent
                            ? "bg-blue-50/80 dark:bg-blue-500/15 border-blue-400 dark:border-blue-400/60 ring-1 ring-blue-500/25"
                            : "bg-slate-50/80 dark:bg-slate-800/60 border-slate-200 dark:border-white/10 hover:border-blue-400"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-mono font-bold shrink-0 ${
                            node.done
                              ? "bg-emerald-600 text-white"
                              : isCurrent
                                ? "bg-blue-600 text-white"
                                : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                          }`}
                        >
                          {node.done ? (
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" aria-hidden="true" />
                          ) : (
                            node.order
                          )}
                        </span>
                        <span className="text-[11px] font-mono font-semibold text-slate-600 dark:text-slate-300">
                          {node.done
                            ? "Xong"
                            : isCurrent
                              ? "Tiếp theo"
                              : node.durationLabel}
                        </span>
                      </div>

                      <div className="space-y-0.5 min-w-0">
                        <div className="text-sm font-bold text-slate-900 dark:text-slate-50 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors leading-snug">
                          {node.title}
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                          {node.subtitle}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <aside className="lg:col-span-4 space-y-3">
          <div className="liquid-glass-card p-4 sm:p-5 space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-50 flex items-center gap-2">
                <Target className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0" aria-hidden="true" />
                <span>Nhiệm vụ hôm nay</span>
              </h2>
              <span className="text-xs font-mono text-slate-600 dark:text-slate-300">
                Thưởng Coin
              </span>
            </div>

            <div className="space-y-2.5">
              {DAILY_QUESTS.map((quest) => {
                const current = hydrated ? quest.getCurrent(stats) : 0;
                const isDone = current >= quest.target;
                const dailyKey = `daily:${todayKey}:${quest.id}`;
                const isClaimed = claimedIds.includes(dailyKey);
                const pct = Math.min(100, Math.round((current / quest.target) * 100));

                return (
                  <div
                    key={quest.id}
                    className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-slate-800/50 p-3 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                        {quest.title}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-400/35 text-[11px] font-mono font-bold text-amber-800 dark:text-amber-300 shrink-0">
                        <Coins className="w-3 h-3" aria-hidden="true" />
                        <span>+{quest.rewardCoins}</span>
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-transform duration-300 origin-left ${
                            isDone ? "bg-emerald-500" : "bg-blue-600"
                          }`}
                          style={{ transform: `scaleX(${Math.max(0.02, pct / 100)})` }}
                        />
                      </div>
                      <span className="text-xs font-mono font-bold tabular-nums text-slate-600 dark:text-slate-300 shrink-0">
                        {current}/{quest.target}
                      </span>
                    </div>

                    <div className="flex justify-end">
                      {isDone ? (
                        isClaimed ? (
                          <span className="text-xs font-mono font-semibold text-emerald-700 dark:text-emerald-300 inline-flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Đã nhận thưởng</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={claimingId === dailyKey}
                            onClick={() =>
                              void handleClaimReward(
                                dailyKey,
                                quest.rewardCoins,
                                quest.title
                              )
                            }
                            className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors focus-visible:ring-2 focus-visible:ring-amber-500"
                          >
                            {claimingId === dailyKey
                              ? "Đang nhận…"
                              : `Nhận +${quest.rewardCoins} Coin`}
                          </button>
                        )
                      ) : (
                        <Link
                          href={quest.href}
                          className="text-xs font-semibold text-blue-700 dark:text-blue-300 hover:underline"
                        >
                          Đi làm ngay
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="liquid-glass-card p-4 sm:p-5 space-y-3">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-50 flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
              <span>Thành tựu lộ trình</span>
            </h2>
            <div className="space-y-2">
              {chapterStates.map((chapter) => (
                <div
                  key={chapter.id}
                  className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 border text-xs ${
                    chapter.isChapterDone
                      ? "bg-emerald-50/70 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-400/35 text-emerald-900 dark:text-emerald-200"
                      : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300"
                  }`}
                >
                  <span className="font-bold truncate">{chapter.achievementTitle}</span>
                  <span className="font-mono shrink-0">
                    {chapter.isChapterDone ? "Đã mở" : `Chương ${chapter.chapterNumber}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
