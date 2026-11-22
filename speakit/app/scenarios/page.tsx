import Link from "next/link";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { HomeOnboardingClient } from "../../components/home/HomeOnboardingClient";
import { getMergedScenarios } from "../../lib/serverScenarios";

export const dynamic = "force-dynamic";

export default async function ScenariosPage() {
  const scenarios = await getMergedScenarios();
  const scenarioCount = scenarios.length;

  return (
    <div className="max-w-5xl mx-auto px-4 py-7 sm:py-9 space-y-6">
      <div>
        <Link
          href="/"
          className="liquid-glass-btn inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-sky-600" aria-hidden="true" />
          <span>Trang chủ</span>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <MessageSquare className="w-6 h-6 text-sky-600" aria-hidden="true" />
          <span>Kịch bản luyện nói IT</span>
        </h1>
        <p className="text-xs text-slate-600 mt-1.5">
          Chọn vai trò CNTT (Frontend, Backend, DevOps, QA) và mức độ khó phù hợp để luyện tập {scenarioCount} tình huống giao tiếp công việc thực tế.
        </p>
      </div>

      <HomeOnboardingClient />
    </div>
  );
}
