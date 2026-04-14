import { createSupabaseBrowserClient } from '$lib/api/supabase.js';
import { invalidate } from '$app/navigation';
import { browser } from '$app/environment';
import type { LayoutLoad } from './$types.js';

export const load: LayoutLoad = async ({ data, depends }) => {
  depends('supabase:auth');

  const supabase = createSupabaseBrowserClient();

  if (browser) {
    supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === 'SIGNED_OUT') return;
      if (newSession?.expires_at !== data.session?.expires_at) {
        invalidate('supabase:auth');
      }
    });
  }

  return { ...data, supabase };
};
