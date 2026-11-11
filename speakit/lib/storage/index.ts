import { SupabaseAdapter } from "./supabaseAdapter";
import { IStorageAdapter } from "./types";

// Singleton storage adapter providing transparent Supabase + localStorage fallback
export const storageAdapter: IStorageAdapter = new SupabaseAdapter();

export * from "./types";
export * from "./localStorageAdapter";
export * from "./supabaseAdapter";

