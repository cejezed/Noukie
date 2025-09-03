// src/lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

// — helpers om camelCase → snake_case in JSON body om te zetten
function remapKeys(o: any, map: Record<string, string>) {
  if (!o || typeof o !== "object" || Array.isArray(o)) return o;
  const out: any = {};
  for (const [k, v] of Object.entries(o)) {
    const nk = map[k] ?? k;
    out[nk] = remapKeys(v, map);
  }
  return out;
}
function maybeRemap(body: any, map: Record<string, string>) {
  if (!body) return body;
  try {
    const data = typeof body === "string" ? JSON.parse(body) : body;
    const out = Array.isArray(data) ? data.map((d) => remapKeys(d, map)) : remapKeys(data, map);
    return JSON.stringify(out);
  } catch {
    return body; // geen JSON → laat met rust
  }
}

// mappings voor endpoints
const MAPPINGS: Array<{ re: RegExp; map: Record<string, string> }> = [
  {
    re: /\/rest\/v1\/tasks(\b|\/|\?)/,
    map: {
      userId: "user_id",
      courseId: "course_id",
      estMinutes: "est_minutes",
      createdAt: "created_at",
      startsAt: "starts_at",
      endsAt: "ends_at",
    },
  },
  {
    re: /\/rest\/v1\/courses(\b|\/|\?)/,
    map: { userId: "user_id", createdAt: "created_at" },
  },
  {
    re: /\/rest\/v1\/schedule(\b|\/|\?)/,
    map: { userId: "user_id", courseId: "course_id", startsAt: "starts_at", endsAt: "ends_at" },
  },
  // --- NIEUWE REGEL HIERONDER TOEGEVOEGD ---
  {
    re: /\/rest\/v1\/chatsessies(\b|\/|\?)/,
    map: { userId: "user_id", updatedAt: "updated_at" },
  },
];

//... (uw helper functies en MAPPINGS blijven hetzelfde)

// VERVANG DE OUDE CREATECLIENT DOOR DEZE:
export const supabase = createClient(
  // Gebruik de VITE_ prefix voor zowel client als server
  (typeof window!== 'undefined'? import.meta.env.VITE_SUPABASE_URL : process.env.VITE_SUPABASE_URL)!,
  (typeof window!== 'undefined'? import.meta.env.VITE_SUPABASE_ANON_KEY : process.env.VITE_SUPABASE_ANON_KEY)!,
  {
    global: {
      fetch: async (input: RequestInfo, init?: RequestInit) => {
        const url = typeof input === "string"? input : input.toString();
        if (init?.body) {
          for (const { re, map } of MAPPINGS) {
            if (re.test(url)) {
              init.body = maybeRemap(init.body, map);
              break;
            }
          }
        }
        return fetch(input as any, init);
      },
    },
  }
);