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
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 hover:border-blue-700 dark:hover:border-blue-500 text-xs font-semibold transition-colors mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" aria-hidden="true" />
          <span>Trang chủ</span>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 flex items-center gap-2">
          <MessageSquare className="w-6 h-6 text-blue-700 dark:text-blue-400" aria-hidden="true" />
          <span>Kịch bản luyện nói IT</span>
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">
          Chọn vai trò CNTT (Frontend, Backend, DevOps, QA) và mức độ khó phù hợp để luyện tập {scenarioCount} tình huống giao tiếp công việc thực tế.
        </p>
      </div>

      <HomeOnboardingClient />
    </div>
  );
}
