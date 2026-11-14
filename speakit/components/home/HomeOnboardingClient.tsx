"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bug,
  Code2,
  Compass,
  HelpCircle,
  Play,
  Server,
  Terminal,
  X,
} from "lucide-react";
import { IT_ROLES } from "../../data/minigames";
import { SCENARIOS } from "../../data/scenarios";
import {
  GAMIFICATION_STORAGE_KEY,
  GAMIFICATION_UPDATED_EVENT,
  getGamificationState,
  setSelectedRole,
} from "../../lib/gamification";
import {
  CONTENT_STORAGE_KEY,
  CONTENT_UPDATED_EVENT,
  fetchAndCachePublicContent,
  getEffectiveScenarios,
} from "../../lib/contentStore";
import {
  PLACEMENT_STORAGE_KEY,
  PLACEMENT_UPDATED_EVENT,
  PlacementResult,
  getSavedPlacementResult,
  getScenarioDifficulty,
} from "../../lib/placement";
import { ITRole, Scenario, ScenarioDifficulty } from "../../lib/types";

const GUIDE_BANNER_DISMISSED_KEY = "speakit_guide_banner_dismissed_v1";

const ROLE_ICONS: Record<ITRole, typeof Code2> = {
  frontend: Code2,
  backend: Server,
  qa: Bug,
  devops: Terminal,
};

const DIFFICULTY_FILTERS: Array<"ALL" | ScenarioDifficulty> = [
  "ALL",
  "Fresher",
  "Junior",
  "Senior",
];

function getDifficultyBadgeClass(level: ScenarioDifficulty): string {
  if (level === "Fresher") {
    return "bg-emerald-500/15 text-emerald-700 border-emerald-500/30";
  }
  if (level === "Junior") {
    return "bg-sky-500/10 text-sky-700 border-sky-500/30";
  }
  return "bg-ink text-white border-ink";
}

export function HomeOnboardingClient() {
  const [selectedRole, setSelectedRoleState] = useState<ITRole>("frontend");
  const [scenarios, setScenarios] = useState<Scenario[]>(SCENARIOS);
  const [difficultyFilter, setDifficultyFilter] = useState<"ALL" | ScenarioDifficulty>("ALL");
  const [placement, setPlacement] = useState<PlacementResult | null>(null);
  const [showGuideBanner, setShowGuideBanner] = useState(false);

  useEffect(() => {
    const syncRole = () => {
      setSelectedRoleState(getGamificationState().selectedRole);
    };
    const syncContent = () => {
      setScenarios(getEffectiveScenarios());
    };
    const syncPlacement = () => {
      setPlacement(getSavedPlacementResult());
    };

    syncRole();
    syncContent();
    syncPlacement();

    try {
      setShowGuideBanner(
        window.localStorage.getItem(GUIDE_BANNER_DISMISSED_KEY) !== "1"
      );
    } catch {
      setShowGuideBanner(false);
    }

    void fetchAndCachePublicContent();

    window.addEventListener(GAMIFICATION_UPDATED_EVENT, syncRole);
    window.addEventListener(CONTENT_UPDATED_EVENT, syncContent);
    window.addEventListener(PLACEMENT_UPDATED_EVENT, syncPlacement);

    const handleStorage = (event: StorageEvent) => {
      if (!event.key || event.key === GAMIFICATION_STORAGE_KEY) {
        syncRole();
      }
      if (!event.key || event.key === CONTENT_STORAGE_KEY) {
        syncContent();
      }
      if (!event.key || event.key === PLACEMENT_STORAGE_KEY) {
        syncPlacement();
      }
    };
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(GAMIFICATION_UPDATED_EVENT, syncRole);
      window.removeEventListener(CONTENT_UPDATED_EVENT, syncContent);
      window.removeEventListener(PLACEMENT_UPDATED_EVENT, syncPlacement);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const handleDismissGuideBanner = () => {
    setShowGuideBanner(false);
    try {
      window.localStorage.setItem(GUIDE_BANNER_DISMISSED_KEY, "1");
    } catch {
    }
  };

  const activeRole =
    IT_ROLES.find((role) => role.id === selectedRole) ?? IT_ROLES[0];

  const sortedScenarios = useMemo(() => {
    const scorePriority = (scenario: Scenario): number => {
      let score = 0;
      if (placement && scenario.id === placement.recommendedScenarioId) score += 4;
      if (placement && getScenarioDifficulty(scenario) === placement.level) score += 2;
      if (scenario.targetRoles?.includes(selectedRole)) score += 2;
      if (scenario.id === activeRole.recommendedScenarioId) score += 1;
      return score;
    };
    return [...scenarios].sort((a, b) => scorePriority(b) - scorePriority(a));
  }, [scenarios, selectedRole, activeRole.recommendedScenarioId, placement]);

  const filteredScenarios = useMemo(() => {
    if (difficultyFilter === "ALL") return sortedScenarios;
    return sortedScenarios.filter(
      (scenario) => getScenarioDifficulty(scenario) === difficultyFilter
    );
  }, [sortedScenarios, difficultyFilter]);

  const recommendedScenario = sortedScenarios[0] ?? null;
  const totalTurnsCount = useMemo(
    () => filteredScenarios.reduce((sum, s) => sum + s.turns.length, 0),
    [filteredScenarios]
  );

  const handleSelectRole = (role: ITRole) => {
    const updated = setSelectedRole(role);
    setSelectedRoleState(updated.selectedRole);
  };

  return (
    <div className="space-y-8">
      {showGuideBanner && (
        <div className="bg-sky-500/10 border border-sky-500/30 rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-ink">
            <HelpCircle className="w-4 h-4 text-sky-600 shrink-0" aria-hidden="true" />
            <span className="font-semibold">Lần đầu sử dụng?</span>
            <Link
              href="/guide"
              className="inline-flex items-center gap-1 rounded-pill px-3 py-1 bg-white hover:bg-sky-500/10 text-sky-700 border border-sky-500/30 text-xs font-semibold transition-colors"
            >
              Xem hướng dẫn 1 phút
            </Link>
            <span className="text-ink-muted">hoặc</span>
            <Link
              href="/placement"
              className="inline-flex items-center gap-1 rounded-pill px-3 py-1 bg-white hover:bg-sky-500/10 text-sky-700 border border-sky-500/30 text-xs font-semibold transition-colors"
            >
              Làm test xếp lớp 2 phút
            </Link>
          </div>
          <button
            type="button"
            onClick={handleDismissGuideBanner}
            aria-label="Đóng thông báo hướng dẫn"
            className="p-1 rounded-pill text-ink-muted hover:text-ink hover:bg-white/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <section
        aria-label="Bắt đầu luyện nói nhanh"
        className="bg-white border border-ink/15 rounded-2xl p-5 sm:p-6 shadow-soft space-y-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs font-mono font-semibold text-ink-muted">
            Chọn vai trò để gợi ý bài phù hợp:
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {IT_ROLES.map((role) => {
              const Icon = ROLE_ICONS[role.id];
              const isSelected = role.id === activeRole.id;
              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => handleSelectRole(role.id)}
                  aria-pressed={isSelected}
                  className={`inline-flex items-center gap-1.5 rounded-pill px-3.5 py-1.5 text-xs font-semibold border transition-all ${
                    isSelected
                      ? "bg-ink text-white border-ink shadow-soft"
                      : "bg-paper text-ink border-ink/15 hover:border-ink/35 hover:bg-paper-muted"
                  }`}
                >
                  <Icon
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isSelected ? "text-sky-300" : "text-ink"
                    }`}
                    aria-hidden="true"
                  />
                  <span>{role.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {recommendedScenario ? (
          <div className="pt-4 border-t border-paper-muted flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-mono font-semibold text-sky-700 uppercase tracking-wide">
                  {placement
                    ? `Đề xuất theo trình độ ${placement.level} · ~3 phút`
                    : `Đề xuất cho ${activeRole.label} · ~3 phút`}
                </span>
                <span
                  className={`text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-pill border ${getDifficultyBadgeClass(
                    getScenarioDifficulty(recommendedScenario)
                  )}`}
                >
                  {getScenarioDifficulty(recommendedScenario)}
                </span>
              </div>
              <h2 className="text-lg font-bold tracking-tight text-ink">
                {recommendedScenario.titleEN}{" "}
                <span className="text-sm font-normal text-ink-faint">
                  ({recommendedScenario.titleVI})
                </span>
              </h2>
              <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
                {recommendedScenario.descriptionVI}
              </p>
              <div className="pt-1">
                <Link
                  href="/placement"
                  className="inline-flex items-center gap-1.5 rounded-pill px-3 py-1 bg-sky-500/10 hover:bg-sky-500/20 text-sky-700 border border-sky-500/30 text-xs font-semibold transition-colors"
                >
                  <Compass className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    {placement
                      ? `Trình độ hiện tại: ${placement.level} (Làm lại test xếp lớp)`
                      : "Chưa rõ trình độ? Làm bài test 2 phút"}
                  </span>
                </Link>
              </div>
            </div>

            <Link
              href={`/practice/${recommendedScenario.id}`}
              className="w-full md:w-auto shrink-0 inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-pill bg-accent hover:bg-accent-hover text-white font-bold text-sm sm:text-base shadow-card ring-2 ring-accent/25 hover:scale-[1.02] transition-all"
            >
              <Play className="w-4 h-4 fill-white shrink-0" aria-hidden="true" />
              <span>Bắt đầu luyện ngay</span>
              <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <div className="pt-4 border-t border-paper-muted text-xs text-ink-muted">
            Hiện chưa có kịch bản nào đang mở.
          </div>
        )}
      </section>

      <section id="scenarios" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-ink">
              Tất cả tình huống ({filteredScenarios.length})
            </h2>
            <p className="text-xs text-ink-muted mt-0.5">
              Chọn cấp độ Fresher, Junior hoặc Senior để luyện phản xạ nói tiếng Anh
            </p>
          </div>
          <span className="text-xs font-mono text-ink-muted bg-paper-muted px-3 py-1 rounded-pill border border-ink/15 shrink-0">
            {totalTurnsCount} Lượt luyện
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Lọc theo cấp độ">
          {DIFFICULTY_FILTERS.map((level) => {
            const isActive = difficultyFilter === level;
            return (
              <button
                key={level}
                type="button"
                onClick={() => setDifficultyFilter(level)}
                aria-pressed={isActive}
                className={`px-3.5 py-1.5 rounded-pill text-xs font-mono font-semibold border transition-all ${
                  isActive
                    ? "bg-ink text-white border-ink shadow-soft"
                    : "bg-white text-ink border-ink/15 hover:bg-paper-muted"
                }`}
              >
                {level === "ALL" ? "Tất cả" : level}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredScenarios.map((scenario, index) => {
            const level = getScenarioDifficulty(scenario);
            const isPlacementMatch =
              placement?.recommendedScenarioId === scenario.id;
            const isRecommended =
              isPlacementMatch ||
              scenario.id === recommendedScenario?.id ||
              Boolean(scenario.targetRoles?.includes(selectedRole));
            return (
              <Link
                key={scenario.id}
                href={`/practice/${scenario.id}`}
                className={`group bg-white border rounded-2xl p-5 shadow-soft hover:shadow-card hover:-translate-y-0.5 transition-all flex flex-col justify-between gap-4 ${
                  isPlacementMatch
                    ? "border-sky-500/60 ring-1 ring-sky-500/20"
                    : isRecommended
                    ? "border-emerald-500/40"
                    : "border-ink/15"
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div
                    className={`w-8 h-8 rounded-pill flex items-center justify-center border shrink-0 font-mono font-bold text-xs transition-colors ${
                      isRecommended
                        ? "bg-ink text-white border-ink"
                        : "bg-paper text-ink border-ink/20 group-hover:bg-ink group-hover:text-white group-hover:border-ink"
                    }`}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <div className="min-w-0 space-y-1.5">
                    <h3 className="font-bold text-sm sm:text-base text-ink group-hover:text-sky-700 transition-colors">
                      {scenario.titleEN}{" "}
                      <span className="text-xs font-normal text-ink-faint">
                        ({scenario.titleVI})
                      </span>
                    </h3>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-pill border ${getDifficultyBadgeClass(
                          level
                        )}`}
                      >
                        {level}
                      </span>
                      {isPlacementMatch && (
                        <span className="text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-pill bg-sky-500/10 text-sky-700 border border-sky-500/30">
                          Đề xuất từ Placement
                        </span>
                      )}
                      {!isPlacementMatch && isRecommended && (
                        <span className="text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-pill bg-emerald-500/15 text-emerald-700 border border-emerald-500/30">
                          Phù hợp với bạn
                        </span>
                      )}
                      <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-pill bg-paper border border-ink/15 text-ink-muted">
                        Vai: {scenario.roleVI}
                      </span>
                    </div>
                    <p className="text-xs text-ink-muted leading-relaxed">
                      {scenario.descriptionVI}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-paper-muted text-xs font-mono text-ink-muted">
                  <span>{scenario.turns.length} lượt hội thoại</span>
                  <span className="inline-flex items-center gap-1.5 rounded-pill px-3.5 py-1.5 bg-paper group-hover:bg-accent text-ink group-hover:text-white border border-ink/20 group-hover:border-accent font-sans font-semibold transition-all shadow-soft">
                    <span>Thực hành</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
