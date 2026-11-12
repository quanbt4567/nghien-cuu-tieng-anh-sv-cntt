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
    <div className="space-y-6">
      <section
        aria-label="Lộ trình bắt đầu nhanh 3 bước"
        className="grid grid-cols-1 lg:grid-cols-3 gap-3"
      >
        <div className="bg-white border border-ink/15 rounded-2xl p-4 shadow-soft flex flex-col justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-pill bg-ink text-white font-mono text-[11px] font-bold flex items-center justify-center shrink-0">
              01
            </span>
            <h2 className="text-sm font-bold text-ink">Chọn vai trò CNTT</h2>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {IT_ROLES.map((role) => {
              const Icon = ROLE_ICONS[role.id];
              const isSelected = role.id === activeRole.id;
              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => handleSelectRole(role.id)}
                  aria-pressed={isSelected}
                  className={`text-left rounded-xl px-2.5 py-2 border transition-all flex items-center gap-1.5 ${
                    isSelected
                      ? "bg-ink text-white border-ink shadow-soft"
                      : "bg-paper text-ink border-ink/15 hover:border-ink/35 hover:bg-paper-muted"
                  }`}
                >
                  <Icon
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isSelected ? "text-accent" : "text-ink"
                    }`}
                    aria-hidden="true"
                  />
                  <span className="font-semibold text-xs truncate">{role.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {recommendedScenario ? (
          <div className="bg-white border border-accent/40 rounded-2xl p-4 shadow-soft flex flex-col justify-between gap-2.5">
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-pill bg-accent text-white font-mono text-[11px] font-bold flex items-center justify-center shrink-0">
                    02
                  </span>
                  <span className="text-[11px] font-mono font-semibold text-accent uppercase tracking-wide">
                    Gợi ý (~3 phút)
                  </span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-pill bg-accent-light text-accent border border-accent/25 shrink-0">
                  {activeRole.label}
                </span>
              </div>
              <h2 className="text-sm font-bold tracking-tight text-ink line-clamp-1">
                {recommendedScenario.titleEN}{" "}
                <span className="font-normal text-xs text-ink-faint">
                  ({recommendedScenario.titleVI})
                </span>
              </h2>
              <p className="text-[11px] text-ink-muted line-clamp-2">
                {recommendedScenario.descriptionVI}
              </p>
            </div>

            <Link
              href={`/practice/${recommendedScenario.id}`}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-pill bg-accent hover:bg-accent-hover text-white font-semibold text-xs border border-accent shadow-soft shadow-hard-press transition-all"
            >
              <Play className="w-3.5 h-3.5 fill-white shrink-0" aria-hidden="true" />
              <span className="truncate">Bắt đầu: {recommendedScenario.titleEN}</span>
              <ArrowRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <div className="bg-white border border-ink/15 rounded-2xl p-4 shadow-soft text-xs text-ink-muted flex items-center">
            Hiện chưa có kịch bản nào đang mở.
          </div>
        )}

        <div className="bg-white border border-ink/15 rounded-2xl p-4 shadow-soft flex flex-col justify-between gap-2.5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-pill bg-paper border border-ink/20 text-ink font-mono text-[11px] font-bold flex items-center justify-center shrink-0">
                03
              </span>
              <h2 className="text-sm font-bold text-ink">
                Phản xạ &amp; Speaking Arena
              </h2>
            </div>
            <p className="text-[11px] text-ink-muted line-clamp-2">
              Thử thách Bug Buster 60s &amp; Standup Speed Run kiếm IT-Coin và leo bảng xếp hạng.
            </p>
          </div>

          <Link
            href="/arena"
            className="w-full inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-pill bg-paper hover:bg-paper-muted text-ink font-semibold text-xs border border-ink/20 shadow-soft transition-all"
          >
            <Gamepad2 className="w-3.5 h-3.5 text-accent shrink-0" aria-hidden="true" />
            <span>Vào IT Speaking Arena</span>
            <ArrowRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section id="scenarios" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-ink">
              Kịch bản tình huống ({sortedScenarios.length})
            </h2>
            <p className="text-xs text-ink-muted">
              Hội thoại phản xạ công việc thực tế cho sinh viên CNTT
            </p>
          </div>
          <span className="text-xs font-mono text-ink-muted bg-paper-muted px-3 py-1 rounded-pill border border-ink/15 shrink-0">
            {totalTurnsCount} Lượt luyện
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {sortedScenarios.map((scenario, index) => {
            const isRecommended =
              scenario.id === recommendedScenario?.id ||
              Boolean(scenario.targetRoles?.includes(selectedRole));
            return (
              <Link
                key={scenario.id}
                href={`/practice/${scenario.id}`}
                className={`group bg-white border rounded-2xl p-4 shadow-soft hover:shadow-card hover:-translate-y-0.5 transition-all flex flex-col justify-between gap-3 ${
                  isRecommended ? "border-accent/50" : "border-ink/15"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-8 h-8 rounded-pill flex items-center justify-center border shrink-0 font-mono font-bold text-xs transition-colors ${
                      isRecommended
                        ? "bg-accent text-white border-accent"
                        : "bg-paper text-ink border-ink/20 group-hover:bg-accent group-hover:text-white group-hover:border-accent"
                    }`}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h3 className="font-bold text-sm text-ink group-hover:text-accent transition-colors">
                        {scenario.titleEN}
                      </h3>
                      <span className="text-[11px] text-ink-faint">
                        ({scenario.titleVI})
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {isRecommended && (
                        <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-pill bg-accent-light text-accent border border-accent/25">
                          Gợi ý cho bạn
                        </span>
                      )}
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-pill bg-paper border border-ink/15 text-ink-muted">
                        Vai: {scenario.roleVI}
                      </span>
                    </div>
                    <p className="text-xs text-ink-muted line-clamp-2">
                      {scenario.descriptionVI}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-paper-muted text-xs font-mono text-ink-muted">
                  <span>{scenario.turns.length} lượt hội thoại</span>
                  <span className="inline-flex items-center gap-1 text-ink font-semibold group-hover:text-accent">
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
