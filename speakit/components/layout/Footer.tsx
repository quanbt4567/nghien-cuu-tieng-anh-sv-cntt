import Image from "next/image";

export function Footer() {
  return (
    <footer className="mt-auto border-t-2 border-ink bg-paper-muted py-6 px-4">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-ink-muted">
        <div className="flex items-center gap-2.5 text-center sm:text-left">
          <Image
            src="/logo-icon.png"
            alt="SpeakIT"
            width={24}
            height={24}
            className="w-6 h-6 object-contain rounded-md"
          />
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
            <span className="font-semibold text-ink">SpeakIT</span>
            <span className="hidden sm:inline">•</span>
            <span>
              Nghiên cứu ứng dụng luyện nói tiếng Anh tình huống CNTT (IUH & BCN Club)
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4 font-mono text-[11px]">
          <span>EF EPI 2025: VN 500 (Speaking 461)</span>
          <span>•</span>
          <span className="text-accent font-semibold">Bản nghiên cứu mở</span>
        </div>
      </div>
    </footer>
  );
}

