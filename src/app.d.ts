import type { SupabaseClient, Session, User } from '@supabase/supabase-js';
import type { Database, Persona, Household } from '$lib/types/database.js';

declare global {
  namespace App {
    // Переиспользуем типы из database.ts
    type Persona = import('$lib/types/database.js').Persona;
    type Household = import('$lib/types/database.js').Household;

    interface Locals {
      supabase: SupabaseClient<Database>;
      safeGetSession: () => Promise<{ session: Session | null; user: User | null }>;
    }

    interface PageData {
      session: Session | null;
      user: User | null;
      household: Household | null;
      householdId: string | null;
      ownHouseholdId: string | null;
      isOwner: boolean;
      persona: Persona | null;
      personas: Persona[];
    }
  }
}

export {};
