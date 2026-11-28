"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import { SCENARIOS } from "../../data/scenarios";
import { computeScenarioBulkDeleteOverrides } from "../../lib/adminBulkDelete";
import { mergeScenarios } from "../../lib/contentStore";
import type {
  AdminContentOverrides,
  ITRole,
  Scenario,
  ScenarioDifficulty,
  ScenarioTurn,
} from "../../lib/types";
import { AdminAiGeneratorBox, type AdminAiGenerateMeta } from "./AdminAiGeneratorBox";
import {
  AdminBulkActionBar,
  AdminDeleteConfirmModal,
  type DeleteConfirmRequest,
} from "./AdminDeleteConfirmModal";
import { AdminImageField } from "./AdminImageField";
import { persistAdminOverrides } from "./adminShared";

interface AdminScenariosTabProps {
  overrides: AdminContentOverrides;
  onOverridesChange: (next: AdminContentOverrides) => void;
  onUnauthorized: () => void;
}

interface TurnDraft {
  questionEN: string;
  keywordsText: string;
  sampleAnswerEN: string;
  hintVI: string;
}

type ScenarioSubTab = "list" | "form";
type RoleFilter = "all" | ITRole;

const ROLE_OPTIONS: Array<{ id: ITRole; label: string }> = [
  { id: "frontend", label: "Frontend" },
  { id: "backend", label: "Backend" },
  { id: "qa", label: "QA" },
  { id: "devops", label: "DevOps" },
];

const BASE_SCENARIO_IDS = new Set(SCENARIOS.map((s) => s.id));
const VALID_ROLES = new Set<ITRole>(["frontend", "backend", "qa", "devops"]);
const SCENARIO_QUICK_TOPICS = [
  "Production database outage postmortem",
  "Sprint planning & API estimation",
  "Code review feedback on React hooks",
];
const SCENARIOS_PAGE_SIZE = 8;

function slugifyId(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function splitCommaList(value: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of value.split(",")) {
    const trimmed = part.trim();
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      out.push(trimmed);
    }
  }
  return out;
}

function emptyTurns(): TurnDraft[] {
  return [0, 1, 2].map(() => ({
    questionEN: "",
    keywordsText: "",
    sampleAnswerEN: "",
    hintVI: "",
  }));
}

function toTurnDrafts(rawTurns?: Array<Partial<ScenarioTurn>>): TurnDraft[] {
  return [0, 1, 2].map((idx) => {
    const turn = rawTurns?.[idx];
    return {
      questionEN: typeof turn?.questionEN === "string" ? turn.questionEN : "",
      keywordsText: Array.isArray(turn?.keywords)
        ? turn.keywords.filter((k): k is string => typeof k === "string").join(", ")
        : "",
      sampleAnswerEN:
        typeof turn?.sampleAnswerEN === "string" ? turn.sampleAnswerEN : "",
      hintVI: typeof turn?.hintVI === "string" ? turn.hintVI : "",
    };
  });
}

export function AdminScenariosTab({
  overrides,
  onOverridesChange,
  onUnauthorized,
}: AdminScenariosTabProps) {
  const scenarios = useMemo(
    () => mergeScenarios(SCENARIOS, overrides, true),
    [overrides]
  );

  const customIds = useMemo(
    () => new Set(overrides.customScenarios.map((s) => s.id)),
    [overrides.customScenarios]
  );
  const hiddenIds = useMemo(
    () => new Set(overrides.hiddenScenarioIds),
    [overrides.hiddenScenarioIds]
  );

  const [subTab, setSubTab] = useState<ScenarioSubTab>("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedScenarioIds, setExpandedScenarioIds] = useState<Set<string>>(
    new Set()
  );
  const [expandedDescIds, setExpandedDescIds] = useState<Set<string>>(new Set());

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteRequest, setDeleteRequest] = useState<DeleteConfirmRequest | null>(null);
  const [aiFocusKey, setAiFocusKey] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [idTouched, setIdTouched] = useState(false);
  const [id, setId] = useState("");
  const [titleEN, setTitleEN] = useState("");
  const [titleVI, setTitleVI] = useState("");
  const [roleVI, setRoleVI] = useState("");
  const [descriptionVI, setDescriptionVI] = useState("");
  const [difficulty, setDifficulty] = useState<ScenarioDifficulty>("Junior");
  const [level, setLevel] = useState("B1 - B2");
  const [duration, setDuration] = useState("5 phút");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [targetRoles, setTargetRoles] = useState<ITRole[]>([]);
  const [turns, setTurns] = useState<TurnDraft[]>(emptyTurns);

  const [isSaving, setIsSaving] = useState(false);
  const [statusNotice, setStatusNotice] = useState<{
    tone: "ok" | "warn" | "error";
    text: string;
  } | null>(null);

  const filteredScenarios = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return scenarios.filter((scenario) => {
      if (roleFilter !== "all" && !scenario.targetRoles?.includes(roleFilter)) {
        return false;
      }
      if (!q) return true;
      return (
        scenario.titleVI.toLowerCase().includes(q) ||
        scenario.titleEN.toLowerCase().includes(q) ||
        scenario.id.toLowerCase().includes(q) ||
        scenario.roleVI.toLowerCase().includes(q) ||
        scenario.descriptionVI.toLowerCase().includes(q)
      );
    });
  }, [scenarios, searchQuery, roleFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredScenarios.length / SCENARIOS_PAGE_SIZE)
  );
  const safePage = Math.min(currentPage, totalPages);
  const paginatedScenarios = useMemo(() => {
    const start = (safePage - 1) * SCENARIOS_PAGE_SIZE;
    return filteredScenarios.slice(start, start + SCENARIOS_PAGE_SIZE);
  }, [filteredScenarios, safePage]);

  const toggleExpandScenario = (scenarioId: string) => {
    setExpandedScenarioIds((prev) => {
      const next = new Set(prev);
      if (next.has(scenarioId)) {
        next.delete(scenarioId);
      } else {
        next.add(scenarioId);
      }
      return next;
    });
  };

  const toggleExpandDesc = (scenarioId: string) => {
    setExpandedDescIds((prev) => {
      const next = new Set(prev);
      if (next.has(scenarioId)) next.delete(scenarioId);
      else next.add(scenarioId);
      return next;
    });
  };

  const resetForm = () => {
    setIsFormOpen(false);
    setSubTab("list");
    setAiFocusKey(0);
    setEditingId(null);
    setIdTouched(false);
    setId("");
    setTitleEN("");
    setTitleVI("");
    setRoleVI("");
    setDescriptionVI("");
    setDifficulty("Junior");
    setLevel("B1 - B2");
    setDuration("5 phút");
    setThumbnailUrl("");
    setTargetRoles([]);
    setTurns(emptyTurns());
  };

  const openCreateForm = () => {
    setAiFocusKey(0);
    setEditingId(null);
    setIdTouched(false);
    setId("");
    setTitleEN("");
    setTitleVI("");
    setRoleVI("Tech Lead / Interviewer");
    setDescriptionVI("");
    setDifficulty("Junior");
    setLevel("B1 - B2");
    setDuration("5 phút");
    setThumbnailUrl("");
    setTargetRoles([]);
    setTurns(emptyTurns());
    setStatusNotice(null);
    setIsFormOpen(true);
    setSubTab("form");
  };

  const openEditForm = (scenario: Scenario) => {
    setAiFocusKey(0);
    setEditingId(scenario.id);
    setIdTouched(true);
    setId(scenario.id);
    setTitleEN(scenario.titleEN);
    setTitleVI(scenario.titleVI);
    setRoleVI(scenario.roleVI);
    setDescriptionVI(scenario.descriptionVI);
    setDifficulty(scenario.difficulty ?? "Junior");
    setLevel(
      scenario.difficulty === "Senior"
        ? "B2 - C1"
        : scenario.difficulty === "Fresher"
        ? "A2 - B1"
        : "B1 - B2"
    );
    setDuration("5 phút");
    setThumbnailUrl(scenario.thumbnailUrl ?? "");
    setTargetRoles(scenario.targetRoles ?? []);
    setTurns(toTurnDrafts(scenario.turns));
    setStatusNotice(null);
    setIsFormOpen(true);
    setSubTab("form");
  };

  const handleAiGenerated = (rawDraft: unknown, meta: AdminAiGenerateMeta) => {
    const draft = (rawDraft && typeof rawDraft === "object" ? rawDraft : {}) as {
      id?: unknown;
      titleEN?: unknown;
      titleVI?: unknown;
      roleVI?: unknown;
      descriptionVI?: unknown;
      targetRoles?: unknown;
      turns?: unknown;
    };
    const nextTitleEN = typeof draft.titleEN === "string" ? draft.titleEN.trim() : "";
    const nextTitleVI = typeof draft.titleVI === "string" ? draft.titleVI.trim() : "";
    const nextRoleVI = typeof draft.roleVI === "string" ? draft.roleVI.trim() : "";
    const nextDescriptionVI =
      typeof draft.descriptionVI === "string" ? draft.descriptionVI.trim() : "";
    const nextRoles = Array.isArray(draft.targetRoles)
      ? draft.targetRoles.filter(
          (r): r is ITRole => typeof r === "string" && VALID_ROLES.has(r as ITRole)
        )
      : [];
    const nextTurns = Array.isArray(draft.turns)
      ? toTurnDrafts(draft.turns as Array<Partial<ScenarioTurn>>)
      : emptyTurns();

    setTitleEN(nextTitleEN);
    setTitleVI(nextTitleVI);
    if (nextRoleVI) setRoleVI(nextRoleVI);
    setDescriptionVI(nextDescriptionVI);
    setTargetRoles(nextRoles);
    setTurns(nextTurns);

    if (!editingId && !idTouched) {
      const rawSlug =
        typeof draft.id === "string" && draft.id.trim() ? draft.id : nextTitleEN;
      setId(slugifyId(rawSlug));
    }

    setStatusNotice({
      tone: meta.mode === "ai" ? "ok" : "warn",
      text:
        meta.mode === "ai"
          ? `Đã tạo nháp kịch bản từ AI (${meta.provider}). Vui lòng kiểm tra kỹ 3 lượt trước khi lưu.`
          : "Đã điền mẫu gợi ý cục bộ (chưa có AI key). Hãy chỉnh sửa nội dung cho phù hợp trước khi lưu.",
    });
  };

  const handleTitleENChange = (value: string) => {
    setTitleEN(value);
    if (!editingId && !idTouched) {
      setId(slugifyId(value));
    }
  };

  const toggleRole = (role: ITRole) => {
    setTargetRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const updateTurn = (idx: number, field: keyof TurnDraft, value: string) => {
    setTurns((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item))
    );
  };

  const saveOverrides = async (next: AdminContentOverrides, okText?: string) => {
    setIsSaving(true);
    const res = await persistAdminOverrides(next);
    setIsSaving(false);

    if (res.unauthorized) {
      onUnauthorized();
      return false;
    }

    onOverridesChange(res.overrides);
    setStatusNotice({
      tone: res.synced ? "ok" : "warn",
      text: res.synced && okText ? okText : res.message,
    });
    return true;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const cleanId = slugifyId(editingId ?? id);
    if (!cleanId) {
      setStatusNotice({
        tone: "error",
        text: "Vui lòng nhập ID slug hợp lệ (chỉ gồm chữ thường, số và dấu gạch ngang).",
      });
      return;
    }
    if (!editingId && scenarios.some((s) => s.id === cleanId)) {
      setStatusNotice({
        tone: "error",
        text: `Kịch bản với ID "${cleanId}" đã tồn tại. Vui lòng chọn ID khác hoặc chỉnh sửa kịch bản có sẵn.`,
      });
      return;
    }
    if (!titleEN.trim() || !titleVI.trim() || !roleVI.trim()) {
      setStatusNotice({
        tone: "error",
        text: "Vui lòng nhập đầy đủ Tên tiếng Anh, Tên tiếng Việt và Vai trò người hỏi.",
      });
      return;
    }

    for (let i = 0; i < 3; i += 1) {
      if (!turns[i].questionEN.trim()) {
        setStatusNotice({
          tone: "error",
          text: `Lượt ${i + 1}: Vui lòng nhập câu hỏi tiếng Anh (questionEN).`,
        });
        return;
      }
      if (splitCommaList(turns[i].keywordsText).length === 0) {
        setStatusNotice({
          tone: "error",
          text: `Lượt ${i + 1}: Vui lòng nhập ít nhất 1 từ khóa mục tiêu (phân tách bởi dấu phẩy).`,
        });
        return;
      }
    }

    const isBase = BASE_SCENARIO_IDS.has(cleanId);
    const nextScenario: Scenario = {
      id: cleanId,
      titleEN: titleEN.trim(),
      titleVI: titleVI.trim(),
      roleVI: roleVI.trim(),
      descriptionVI: descriptionVI.trim(),
      difficulty,
      thumbnailUrl: thumbnailUrl.trim() || null,
      turns: turns.map((t, idx) => ({
        turnIndex: idx,
        questionEN: t.questionEN.trim(),
        keywords: splitCommaList(t.keywordsText),
        sampleAnswerEN: t.sampleAnswerEN.trim(),
        hintVI: t.hintVI.trim(),
      })),
      ...(targetRoles.length > 0 ? { targetRoles } : {}),
      ...(isBase ? {} : { isCustom: true }),
    };

    const nextOverrides: AdminContentOverrides = {
      ...overrides,
      customScenarios: [
        ...overrides.customScenarios.filter((s) => s.id !== cleanId),
        nextScenario,
      ],
    };

    const done = await saveOverrides(
      nextOverrides,
      editingId
        ? `Đã cập nhật kịch bản "${nextScenario.titleVI}".`
        : `Đã tạo kịch bản mới "${nextScenario.titleVI}".`
    );
    if (done) {
      resetForm();
    }
  };

  const handleToggleHidden = async (scenarioId: string) => {
    const currentlyHidden = hiddenIds.has(scenarioId);
    const nextHidden = currentlyHidden
      ? overrides.hiddenScenarioIds.filter((x) => x !== scenarioId)
      : [...overrides.hiddenScenarioIds, scenarioId];
    const nextCustomScenarios = currentlyHidden
      ? overrides.customScenarios.map((s) =>
          s.id === scenarioId && s.isHidden ? { ...s, isHidden: false } : s
        )
      : overrides.customScenarios;

    await saveOverrides(
      {
        ...overrides,
        customScenarios: nextCustomScenarios,
        hiddenScenarioIds: nextHidden,
      },
      currentlyHidden
        ? `Đã bật hiển thị kịch bản "${scenarioId}" cho người dùng.`
        : `Đã ẩn kịch bản "${scenarioId}" khỏi ứng dụng người dùng.`
    );
  };

  const selectableFilteredScenarios = useMemo(
    () => filteredScenarios.filter((s) => !BASE_SCENARIO_IDS.has(s.id)),
    [filteredScenarios]
  );

  const selectablePageScenarios = useMemo(
    () => paginatedScenarios.filter((s) => !BASE_SCENARIO_IDS.has(s.id)),
    [paginatedScenarios]
  );

  const selectedCustomScenarios = useMemo(
    () =>
      scenarios.filter(
        (s) => !BASE_SCENARIO_IDS.has(s.id) && selectedIds.has(s.id)
      ),
    [scenarios, selectedIds]
  );

  const toggleSelectId = (scenarioId: string) => {
    if (BASE_SCENARIO_IDS.has(scenarioId)) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(scenarioId)) next.delete(scenarioId);
      else next.add(scenarioId);
      return next;
    });
  };

  const allPageSelected =
    selectablePageScenarios.length > 0 &&
    selectablePageScenarios.every((s) => selectedIds.has(s.id));

  const toggleSelectPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        for (const s of selectablePageScenarios) next.delete(s.id);
      } else {
        for (const s of selectablePageScenarios) next.add(s.id);
      }
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const s of selectableFilteredScenarios) next.add(s.id);
      return next;
    });
  };

  const executeDeleteScenarios = async (targets: Scenario[], okLabel: string) => {
    if (targets.length === 0) return false;
    const nextOverrides = computeScenarioBulkDeleteOverrides(
      overrides,
      targets,
      BASE_SCENARIO_IDS
    );
    const removedSet = new Set(targets.map((s) => s.id));
    if (editingId && removedSet.has(editingId)) {
      resetForm();
    }
    const ok = await saveOverrides(nextOverrides, okLabel);
    if (ok) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        targets.forEach((s) => next.delete(s.id));
        return next;
      });
    }
    return ok;
  };

  const handleBulkDeleteScenarios = () => {
    if (selectedCustomScenarios.length === 0) return;
    const count = selectedCustomScenarios.length;
    setDeleteRequest({
      title: `Bạn có chắc chắn muốn xóa ${count} kịch bản tùy chỉnh đã chọn?`,
      description:
        "Các kịch bản tùy chỉnh và toàn bộ 3 lượt hội thoại bên trong sẽ bị xóa khỏi danh sách và Neon DB.",
      itemCount: count,
      itemPreviewLabels: selectedCustomScenarios.map((s) => s.titleVI),
      confirmButtonLabel: `Xóa ${count} kịch bản`,
      onConfirm: () =>
        executeDeleteScenarios(
          selectedCustomScenarios,
          `Đã xóa hàng loạt ${count} kịch bản tùy chỉnh.`
        ),
    });
  };

  const handleDeleteOrRestore = async (scenario: Scenario) => {
    const isBase = BASE_SCENARIO_IDS.has(scenario.id);
    if (isBase) {
      const nextOverrides: AdminContentOverrides = {
        ...overrides,
        customScenarios: overrides.customScenarios.filter((s) => s.id !== scenario.id),
        hiddenScenarioIds: overrides.hiddenScenarioIds.filter((x) => x !== scenario.id),
      };
      if (editingId === scenario.id) {
        resetForm();
      }
      await saveOverrides(
        nextOverrides,
        `Đã khôi phục kịch bản "${scenario.titleVI}" về mặc định.`
      );
      return;
    }

    setDeleteRequest({
      title: `Bạn có chắc chắn muốn xóa kịch bản "${scenario.titleVI}"?`,
      description:
        "Kịch bản tùy chỉnh này sẽ bị xóa vĩnh viễn khỏi kho tình huống và Neon DB.",
      itemCount: 1,
      itemPreviewLabels: [scenario.titleVI],
      confirmButtonLabel: "Xóa kịch bản",
      onConfirm: () =>
        executeDeleteScenarios(
          [scenario],
          `Đã xóa kịch bản tùy chỉnh "${scenario.titleVI}".`
        ),
    });
  };

  return (
    <div className="space-y-4">
      <div className="liquid-glass-card p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Quản Lý Kịch Bản Luyện Nói ({scenarios.length})
            </h2>
            <p className="text-sm text-slate-700 dark:text-slate-300 mt-0.5">
              Chỉnh sửa kịch bản mặc định, ẩn/hiện hoặc thêm tình huống CNTT mới gồm 3 lượt hội thoại.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setSubTab("list")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              subTab === "list"
                ? "bg-blue-50 dark:bg-blue-950/50 border-blue-700 dark:border-blue-500 text-blue-700 dark:text-blue-300"
                : "liquid-glass-btn text-slate-700 dark:text-slate-300"
            }`}
          >
            Danh sách kịch bản ({scenarios.length})
          </button>
          <button
            type="button"
            onClick={() => {
              if (!isFormOpen) openCreateForm();
              else setSubTab("form");
            }}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              subTab === "form"
                ? "bg-blue-50 dark:bg-blue-950/50 border-blue-700 dark:border-blue-500 text-blue-700 dark:text-blue-300"
                : "liquid-glass-btn text-slate-700 dark:text-slate-300"
            }`}
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Tạo kịch bản / AI Generator</span>
          </button>
        </div>
      </div>

      {statusNotice && (
        <div
          role={statusNotice.tone === "error" ? "alert" : "status"}
          className={`flex items-start gap-2.5 p-3.5 rounded-xl border text-sm ${
            statusNotice.tone === "error"
              ? "bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-700 dark:text-red-300"
              : statusNotice.tone === "warn"
              ? "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300"
              : "bg-green-50 dark:bg-green-950/40 border-green-300 dark:border-green-800 text-green-700 dark:text-green-300"
          }`}
        >
          {statusNotice.tone === "ok" ? (
            <CheckCircle2 className="w-4 h-4 text-green-700 dark:text-green-400 shrink-0 mt-0.5" aria-hidden="true" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" aria-hidden="true" />
          )}
          <span>{statusNotice.text}</span>
        </div>
      )}

      {subTab === "form" && (
        <form
          onSubmit={handleSubmit}
          className="liquid-glass-card p-5 space-y-5"
        >
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {editingId ? `Chỉnh sửa kịch bản: ${editingId}` : "Thêm kịch bản CNTT mới"}
            </h3>
          </div>

          <AdminAiGeneratorBox
            key={editingId ?? "create"}
            kind="scenario"
            role={targetRoles[0] ?? ""}
            placeholder="VD: Production database incident postmortem, Daily standup blocker…"
            quickTopics={SCENARIO_QUICK_TOPICS}
            onGenerated={handleAiGenerated}
            onUnauthorized={onUnauthorized}
            focusKey={aiFocusKey}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="scenario-title-en" className="block text-xs font-mono font-semibold text-slate-700 dark:text-slate-300">
                Tên tiếng Anh (titleEN) *
              </label>
              <input
                id="scenario-title-en"
                name="titleEN"
                type="text"
                autoComplete="off"
                value={titleEN}
                onChange={(e) => handleTitleENChange(e.target.value)}
                placeholder="VD: Production Incident Postmortem"
                className="liquid-glass-input w-full px-3.5 py-2 text-sm rounded-lg"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="scenario-id-slug" className="block text-xs font-mono font-semibold text-slate-700 dark:text-slate-300">
                ID Slug (URL /practice/[id]) *
              </label>
              <input
                id="scenario-id-slug"
                name="scenarioId"
                type="text"
                autoComplete="off"
                spellCheck={false}
                value={id}
                disabled={Boolean(editingId)}
                onChange={(e) => {
                  setIdTouched(true);
                  setId(slugifyId(e.target.value));
                }}
                placeholder="production-incident-postmortem"
                className="liquid-glass-input w-full px-3.5 py-2 text-sm font-mono rounded-lg disabled:opacity-60"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="scenario-title-vi" className="block text-xs font-mono font-semibold text-slate-700 dark:text-slate-300">
                Tên tiếng Việt (titleVI) *
              </label>
              <input
                id="scenario-title-vi"
                name="titleVI"
                type="text"
                autoComplete="off"
                value={titleVI}
                onChange={(e) => setTitleVI(e.target.value)}
                placeholder="VD: Họp Phân Tích Sự Cố Production"
                className="liquid-glass-input w-full px-3.5 py-2 text-sm rounded-lg"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="scenario-role-vi" className="block text-xs font-mono font-semibold text-slate-700 dark:text-slate-300">
                Vai trò người phỏng vấn / đối tác (roleVI) *
              </label>
              <input
                id="scenario-role-vi"
                name="roleVI"
                type="text"
                autoComplete="off"
                value={roleVI}
                onChange={(e) => setRoleVI(e.target.value)}
                placeholder="VD: Site Reliability Lead"
                className="liquid-glass-input w-full px-3.5 py-2 text-sm rounded-lg"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="scenario-description-vi" className="block text-xs font-mono font-semibold text-slate-700 dark:text-slate-300">
              Mô tả ngắn tiếng Việt (descriptionVI)
            </label>
            <textarea
              id="scenario-description-vi"
              name="descriptionVI"
              rows={2}
              autoComplete="off"
              value={descriptionVI}
              onChange={(e) => setDescriptionVI(e.target.value)}
              placeholder="Mô tả mục tiêu luyện tập cho sinh viên…"
              className="liquid-glass-input w-full px-3.5 py-2 text-sm rounded-lg"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="scenario-difficulty" className="block text-xs font-mono font-semibold text-slate-700 dark:text-slate-300">
                Độ khó (difficulty)
              </label>
              <select
                id="scenario-difficulty"
                name="difficulty"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as ScenarioDifficulty)}
                className="liquid-glass-input w-full px-3.5 py-2 text-sm rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 [&>option]:bg-white dark:[&>option]:bg-slate-900 [&>option]:text-slate-900 dark:[&>option]:text-slate-100"
              >
                <option value="Fresher">Fresher</option>
                <option value="Junior">Junior</option>
                <option value="Senior">Senior</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="scenario-level" className="block text-xs font-mono font-semibold text-slate-700 dark:text-slate-300">
                Trình độ (level)
              </label>
              <input
                id="scenario-level"
                name="level"
                type="text"
                autoComplete="off"
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                placeholder="VD: B1 - B2"
                className="liquid-glass-input w-full px-3.5 py-2 text-sm rounded-lg"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="scenario-duration" className="block text-xs font-mono font-semibold text-slate-700 dark:text-slate-300">
                Thời lượng ước tính (duration)
              </label>
              <input
                id="scenario-duration"
                name="duration"
                type="text"
                autoComplete="off"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="VD: 5 phút"
                className="liquid-glass-input w-full px-3.5 py-2 text-sm rounded-lg"
              />
            </div>
          </div>

          <AdminImageField
            label="Ảnh thumbnail"
            value={thumbnailUrl}
            onChange={setThumbnailUrl}
            allowGenerate={true}
            contextHint={titleVI || titleEN || "Tình huống giao tiếp tiếng Anh cho lập trình viên"}
            placeholder="https://... hoặc /research-covers/..."
          />

          <div className="space-y-2">
            <span className="block text-xs font-mono font-semibold text-slate-700 dark:text-slate-300">
              Vai trò ưu tiên đề xuất (targetRoles)
            </span>
            <div className="flex flex-wrap gap-3">
              {ROLE_OPTIONS.map((role) => {
                const checked = targetRoles.includes(role.id);
                return (
                  <label
                    key={role.id}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-mono cursor-pointer transition-colors focus-within:ring-2 focus-within:ring-blue-600 dark:focus-within:ring-blue-400 ${
                      checked
                        ? "bg-blue-50 dark:bg-blue-950/50 border-blue-700 dark:border-blue-500 text-blue-700 dark:text-blue-300 font-semibold"
                        : "liquid-glass-btn text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <input
                      name={`targetRole-${role.id}`}
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleRole(role.id)}
                      className="sr-only"
                    />
                    <span>{role.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="space-y-4 pt-2">
            <h4 className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
              Nội dung 3 lượt hội thoại
            </h4>
            <div className="divide-y divide-slate-200 dark:divide-slate-800 border-t border-slate-200 dark:border-slate-800">
              {turns.map((turn, idx) => (
                <div
                  key={idx}
                  className="py-4 space-y-3"
                >
                  <div className="text-xs font-mono font-bold text-blue-700 dark:text-blue-400">
                    Lượt {idx + 1} (Turn {idx})
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label htmlFor={`turn-question-${idx}`} className="block text-xs font-mono text-slate-700 dark:text-slate-300">
                        Câu hỏi tiếng Anh (questionEN) *
                      </label>
                      <input
                        id={`turn-question-${idx}`}
                        name={`turnQuestion-${idx}`}
                        type="text"
                        autoComplete="off"
                        value={turn.questionEN}
                        onChange={(e) => updateTurn(idx, "questionEN", e.target.value)}
                        placeholder="What caused the latency spike?"
                        className="liquid-glass-input w-full px-3 py-2 text-sm rounded-lg"
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor={`turn-keywords-${idx}`} className="block text-xs font-mono text-slate-700 dark:text-slate-300">
                        Từ khóa kỳ vọng (phân tách dấu phẩy) *
                      </label>
                      <input
                        id={`turn-keywords-${idx}`}
                        name={`turnKeywords-${idx}`}
                        type="text"
                        autoComplete="off"
                        value={turn.keywordsText}
                        onChange={(e) => updateTurn(idx, "keywordsText", e.target.value)}
                        placeholder="latency, database, root cause, rollback"
                        className="liquid-glass-input w-full px-3 py-2 text-sm font-mono rounded-lg"
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor={`turn-sample-${idx}`} className="block text-xs font-mono text-slate-700 dark:text-slate-300">
                        Câu trả lời mẫu (sampleAnswerEN)
                      </label>
                      <input
                        id={`turn-sample-${idx}`}
                        name={`turnSample-${idx}`}
                        type="text"
                        autoComplete="off"
                        value={turn.sampleAnswerEN}
                        onChange={(e) =>
                          updateTurn(idx, "sampleAnswerEN", e.target.value)
                        }
                        placeholder="The spike was caused by an unindexed query…"
                        className="liquid-glass-input w-full px-3 py-2 text-sm rounded-lg"
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor={`turn-hint-${idx}`} className="block text-xs font-mono text-slate-700 dark:text-slate-300">
                        Gợi ý tiếng Việt (hintVI)
                      </label>
                      <input
                        id={`turn-hint-${idx}`}
                        name={`turnHint-${idx}`}
                        type="text"
                        autoComplete="off"
                        value={turn.hintVI}
                        onChange={(e) => updateTurn(idx, "hintVI", e.target.value)}
                        placeholder="Nêu nguyên nhân gốc rễ và cách khắc phục…"
                        className="liquid-glass-input w-full px-3 py-2 text-sm rounded-lg"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={resetForm}
              className="liquid-glass-btn px-4 py-2 rounded-lg text-xs font-medium"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="liquid-btn-primary px-5 py-2 rounded-lg text-xs font-semibold disabled:opacity-60"
            >
              {isSaving
                ? "Đang lưu…"
                : editingId
                ? "Lưu chỉnh sửa kịch bản"
                : "Tạo & đồng bộ kịch bản"}
            </button>
          </div>
        </form>
      )}

      {subTab === "list" && (
        <div className="space-y-3">
          <div className="liquid-glass-card p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search
                className="w-4 h-4 text-slate-500 dark:text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Tìm theo tiêu đề, ID slug, vai trò người hỏi..."
                className="liquid-glass-input w-full pl-9 pr-3.5 py-1.5 text-sm rounded-lg"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setRoleFilter("all");
                  setCurrentPage(1);
                }}
                className={`px-3 py-1 rounded-full text-xs font-mono border transition-colors ${
                  roleFilter === "all"
                    ? "bg-blue-50 dark:bg-blue-950/50 border-blue-700 dark:border-blue-500 text-blue-700 dark:text-blue-300 font-semibold"
                    : "liquid-glass-btn text-slate-700 dark:text-slate-300"
                }`}
              >
                Tất cả
              </button>
              {ROLE_OPTIONS.map((role) => (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => {
                    setRoleFilter(role.id);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-mono border transition-colors ${
                    roleFilter === role.id
                      ? "bg-blue-50 dark:bg-blue-950/50 border-blue-700 dark:border-blue-500 text-blue-700 dark:text-blue-300 font-semibold"
                      : "liquid-glass-btn text-slate-700 dark:text-slate-300"
                  }`}
                >
                  {role.label}
                </button>
              ))}
            </div>
          </div>

          <AdminBulkActionBar
            selectedCount={selectedCustomScenarios.length}
            totalFilteredCount={selectableFilteredScenarios.length}
            allPageSelected={allPageSelected}
            pageCount={selectablePageScenarios.length}
            itemUnitLabel="kịch bản tùy chỉnh"
            selectPageLabel={
              selectablePageScenarios.length === 0
                ? "Không có kịch bản tùy chỉnh trên trang này"
                : `Chọn ${selectablePageScenarios.length} kịch bản tùy chỉnh trên trang`
            }
            disabled={isSaving}
            onToggleSelectPage={toggleSelectPage}
            onSelectAllFiltered={selectAllFiltered}
            onClearSelection={() => setSelectedIds(new Set())}
            onBulkDelete={handleBulkDeleteScenarios}
          />

          {paginatedScenarios.length === 0 ? (
            <div className="liquid-glass-card p-6 text-center text-sm text-slate-700 dark:text-slate-300">
              Không tìm thấy kịch bản nào khớp với bộ lọc hiện tại.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {paginatedScenarios.map((scenario) => {
                const isBase = BASE_SCENARIO_IDS.has(scenario.id);
                const isOverridden = customIds.has(scenario.id);
                const isHidden = Boolean(
                  scenario.isHidden || hiddenIds.has(scenario.id)
                );
                const isExpanded = expandedScenarioIds.has(scenario.id);
                const isSelected = !isBase && selectedIds.has(scenario.id);

                return (
                  <div
                    key={scenario.id}
                    className={`liquid-glass-card-lite p-4 space-y-3 transition-colors ${
                      isSelected ? "!border-blue-700 dark:!border-blue-500 ring-1 ring-blue-700/35" : ""
                    } ${isHidden ? "opacity-75" : ""}`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        {!isBase && (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectId(scenario.id)}
                            aria-label={`Chọn kịch bản ${scenario.titleVI}`}
                            className="mt-1 w-4 h-4 rounded accent-blue-700 cursor-pointer shrink-0"
                          />
                        )}
                        {scenario.thumbnailUrl && (
                          <img
                            src={scenario.thumbnailUrl}
                            alt={scenario.titleVI}
                            className="w-20 h-14 object-cover rounded-lg border border-slate-200 dark:border-slate-800 shrink-0"
                          />
                        )}
                        <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                            {scenario.titleVI}
                          </span>
                          <span className="text-xs font-mono text-slate-600 dark:text-slate-400">
                            ({scenario.titleEN})
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-mono text-slate-700 dark:text-slate-300">
                            {scenario.id}
                          </span>
                          {!isBase ? (
                            <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-[11px] font-mono font-semibold text-blue-700 dark:text-blue-300">
                              Tùy chỉnh
                            </span>
                          ) : isOverridden ? (
                            <span className="px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-[11px] font-mono font-semibold text-amber-700 dark:text-amber-300">
                              Mặc định (Đã sửa)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-mono text-slate-700 dark:text-slate-300">
                              Mặc định
                            </span>
                          )}
                          {isHidden && (
                            <span className="px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 text-[11px] font-mono">
                              Đang ẩn
                            </span>
                          )}
                        </div>

                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={`text-sm text-slate-700 dark:text-slate-300 leading-snug ${
                              expandedDescIds.has(scenario.id) ? "" : "line-clamp-1"
                            }`}
                          >
                            {scenario.descriptionVI}
                          </p>
                          {scenario.descriptionVI.length > 90 && (
                            <button
                              type="button"
                              onClick={() => toggleExpandDesc(scenario.id)}
                              className="text-xs font-mono text-blue-700 dark:text-blue-400 hover:underline shrink-0"
                            >
                              {expandedDescIds.has(scenario.id) ? "Thu gọn" : "Xem thêm"}
                            </button>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono text-slate-700 dark:text-slate-300">
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200">
                            Vai trò hỏi: {scenario.roleVI}
                          </span>
                          {scenario.targetRoles?.map((role) => (
                            <span
                              key={role}
                              className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-[11px] uppercase text-blue-700 dark:text-blue-300"
                            >
                              {role}
                            </span>
                          ))}
                        </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => toggleExpandScenario(scenario.id)}
                          className="liquid-glass-btn inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-mono font-medium"
                        >
                          <span>
                            {isExpanded
                              ? "Ẩn 3 lượt hội thoại"
                              : `Xem ${scenario.turns.length} lượt hội thoại`}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                          )}
                        </button>

                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => handleToggleHidden(scenario.id)}
                          className="liquid-glass-btn inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
                        >
                          {isHidden ? (
                            <>
                              <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Hiện lại</span>
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Ẩn</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => openEditForm(scenario)}
                          className="liquid-glass-btn inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
                        >
                          <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Sửa</span>
                        </button>

                        {!isBase ? (
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => handleDeleteOrRestore(scenario)}
                            className="liquid-btn-danger inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Xóa</span>
                          </button>
                        ) : isOverridden || isHidden ? (
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => handleDeleteOrRestore(scenario)}
                            className="liquid-glass-btn inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
                          >
                            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Khôi phục gốc</span>
                          </button>
                        ) : null}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-slate-200 dark:border-slate-800">
                        {scenario.turns.map((turn, idx) => (
                          <div
                            key={idx}
                            className="bg-slate-50 dark:bg-[#263349] rounded-lg px-3 py-2 space-y-1.5 text-xs"
                          >
                            <div className="font-mono font-bold text-blue-700 dark:text-blue-400 text-xs">
                              Lượt {idx + 1}
                            </div>
                            <div className="font-medium text-slate-900 dark:text-slate-100">
                              &ldquo;{turn.questionEN}&rdquo;
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {turn.keywords.map((kw) => (
                                <span
                                  key={kw}
                                  className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-[11px] font-mono text-blue-700 dark:text-blue-300"
                                >
                                  {kw}
                                </span>
                              ))}
                            </div>
                            {turn.hintVI && (
                              <div className="text-xs text-slate-700 dark:text-slate-300">
                                Gợi ý: {turn.hintVI}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="liquid-glass-card px-4 py-2.5 flex items-center justify-between gap-3">
            <span className="text-xs font-mono text-slate-700 dark:text-slate-300">
              Trang {safePage}/{totalPages} ({filteredScenarios.length} kịch bản)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="liquid-glass-btn inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold disabled:opacity-40"
              >
                <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Trước</span>
              </button>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="liquid-glass-btn inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold disabled:opacity-40"
              >
                <span>Sau</span>
                <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      )}

      <AdminDeleteConfirmModal
        request={deleteRequest}
        onClose={() => setDeleteRequest(null)}
      />
    </div>
  );
}
