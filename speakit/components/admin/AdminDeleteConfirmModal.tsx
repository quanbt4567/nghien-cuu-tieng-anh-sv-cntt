"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, CheckSquare, Loader2, Square, Trash2, X } from "lucide-react";
import { DELETE_CONFIRM_KEYWORD, isDeleteConfirmationMatch } from "../../lib/adminBulkDelete";

export interface DeleteConfirmRequest {
  title: string;
  description: string;
  itemCount: number;
  itemPreviewLabels?: string[];
  confirmButtonLabel?: string;
  onConfirm: () => Promise<boolean | void>;
}

interface AdminDeleteConfirmModalProps {
  request: DeleteConfirmRequest | null;
  onClose: () => void;
}

export function AdminDeleteConfirmModal({
  request,
  onClose,
}: AdminDeleteConfirmModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [confirmInput, setConfirmInput] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setStep(1);
    setConfirmInput("");
    setIsDeleting(false);
  }, [request]);

  useEffect(() => {
    if (!request) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isDeleting) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [request, isDeleting, onClose]);

  if (!request) return null;

  const canConfirm = isDeleteConfirmationMatch(confirmInput);
  const previewLabels = (request.itemPreviewLabels ?? []).slice(0, 6);
  const remainingPreview = Math.max(0, request.itemCount - previewLabels.length);

  const executeConfirm = async () => {
    if (!canConfirm || isDeleting) return;
    setIsDeleting(true);
    try {
      const outcome = await request.onConfirm();
      if (outcome !== false) {
        onClose();
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSubmitStep2 = (event: FormEvent) => {
    event.preventDefault();
    void executeConfirm();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 backdrop-blur-md p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-delete-modal-title"
      onClick={() => {
        if (!isDeleting) onClose();
      }}
    >
      <div
        className="w-full max-w-md bg-white/95 backdrop-blur-2xl border border-slate-200/85 rounded-3xl shadow-[0_20px_56px_rgba(15,23,42,0.18),inset_0_1px_1px_rgba(255,255,255,0.95)] overflow-hidden text-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 bg-slate-100/80 border-b border-slate-200/85">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-rose-100 border border-rose-300/80 text-rose-700">
              <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
            </span>
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-rose-800">
              Bước {step} / 2 · {step === 1 ? "Xác nhận xóa" : `Nhập "${DELETE_CONFIRM_KEYWORD}"`}
            </span>
          </div>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onClose}
            aria-label="Đóng hộp thoại xác nhận"
            className="liquid-glass-btn w-7 h-7 rounded-full flex items-center justify-center disabled:opacity-50"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>

        {step === 1 ? (
          <div className="p-5 space-y-4">
            <div className="space-y-1.5">
              <h3 id="admin-delete-modal-title" className="text-base font-bold text-slate-900 leading-snug">
                {request.title}
              </h3>
              <p className="text-xs text-slate-700 leading-relaxed">{request.description}</p>
            </div>

            {previewLabels.length > 0 && (
              <div className="p-3 rounded-xl bg-slate-50/90 border border-slate-200/85 space-y-1.5">
                <p className="text-[11px] font-mono font-semibold text-slate-700 uppercase">
                  Mục sẽ bị xóa ({request.itemCount}):
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {previewLabels.map((label, idx) => (
                    <span
                      key={`${label}-${idx}`}
                      className="px-2 py-0.5 rounded-full bg-white/90 border border-slate-200/85 text-[11px] font-mono text-slate-800 max-w-[200px] truncate"
                    >
                      {label}
                    </span>
                  ))}
                  {remainingPreview > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-rose-100/90 border border-rose-300/80 text-[11px] font-mono font-semibold text-rose-800">
                      +{remainingPreview} mục khác
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="liquid-glass-btn px-4 py-2 rounded-full text-xs font-semibold"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmInput("");
                  setStep(2);
                }}
                className="liquid-btn-danger inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold"
              >
                <span>Chắc chắn, tiếp tục</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmitStep2} className="p-5 space-y-4">
            <div className="space-y-1.5">
              <h3 id="admin-delete-modal-title" className="text-base font-bold text-slate-900 leading-snug">
                Nhập chữ <code className="px-1.5 py-0.5 rounded bg-rose-100 border border-rose-300/80 font-mono text-rose-800">{DELETE_CONFIRM_KEYWORD}</code> để xóa
              </h3>
              <p className="text-xs text-slate-700 leading-relaxed">
                Để tránh xóa nhầm ({request.itemCount} mục), vui lòng gõ chính xác chữ{" "}
                <strong className="font-mono text-rose-700">{DELETE_CONFIRM_KEYWORD}</strong> vào ô bên dưới để mở khóa nút xóa.
              </p>
            </div>

            <div className="space-y-1.5">
              <input
                type="text"
                autoFocus
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                disabled={isDeleting}
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                placeholder={`Nhập chữ ${DELETE_CONFIRM_KEYWORD}...`}
                aria-label={`Nhập chữ ${DELETE_CONFIRM_KEYWORD} để xác nhận xóa`}
                className="liquid-glass-input w-full px-3.5 py-2.5 text-sm font-mono rounded-xl focus:border-rose-400"
              />
              {confirmInput.length > 0 && !canConfirm && (
                <p className="text-[11px] font-mono text-rose-700">
                  Cần nhập chính xác chữ &ldquo;{DELETE_CONFIRM_KEYWORD}&rdquo; để tiếp tục.
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setStep(1)}
                className="liquid-glass-btn inline-flex items-center gap-1 px-3 py-2 rounded-full text-xs font-medium disabled:opacity-50"
              >
                <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Quay lại</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={onClose}
                  className="liquid-glass-btn px-3.5 py-2 rounded-full text-xs font-semibold disabled:opacity-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={!canConfirm || isDeleting}
                  className="liquid-btn-danger inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isDeleting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  )}
                  <span>
                    {isDeleting
                      ? "Đang xóa..."
                      : request.confirmButtonLabel || `Xác nhận xóa (${request.itemCount})`}
                  </span>
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

interface AdminBulkActionBarProps {
  selectedCount: number;
  totalFilteredCount: number;
  allPageSelected: boolean;
  pageCount: number;
  itemUnitLabel: string;
  disabled?: boolean;
  onToggleSelectPage: () => void;
  onSelectAllFiltered: () => void;
  onClearSelection: () => void;
  onBulkDelete: () => void;
}

export function AdminBulkActionBar({
  selectedCount,
  totalFilteredCount,
  allPageSelected,
  pageCount,
  itemUnitLabel,
  disabled = false,
  onToggleSelectPage,
  onSelectAllFiltered,
  onClearSelection,
  onBulkDelete,
}: AdminBulkActionBarProps) {
  if (totalFilteredCount === 0 && selectedCount === 0) return null;

  return (
    <div className="liquid-glass-card-lite px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={disabled || pageCount === 0}
          onClick={onToggleSelectPage}
          className="liquid-glass-btn inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold disabled:opacity-50"
        >
          {allPageSelected && pageCount > 0 ? (
            <CheckSquare className="w-3.5 h-3.5 text-sky-600" aria-hidden="true" />
          ) : (
            <Square className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
          )}
          <span>{allPageSelected ? "Bỏ chọn trang này" : `Chọn trang này (${pageCount})`}</span>
        </button>

        {totalFilteredCount > pageCount && selectedCount < totalFilteredCount && (
          <button
            type="button"
            disabled={disabled}
            onClick={onSelectAllFiltered}
            className="liquid-glass-btn px-3 py-1 rounded-full text-xs font-mono font-medium disabled:opacity-50"
          >
            Chọn tất cả ({totalFilteredCount})
          </button>
        )}

        {selectedCount > 0 && (
          <>
            <span className="px-2.5 py-0.5 rounded-full bg-sky-100/90 border border-sky-300/80 text-xs font-mono font-bold text-sky-800">
              Đã chọn {selectedCount} {itemUnitLabel}
            </span>
            <button
              type="button"
              disabled={disabled}
              onClick={onClearSelection}
              className="text-xs font-mono text-slate-700 hover:text-slate-900 underline underline-offset-2 disabled:opacity-50"
            >
              Bỏ chọn
            </button>
          </>
        )}
      </div>

      {selectedCount > 0 && (
        <button
          type="button"
          disabled={disabled}
          onClick={onBulkDelete}
          className="liquid-btn-danger inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold disabled:opacity-50"
        >
          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Xóa hàng loạt ({selectedCount})</span>
        </button>
      )}
    </div>
  );
}
