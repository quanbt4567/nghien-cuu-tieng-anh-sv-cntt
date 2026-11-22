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

const ROLE_ACTIVE_STYLES: Record<ITRole, { pill: string; icon: string }> = {
  frontend: {
    pill: "bg-gradient-to-r from-sky-500 to-blue-600 text-white border-sky-300/60 shadow-[0_6px_18px_rgba(14,165,233,0.3)]",
    icon: "text-white",
  },
  backend: {
    pill: "bg-gradient-to-r from-violet-500 to-purple-600 text-white border-violet-300/60 shadow-[0_6px_18px_rgba(139,92,246,0.3)]",
    icon: "text-white",
  },
  qa: {
    pill: "bg-gradient-to-r from-emerald-500 to-teal-600 text-white border-emerald-300/60 shadow-[0_6px_18px_rgba(16,185,129,0.3)]",
    icon: "text-white",
  },
  devops: {
    pill: "bg-gradient-to-r from-amber-500 to-orange-600 text-white border-amber-300/60 shadow-[0_6px_18px_rgba(245,158,11,0.3)]",
    icon: "text-white",
  },
};

const DIFFICULTY_FILTERS: Array<"ALL" | ScenarioDifficulty> = [
  "ALL",
  "Fresher",
  "Junior",
  "Senior",
];

const DIFFICULTY_SECTIONS: Array<{
  level: ScenarioDifficulty;
  subtitle: string;
}> = [
  {
    level: "Fresher",
    subtitle: "Làm quen quy trình & giao tiếp cơ bản",
  },
  {
    level: "Junior",
    subtitle: "Phối hợp nhóm & xử lý nghiệp vụ",
  },
  {
    level: "Senior",
    subtitle: "Dẫn dắt kỹ thuật, sự cố & khách hàng",
  },
];

function getDifficultyBadgeClass(level: ScenarioDifficulty): string {
  if (level === "Fresher") {
    return "bg-emerald-100/90 text-emerald-700 border-emerald-300/80";
  }
  if (level === "Junior") {
    return "bg-sky-100/90 text-sky-700 border-sky-300/80";
  }
  return "bg-violet-100/90 text-violet-700 border-violet-300/80";
}

function getDifficultyFilterActiveClass(level: "ALL" | ScenarioDifficulty): string {
  if (level === "Fresher") {
    return "bg-gradient-to-r from-emerald-500 to-teal-600 text-white border-emerald-300/60 shadow-[0_6px_16px_rgba(16,185,129,0.3)]";
  }
  if (level === "Junior") {
    return "bg-gradient-to-r from-sky-500 to-blue-600 text-white border-sky-300/60 shadow-[0_6px_16px_rgba(14,165,233,0.3)]";
  }
  if (level === "Senior") {
    return "bg-gradient-to-r from-violet-500 to-purple-600 text-white border-violet-300/60 shadow-[0_6px_16px_rgba(139,92,246,0.3)]";
  }
  return "bg-gradient-to-r from-sky-500 to-blue-600 text-white border-sky-300/60 shadow-[0_6px_16px_rgba(14,165,233,0.3)]";
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

  const scenariosByLevel = useMemo(() => {
    const grouped: Record<ScenarioDifficulty, Scenario[]> = {
      Fresher: [],
      Junior: [],
      Senior: [],
    };
    for (const scenario of sortedScenarios) {
      grouped[getScenarioDifficulty(scenario)].push(scenario);
    }
    return grouped;
  }, [sortedScenarios]);

  const difficultyCounts: Record<"ALL" | ScenarioDifficulty, number> = {
    ALL: sortedScenarios.length,
    Fresher: scenariosByLevel.Fresher.length,
    Junior: scenariosByLevel.Junior.length,
    Senior: scenariosByLevel.Senior.length,
  };

  const filteredScenarios = useMemo(() => {
    if (difficultyFilter === "ALL") return sortedScenarios;
    return scenariosByLevel[difficultyFilter];
  }, [sortedScenarios, scenariosByLevel, difficultyFilter]);

  const recommendedScenario = sortedScenarios[0] ?? null;
  const totalTurnsCount = useMemo(
    () => filteredScenarios.reduce((sum, s) => sum + s.turns.length, 0),
    [filteredScenarios]
  );

  const handleSelectRole = (role: ITRole) => {
    const updated = setSelectedRole(role);
    setSelectedRoleState(updated.selectedRole);
  };

  const renderScenarioCard = (scenario: Scenario, index: number) => {
    const level = getScenarioDifficulty(scenario);
    const isPlacementMatch = placement?.recommendedScenarioId === scenario.id;
    const isRecommended =
      isPlacementMatch ||
      scenario.id === recommendedScenario?.id ||
      Boolean(scenario.targetRoles?.includes(selectedRole));

    return (
      <Link
        key={scenario.id}
        href={`/practice/${scenario.id}`}
        className={`group liquid-glass-card-lite p-5 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(14,165,233,0.16)] transition-all flex flex-col justify-between gap-4 ${
          isPlacementMatch
            ? "!border-sky-400/80 ring-1 ring-sky-400/35"
            : isRecommended
            ? "!border-emerald-400/70 hover:!border-emerald-500/80"
            : "hover:!border-sky-400/70"
        }`}
      >
        <div className="flex items-start gap-3.5">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center border shrink-0 font-mono font-bold text-xs transition-colors ${
              isRecommended
                ? "bg-sky-100/90 text-sky-700 border-sky-300/80"
                : "bg-slate-100/85 text-slate-600 border-slate-200/85 group-hover:bg-sky-100/90 group-hover:text-sky-700 group-hover:border-sky-300/80"
            }`}
          >
            {String(index + 1).padStart(2, "0")}
          </div>
          <div className="min-w-0 space-y-1.5">
            <h3 className="font-bold text-sm sm:text-base text-slate-900 group-hover:text-sky-700 transition-colors">
              {scenario.titleEN}{" "}
              <span className="text-xs font-normal text-slate-600">
                ({scenario.titleVI})
              </span>
            </h3>
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={`text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${getDifficultyBadgeClass(
                  level
                )}`}
              >
                {level}
              </span>
              {isPlacementMatch && (
                <span className="text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-sky-100/90 text-sky-700 border border-sky-300/80">
                  Đề xuất từ Placement
                </span>
              )}
              {!isPlacementMatch && isRecommended && (
                <span className="text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100/90 text-emerald-700 border border-emerald-300/80">
                  Phù hợp với bạn
                </span>
              )}
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-slate-100/80 border border-slate-200/85 text-slate-600">
                Vai: {scenario.roleVI}
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              {scenario.descriptionVI}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-slate-200/85 text-xs font-mono text-slate-600">
          <span>{scenario.turns.length} lượt hội thoại</span>
          <span className="liquid-btn-primary inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-sans text-xs transition-all">
            <span>Thực hành</span>
            <ArrowRight
              className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform"
              aria-hidden="true"
            />
          </span>
        </div>
      </Link>
    );
  };

  return (
    <div className="space-y-8">
      {showGuideBanner && (
        <div className="bg-sky-50/90 border border-sky-200/90 backdrop-blur-xl rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-slate-900">
            <HelpCircle className="w-4 h-4 text-sky-600 shrink-0" aria-hidden="true" />
            <span className="font-semibold">Lần đầu sử dụng?</span>
            <Link
              href="/guide"
              className="liquid-glass-btn inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition-all"
            >
              Xem hướng dẫn 1 phút
            </Link>
            <span className="text-slate-600">hoặc</span>
            <Link
              href="/placement"
              className="liquid-glass-btn inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition-all"
            >
              Làm test xếp lớp 2 phút
            </Link>
          </div>
          <button
            type="button"
            onClick={handleDismissGuideBanner}
            aria-label="Đóng thông báo hướng dẫn"
            className="p-1 rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <section
        aria-label="Bắt đầu luyện nói nhanh"
        className="liquid-glass-card p-5 sm:p-6 space-y-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs font-mono font-semibold text-slate-700">
            Chọn vai trò để gợi ý bài phù hợp:
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {IT_ROLES.map((role) => {
              const Icon = ROLE_ICONS[role.id];
              const isSelected = role.id === activeRole.id;
              const roleStyle = ROLE_ACTIVE_STYLES[role.id];
              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => handleSelectRole(role.id)}
                  aria-pressed={isSelected}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold border transition-all ${
                    isSelected
                      ? roleStyle.pill
                      : "bg-white/80 text-slate-700 border-slate-200/85 hover:border-sky-300/80 hover:bg-white hover:text-slate-900"
                  }`}
                >
                  <Icon
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isSelected ? roleStyle.icon : "text-slate-500"
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
          <div className="pt-4 border-t border-slate-200/85 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-mono font-bold text-sky-600 uppercase tracking-wide">
                  {placement
                    ? `Đề xuất theo trình độ ${placement.level} · ~3 phút`
                    : `Đề xuất cho ${activeRole.label} · ~3 phút`}
                </span>
                <span
                  className={`text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${getDifficultyBadgeClass(
                    getScenarioDifficulty(recommendedScenario)
                  )}`}
                >
                  {getScenarioDifficulty(recommendedScenario)}
                </span>
              </div>
              <h2 className="text-lg font-bold tracking-tight text-slate-900">
                {recommendedScenario.titleEN}{" "}
                <span className="text-sm font-normal text-slate-600">
                  ({recommendedScenario.titleVI})
                </span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                {recommendedScenario.descriptionVI}
              </p>
              <div className="pt-1">
                <Link
                  href="/placement"
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 bg-sky-50/90 hover:bg-sky-100/90 text-sky-700 border border-sky-200/90 text-xs font-semibold transition-colors"
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
              className="liquid-btn-primary w-full md:w-auto shrink-0 inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-full text-sm sm:text-base hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              <Play className="w-4 h-4 fill-white shrink-0" aria-hidden="true" />
              <span>Bắt đầu luyện ngay</span>
              <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <div className="pt-4 border-t border-slate-200/85 text-xs text-slate-600">
            Hiện chưa có kịch bản nào đang mở.
          </div>
        )}
      </section>

      <section id="scenarios" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">
              Tất cả tình huống ({filteredScenarios.length})
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Chọn cấp độ Fresher, Junior hoặc Senior để luyện phản xạ nói tiếng Anh
            </p>
          </div>
          <span className="text-xs font-mono text-slate-700 bg-white/80 px-3 py-1 rounded-full border border-slate-200/85 shrink-0">
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
                className={`px-3.5 py-1.5 rounded-full text-xs font-mono font-semibold border transition-all ${
                  isActive
                    ? getDifficultyFilterActiveClass(level)
                    : "bg-white/80 text-slate-700 border-slate-200/85 hover:bg-white hover:border-sky-300/80 hover:text-slate-900"
                }`}
              >
                {level === "ALL"
                  ? `Tất cả (${difficultyCounts.ALL})`
                  : `${level} (${difficultyCounts[level]})`}
              </button>
            );
          })}
        </div>

        {difficultyFilter === "ALL" ? (
          <div className="space-y-8">
            {DIFFICULTY_SECTIONS.map(({ level, subtitle }) => {
              const items = scenariosByLevel[level];
              if (items.length === 0) return null;
              return (
                <div key={level} className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200/85">
                    <h3 className="text-sm sm:text-base font-bold tracking-tight text-slate-900">
                      {level} · {subtitle}
                    </h3>
                    <span className="text-xs font-mono text-slate-600">
                      {items.length} tình huống
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {items.map((scenario, index) =>
                      renderScenarioCard(scenario, index)
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredScenarios.map((scenario, index) =>
              renderScenarioCard(scenario, index)
            )}
          </div>
        )}
      </section>
    </div>
  );
}
