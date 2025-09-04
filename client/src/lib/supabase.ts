import { createClient } from "@supabase/supabase-js";

// Helper om camelCase → snake_case om te zetten
function remapKeys(o: any, map: Record<string, string>): any {
  if (!o || typeof o !== "object" || Array.isArray(o)) return o;
  const out: any = {};
  for (const [k, v] of Object.entries(o)) {
    const nk = map[k] ?? k;
    out[nk] = remapKeys(v, map);
  }
  return out;
}

function maybeRemap(body: any, map: Record<string, string>): string {
  if (!body) return body;
  try {
    const data = typeof body === "string" ? JSON.parse(body) : body;
    const out = Array.isArray(data) ? data.map((d) => remapKeys(d, map)) : remapKeys(data, map);
    return JSON.stringify(out);
  } catch {
    return body;
  }
}

const MAPPINGS: Array<{ re: RegExp; map: Record<string, string> }> = [
  { 
    re: /\/rest\/v1\/tasks(\b|\/|\?)/, 
    map: { 
      userId: "user_id", 
      courseId: "course_id", 
      estMinutes: "est_minutes", 
      createdAt: "created_at", 
      startsAt: "starts_at", 
      endsAt: "ends_at" 
    } 
  },
  { 
    re: /\/rest\/v1\/courses(\b|\/|\?)/, 
    map: { 
      userId: "user_id", 
      createdAt: "created_at" 
    } 
  },
  { 
    re: /\/rest\/v1\/schedule(\b|\/|\?)/, 
    map: { 
      userId: "user_id", 
      courseId: "course_id", 
      startsAt: "starts_at", 
      endsAt: "ends_at" 
    } 
  },
  { 
    re: /\/rest\/v1\/chatsessies(\b|\/|\?)/, 
    map: { 
      userId: "user_id", 
      updatedAt: "updated_at" 
    } 
  },
];

// Environment variable detection with better fallback logic
function getEnvVar(key: string): string | undefined {
  // Check if we're in a Vite environment
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env[key];
  }
  
  // Fallback to Node.js environment
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key];
  }
  
  return undefined;
}

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY');

if (!supabaseUrl || !supabaseAnonKey) {
  const missingVars = [];
  if (!supabaseUrl) missingVars.push('VITE_SUPABASE_URL');
  if (!supabaseAnonKey) missingVars.push('VITE_SUPABASE_ANON_KEY');
  
  throw new Error(`Ontbrekende environment variabelen: ${missingVars.join(', ')}. Controleer uw .env bestand.`);
}

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    global: {
      fetch: async (input: RequestInfo, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        
        if (init?.body) {
          for (const { re, map } of MAPPINGS) {
            if (re.test(url)) {
              init.body = maybeRemap(init.body, map);
              break;
            }
          }
        }
        
        return fetch(input, init);
      },
    },
  }
);