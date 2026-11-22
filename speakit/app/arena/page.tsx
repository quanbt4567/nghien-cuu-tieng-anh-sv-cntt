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
    badgeTone: "bg-rose-100 text-rose-700 border-rose-300/80",
    buttonTone: "liquid-btn-danger",
    cardAccent: "hover:border-rose-400/60",
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
    badgeTone: "bg-violet-100 text-violet-700 border-violet-300/80",
    buttonTone:
      "bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-500 hover:to-purple-600 text-white border border-violet-300/60 shadow-[0_8px_20px_rgba(139,92,246,0.34),inset_0_1px_1px_rgba(255,255,255,0.45)]",
    cardAccent: "hover:border-violet-400/60",
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
    badgeTone: "bg-amber-100 text-amber-700 border-amber-300/80",
    buttonTone:
      "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-500 hover:to-orange-500 text-white border border-amber-300/60 shadow-[0_8px_20px_rgba(245,158,11,0.34),inset_0_1px_1px_rgba(255,255,255,0.45)]",
    cardAccent: "hover:border-amber-400/60",
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
    badgeTone: "bg-sky-100 text-sky-700 border-sky-300/80",
    buttonTone: "liquid-btn-primary",
    cardAccent: "hover:border-sky-400/60",
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
    badgeTone: "bg-emerald-100 text-emerald-700 border-emerald-300/80",
    buttonTone: "liquid-btn-success",
    cardAccent: "hover:border-emerald-400/60",
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
    badgeTone: "bg-indigo-100 text-indigo-700 border-indigo-300/80",
    buttonTone:
      "bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-500 hover:to-blue-600 text-white border border-indigo-300/60 shadow-[0_8px_20px_rgba(99,102,241,0.34),inset_0_1px_1px_rgba(255,255,255,0.45)]",
    cardAccent: "hover:border-indigo-400/60",
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
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-pill bg-amber-100/90 text-amber-800 border border-amber-300/80 text-[11px] font-mono font-bold shrink-0">
              <Coins className="w-3 h-3 text-amber-600" />
              <span>{mode.rewardBadge}</span>
            </span>
          </div>

          <div className="space-y-1.5">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-pill bg-slate-100/90 border border-slate-200/85 text-[10px] font-mono font-bold text-slate-700 uppercase">
              <Bot className="w-3 h-3 text-sky-600" />
              <span>{mode.playersTag}</span>
            </span>
            <h2 className="text-base font-bold text-slate-900 leading-snug">
              {mode.title}
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              {mode.description}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-[11px] font-mono font-semibold text-slate-600">
            {mode.href ? "Phòng chơi riêng" : "Chơi trực tiếp bên dưới"}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-pill text-xs font-bold shrink-0 transition-all ${mode.buttonTone} ${
              isInlineActive ? "ring-2 ring-sky-400/70" : ""
            }`}
          >
            <span>{isInlineActive ? "Đang mở" : mode.ctaLabel}</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
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
          className="liquid-glass-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill text-xs font-medium transition-all"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Trang chủ</span>
        </Link>

        <div className="flex items-center gap-2.5">
          <Link
            href="/shop"
            className="liquid-btn-primary inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-pill text-xs font-bold transition-all"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Cửa hàng Hiệu ứng</span>
          </Link>
        </div>
      </div>

      <section className="liquid-glass-card p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <Gamepad2 className="w-6 h-6 text-sky-600 shrink-0" />
              <span>IT Speaking Arena</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-600">
              Luyện phản xạ nói tiếng Anh CNTT theo thời gian thực để tích lũy
              IT-Coin và nâng hạng Dev Speaker.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="liquid-glass-pill inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-bold text-amber-700">
              <Flame className="w-4 h-4 fill-amber-500 text-amber-500" />
              <span>{identity.streakDays} ngày</span>
            </span>

            <span className="liquid-glass-pill inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-semibold text-sky-800 border-sky-300/70">
              <Award className="w-3.5 h-3.5 text-sky-600" />
              <span>{devTitle.title}</span>
            </span>

            <label className="liquid-glass-pill inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-semibold text-slate-900">
              <UserCog className="w-3.5 h-3.5 text-sky-600 shrink-0" />
              <span className="sr-only">Vai trò CNTT</span>
              <select
                value={state.selectedRole}
                onChange={(e) => handleRoleChange(e.target.value as ITRole)}
                aria-label="Chọn vai trò CNTT"
                className="bg-transparent focus:outline-none cursor-pointer font-mono text-xs text-slate-900"
              >
                {IT_ROLES.map((r) => (
                  <option key={r.id} value={r.id} className="bg-white text-slate-900">
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="bg-white/80 border border-slate-200/85 rounded-2xl p-4 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-amber-100 border border-amber-300/80 flex items-center justify-center">
                <Coins className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900 font-mono">
                  Số dư IT-Coin: {coins}
                </div>
                <div className="text-[11px] text-slate-600">
                  1.000 điểm = 1 IT-Coin • Vai trò hiện tại:{" "}
                  <strong className="text-sky-700">{roleLabel}</strong>
                </div>
              </div>
            </div>

            <div className="text-right font-mono text-xs">
              <div className="font-bold text-slate-900">
                {coinRemainder} / {POINTS_PER_COIN} điểm
              </div>
              <div className="text-[11px] text-slate-600">
                Còn {toNextCoin} điểm để nhận +1 IT-Coin
              </div>
            </div>
          </div>

          <div className="w-full h-2.5 bg-slate-200/80 rounded-pill border border-slate-300/70 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-sky-500 to-blue-600 transition-all duration-500"
              style={{ width: `${Math.max(2, coinProgressPct)}%` }}
            />
          </div>
        </div>
      </section>

      <section className="space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-0.5">
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              6 Chế độ Đấu trường SpeakIT
            </h2>
            <p className="text-xs text-slate-600">
              Chọn phòng Co-op / PvP đấu AI Bot hoặc luyện tập tốc độ trực tiếp ngay bên dưới.
            </p>
          </div>
          <Link
            href="/shop"
            className="liquid-glass-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill text-xs font-bold transition-all"
          >
            <ShoppingBag className="w-3.5 h-3.5 text-amber-600" />
            <span>Đổi quà tại Shop</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ARENA_SHOWCASE_MODES.map((mode) => {
            const isInlineActive = Boolean(mode.tab && activeTab === mode.tab);
            const cardClass = `group liquid-glass-card text-left p-4 sm:p-5 hover:-translate-y-0.5 transition-all flex flex-col justify-between gap-4 ${mode.cardAccent} ${
              isInlineActive ? "ring-2 ring-sky-400/70 border-sky-400/60" : ""
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
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-pill text-xs sm:text-sm font-semibold transition-all ${
            activeTab === "bug-buster"
              ? "liquid-btn-success"
              : "liquid-glass-pill text-slate-700 hover:text-slate-900 hover:border-sky-300/70"
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
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-pill text-xs sm:text-sm font-semibold transition-all ${
            activeTab === "standup-speed-run"
              ? "bg-gradient-to-r from-indigo-500 to-blue-600 text-white border border-indigo-300/60 shadow-[0_8px_20px_rgba(99,102,241,0.34),inset_0_1px_1px_rgba(255,255,255,0.45)]"
              : "liquid-glass-pill text-slate-700 hover:text-slate-900 hover:border-sky-300/70"
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
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-pill text-xs sm:text-sm font-semibold transition-all ${
            activeTab === "leaderboard"
              ? "liquid-btn-primary"
              : "liquid-glass-pill text-slate-700 hover:text-slate-900 hover:border-sky-300/70"
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
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-pill text-xs sm:text-sm font-semibold transition-all ${
            activeTab === "global-leaderboard"
              ? "liquid-btn-primary"
              : "liquid-glass-pill text-slate-700 hover:text-slate-900 hover:border-sky-300/70"
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
