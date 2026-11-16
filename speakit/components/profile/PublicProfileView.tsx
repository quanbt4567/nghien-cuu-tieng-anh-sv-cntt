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
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-white text-ink text-xs font-medium border border-ink/15 shadow-soft hover:bg-paper-muted transition-colors"
          >
            <span>← Quay lại Bảng xếp hạng</span>
          </Link>

          <Link
            href="/profile"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-ink text-white text-xs font-semibold border border-ink shadow-soft hover:bg-ink/90 transition-colors"
          >
            <User className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
            <span>Hồ sơ của tôi</span>
          </Link>
        </div>

        <section
          aria-label="Hồ sơ công khai người học"
          className="bg-white/95 border border-ink/15 rounded-2xl p-5 sm:p-6 shadow-soft space-y-5"
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
                      : "rounded-xl border border-ink/15 px-3.5 py-2.5 bg-paper"
                  }
                >
                  <h1
                    className={`text-lg sm:text-xl font-bold truncate ${
                      hasNameplate ? "text-white" : "text-ink"
                    }`}
                  >
                    {profile.displayName}
                  </h1>
                  <div
                    className={`flex flex-wrap items-center gap-2 text-xs font-mono ${
                      hasNameplate ? "text-zinc-200" : "text-ink-muted"
                    }`}
                  >
                    <span>{profile.equippedTitle}</span>
                    {profile.createdAt && (
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3 h-3" aria-hidden="true" />
                        <span>Tham gia {formatDate(profile.createdAt)}</span>
                      </span>
                    )}
                  </div>
                </NameplateBanner>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-pill bg-ink text-white text-xs font-mono font-semibold">
                    <Award className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
                    <span>{profile.devTitle}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-pill bg-accent-light border border-accent/30 text-xs font-mono font-bold text-accent">
                    <Flame className="w-3.5 h-3.5 fill-accent text-accent" aria-hidden="true" />
                    <span>{profile.streakDays} ngày streak</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="md:text-right shrink-0 bg-paper border border-ink/15 rounded-xl px-4 py-3 font-mono">
              <div className="text-[11px] uppercase text-ink-muted">Tổng điểm tích lũy</div>
              <div className="text-xl font-bold text-ink">
                {profile.totalPoints.toLocaleString("vi-VN")} pts
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-paper border border-ink/15 rounded-xl p-3.5 space-y-1">
              <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase text-ink-muted">
                <Trophy className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
                <span>Tổng điểm</span>
              </div>
              <div className="text-base font-bold font-mono text-ink">
                {profile.totalPoints.toLocaleString("vi-VN")}
              </div>
            </div>

            <div className="bg-paper border border-ink/15 rounded-xl p-3.5 space-y-1">
              <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase text-ink-muted">
                <Coins className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
                <span>IT-Coin</span>
              </div>
              <div className="text-base font-bold font-mono text-ink">
                {profile.itCoins.toLocaleString("vi-VN")}
              </div>
            </div>

            <div className="bg-paper border border-ink/15 rounded-xl p-3.5 space-y-1">
              <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase text-ink-muted">
                <Flame className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
                <span>Streak</span>
              </div>
              <div className="text-base font-bold font-mono text-ink">
                {profile.streakDays} ngày
              </div>
            </div>

            <div className="bg-paper border border-ink/15 rounded-xl p-3.5 space-y-1">
              <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase text-ink-muted">
                <Package className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
                <span>Vật phẩm sở hữu</span>
              </div>
              <div className="text-base font-bold font-mono text-ink">
                {profile.ownedCount}
              </div>
            </div>
          </div>
        </section>

        <section
          aria-label="Trang bị hiệu ứng đang dùng"
          className="bg-white/95 border border-ink/15 rounded-2xl p-5 shadow-soft space-y-3"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-ink uppercase tracking-wider font-mono flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-accent" aria-hidden="true" />
              <span>Trang bị hiệu ứng đang dùng</span>
            </h2>
            <span className="text-[11px] font-mono text-ink-muted">
              {equippedBadges.length} đang bật
            </span>
          </div>

          {equippedBadges.length === 0 ? (
            <p className="text-xs text-ink-muted bg-paper border border-ink/10 rounded-xl p-3.5">
              Người chơi này chưa trang bị hiệu ứng Discord-style nào.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {equippedBadges.map(({ category, label, item }) => (
                <span
                  key={category}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-paper border border-ink/15 text-xs font-medium text-ink"
                >
                  <span className="text-[10px] font-mono uppercase text-ink-muted">
                    {label}:
                  </span>
                  <span className="font-semibold">{item.name}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-pill bg-white border border-ink/10 text-ink-muted">
                    {item.rarity}
                  </span>
                </span>
              ))}
            </div>
          )}
        </section>

        <section
          aria-label="Lịch sử đấu Arena gần đây"
          className="bg-white/95 border border-ink/15 rounded-2xl p-5 shadow-soft space-y-3"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-ink uppercase tracking-wider font-mono flex items-center gap-2">
              <Gamepad2 className="w-4 h-4 text-accent" aria-hidden="true" />
              <span>Trận Arena gần đây</span>
            </h2>
            <span className="text-[11px] font-mono text-ink-muted">
              {profile.recentArenaRuns.length} trận
            </span>
          </div>

          {profile.recentArenaRuns.length === 0 ? (
            <p className="text-xs text-ink-muted bg-paper border border-ink/10 rounded-xl p-3.5">
              Chưa có trận Arena nào được ghi nhận công khai.
            </p>
          ) : (
            <div className="space-y-2">
              {profile.recentArenaRuns.map((run) => (
                <div
                  key={run.id}
                  className="bg-paper border border-ink/10 rounded-xl p-3 space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-ink truncate flex items-center gap-1.5">
                      <Gamepad2 className="w-3.5 h-3.5 text-accent shrink-0" aria-hidden="true" />
                      <span>
                        {run.gameId === "bug-buster"
                          ? "Bug Buster Arena"
                          : run.gameId === "standup-speed-run"
                          ? "Standup Speed Run"
                          : run.gameId}
                      </span>
                      {run.role && (
                        <span className="px-2 py-0.5 rounded-pill bg-white border border-ink/10 text-[10px] font-mono text-ink-muted uppercase">
                          {run.role}
                        </span>
                      )}
                    </span>
                    <span className="px-2 py-0.5 rounded-pill bg-accent-light border border-accent/30 text-[11px] font-mono font-bold text-accent shrink-0">
                      {run.score.toLocaleString("vi-VN")} pts
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-ink-muted">
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
