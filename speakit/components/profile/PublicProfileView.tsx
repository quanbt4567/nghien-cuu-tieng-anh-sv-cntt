"use client";

import Link from "next/link";
import {
  Award,
  Calendar,
  Coins,
  Flame,
  Gamepad2,
  Package,
  Sparkles,
  Trophy,
  User,
} from "lucide-react";
import {
  COSMETIC_CATEGORIES,
  findCosmeticById,
  type CosmeticCategory,
} from "../../lib/cosmetics";
import type { PublicProfileData } from "../../lib/public-profile";
import { CustomCursorTrail } from "../cosmetics/CustomCursorTrail";
import { DiscordAvatarFrame } from "../cosmetics/DiscordAvatarFrame";
import { FullPageProfileEffect } from "../cosmetics/FullPageProfileEffect";
import { NameplateBanner } from "../cosmetics/NameplateBanner";
import { PlayerAvatar } from "../cosmetics/PlayerAvatar";

const CATEGORY_LABELS: Record<CosmeticCategory, string> = {
  avatar_decoration: "Khung Avatar",
  profile_theme: "Hiệu ứng trang",
  nameplate: "Bảng tên",
  cursor_effect: "Con trỏ",
  leaderboard_fx: "Hiệu ứng BXH",
  victory_finisher: "Hiệu ứng chiến thắng",
};

function formatDate(iso: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatRunDate(iso: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function PublicProfileView({ profile }: { profile: PublicProfileData }) {
  const hasNameplate = Boolean(profile.equippedCosmetics.nameplate);
  const equippedBadges = COSMETIC_CATEGORIES.flatMap((category) => {
    const id = profile.equippedCosmetics[category];
    if (!id) return [];
    const item = findCosmeticById(id);
    if (!item) return [];
    return [{ category, label: CATEGORY_LABELS[category], item }];
  });

  return (
    <div className="relative min-h-screen">
      <FullPageProfileEffect themeId={profile.equippedCosmetics.profile_theme} />
      <CustomCursorTrail effectId={profile.equippedCosmetics.cursor_effect} />

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-8 space-y-6 pb-16">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/leaderboard"
            className="liquid-glass-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill text-xs font-medium transition-all"
          >
            <span>← Quay lại Bảng xếp hạng</span>
          </Link>

          <Link
            href="/profile"
            className="liquid-btn-primary inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-pill text-xs font-semibold transition-all"
          >
            <User className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Hồ sơ của tôi</span>
          </Link>
        </div>

        <section
          aria-label="Hồ sơ công khai người học"
          className="liquid-glass-card p-5 sm:p-6 space-y-5"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="flex items-center gap-4 min-w-0 flex-1">
              <DiscordAvatarFrame
                equippedId={profile.equippedCosmetics.avatar_decoration}
                fallbackRing={profile.equippedRing}
                size="xl"
              >
                <PlayerAvatar
                  avatarUrl={profile.avatarUrl}
                  displayName={profile.displayName}
                  className="text-xl"
                />
              </DiscordAvatarFrame>

              <div className="min-w-0 flex-1 space-y-2">
                <NameplateBanner
                  nameplateId={profile.equippedCosmetics.nameplate}
                  className={
                    hasNameplate
                      ? "px-3.5 py-2.5"
                      : "rounded-xl border border-white/15 px-3.5 py-2.5 bg-slate-950/55"
                  }
                >
                  <h1 className="text-lg sm:text-xl font-bold truncate text-white">
                    {profile.displayName}
                  </h1>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-300">
                    <span>{profile.equippedTitle}</span>
                    {profile.createdAt && (
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-cyan-300" aria-hidden="true" />
                        <span>Tham gia {formatDate(profile.createdAt)}</span>
                      </span>
                    )}
                  </div>
                </NameplateBanner>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-pill bg-cyan-500/20 border border-cyan-400/40 text-cyan-100 text-xs font-mono font-semibold">
                    <Award className="w-3.5 h-3.5 text-cyan-300" aria-hidden="true" />
                    <span>{profile.devTitle}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-pill bg-amber-500/20 border border-amber-400/40 text-xs font-mono font-bold text-amber-200">
                    <Flame className="w-3.5 h-3.5 fill-amber-400 text-amber-300" aria-hidden="true" />
                    <span>{profile.streakDays} ngày streak</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="md:text-right shrink-0 bg-slate-950/55 border border-white/15 rounded-xl px-4 py-3 font-mono">
              <div className="text-[11px] uppercase text-slate-400">Tổng điểm tích lũy</div>
              <div className="text-xl font-bold text-cyan-300">
                {profile.totalPoints.toLocaleString("vi-VN")} pts
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-950/50 border border-white/15 rounded-xl p-3.5 space-y-1">
              <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase text-slate-400">
                <Trophy className="w-3.5 h-3.5 text-cyan-300" aria-hidden="true" />
                <span>Tổng điểm</span>
              </div>
              <div className="text-base font-bold font-mono text-white">
                {profile.totalPoints.toLocaleString("vi-VN")}
              </div>
            </div>

            <div className="bg-slate-950/50 border border-white/15 rounded-xl p-3.5 space-y-1">
              <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase text-slate-400">
                <Coins className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
                <span>IT-Coin</span>
              </div>
              <div className="text-base font-bold font-mono text-amber-200">
                {profile.itCoins.toLocaleString("vi-VN")}
              </div>
            </div>

            <div className="bg-slate-950/50 border border-white/15 rounded-xl p-3.5 space-y-1">
              <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase text-slate-400">
                <Flame className="w-3.5 h-3.5 text-emerald-300" aria-hidden="true" />
                <span>Streak</span>
              </div>
              <div className="text-base font-bold font-mono text-emerald-200">
                {profile.streakDays} ngày
              </div>
            </div>

            <div className="bg-slate-950/50 border border-white/15 rounded-xl p-3.5 space-y-1">
              <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase text-slate-400">
                <Package className="w-3.5 h-3.5 text-violet-300" aria-hidden="true" />
                <span>Vật phẩm sở hữu</span>
              </div>
              <div className="text-base font-bold font-mono text-white">
                {profile.ownedCount}
              </div>
            </div>
          </div>
        </section>

        <section
          aria-label="Trang bị hiệu ứng đang dùng"
          className="liquid-glass-card p-5 space-y-3"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-300" aria-hidden="true" />
              <span>Trang bị hiệu ứng đang dùng</span>
            </h2>
            <span className="text-[11px] font-mono text-slate-400">
              {equippedBadges.length} đang bật
            </span>
          </div>

          {equippedBadges.length === 0 ? (
            <p className="text-xs text-slate-300 bg-slate-950/50 border border-white/12 rounded-xl p-3.5">
              Người chơi này chưa trang bị hiệu ứng Discord-style nào.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {equippedBadges.map(({ category, label, item }) => (
                <span
                  key={category}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-slate-950/55 border border-white/15 text-xs font-medium text-white"
                >
                  <span className="text-[10px] font-mono uppercase text-slate-400">
                    {label}:
                  </span>
                  <span className="font-semibold text-cyan-200">{item.name}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-pill bg-white/[0.08] border border-white/15 text-amber-200">
                    {item.rarity}
                  </span>
                </span>
              ))}
            </div>
          )}
        </section>

        <section
          aria-label="Lịch sử đấu Arena gần đây"
          className="liquid-glass-card p-5 space-y-3"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
              <Gamepad2 className="w-4 h-4 text-emerald-300" aria-hidden="true" />
              <span>Trận Arena gần đây</span>
            </h2>
            <span className="text-[11px] font-mono text-slate-400">
              {profile.recentArenaRuns.length} trận
            </span>
          </div>

          {profile.recentArenaRuns.length === 0 ? (
            <p className="text-xs text-slate-300 bg-slate-950/50 border border-white/12 rounded-xl p-3.5">
              Chưa có trận Arena nào được ghi nhận công khai.
            </p>
          ) : (
            <div className="space-y-2">
              {profile.recentArenaRuns.map((run) => (
                <div
                  key={run.id}
                  className="liquid-glass-card-lite p-3 space-y-1 border-white/12"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                      <Gamepad2 className="w-3.5 h-3.5 text-emerald-300 shrink-0" aria-hidden="true" />
                      <span>
                        {run.gameId === "bug-buster"
                          ? "Bug Buster Arena"
                          : run.gameId === "standup-speed-run"
                          ? "Standup Speed Run"
                          : run.gameId}
                      </span>
                      {run.role && (
                        <span className="px-2 py-0.5 rounded-pill bg-white/[0.08] border border-white/15 text-[10px] font-mono text-slate-300 uppercase">
                          {run.role}
                        </span>
                      )}
                    </span>
                    <span className="px-2 py-0.5 rounded-pill bg-emerald-500/20 border border-emerald-400/40 text-[11px] font-mono font-bold text-emerald-200 shrink-0">
                      {run.score.toLocaleString("vi-VN")} pts
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-slate-400">
                    <span>
                      {run.gameId === "bug-buster"
                        ? `${run.accuracyOrWords}% chính xác`
                        : `${run.accuracyOrWords} từ khóa`}
                    </span>
                    <span className="flex items-center gap-2 shrink-0">
                      {run.durationSec > 0 && <span>Thời lượng: {run.durationSec}s</span>}
                      <span>{formatRunDate(run.createdAt)}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
