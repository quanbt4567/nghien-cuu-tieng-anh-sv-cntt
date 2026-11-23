/**
 * Verified EF EPI 2025 Benchmark Data
 * STRICT CONSTITUTION REQUIREMENT (Principle I):
 * Only verified EF EPI 2025 numbers may be used.
 * Never attribute national scores to specific universities (e.g. "IUH students score 500").
 * Never invent job English requirements.
 */

export interface EfEpiSkillBreakdown {
  speaking: number;
  listening: number;
  writing: number;
  reading: number;
}

export interface EfEpiData {
  year: number;
  country: string;
  score: number;
  proficiencyBand: string;
  globalRank: number;
  totalCountries: number;
  asiaRank: number;
  totalAsiaCountries: number;
  targetDemographic: string;
  skills: EfEpiSkillBreakdown;
  summaryVI: string;
  sourceCitation: string;
}

export const EF_EPI_2025: EfEpiData = {
  year: 2025,
  country: "Việt Nam",
  score: 500,
  proficiencyBand: "Mức độ thông thạo Trung bình (Moderate)",
  globalRank: 64,
  totalCountries: 123,
  asiaRank: 7,
  totalAsiaCountries: 25,
  targetDemographic: "Người trưởng thành từ 18 tuổi trở lên trên toàn quốc",
  skills: {
    speaking: 461, // Weakest skill
    listening: 470,
    writing: 508,
    reading: 522,
  },
  summaryVI:
    "Theo chỉ số EF EPI 2025, điểm số tiếng Anh toàn quốc của Việt Nam đạt 500 điểm (xếp hạng 64/123 toàn cầu, hạng 7/25 châu Á). Kỹ năng Nói (Speaking) đạt 461 điểm, là kỹ năng yếu nhất trong 4 kỹ năng (Đọc: 522, Viết: 508, Nghe: 470).",
  sourceCitation: "Báo cáo Chỉ số Thông thạo Tiếng Anh Toàn cầu EF EPI 2025 (Adults 18+ Nationwide)",
};

