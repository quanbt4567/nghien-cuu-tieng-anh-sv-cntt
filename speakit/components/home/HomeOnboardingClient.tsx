"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bug,
  Code2,
  Gamepad2,
  Play,
  Server,
  Terminal,
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
import { ITRole, Scenario } from "../../lib/types";

const ROLE_ICONS: Record<ITRole, typeof Code2> = {
  frontend: Code2,
  backend: Server,
  qa: Bug,
  devops: Terminal,
};

export function HomeOnboardingClient() {
  // Default matches SSR state to avoid hydration mismatch before localStorage/content loads.
  const [selectedRole, setSelectedRoleState] = useState<ITRole>("frontend");
  const [scenarios, setScenarios] = useState<Scenario[]>(SCENARIOS);

  useEffect(() => {
    const syncRole = () => {
      setSelectedRoleState(getGamificationState().selectedRole);
    };
    const syncContent = () => {
      setScenarios(getEffectiveScenarios());
    };

    syncRole();
    syncContent();
    void fetchAndCachePublicContent();

    window.addEventListener(GAMIFICATION_UPDATED_EVENT, syncRole);
    window.addEventListener(CONTENT_UPDATED_EVENT, syncContent);

    const handleStorage = (event: StorageEvent) => {
      if (!event.key || event.key === GAMIFICATION_STORAGE_KEY) {
        syncRole();
      }
      if (!event.key || event.key === CONTENT_STORAGE_KEY) {
        syncContent();
      }
    };
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(GAMIFICATION_UPDATED_EVENT, syncRole);
      window.removeEventListener(CONTENT_UPDATED_EVENT, syncContent);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const activeRole =
    IT_ROLES.find((role) => role.id === selectedRole) ?? IT_ROLES[0];

  const sortedScenarios = useMemo(() => {
    const scorePriority = (scenario: Scenario): number => {
      let score = 0;
      if (scenario.targetRoles?.includes(selectedRole)) score += 2;
      if (scenario.id === activeRole.recommendedScenarioId) score += 1;
      return score;
    };
    return [...scenarios].sort((a, b) => scorePriority(b) - scorePriority(a));
  }, [scenarios, selectedRole, activeRole.recommendedScenarioId]);

  const recommendedScenario = sortedScenarios[0] ?? null;
  const totalTurnsCount = useMemo(
    () => sortedScenarios.reduce((sum, s) => sum + s.turns.length, 0),
    [sortedScenarios]
  );

  const handleSelectRole = (role: ITRole) => {
    const updated = setSelectedRole(role);
    setSelectedRoleState(updated.selectedRole);
  };

  return (
    <div className="space-y-10">
      {/* 3-Step Onboarding Flow */}
      <section aria-label="Lộ trình bắt đầu nhanh 3 bước" className="space-y-4">
        {/* Step 1: Select IT Role */}
        <div className="bg-white border border-ink/15 rounded-2xl p-5 sm:p-6 shadow-soft space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-pill bg-ink text-white font-mono text-xs font-bold flex items-center justify-center shrink-0">
                01
              </span>
              <h2 className="text-base sm:text-lg font-bold text-ink">
                Chọn vai trò CNTT
              </h2>
            </div>
            <span className="text-xs text-ink-muted">
              Gợi ý kịch bản sát vị trí của bạn
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {IT_ROLES.map((role) => {
              const Icon = ROLE_ICONS[role.id];
              const isSelected = role.id === activeRole.id;
              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => handleSelectRole(role.id)}
                  aria-pressed={isSelected}
                  className={`text-left rounded-2xl p-3.5 border transition-all flex flex-col gap-1.5 ${
                    isSelected
                      ? "bg-ink text-white border-ink shadow-soft"
                      : "bg-paper text-ink border-ink/15 hover:border-ink/35 hover:bg-paper-muted"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isSelected ? "text-accent" : "text-ink"
                      }`}
                      aria-hidden="true"
                    />
                    <span className="font-bold text-sm">{role.label}</span>
                  </div>
                  <p
                    className={`text-[11px] leading-snug line-clamp-2 ${
                      isSelected ? "text-white/80" : "text-ink-muted"
                    }`}
                  >
                    {role.taglineVI}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 2: Recommended 3-minute Scenario */}
        {recommendedScenario ? (
          <div className="bg-white border border-ink/15 rounded-2xl p-5 sm:p-6 shadow-soft flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-7 h-7 rounded-pill bg-accent text-white font-mono text-xs font-bold flex items-center justify-center shrink-0">
                  02
                </span>
                <span className="text-xs font-mono font-semibold text-accent uppercase tracking-wide">
                  Luyện 1 kịch bản nhanh (~3 phút)
                </span>
                <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-pill bg-accent-light text-accent border border-accent/25">
                  Gợi ý cho {activeRole.label}
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-ink">
                {recommendedScenario.titleEN}{" "}
                <span className="text-sm font-normal text-ink-faint">
                  ({recommendedScenario.titleVI})
                </span>
              </h2>
              <p className="text-xs sm:text-sm text-ink-muted">
                {recommendedScenario.descriptionVI}
              </p>
            </div>

            <Link
              href={`/practice/${recommendedScenario.id}`}
              className="w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-pill bg-accent hover:bg-accent-hover text-white font-semibold text-sm border border-accent shadow-soft shadow-hard-press transition-all text-center"
            >
              <Play className="w-4 h-4 fill-white shrink-0" aria-hidden="true" />
              <span>Bắt đầu ngay: {recommendedScenario.titleEN}</span>
              <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <div className="bg-white border border-ink/15 rounded-2xl p-5 sm:p-6 shadow-soft text-xs text-ink-muted">
            Hiện chưa có kịch bản nào đang mở. Vui lòng kiểm tra lại trong Cổng Quản trị.
          </div>
        )}

        {/* Step 3: Reflex Diagnostics & IT Speaking Arena */}
        <div className="bg-white border border-ink/15 rounded-2xl p-5 sm:p-6 shadow-soft flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-pill bg-paper border border-ink/20 text-ink font-mono text-xs font-bold flex items-center justify-center shrink-0">
                03
              </span>
              <h2 className="text-base sm:text-lg font-bold text-ink">
                Chẩn đoán phản xạ & IT Speaking Arena
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-ink-muted">
              Thử thách Bug Buster 60s &amp; Standup Speed Run kiếm IT-Coin và nâng danh hiệu kỹ thuật.
            </p>
          </div>

          <Link
            href="/arena"
            className="w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-pill bg-paper hover:bg-paper-muted text-ink font-semibold text-xs sm:text-sm border border-ink/20 shadow-soft transition-all"
          >
            <Gamepad2 className="w-4 h-4 text-accent shrink-0" aria-hidden="true" />
            <span>Vào IT Speaking Arena</span>
            <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
          </Link>
        </div>
      </section>

      {/* Scenario Setlist */}
      <section id="scenarios" className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-ink">
              Kịch bản tình huống ({sortedScenarios.length})
            </h2>
            <p className="text-xs text-ink-muted mt-0.5">
              Mỗi kịch bản gồm các lượt hội thoại phản xạ công việc thực tế
            </p>
          </div>
          <span className="text-xs font-mono text-ink-muted bg-paper-muted px-3 py-1 rounded-pill border border-ink/15 shrink-0">
            {totalTurnsCount} Lượt luyện
          </span>
        </div>

        <div className="space-y-4">
          {sortedScenarios.map((scenario, index) => {
            const isRecommended =
              scenario.id === recommendedScenario?.id ||
              Boolean(scenario.targetRoles?.includes(selectedRole));
            return (
              <Link
                key={scenario.id}
                href={`/practice/${scenario.id}`}
                className={`block group bg-white border rounded-2xl p-5 sm:p-6 shadow-soft hover:shadow-card hover:-translate-y-0.5 transition-all ${
                  isRecommended ? "border-accent/50" : "border-ink/15"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5 sm:gap-4">
                    <div
                      className={`w-9 h-9 rounded-pill flex items-center justify-center border shrink-0 font-mono font-bold text-sm transition-colors ${
                        isRecommended
                          ? "bg-accent text-white border-accent"
                          : "bg-paper text-ink border-ink/20 group-hover:bg-accent group-hover:text-white group-hover:border-accent"
                      }`}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-base text-ink group-hover:text-accent transition-colors">
                          {scenario.titleEN}
                        </h3>
                        <span className="text-xs text-ink-faint">
                          ({scenario.titleVI})
                        </span>
                        {isRecommended && (
                          <span className="text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-pill bg-accent-light text-accent border border-accent/25">
                            Phù hợp vai trò của bạn
                          </span>
                        )}
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded-pill bg-paper border border-ink/15 text-ink-muted">
                          Vai: {scenario.roleVI}
                        </span>
                      </div>
                      <p className="text-xs text-ink-muted line-clamp-2">
                        {scenario.descriptionVI}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-end sm:justify-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-paper-muted">
                    <span className="text-xs font-mono text-ink-muted">
                      {scenario.turns.length} lượt
                    </span>
                    <div className="w-7 h-7 rounded-pill bg-paper flex items-center justify-center border border-ink/20 group-hover:translate-x-1 transition-transform">
                      <ArrowRight className="w-3.5 h-3.5 text-ink" aria-hidden="true" />
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
