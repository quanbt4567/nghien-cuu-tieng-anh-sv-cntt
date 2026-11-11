"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Search, BookOpen, Volume2 } from "lucide-react";
import { VOCABULARY_LIST } from "../../data/scenarios";
import { VocabCard } from "../../components/vocabulary/VocabCard";

export default function VocabularyPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = VOCABULARY_LIST.filter(
    (item) =>
      item.term.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.meaningVI.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.exampleSentenceEN.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-paper-card text-ink text-xs font-medium border-2 border-ink shadow-hard hover:bg-paper-muted shadow-hard-press transition-all mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Trang chủ</span>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-ink flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-accent" />
            <span>12 Thuật Ngữ IT Thiết Yếu</span>
          </h1>
          <p className="text-xs text-ink-muted mt-1">
            Luyện phát âm chuẩn và nắm vững cách diễn đạt các thuật ngữ xuất hiện hàng ngày trong môi trường kỹ thuật.
          </p>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm kiếm thuật ngữ..."
            className="w-full pl-9 pr-3 py-2 text-xs font-mono bg-white border-2 border-ink rounded-pill text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent shadow-hard"
          />
        </div>
      </div>

      {/* Vocabulary Cards List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {filtered.map((item) => (
          <VocabCard key={item.id} item={item} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="bg-white border-2 border-ink rounded-2xl p-8 text-center text-xs text-ink-muted shadow-hard">
          Không tìm thấy thuật ngữ nào phù hợp với từ khóa "{searchQuery}".
        </div>
      )}
    </div>
  );
}

