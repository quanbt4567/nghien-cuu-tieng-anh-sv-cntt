"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Bomb,
  Bot,
  Bug,
  Coins,
  Flame,
  Gamepad2,
  Globe,
  MessageSquare,
  ShoppingBag,
  Siren,
  Swords,
  Timer,
  Trophy,
  UserCog,
  type LucideIcon,
} from "lucide-react";
import { initOrHydrateGuestSession } from "../../app/actions/leaderboard";
import { BugBusterGame } from "../../components/arena/BugBusterGame";
import { LocalLeaderboard } from "../../components/arena/LocalLeaderboard";
import { StandupSpeedRun } from "../../components/arena/StandupSpeedRun";
import { GlobalLeaderboard } from "../../components/leaderboard/GlobalLeaderboard";
import { IT_ROLES } from "../../data/minigames";
import type { PublicGuestPlayer } from "../../lib/db";
import {
  GAMIFICATION_STORAGE_KEY,
  GAMIFICATION_UPDATED_EVENT,
  POINTS_PER_COIN,
  getDevTitle,
  getGamificationState,
  pointsToNextCoin,
  setSelectedRole,
} from "../../lib/gamification";
import {
  GUEST_PROFILE_CACHE_KEY,
  GUEST_PROFILE_UPDATED_EVENT,
  readBackupTransferCode,
  readCachedGuestProfile,
  saveCachedGuestProfile,
} from "../../lib/guestClient";
import { mergeProfileIdentity } from "../../lib/profileStats";
import { GamificationState, ITRole } from "../../lib/types";

type ArenaTab =
  | "bug-buster"
  | "standup-speed-run"
  | "leaderboard"
  | "global-leaderboard";

type InlineGameTab = Extract<ArenaTab, "bug-buster" | "standup-speed-run">;

type ArenaModeCard = {
  id: string;
  title: string;
  playersTag: string;
  rewardBadge: string;
  description: string;
  ctaLabel: string;
  icon: LucideIcon;
  badgeTone: string;
  buttonTone: string;
  cardAccent: string;
  href?: string;
  tab?: InlineGameTab;
};

const ARENA_SHOWCASE_MODES: ArenaModeCard[] = [
  {
    id: "party",
    title: "Outage At 3AM (Party Mode)",
    playersTag: "Co-op / AI Teammates",
    rewardBadge: "+15-25 IT-Coins",
    description:
      "Phối hợp xử lý sự cố production khẩn cấp theo nhóm với phản xạ tiếng Anh CNTT.",
    ctaLabel: "Mở Party Mode",
    icon: Siren,
    badgeTone:
      "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800",
    buttonTone: "liquid-btn-danger",
    cardAccent: "hover:border-red-300 dark:hover:border-red-700",
    href: "/arena/party",
  },
  {
    id: "duel",
    title: "Code Review Duel",
    playersTag: "1v1 PvP / AI Bot",
    rewardBadge: "+12 IT-Coins",
    description:
      "Tranh luận bảo vệ PR hoặc review code 1v1 theo lượt, phản biện trực tiếp bằng tiếng Anh.",
    ctaLabel: "Vào Duel",
    icon: Swords,
    badgeTone:
      "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
    buttonTone: "liquid-btn-primary",
    cardAccent: "hover:border-blue-300 dark:hover:border-blue-700",
    href: "/arena/duel",
  },
  {
    id: "taboo",
    title: "Explain It Like I'm 5",
    playersTag: "Party / AI Guesser",
    rewardBadge: "+10 IT-Coins",
    description:
      "Giải thích khái niệm CNTT thật dễ hiểu mà không chạm từ cấm để AI hoặc đồng đội đoán đúng.",
    ctaLabel: "Chơi Explain It Like I'm 5",
    icon: MessageSquare,
    badgeTone:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
    buttonTone:
      "bg-amber-700 hover:bg-amber-800 text-white border border-amber-700 dark:bg-amber-600 dark:hover:bg-amber-500",
    cardAccent: "hover:border-amber-300 dark:hover:border-amber-700",
    href: "/arena/explain-it-like-im-5",
  },
  {
    id: "word-chain",
    title: "Syntax Bomb: Tech Word Chain",
    playersTag: "Speed / AI Bot",
    rewardBadge: "+8 IT-Coins",
    description:
      "Nối nhanh thuật ngữ IT theo chữ cái cuối trước khi bom máy chủ nổ, tích combo rút dây cháy.",
    ctaLabel: "Vào Syntax Bomb",
    icon: Bomb,
    badgeTone:
      "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
    buttonTone: "liquid-btn-primary",
    cardAccent: "hover:border-blue-300 dark:hover:border-blue-700",
    href: "/arena/syntax-bomb",
  },
  {
    id: "bug-buster",
    title: "Bug Buster 280s",
    playersTag: "Solo / Phản xạ 280s",
    rewardBadge: "+2-5 IT-Coins",
    description:
      "Đọc và nói đúng từ khóa kỹ thuật còn thiếu trong 280 giây để vá nhanh hàng loạt bug.",
    ctaLabel: "Mở Bug Buster",
    icon: Bug,
    badgeTone:
      "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800",
    buttonTone: "liquid-btn-success",
    cardAccent: "hover:border-green-300 dark:hover:border-green-700",
    tab: "bug-buster",
  },
  {
    id: "standup-speed-run",
    title: "Standup Speed Run",
    playersTag: "Solo / AI Chấm điểm",
    rewardBadge: "+1-2 IT-Coins",
    description:
      "Trả lời 3 câu hỏi Daily Standup trong 25 giây mỗi lượt để luyện phản xạ nói gọn gàng.",
    ctaLabel: "Mở Speed Run",
    icon: Timer,
    badgeTone:
      "bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700",
    buttonTone: "liquid-btn-primary",
    cardAccent: "hover:border-blue-300 dark:hover:border-blue-700",
    tab: "standup-speed-run",
  },
];

const INITIAL_SSR_STATE: GamificationState = {
  totalPoints: 0,
  streakDays: 0,
  lastPracticeDate: null,
  selectedRole: "frontend",
  personalBests: {
    "bug-buster": 0,
    "standup-speed-run": 0,
  },
  history: [],
};

export default function ArenaPage() {
  const [activeTab, setActiveTab] = useState<ArenaTab>("bug-buster");
  const [state, setState] = useState<GamificationState>(INITIAL_SSR_STATE);
  const [guestPlayer, setGuestPlayer] = useState<PublicGuestPlayer | null>(null);
  const tabSectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;

    const syncState = () => {
      if (!active) return;
      setState(getGamificationState());
    };

    const syncCachedGuest = () => {
      if (!active) return;
      const cached = readCachedGuestProfile();
      if (cached) {
        setGuestPlayer(cached);
      }
    };

    syncState();
    syncCachedGuest();

    const hydrateCloudGuest = async () => {
      try {
        const session = await initOrHydrateGuestSession(readBackupTransferCode());
        if (!active) return;
        if (session.mode === "online" && session.player) {
          setGuestPlayer(session.player);
          saveCachedGuestProfile(session.player);
        } else if (!readCachedGuestProfile()) {
          setGuestPlayer(null);
        }
      } catch {
      }
    };

    void hydrateCloudGuest();

    const handleStorage = (event: StorageEvent) => {
      if (event.key === GAMIFICATION_STORAGE_KEY || event.key === null) {
        syncState();
      }
      if (event.key === GUEST_PROFILE_CACHE_KEY || event.key === null) {
        syncCachedGuest();
      }
    };

    window.addEventListener(GAMIFICATION_UPDATED_EVENT, syncState);
    window.addEventListener(GUEST_PROFILE_UPDATED_EVENT, syncCachedGuest);
    window.addEventListener("storage", handleStorage);
    return () => {
      active = false;
      window.removeEventListener(GAMIFICATION_UPDATED_EVENT, syncState);
      window.removeEventListener(GUEST_PROFILE_UPDATED_EVENT, syncCachedGuest);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const identity = mergeProfileIdentity(guestPlayer, state);
  const coins = identity.itCoins;
  const toNextCoin = pointsToNextCoin(identity.totalPoints);
  const coinRemainder = POINTS_PER_COIN - toNextCoin;
  const coinProgressPct = Math.round((coinRemainder / POINTS_PER_COIN) * 100);
  const devTitle = getDevTitle(identity.totalPoints);
  const roleLabel =
    IT_ROLES.find((r) => r.id === state.selectedRole)?.label ?? "Frontend";

  const handleRoleChange = (role: ITRole) => {
    setState(setSelectedRole(role));
  };

  const handleSelectInlineMode = (tab: InlineGameTab) => {
    setActiveTab(tab);
    tabSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const renderModeCardContent = (mode: ArenaModeCard, isInlineActive: boolean) => {
    const Icon = mode.icon;
    return (
      <>
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div
              className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${mode.badgeTone}`}
            >
              <Icon className="w-5 h-5" />
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 text-xs font-mono font-bold shrink-0">
              <Coins className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
              <span>{mode.rewardBadge}</span>
            </span>
          </div>

          <div className="space-y-1.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 text-xs font-mono font-semibold text-slate-700 dark:text-slate-300 uppercase">
              <Bot className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
              <span>{mode.playersTag}</span>
            </span>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 leading-snug">
              {mode.title}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {mode.description}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <span className="text-xs font-mono font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">
            {mode.href ? "Phòng chơi riêng" : "Chơi trực tiếp bên dưới"}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-colors ${mode.buttonTone} ${
              isInlineActive ? "ring-2 ring-blue-600/60" : ""
            }`}
          >
            <span>{isInlineActive ? "Đang mở" : mode.ctaLabel}</span>
          </span>
        </div>
      </>
    );
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/"
          className="liquid-glass-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Trang chủ</span>
        </Link>

        <div className="flex items-center gap-2.5">
          <Link
            href="/shop"
            className="liquid-btn-primary inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-bold transition-colors"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Cửa hàng Hiệu ứng</span>
          </Link>
        </div>
      </div>

      <section className="liquid-glass-card p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Gamepad2 className="w-6 h-6 text-blue-700 dark:text-blue-400 shrink-0" />
              <span>IT Speaking Arena</span>
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Luyện phản xạ nói tiếng Anh CNTT theo thời gian thực để tích lũy
              IT-Coin và nâng hạng Dev Speaker.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-800 text-xs font-mono font-bold text-amber-700 dark:text-amber-300">
              <Flame className="w-4 h-4 fill-amber-500 text-amber-600 dark:text-amber-400" />
              <span>{identity.streakDays} ngày</span>
            </span>

            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 dark:bg-blue-950/40 dark:border-blue-800 text-xs font-mono font-semibold text-blue-800 dark:text-blue-300">
              <Award className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
              <span>{devTitle.title}</span>
            </span>

            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-300 dark:bg-slate-800 dark:border-slate-700 text-xs font-mono font-semibold text-slate-900 dark:text-slate-100">
              <UserCog className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400 shrink-0" />
              <span className="sr-only">Vai trò CNTT</span>
              <select
                value={state.selectedRole}
                onChange={(e) => handleRoleChange(e.target.value as ITRole)}
                aria-label="Chọn vai trò CNTT"
                className="bg-transparent focus:outline-none cursor-pointer font-mono text-xs text-slate-900 dark:text-slate-100"
              >
                {IT_ROLES.map((r) => (
                  <option key={r.id} value={r.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-amber-50 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-800 flex items-center justify-center">
                <Coins className="w-4 h-4 text-amber-700 dark:text-amber-400" />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100 font-mono">
                  Số dư IT-Coin: {coins}
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-300">
                  1.000 điểm = 1 IT-Coin, Vai trò hiện tại:{" "}
                  <strong className="text-blue-700 dark:text-blue-400">{roleLabel}</strong>
                </div>
              </div>
            </div>

            <div className="text-right font-mono text-xs">
              <div className="font-bold text-slate-900 dark:text-slate-100">
                {coinRemainder} / {POINTS_PER_COIN} điểm
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400">
                Còn {toNextCoin} điểm để nhận +1 IT-Coin
              </div>
            </div>
          </div>

          <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-800 rounded-full border border-slate-300 dark:border-slate-700 overflow-hidden">
            <div
              className="w-full h-full origin-left bg-blue-700 dark:bg-blue-600 transition-transform duration-500"
              style={{ transform: `scaleX(${Math.max(0.02, coinProgressPct / 100)})` }}
            />
          </div>
        </div>
      </section>

      <section className="space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-0.5">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
              6 Chế độ Đấu trường SpeakIT
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Chọn phòng Co-op / PvP đấu AI Bot hoặc luyện tập tốc độ trực tiếp ngay bên dưới.
            </p>
          </div>
          <Link
            href="/shop"
            className="liquid-glass-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors"
          >
            <ShoppingBag className="w-4 h-4 text-amber-700 dark:text-amber-400" />
            <span>Đổi quà tại Shop</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ARENA_SHOWCASE_MODES.map((mode) => {
            const isInlineActive = Boolean(mode.tab && activeTab === mode.tab);
            const cardClass = `group liquid-glass-card text-left p-4 sm:p-5 hover:-translate-y-0.5 transition-transform flex flex-col justify-between gap-4 ${mode.cardAccent} ${
              isInlineActive ? "ring-2 ring-blue-600/60 border-blue-600" : ""
            }`;

            if (mode.href) {
              return (
                <Link key={mode.id} href={mode.href} className={cardClass}>
                  {renderModeCardContent(mode, false)}
                </Link>
              );
            }

            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => handleSelectInlineMode(mode.tab!)}
                className={cardClass}
              >
                {renderModeCardContent(mode, isInlineActive)}
              </button>
            );
          })}
        </div>
      </section>

      <div
        ref={tabSectionRef}
        role="tablist"
        aria-label="Chế độ IT Speaking Arena"
        className="inline-flex w-fit max-w-full flex-wrap gap-2 scroll-mt-4"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "bug-buster"}
          onClick={() => setActiveTab("bug-buster")}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            activeTab === "bug-buster"
              ? "liquid-btn-success"
              : "liquid-glass-btn text-slate-700 dark:text-slate-200 hover:border-blue-400"
          }`}
        >
          <Bug className="w-4 h-4" />
          <span>Bug Buster 280s</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "standup-speed-run"}
          onClick={() => setActiveTab("standup-speed-run")}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            activeTab === "standup-speed-run"
              ? "liquid-btn-primary"
              : "liquid-glass-btn text-slate-700 dark:text-slate-200 hover:border-blue-400"
          }`}
        >
          <Timer className="w-4 h-4" />
          <span>Standup Speed Run</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "leaderboard"}
          onClick={() => setActiveTab("leaderboard")}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            activeTab === "leaderboard"
              ? "liquid-btn-primary"
              : "liquid-glass-btn text-slate-700 dark:text-slate-200 hover:border-blue-400"
          }`}
        >
          <Trophy className="w-4 h-4" />
          <span>Xếp hạng & Danh hiệu</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "global-leaderboard"}
          onClick={() => setActiveTab("global-leaderboard")}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            activeTab === "global-leaderboard"
              ? "liquid-btn-primary"
              : "liquid-glass-btn text-slate-700 dark:text-slate-200 hover:border-blue-400"
          }`}
        >
          <Globe className="w-4 h-4" />
          <span>Bảng xếp hạng</span>
        </button>
      </div>

      {activeTab === "bug-buster" && <BugBusterGame role={state.selectedRole} />}
      {activeTab === "standup-speed-run" && (
        <StandupSpeedRun role={state.selectedRole} />
      )}
      {activeTab === "leaderboard" && <LocalLeaderboard state={state} />}
      {activeTab === "global-leaderboard" && <GlobalLeaderboard />}
    </div>
  );
}
