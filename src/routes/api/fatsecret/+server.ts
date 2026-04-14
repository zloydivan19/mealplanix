import { json, error } from '@sveltejs/kit';
import { FATSECRET_CLIENT_ID, FATSECRET_SECRET } from '$env/static/private';
import type { RequestHandler } from './$types.js';

// ── Token cache ──────────────────────────────────────────────────────────
let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;

  const body = new URLSearchParams({
    grant_type:    'client_credentials',
    client_id:     FATSECRET_CLIENT_ID,
    client_secret: FATSECRET_SECRET,
    scope:         'basic',
  });

  const res = await fetch('https://oauth.fatsecret.com/connect/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) throw new Error(`FatSecret token error: ${res.status}`);

  const data = await res.json();
  cachedToken    = data.access_token as string;
  tokenExpiresAt = Date.now() + (data.expires_in - 300) * 1000;
  return cachedToken;
}

// ── Result type ──────────────────────────────────────────────────────────
export interface FoodResult {
  id:      string;
  name:    string;
  kcal:    number;
  protein: number;
  fat:     number;
  carbs:   number;
}

// ── Parse one food entry (foods.search format) ───────────────────────────
// foods.search returns food_description like:
// "Per 100g - Calories: 52kcal | Fat: 0.17g | Carbs: 13.81g | Protein: 0.26g"
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseFood(food: any): FoodResult | null {
  if (!food) return null;

  const desc: string = food.food_description ?? '';

  const get = (key: string): number => {
    const m = desc.match(new RegExp(key + '[:\\s]+([\\d.]+)', 'i'));
    return m ? Math.round(parseFloat(m[1]) * 10) / 10 : 0;
  };

  const kcal    = Math.round(get('Calories'));
  const fat     = get('Fat');
  const carbs   = get('Carbs');
  const protein = get('Protein');

  if (!kcal && !protein && !fat && !carbs) return null;

  return {
    id:      String(food.food_id ?? ''),
    name:    String(food.food_name ?? ''),
    kcal,
    protein,
    fat,
    carbs,
  };
}

// ── GET /api/fatsecret?q=...&max=10 ─────────────────────────────────────
export const GET: RequestHandler = async ({ url }) => {
  const q   = url.searchParams.get('q')?.trim();
  const max = Math.min(Number(url.searchParams.get('max') ?? 10), 20);

  if (!q || q.length < 3) return json([]);

  let token: string;
  try {
    token = await getToken();
  } catch (e) {
    console.error('FatSecret token error:', e);
    throw error(502, 'FatSecret auth failed');
  }

  const params = new URLSearchParams({
    method:            'foods.search',
    search_expression: q,
    format:            'json',
    max_results:       String(max),
  });

  let res: Response;
  try {
    res = await fetch(`https://platform.fatsecret.com/rest/server.api?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (e) {
    console.error('FatSecret fetch error:', e);
    throw error(502, 'FatSecret unreachable');
  }

  const raw = await res.json();

  // Log structure in dev so we can debug
  if (!res.ok || raw?.error) {
    console.error('FatSecret API error:', JSON.stringify(raw));
    throw error(502, raw?.error?.message ?? `FatSecret error ${res.status}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const foods: any[] = raw?.foods?.food ?? [];
  const list = Array.isArray(foods) ? foods : [foods];

  const results: FoodResult[] = list
    .map(parseFood)
    .filter((f): f is FoodResult => f !== null && f.kcal > 0);

  return json(results);
};
