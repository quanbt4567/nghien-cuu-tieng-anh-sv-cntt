import { randomUUID } from "crypto";
import { NeonQueryFunction } from "@neondatabase/serverless";
import { EquippedCosmetics } from "../cosmetics";
import { getNeonSql, sanitizeDatabaseUrl } from "./neon";

export type ResearchCategory = "benchmark" | "hr_interview" | "tech_news" | "case_study";
export type ResearchSourceType = "ai_curated" | "admin_authored";
export type ResearchStatus = "pending_review" | "published" | "archived";

export interface ResearchMetricItem {
  label: string;
  value: string;
  highlight?: string;
}

export interface ResearchSourceUrl {
  title: string;
  url: string;
}

export interface ResearchArticle {
  id: string;
  slug: string;
  title: string;
  summary: string;
  contentMarkdown: string;
  category: ResearchCategory;
  metricsJson: ResearchMetricItem[];
  sourceType: ResearchSourceType;
  sourceUrls: ResearchSourceUrl[];
  status: ResearchStatus;
  createdAt: string;
  publishedAt: string | null;
}

export const EF_EPI_2025_SEED_ARTICLE = {
  id: "00000000-0000-4000-8000-000000002025",
  slug: "ef-epi-2025-vietnam-it-speaking-benchmark",
  title: "EF EPI 2025 Việt Nam: Điểm Nói (461) thấp hơn Đọc (522) — Thách thức giao tiếp của nhân lực CNTT",
  summary:
    "Phân tích số liệu EF EPI 2025 toàn quốc (500 điểm, hạng 64/123 thế giới, 7/25 châu Á) cho thấy kỹ năng Nói là điểm nghẽn lớn nhất cần luyện phản xạ theo tình huống công việc.",
  contentMarkdown: `## Tổng quan chỉ số EF EPI 2025 tại Việt Nam

Theo Báo cáo Chỉ số Thông thạo Tiếng Anh Toàn cầu **EF EPI 2025** (khảo sát nhóm người trưởng thành từ 18 tuổi trở lên trên toàn quốc), Việt Nam đạt **500 điểm** — thuộc mức độ thông thạo **Trung bình (Moderate)**.

- **Xếp hạng toàn cầu:** 64 / 123 quốc gia và vùng lãnh thổ
- **Xếp hạng khu vực châu Á:** 7 / 25 quốc gia

## Khoảng cách lớn giữa kỹ năng Đọc và kỹ năng Nói

Dữ liệu phân rã 4 kỹ năng cho thấy sự chênh lệch rõ rệt giữa năng lực tiếp nhận thụ động và phản xạ giao tiếp chủ động:

- **Reading (Đọc):** 522 điểm — kỹ năng mạnh nhất
- **Writing (Viết):** 508 điểm
- **Listening (Nghe):** 470 điểm
- **Speaking (Nói):** 461 điểm — kỹ năng yếu nhất

## Hàm ý đối với sinh viên và kỹ sư CNTT

Trong môi trường làm việc phần mềm (Daily Standup, Code Review, Bug Triage, Client Demo), kỹ sư CNTT thường đọc tài liệu kỹ thuật rất tốt nhưng gặp khó khăn khi diễn đạt ngắn gọn, đúng thuật ngữ và tự nhiên trong giao tiếp thời gian thực.

Việc chuyển từ học từ vựng rời rạc sang **luyện phản xạ nói theo tình huống công việc ngắn (3 lượt hội thoại)** giúp thu hẹp trực tiếp khoảng cách giữa điểm Đọc (522) và điểm Nói (461).`,
  category: "benchmark" as ResearchCategory,
  metricsJson: [
    { label: "Điểm EF EPI 2025 Việt Nam", value: "500", highlight: "Mức Trung bình (Moderate)" },
    { label: "Xếp hạng Toàn cầu", value: "64 / 123", highlight: "Châu Á: 7 / 25" },
    { label: "Kỹ năng Nói (Speaking)", value: "461", highlight: "Kỹ năng yếu nhất" },
    { label: "Kỹ năng Đọc (Reading)", value: "522", highlight: "+61 điểm so với Nói" },
  ] satisfies ResearchMetricItem[],
  sourceType: "admin_authored" as ResearchSourceType,
  sourceUrls: [
    {
      title: "EF English Proficiency Index 2025 — Vietnam",
      url: "https://www.ef.com/wwen/epi/regions/asia/vietnam/",
    },
  ] satisfies ResearchSourceUrl[],
  status: "published" as ResearchStatus,
};

export interface GuestPlayerRow {
  id: string;
  device_token_hash: string;
  transfer_code: string;
  display_name: string;
  avatar_url?: string | null;
  it_coins: number;
  total_points: number;
  streak_days: number;
  last_practice_date: string | null;
  equipped_title: string;
  equipped_ring: string;
  equipped_cosmetics?: EquippedCosmetics | string | null;
  owned_items: string[];
  ip_hash?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeaderboardEntry {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
  itCoins: number;
  totalPoints: number;
  streakDays: number;
  equippedTitle: string;
  equippedRing: string;
  equippedCosmetics?: EquippedCosmetics;
  rank: number;
  isCurrentUser?: boolean;
}

export interface PublicGuestPlayer {
  id: string;
  transferCode: string;
  displayName: string;
  avatarUrl?: string | null;
  itCoins: number;
  totalPoints: number;
  streakDays: number;
  lastPracticeDate: string | null;
  equippedTitle: string;
  equippedRing: string;
  equippedCosmetics?: EquippedCosmetics;
  ownedItems: string[];
}

let guestSchemaReadyUrl: string | null = null;
let guestSchemaInFlight: Promise<boolean> | null = null;

export async function initializeGuestPlayersSchema(
  sqlClient?: NeonQueryFunction<false, false> | null
): Promise<boolean> {
  const url = sanitizeDatabaseUrl(process.env.DATABASE_URL);
  const sql = sqlClient ?? getNeonSql();
  if (!url || !sql) return false;
  if (guestSchemaReadyUrl === url) return true;
  if (guestSchemaInFlight) return guestSchemaInFlight;

  guestSchemaInFlight = (async () => {
    try {
      await sql.transaction([
        sql`
          CREATE TABLE IF NOT EXISTS guest_players (
            id TEXT PRIMARY KEY,
            device_token_hash TEXT UNIQUE NOT NULL,
            transfer_code TEXT UNIQUE NOT NULL,
            display_name TEXT NOT NULL,
            avatar_url TEXT,
            it_coins INT NOT NULL DEFAULT 0,
            total_points INT NOT NULL DEFAULT 0,
            streak_days INT NOT NULL DEFAULT 0,
            last_practice_date TEXT,
            equipped_title TEXT NOT NULL DEFAULT 'Junior Speaker',
            equipped_ring TEXT NOT NULL DEFAULT 'default',
            equipped_cosmetics JSONB NOT NULL DEFAULT '{}'::jsonb,
            owned_items JSONB NOT NULL DEFAULT '[]'::jsonb,
            ip_hash TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `,
        sql`
          ALTER TABLE guest_players
          ADD COLUMN IF NOT EXISTS ip_hash TEXT
        `,
        sql`
          ALTER TABLE guest_players
          ADD COLUMN IF NOT EXISTS equipped_cosmetics JSONB NOT NULL DEFAULT '{}'::jsonb
        `,
        sql`
          ALTER TABLE guest_players
          ADD COLUMN IF NOT EXISTS avatar_url TEXT
        `,
        sql`
          CREATE INDEX IF NOT EXISTS idx_guest_players_leaderboard
          ON guest_players (it_coins DESC, total_points DESC)
        `,
        sql`
          CREATE INDEX IF NOT EXISTS idx_guest_players_ip_created
          ON guest_players (ip_hash, created_at DESC)
        `,
        sql`
          CREATE INDEX IF NOT EXISTS idx_guest_players_zero_coin_cleanup
          ON guest_players (it_coins, updated_at)
        `,
        sql`
          CREATE TABLE IF NOT EXISTS research_articles (
            id UUID PRIMARY KEY,
            slug VARCHAR(160) UNIQUE NOT NULL,
            title TEXT NOT NULL,
            summary TEXT NOT NULL,
            content_markdown TEXT NOT NULL,
            category VARCHAR(32) NOT NULL,
            metrics_json JSONB NOT NULL DEFAULT '[]'::jsonb,
            source_type VARCHAR(32) NOT NULL,
            source_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
            status VARCHAR(32) NOT NULL DEFAULT 'pending_review',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            published_at TIMESTAMPTZ
          )
        `,
        sql`
          CREATE INDEX IF NOT EXISTS idx_research_articles_status_published
          ON research_articles (status, published_at DESC, created_at DESC)
        `,
        sql`
          INSERT INTO research_articles (
            id,
            slug,
            title,
            summary,
            content_markdown,
            category,
            metrics_json,
            source_type,
            source_urls,
            status,
            published_at
          )
          VALUES (
            ${EF_EPI_2025_SEED_ARTICLE.id}::uuid,
            ${EF_EPI_2025_SEED_ARTICLE.slug},
            ${EF_EPI_2025_SEED_ARTICLE.title},
            ${EF_EPI_2025_SEED_ARTICLE.summary},
            ${EF_EPI_2025_SEED_ARTICLE.contentMarkdown},
            ${EF_EPI_2025_SEED_ARTICLE.category},
            ${JSON.stringify(EF_EPI_2025_SEED_ARTICLE.metricsJson)}::jsonb,
            ${EF_EPI_2025_SEED_ARTICLE.sourceType},
            ${JSON.stringify(EF_EPI_2025_SEED_ARTICLE.sourceUrls)}::jsonb,
            ${EF_EPI_2025_SEED_ARTICLE.status},
            NOW()
          )
          ON CONFLICT (slug) DO NOTHING
        `,
      ]);
      void randomUUID;
      guestSchemaReadyUrl = url;
      return true;
    } catch {
      guestSchemaReadyUrl = null;
      return false;
    } finally {
      guestSchemaInFlight = null;
    }
  })();

  return guestSchemaInFlight;
}

