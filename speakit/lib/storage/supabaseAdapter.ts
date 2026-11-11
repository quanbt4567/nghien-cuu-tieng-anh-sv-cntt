import { PracticeAttempt, ScenarioId, UserSettings, WeakPoint } from "../types";
import { LocalStorageAdapter } from "./localStorageAdapter";
import { getSupabaseClient } from "./supabaseClient";
import { IStorageAdapter } from "./types";

export class SupabaseAdapter implements IStorageAdapter {
  private localFallback = new LocalStorageAdapter();

  async saveAttempt(
    data: Omit<PracticeAttempt, "id" | "created_at">
  ): Promise<PracticeAttempt> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return this.localFallback.saveAttempt(data);
    }

    try {
      const { data: inserted, error } = await supabase
        .from("attempts")
        .insert({
          scenario: data.scenario,
          turn_index: data.turn_index,
          transcript: data.transcript,
          score: data.score,
          keywords_used: data.keywords_used,
        })
        .select()
        .single();

      if (error || !inserted) {
        return this.localFallback.saveAttempt(data);
      }

      // Also mirror to local storage for offline resilience
      await this.localFallback.saveAttempt(data);

      return {
        id: inserted.id,
        scenario: inserted.scenario,
        turn_index: inserted.turn_index,
        transcript: inserted.transcript,
        score: inserted.score,
        keywords_used: inserted.keywords_used,
        created_at: inserted.created_at,
      };
    } catch {
      return this.localFallback.saveAttempt(data);
    }
  }

  async getAttempts(scenario?: ScenarioId): Promise<PracticeAttempt[]> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return this.localFallback.getAttempts(scenario);
    }

    try {
      let query = supabase
        .from("attempts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (scenario) {
        query = query.eq("scenario", scenario);
      }

      const { data, error } = await query;
      if (error || !data || data.length === 0) {
        return this.localFallback.getAttempts(scenario);
      }

      return data.map((d: any) => ({
        id: d.id,
        scenario: d.scenario,
        turn_index: d.turn_index,
        transcript: d.transcript,
        score: d.score,
        keywords_used: d.keywords_used || [],
        created_at: d.created_at,
      }));
    } catch {
      return this.localFallback.getAttempts(scenario);
    }
  }

  async recordWeakPoints(
    missedKeywords: string[],
    grammarIssues: string[]
  ): Promise<void> {
    // Always mirror to localStorage
    await this.localFallback.recordWeakPoints(missedKeywords, grammarIssues);

    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      const now = new Date().toISOString();

      for (const kw of missedKeywords) {
        const clean = kw.trim().toLowerCase();
        if (!clean) continue;
        // Upsert into Supabase weak_points
        const { data: existing } = await supabase
          .from("weak_points")
          .select("id, miss_count")
          .eq("kind", "keyword")
          .eq("value", clean)
          .maybeSingle();

        if (existing) {
          await supabase
            .from("weak_points")
            .update({ miss_count: existing.miss_count + 1, updated_at: now })
            .eq("id", existing.id);
        } else {
          await supabase.from("weak_points").insert({
            kind: "keyword",
            value: clean,
            miss_count: 1,
            updated_at: now,
          });
        }
      }

      for (const gm of grammarIssues) {
        const clean = gm.trim().toLowerCase();
        if (!clean) continue;
        const { data: existing } = await supabase
          .from("weak_points")
          .select("id, miss_count")
          .eq("kind", "grammar")
          .eq("value", clean)
          .maybeSingle();

        if (existing) {
          await supabase
            .from("weak_points")
            .update({ miss_count: existing.miss_count + 1, updated_at: now })
            .eq("id", existing.id);
        } else {
          await supabase.from("weak_points").insert({
            kind: "grammar",
            value: clean,
            miss_count: 1,
            updated_at: now,
          });
        }
      }
    } catch {
      // ignore network errors, localStorage was already updated
    }
  }

  async getWeakPoints(limit: number = 50): Promise<WeakPoint[]> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return this.localFallback.getWeakPoints(limit);
    }

    try {
      const { data, error } = await supabase
        .from("weak_points")
        .select("*")
        .order("miss_count", { ascending: false })
        .limit(limit);

      if (error || !data || data.length === 0) {
        return this.localFallback.getWeakPoints(limit);
      }

      return data.map((d: any) => ({
        id: d.id,
        kind: d.kind,
        value: d.value,
        miss_count: d.miss_count,
        updated_at: d.updated_at,
      }));
    } catch {
      return this.localFallback.getWeakPoints(limit);
    }
  }

  // Settings & Gemini API key NEVER go to Supabase per Constitution Principle II
  getSettings(): UserSettings {
    return this.localFallback.getSettings();
  }

  saveSettings(settings: Partial<UserSettings>): void {
    this.localFallback.saveSettings(settings);
  }

  async resetAll(): Promise<void> {
    await this.localFallback.resetAll();
    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      // In prototype mode with anonymous access, clear public attempts
      await supabase.from("attempts").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("weak_points").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    } catch {
      // ignore
    }
  }
}

