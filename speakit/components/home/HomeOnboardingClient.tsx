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

const DIFFICULTY_SECTIONS: Array<{
  level: ScenarioDifficulty;
  subtitle: string;
}> = [
  {
    level: "Fresher",
    subtitle: "LÃ m quen quy trÃ¬nh & giao tiáº¿p cÆ¡ báº£n",
  },
  {
    level: "Junior",
    subtitle: "Phá»‘i há»£p nhÃ³m & xá»­ lÃ½ nghiá»‡p vá»¥",
  },
  {
    level: "Senior",
    subtitle: "Dáº«n dáº¯t ká»¹ thuáº­t, sá»± cá»‘ & khÃ¡ch hÃ ng",
  },
];

function getDifficultyBadgeClass(level: ScenarioDifficulty): string {
  if (level === "Fresher") {
    return "bg-green-50 text-green-800 border-green-200 dark:bg-green-950/50 dark:text-green-300 dark:border-green-800";
  }
  if (level === "Junior") {
    return "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800";
  }
  return "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800";
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
        className={`group bg-white dark:bg-[#0A0A0A] border rounded-xl p-5 hover:border-blue-700 dark:hover:border-blue-500 transition-colors flex flex-col justify-between gap-4 ${
          isPlacementMatch
            ? "border-blue-700 dark:border-blue-500 ring-1 ring-blue-700/20 dark:ring-blue-500/25"
            : isRecommended
            ? "border-slate-300 dark:border-slate-700"
            : "border-slate-200 dark:border-slate-800"
        }`}
      >
        <div className="flex items-start gap-3.5">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 font-mono font-bold text-xs transition-colors ${
              isRecommended
                ? "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800"
                : "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 group-hover:bg-blue-50 group-hover:text-blue-800 group-hover:border-blue-200"
            }`}
          >
            {String(index + 1).padStart(2, "0")}
          </div>
          <div className="min-w-0 space-y-1.5">
            <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-50 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">
              {scenario.titleEN}{" "}
              <span className="text-sm font-normal text-slate-600 dark:text-slate-300">
                ({scenario.titleVI})
              </span>
            </h3>
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-full border ${getDifficultyBadgeClass(
                  level
                )}`}
              >
                {level}
              </span>
              {isPlacementMatch && (
                <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800">
                  Äá» xuáº¥t tá»« Placement
                </span>
              )}
              {!isPlacementMatch && isRecommended && (
                <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full bg-green-50 text-green-800 border border-green-200 dark:bg-green-950/50 dark:text-green-300 dark:border-green-800">
                  PhÃ¹ há»£p vá»›i báº¡n
                </span>
              )}
              <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                Vai: {scenario.roleVI}
              </span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {scenario.descriptionVI}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-600 dark:text-slate-400">
          <span>{scenario.turns.length} lÆ°á»£t há»™i thoáº¡i</span>
          <span className="inline-flex items-center rounded-lg px-3.5 py-1.5 bg-blue-700 group-hover:bg-blue-800 dark:bg-blue-600 dark:group-hover:bg-blue-700 text-white font-sans text-xs font-semibold transition-colors">
            Thá»±c hÃ nh
          </span>
        </div>
      </Link>
    );
  };

  return (
    <div className="space-y-8">
      {showGuideBanner && (
        <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-900 dark:text-slate-50">
            <HelpCircle className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0" aria-hidden="true" />
            <span className="font-semibold">Láº§n Ä‘áº§u sá»­ dá»¥ng?</span>
            <Link
              href="/guide"
              className="inline-flex items-center gap-1 rounded-lg px-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 hover:border-blue-700 text-xs font-semibold transition-colors"
            >
              Xem hÆ°á»›ng dáº«n 1 phÃºt
            </Link>
            <span className="text-slate-600 dark:text-slate-300">hoáº·c</span>
            <Link
              href="/placement"
              className="inline-flex items-center gap-1 rounded-lg px-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 hover:border-blue-700 text-xs font-semibold transition-colors"
            >
              LÃ m test xáº¿p lá»›p 2 phÃºt
            </Link>
          </div>
          <button
            type="button"
            onClick={handleDismissGuideBanner}
            aria-label="ÄÃ³ng thÃ´ng bÃ¡o hÆ°á»›ng dáº«n"
            className="p-1 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-50 hover:bg-blue-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <section
        aria-label="Báº¯t Ä‘áº§u luyá»‡n nÃ³i nhanh"
        className="bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 space-y-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs font-mono font-semibold text-slate-700 dark:text-slate-300">
            Chá»n vai trÃ² Ä‘á»ƒ gá»£i Ã½ bÃ i phÃ¹ há»£p:
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
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold border transition-colors ${
                    isSelected
                      ? "bg-blue-700 text-white border-blue-700 dark:bg-blue-600 dark:border-blue-600"
                      : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-blue-700 dark:hover:border-blue-500 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <Icon
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isSelected ? "text-white" : "text-slate-500 dark:text-slate-400"
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
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-mono font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wide">
                  {placement
                    ? `Äá» xuáº¥t theo trÃ¬nh Ä‘á»™ ${placement.level} Â· ~3 phÃºt`
                    : `Äá» xuáº¥t cho ${activeRole.label} Â· ~3 phÃºt`}
                </span>
                <span
                  className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-full border ${getDifficultyBadgeClass(
                    getScenarioDifficulty(recommendedScenario)
                  )}`}
                >
                  {getScenarioDifficulty(recommendedScenario)}
                </span>
              </div>
              <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-50">
                {recommendedScenario.titleEN}{" "}
                <span className="text-sm font-normal text-slate-600 dark:text-slate-300">
                  ({recommendedScenario.titleVI})
                </span>
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {recommendedScenario.descriptionVI}
              </p>
              <div className="pt-1">
                <Link
                  href="/placement"
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 dark:hover:bg-blue-950/80 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-semibold transition-colors"
                >
                  <Compass className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    {placement
                      ? `TrÃ¬nh Ä‘á»™ hiá»‡n táº¡i: ${placement.level} (LÃ m láº¡i test xáº¿p lá»›p)`
                      : "ChÆ°a rÃµ trÃ¬nh Ä‘á»™? LÃ m bÃ i test 2 phÃºt"}
                  </span>
                </Link>
              </div>
            </div>

            <Link
              href={`/practice/${recommendedScenario.id}`}
              className="w-full md:w-auto shrink-0 inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-lg bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-semibold text-sm sm:text-base active:scale-[0.98] transition-colors"
            >
              <Play className="w-4 h-4 fill-white shrink-0" aria-hidden="true" />
              <span>Báº¯t Ä‘áº§u luyá»‡n ngay</span>
              <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 text-sm text-slate-600 dark:text-slate-300">
            Hiá»‡n chÆ°a cÃ³ ká»‹ch báº£n nÃ o Ä‘ang má»Ÿ.
          </div>
        )}
      </section>

      <section id="scenarios" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
              Táº¥t cáº£ tÃ¬nh huá»‘ng ({filteredScenarios.length})
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">
              Chá»n cáº¥p Ä‘á»™ Fresher, Junior hoáº·c Senior Ä‘á»ƒ luyá»‡n pháº£n xáº¡ nÃ³i tiáº¿ng Anh
            </p>
          </div>
          <span className="text-xs font-mono text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700 shrink-0">
            {totalTurnsCount} LÆ°á»£t luyá»‡n
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Lá»c theo cáº¥p Ä‘á»™">
          {DIFFICULTY_FILTERS.map((level) => {
            const isActive = difficultyFilter === level;
            return (
              <button
                key={level}
                type="button"
                onClick={() => setDifficultyFilter(level)}
                aria-pressed={isActive}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-colors ${
                  isActive
                    ? "bg-blue-700 text-white border-blue-700 dark:bg-blue-600 dark:border-blue-600"
                    : "bg-white dark:bg-[#0A0A0A] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-blue-700 dark:hover:border-blue-500 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {level === "ALL"
                  ? `Táº¥t cáº£ (${difficultyCounts.ALL})`
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
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
                    <h3 className="text-sm sm:text-base font-bold tracking-tight text-slate-900 dark:text-slate-50">
                      {level} Â· {subtitle}
                    </h3>
                    <span className="text-xs font-mono text-slate-600 dark:text-slate-400">
                      {items.length} tÃ¬nh huá»‘ng
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
