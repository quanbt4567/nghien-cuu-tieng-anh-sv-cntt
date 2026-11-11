import { SupabaseAdapter } from "./supabaseAdapter";
import { StorageAdapter } from "../types";

// Singleton storage adapter providing transparent Supabase + localStorage fallback
export const storageAdapter: StorageAdapter = new SupabaseAdapter();

export * from "./localStorageAdapter";
export * from "./supabaseAdapter";

