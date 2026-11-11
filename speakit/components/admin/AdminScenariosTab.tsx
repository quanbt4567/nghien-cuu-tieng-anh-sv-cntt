"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { SCENARIOS } from "../../data/scenarios";
import { mergeScenarios } from "../../lib/contentStore";
import type { AdminContentOverrides, ITRole, Scenario } from "../../lib/types";
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

const ROLE_OPTIONS: Array<{ id: ITRole; label: string }> = [
  { id: "frontend", label: "Frontend" },
  { id: "backend", label: "Backend" },
  { id: "qa", label: "QA" },
  { id: "devops", label: "DevOps" },
];

const BASE_SCENARIO_IDS = new Set(SCENARIOS.map((s) => s.id));

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

function scenarioToTurns(scenario: Scenario): TurnDraft[] {
  return [0, 1, 2].map((idx) => {
    const turn = scenario.turns[idx];
    return {
      questionEN: turn?.questionEN ?? "",
      keywordsText: (turn?.keywords ?? []).join(", "),
      sampleAnswerEN: turn?.sampleAnswerEN ?? "",
      hintVI: turn?.hintVI ?? "",
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

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [idTouched, setIdTouched] = useState(false);
  const [id, setId] = useState("");
  const [titleEN, setTitleEN] = useState("");
  const [titleVI, setTitleVI] = useState("");
  const [roleVI, setRoleVI] = useState("");
  const [descriptionVI, setDescriptionVI] = useState("");
  const [targetRoles, setTargetRoles] = useState<ITRole[]>([]);
  const [turns, setTurns] = useState<TurnDraft[]>(emptyTurns);

  const [isSaving, setIsSaving] = useState(false);
  const [statusNotice, setStatusNotice] = useState<{
    tone: "ok" | "warn" | "error";
    text: string;
  } | null>(null);

  const resetForm = () => {
    setIsFormOpen(false);
    setEditingId(null);
    setIdTouched(false);
    setId("");
    setTitleEN("");
    setTitleVI("");
    setRoleVI("");
    setDescriptionVI("");
    setTargetRoles([]);
    setTurns(emptyTurns());
  };

  const openCreateForm = () => {
    setEditingId(null);
    setIdTouched(false);
    setId("");
    setTitleEN("");
    setTitleVI("");
    setRoleVI("Tech Lead / Interviewer");
    setDescriptionVI("");
    setTargetRoles([]);
    setTurns(emptyTurns());
    setStatusNotice(null);
    setIsFormOpen(true);
  };

  const openEditForm = (scenario: Scenario) => {
    setEditingId(scenario.id);
    setIdTouched(true);
    setId(scenario.id);
    setTitleEN(scenario.titleEN);
    setTitleVI(scenario.titleVI);
    setRoleVI(scenario.roleVI);
    setDescriptionVI(scenario.descriptionVI);
    setTargetRoles(scenario.targetRoles ?? []);
    setTurns(scenarioToTurns(scenario));
    setStatusNotice(null);
    setIsFormOpen(true);
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
        ? `Đã cập nhật kịch bản "${nextScenario.titleVI}" và đồng bộ Cloud DB.`
        : `Đã tạo kịch bản mới "${nextScenario.titleVI}" và đồng bộ Cloud DB.`
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

  const handleDeleteOrRestore = async (scenario: Scenario) => {
    const isBase = BASE_SCENARIO_IDS.has(scenario.id);
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
      isBase
        ? `Đã khôi phục kịch bản "${scenario.titleVI}" về mặc định.`
        : `Đã xóa kịch bản tùy chỉnh "${scenario.titleVI}".`
    );
  };

  return (
    <div className="space-y-6">
      {/* Header & Create Button */}
      <div className="bg-white border border-ink/15 rounded-2xl p-5 shadow-soft flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-ink">
            Quản Lý Kịch Bản Luyện Nói ({scenarios.length})
          </h2>
          <p className="text-xs text-ink-muted mt-0.5">
            Chỉnh sửa kịch bản mặc định, ẩn/hiện hoặc thêm tình huống CNTT mới gồm 3 lượt hội thoại.
          </p>
        </div>

        <button
          type="button"
          onClick={isFormOpen ? resetForm : openCreateForm}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-pill bg-ink text-white text-xs font-semibold hover:bg-ink/90 shadow-soft shadow-hard-press transition-all self-start sm:self-auto"
        >
          {isFormOpen ? (
            <>
              <X className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Đóng biểu mẫu</span>
            </>
          ) : (
            <>
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Tạo kịch bản mới</span>
            </>
          )}
        </button>
      </div>

      {/* Feedback Notice */}
      {statusNotice && (
        <div
          role={statusNotice.tone === "error" ? "alert" : "status"}
          className={`flex items-start gap-2.5 p-3.5 rounded-2xl border text-xs ${
            statusNotice.tone === "error"
              ? "bg-accent-light border-accent/40 text-ink"
              : statusNotice.tone === "warn"
              ? "bg-paper-muted border-ink/25 text-ink"
              : "bg-white border-ink/20 text-ink shadow-soft"
          }`}
        >
          {statusNotice.tone === "ok" ? (
            <CheckCircle2 className="w-4 h-4 text-ink shrink-0 mt-0.5" aria-hidden="true" />
          ) : (
            <AlertCircle className="w-4 h-4 text-accent shrink-0 mt-0.5" aria-hidden="true" />
          )}
          <span>{statusNotice.text}</span>
        </div>
      )}

      {/* Create / Edit Scenario Form */}
      {isFormOpen && (
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-ink/20 rounded-2xl p-5 sm:p-6 shadow-soft space-y-5"
        >
          <div className="flex items-center justify-between border-b border-ink/10 pb-3">
            <h3 className="text-base font-bold text-ink">
              {editingId ? `Chỉnh sửa kịch bản: ${editingId}` : "Thêm kịch bản CNTT mới"}
            </h3>
            <button
              type="button"
              onClick={resetForm}
              className="text-xs font-mono text-ink-muted hover:text-ink"
            >
              Hủy
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-mono font-semibold text-ink-muted">
                Tên tiếng Anh (titleEN) *
              </label>
              <input
                type="text"
                value={titleEN}
                onChange={(e) => handleTitleENChange(e.target.value)}
                placeholder="VD: Production Incident Postmortem"
                className="w-full px-3.5 py-2 text-sm bg-paper border border-ink/20 rounded-xl text-ink focus:outline-none focus:border-accent"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-mono font-semibold text-ink-muted">
                ID Slug (URL /practice/[id]) *
              </label>
              <input
                type="text"
                value={id}
                disabled={Boolean(editingId)}
                onChange={(e) => {
                  setIdTouched(true);
                  setId(slugifyId(e.target.value));
                }}
                placeholder="production-incident-postmortem"
                className="w-full px-3.5 py-2 text-sm font-mono bg-paper border border-ink/20 rounded-xl text-ink disabled:opacity-60 focus:outline-none focus:border-accent"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-mono font-semibold text-ink-muted">
                Tên tiếng Việt (titleVI) *
              </label>
              <input
                type="text"
                value={titleVI}
                onChange={(e) => setTitleVI(e.target.value)}
                placeholder="VD: Họp Phân Tích Sự Cố Production"
                className="w-full px-3.5 py-2 text-sm bg-paper border border-ink/20 rounded-xl text-ink focus:outline-none focus:border-accent"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-mono font-semibold text-ink-muted">
                Vai trò người phỏng vấn / đối tác (roleVI) *
              </label>
              <input
                type="text"
                value={roleVI}
                onChange={(e) => setRoleVI(e.target.value)}
                placeholder="VD: Site Reliability Lead"
                className="w-full px-3.5 py-2 text-sm bg-paper border border-ink/20 rounded-xl text-ink focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-mono font-semibold text-ink-muted">
              Mô tả ngắn tiếng Việt (descriptionVI)
            </label>
            <textarea
              rows={2}
              value={descriptionVI}
              onChange={(e) => setDescriptionVI(e.target.value)}
              placeholder="Mô tả mục tiêu luyện tập cho sinh viên..."
              className="w-full px-3.5 py-2 text-sm bg-paper border border-ink/20 rounded-xl text-ink focus:outline-none focus:border-accent"
            />
          </div>

          <div className="space-y-2">
            <span className="block text-xs font-mono font-semibold text-ink-muted">
              Vai trò ưu tiên đề xuất (targetRoles)
            </span>
            <div className="flex flex-wrap gap-3">
              {ROLE_OPTIONS.map((role) => {
                const checked = targetRoles.includes(role.id);
                return (
                  <label
                    key={role.id}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-pill border text-xs font-mono cursor-pointer transition-colors ${
                      checked
                        ? "bg-ink text-white border-ink"
                        : "bg-paper text-ink border-ink/20 hover:bg-paper-muted"
                    }`}
                  >
                    <input
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

          {/* 3 Turns Editor */}
          <div className="space-y-4 pt-2">
            <h4 className="text-xs font-mono font-bold uppercase text-ink-muted">
              Nội dung 3 lượt hội thoại
            </h4>
            <div className="space-y-4">
              {turns.map((turn, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-paper border border-ink/15 space-y-3"
                >
                  <div className="text-xs font-mono font-bold text-accent">
                    Lượt {idx + 1} (Turn {idx})
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[11px] font-mono text-ink-muted">
                        Câu hỏi tiếng Anh (questionEN) *
                      </label>
                      <input
                        type="text"
                        value={turn.questionEN}
                        onChange={(e) => updateTurn(idx, "questionEN", e.target.value)}
                        placeholder="What caused the latency spike?"
                        className="w-full px-3 py-2 text-xs bg-white border border-ink/20 rounded-xl text-ink focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[11px] font-mono text-ink-muted">
                        Từ khóa kỳ vọng (phân tách dấu phẩy) *
                      </label>
                      <input
                        type="text"
                        value={turn.keywordsText}
                        onChange={(e) => updateTurn(idx, "keywordsText", e.target.value)}
                        placeholder="latency, database, root cause, rollback"
                        className="w-full px-3 py-2 text-xs font-mono bg-white border border-ink/20 rounded-xl text-ink focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[11px] font-mono text-ink-muted">
                        Câu trả lời mẫu (sampleAnswerEN)
                      </label>
                      <input
                        type="text"
                        value={turn.sampleAnswerEN}
                        onChange={(e) =>
                          updateTurn(idx, "sampleAnswerEN", e.target.value)
                        }
                        placeholder="The spike was caused by an unindexed query..."
                        className="w-full px-3 py-2 text-xs bg-white border border-ink/20 rounded-xl text-ink focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[11px] font-mono text-ink-muted">
                        Gợi ý tiếng Việt (hintVI)
                      </label>
                      <input
                        type="text"
                        value={turn.hintVI}
                        onChange={(e) => updateTurn(idx, "hintVI", e.target.value)}
                        placeholder="Nêu nguyên nhân gốc rễ và cách khắc phục..."
                        className="w-full px-3 py-2 text-xs bg-white border border-ink/20 rounded-xl text-ink focus:outline-none focus:border-accent"
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
              className="px-4 py-2 rounded-pill bg-white border border-ink/20 text-xs font-medium text-ink hover:bg-paper-muted"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 rounded-pill bg-accent text-white text-xs font-semibold hover:bg-accent-hover shadow-soft shadow-hard-press transition-all disabled:opacity-60"
            >
              {isSaving
                ? "Đang lưu..."
                : editingId
                ? "Lưu chỉnh sửa kịch bản"
                : "Tạo & đồng bộ kịch bản"}
            </button>
          </div>
        </form>
      )}

      {/* Scenarios List */}
      <div className="grid grid-cols-1 gap-4">
        {scenarios.map((scenario) => {
          const isBase = BASE_SCENARIO_IDS.has(scenario.id);
          const isOverridden = customIds.has(scenario.id);
          const isHidden = Boolean(scenario.isHidden || hiddenIds.has(scenario.id));

          return (
            <div
              key={scenario.id}
              className={`bg-white border rounded-2xl p-5 shadow-soft flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-opacity ${
                isHidden ? "border-ink/15 opacity-75" : "border-ink/15"
              }`}
            >
              <div className="space-y-2 min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-bold text-ink">
                    {scenario.titleVI}
                  </span>
                  <span className="text-xs font-mono text-ink-muted">
                    ({scenario.titleEN})
                  </span>
                  <span className="px-2 py-0.5 rounded-pill bg-paper border border-ink/15 text-[10px] font-mono text-ink-muted">
                    {scenario.id}
                  </span>
                  {!isBase ? (
                    <span className="px-2 py-0.5 rounded-pill bg-accent-light border border-accent/30 text-[10px] font-mono font-semibold text-ink">
                      Tùy chỉnh
                    </span>
                  ) : isOverridden ? (
                    <span className="px-2 py-0.5 rounded-pill bg-paper-muted border border-ink/20 text-[10px] font-mono font-semibold text-ink">
                      Mặc định (Đã sửa)
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-pill bg-paper border border-ink/15 text-[10px] font-mono text-ink-muted">
                      Mặc định
                    </span>
                  )}
                  {isHidden && (
                    <span className="px-2 py-0.5 rounded-pill bg-ink text-white text-[10px] font-mono">
                      Đang ẩn
                    </span>
                  )}
                </div>

                <p className="text-xs text-ink-muted leading-relaxed">
                  {scenario.descriptionVI}
                </p>

                <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-ink-muted">
                  <span className="px-2.5 py-0.5 rounded-pill bg-paper border border-ink/10 text-ink">
                    Vai trò hỏi: {scenario.roleVI}
                  </span>
                  <span>• {scenario.turns.length} lượt</span>
                  {scenario.targetRoles?.map((role) => (
                    <span
                      key={role}
                      className="px-2 py-0.5 rounded-pill bg-paper-muted border border-ink/15 text-[10px] uppercase text-ink"
                    >
                      {role}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => handleToggleHidden(scenario.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-paper border border-ink/15 text-xs font-medium text-ink hover:bg-paper-muted transition-colors disabled:opacity-50"
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
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-white border border-ink/20 text-xs font-medium text-ink hover:bg-paper-muted transition-colors disabled:opacity-50"
                >
                  <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Sửa</span>
                </button>

                {!isBase ? (
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => handleDeleteOrRestore(scenario)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-accent-light border border-accent/40 text-xs font-medium text-ink hover:bg-accent hover:text-white transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Xóa</span>
                  </button>
                ) : (isOverridden || isHidden) ? (
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => handleDeleteOrRestore(scenario)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-white border border-ink/20 text-xs font-medium text-ink-muted hover:text-ink hover:bg-paper-muted transition-colors disabled:opacity-50"
                  >
                    <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Khôi phục gốc</span>
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
