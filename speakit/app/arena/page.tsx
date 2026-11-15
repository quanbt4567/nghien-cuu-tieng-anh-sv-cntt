"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Bug,
  Coins,
  Flame,
  Gamepad2,
  Globe,
  ShoppingBag,
  Siren,
  Timer,
  Trophy,
  UserCog,
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

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-white text-ink text-xs font-medium border border-ink/15 shadow-soft hover:bg-paper-muted shadow-hard-press transition-all"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Trang chủ</span>
        </Link>

        <div className="flex items-center gap-2.5">
          <Link
            href="/shop"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-pill bg-[#FAF6EF] text-[#1A1714] text-xs font-bold border-2 border-[#1A1714] shadow-[4px_4px_0_#1A1714] hover:bg-[#E5484D] hover:text-white transition-all"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Cửa hàng Hiệu ứng</span>
          </Link>
        </div>
      </div>

      {/* Arena Header Card */}
      <section className="bg-white border border-ink/15 rounded-2xl p-5 sm:p-6 shadow-soft space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <h1 className="text-2xl font-bold tracking-tight text-ink flex items-center gap-2">
              <Gamepad2 className="w-6 h-6 text-accent shrink-0" />
              <span>IT Speaking Arena</span>
            </h1>
            <p className="text-xs sm:text-sm text-ink-muted">
              Luyện phản xạ nói tiếng Anh CNTT theo thời gian thực để tích lũy
              IT-Coin và nâng hạng Dev Speaker.
            </p>
          </div>

          {/* Badges: Streak Flame, Dev Title, Role */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-paper border border-ink/15 text-xs font-mono font-bold text-ink">
              <Flame className="w-4 h-4 fill-accent text-accent" />
              <span>{identity.streakDays} ngày</span>
            </span>

            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-ink text-white text-xs font-mono font-semibold">
              <Award className="w-3.5 h-3.5 text-accent" />
              <span>{devTitle.title}</span>
            </span>

            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-paper border border-ink/15 text-xs font-mono font-semibold text-ink">
              <UserCog className="w-3.5 h-3.5 text-accent shrink-0" />
              <span className="sr-only">Vai trò CNTT</span>
              <select
                value={state.selectedRole}
                onChange={(e) => handleRoleChange(e.target.value as ITRole)}
                aria-label="Chọn vai trò CNTT"
                className="bg-transparent focus:outline-none cursor-pointer font-mono text-xs text-ink"
              >
                {IT_ROLES.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* IT-Coins & Progress toward next Coin (1000 pts = 1 IT-Coin) */}
        <div className="bg-paper border border-ink/15 rounded-2xl p-4 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-accent-light border border-accent/30 flex items-center justify-center">
                <Coins className="w-4 h-4 text-accent" />
              </div>
              <div>
                <div className="text-sm font-bold text-ink font-mono">
                  Số dư IT-Coin: {coins}
                </div>
                <div className="text-[11px] text-ink-muted">
                  1.000 điểm = 1 IT-Coin • Vai trò hiện tại:{" "}
                  <strong className="text-ink">{roleLabel}</strong>
                </div>
              </div>
            </div>

            <div className="text-right font-mono text-xs">
              <div className="font-bold text-ink">
                {coinRemainder} / {POINTS_PER_COIN} điểm
              </div>
              <div className="text-[11px] text-ink-muted">
                Còn {toNextCoin} điểm để nhận +1 IT-Coin
              </div>
            </div>
          </div>

          <div className="w-full h-2.5 bg-white rounded-pill border border-ink/15 overflow-hidden">
            <div
              className="h-full bg-accent transition-all duration-500"
              style={{ width: `${Math.max(2, coinProgressPct)}%` }}
            />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="/arena/party"
          className="md:col-span-2 group bg-[#FAF6EF] border-2 border-[#1A1714] rounded-2xl p-5 shadow-[4px_4px_0_#1A1714] hover:translate-x-[1px] hover:translate-y-[1px] transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#E5484D] text-white border-2 border-[#1A1714] flex items-center justify-center shrink-0">
              <Siren className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-pill bg-[#E5484D]/10 text-[#E5484D] border border-[#E5484D]/30 text-[10px] font-mono font-bold uppercase">
                Live Co-op Mode
              </div>
              <h2 className="text-base sm:text-lg font-bold text-[#1A1714]">
                Outage At 3AM (Party Mode)
              </h2>
              <p className="text-xs text-[#1A1714]/75">
                Phối hợp xử lý sự cố production khẩn cấp theo nhóm với phản xạ tiếng Anh CNTT.
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-pill bg-[#E5484D] text-white border-2 border-[#1A1714] text-xs font-bold shrink-0 self-start sm:self-center">
            <span>Mở Party Mode</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </Link>

        <Link
          href="/shop"
          className="group bg-white border-2 border-[#1A1714] rounded-2xl p-5 shadow-[4px_4px_0_#1A1714] hover:bg-[#FAF6EF] transition-all flex flex-col justify-between gap-3"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FAF6EF] text-[#E5484D] border-2 border-[#1A1714] flex items-center justify-center shrink-0">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-bold text-[#1A1714]">
                Cửa hàng Hiệu ứng
              </h2>
              <p className="text-xs text-[#1A1714]/75">
                Dùng IT-Coin mở khóa khung avatar, nameplate và hiệu ứng bảng xếp hạng.
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#E5484D] self-end">
            <span>Vào cửa hàng</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </Link>
      </section>

      <div
        role="tablist"
        aria-label="Chế độ IT Speaking Arena"
        className="flex flex-wrap gap-2"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "bug-buster"}
          onClick={() => setActiveTab("bug-buster")}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-pill text-xs sm:text-sm font-semibold border transition-all ${
            activeTab === "bug-buster"
              ? "bg-ink text-white border-ink shadow-soft"
              : "bg-white text-ink border-ink/15 hover:bg-paper-muted shadow-soft"
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
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-pill text-xs sm:text-sm font-semibold border transition-all ${
            activeTab === "standup-speed-run"
              ? "bg-ink text-white border-ink shadow-soft"
              : "bg-white text-ink border-ink/15 hover:bg-paper-muted shadow-soft"
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
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-pill text-xs sm:text-sm font-semibold border transition-all ${
            activeTab === "leaderboard"
              ? "bg-ink text-white border-ink shadow-soft"
              : "bg-white text-ink border-ink/15 hover:bg-paper-muted shadow-soft"
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
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-pill text-xs sm:text-sm font-semibold border transition-all ${
            activeTab === "global-leaderboard"
              ? "bg-accent text-white border-accent shadow-soft"
              : "bg-white text-ink border-ink/15 hover:bg-paper-muted shadow-soft"
          }`}
        >
          <Globe className="w-4 h-4" />
          <span>Bảng xếp hạng Toàn cầu</span>
        </button>
      </div>

      {/* Active Tab Panel */}
      {activeTab === "bug-buster" && <BugBusterGame role={state.selectedRole} />}
      {activeTab === "standup-speed-run" && (
        <StandupSpeedRun role={state.selectedRole} />
      )}
      {activeTab === "leaderboard" && <LocalLeaderboard state={state} />}
      {activeTab === "global-leaderboard" && <GlobalLeaderboard />}
    </div>
  );
}
