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
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 backdrop-blur-[1px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-delete-modal-title"
      onClick={() => {
        if (!isDeleting) onClose();
      }}
    >
      <div
        className="w-full max-w-md bg-white border border-ink/15 rounded-2xl shadow-hard overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 bg-paper border-b border-ink/15">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-rose-600 text-white">
              <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
            </span>
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-rose-700">
              Bước {step} / 2 · {step === 1 ? "Xác nhận xóa" : `Nhập "${DELETE_CONFIRM_KEYWORD}"`}
            </span>
          </div>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onClose}
            aria-label="Đóng hộp thoại xác nhận"
            className="w-7 h-7 rounded-full border border-ink/15 bg-white flex items-center justify-center text-ink-muted hover:text-ink disabled:opacity-50"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>

        {step === 1 ? (
          <div className="p-5 space-y-4">
            <div className="space-y-1.5">
              <h3 id="admin-delete-modal-title" className="text-base font-bold text-ink leading-snug">
                {request.title}
              </h3>
              <p className="text-xs text-ink-muted leading-relaxed">{request.description}</p>
            </div>

            {previewLabels.length > 0 && (
              <div className="p-3 rounded-xl bg-paper border border-ink/15 space-y-1.5">
                <p className="text-[11px] font-mono font-semibold text-ink-muted uppercase">
                  Mục sẽ bị xóa ({request.itemCount}):
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {previewLabels.map((label, idx) => (
                    <span
                      key={`${label}-${idx}`}
                      className="px-2 py-0.5 rounded-pill bg-white border border-ink/15 text-[11px] font-mono text-ink max-w-[200px] truncate"
                    >
                      {label}
                    </span>
                  ))}
                  {remainingPreview > 0 && (
                    <span className="px-2 py-0.5 rounded-pill bg-rose-50 border border-rose-200 text-[11px] font-mono font-semibold text-rose-700">
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
                className="px-4 py-2 rounded-pill bg-paper border border-ink/20 text-xs font-semibold text-ink hover:bg-paper-muted"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmInput("");
                  setStep(2);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-pill bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-colors"
              >
                <span>Chắc chắn, tiếp tục</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmitStep2} className="p-5 space-y-4">
            <div className="space-y-1.5">
              <h3 id="admin-delete-modal-title" className="text-base font-bold text-ink leading-snug">
                Nhập chữ <code className="px-1.5 py-0.5 rounded bg-rose-50 border border-rose-200 font-mono text-rose-700">{DELETE_CONFIRM_KEYWORD}</code> để xóa
              </h3>
              <p className="text-xs text-ink-muted leading-relaxed">
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
                className="w-full px-3.5 py-2.5 text-sm font-mono bg-paper border-2 border-ink/25 rounded-xl text-ink focus:outline-none focus:border-rose-600"
              />
              {confirmInput.length > 0 && !canConfirm && (
                <p className="text-[11px] font-mono text-rose-600">
                  Cần nhập chính xác chữ &ldquo;{DELETE_CONFIRM_KEYWORD}&rdquo; để tiếp tục.
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-pill bg-paper border border-ink/20 text-xs font-medium text-ink hover:bg-paper-muted disabled:opacity-50"
              >
                <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Quay lại</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={onClose}
                  className="px-3.5 py-2 rounded-pill bg-paper border border-ink/20 text-xs font-semibold text-ink hover:bg-paper-muted disabled:opacity-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={!canConfirm || isDeleting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-pill bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
    <div className="bg-white border border-ink/15 rounded-2xl px-3.5 py-2.5 shadow-soft flex flex-wrap items-center justify-between gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={disabled || pageCount === 0}
          onClick={onToggleSelectPage}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-pill bg-paper border border-ink/20 text-xs font-semibold text-ink hover:bg-paper-muted transition-colors disabled:opacity-50"
        >
          {allPageSelected && pageCount > 0 ? (
            <CheckSquare className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
          ) : (
            <Square className="w-3.5 h-3.5 text-ink-muted" aria-hidden="true" />
          )}
          <span>{allPageSelected ? "Bỏ chọn trang này" : `Chọn trang này (${pageCount})`}</span>
        </button>

        {totalFilteredCount > pageCount && selectedCount < totalFilteredCount && (
          <button
            type="button"
            disabled={disabled}
            onClick={onSelectAllFiltered}
            className="px-3 py-1 rounded-pill bg-paper border border-ink/15 text-xs font-mono font-medium text-ink-muted hover:text-ink transition-colors disabled:opacity-50"
          >
            Chọn tất cả ({totalFilteredCount})
          </button>
        )}

        {selectedCount > 0 && (
          <>
            <span className="px-2.5 py-0.5 rounded-pill bg-accent-light border border-accent/30 text-xs font-mono font-bold text-ink">
              Đã chọn {selectedCount} {itemUnitLabel}
            </span>
            <button
              type="button"
              disabled={disabled}
              onClick={onClearSelection}
              className="text-xs font-mono text-ink-muted hover:text-ink underline underline-offset-2 disabled:opacity-50"
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
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-pill bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 shadow-soft transition-colors disabled:opacity-50"
        >
          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Xóa hàng loạt ({selectedCount})</span>
        </button>
      )}
    </div>
  );
}
