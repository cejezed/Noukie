// src/lib/snake.ts
function camelToSnake(s: string) {
  return s.replace(/([A-Z])/g, "_$1").toLowerCase();
}
export function toSnake<T>(obj: T): any {
  if (Array.isArray(obj)) return obj.map(toSnake);
  if (obj && typeof obj === "object") {
    const out: any = {};
    for (const [k, v] of Object.entries(obj as any)) {
      out[camelToSnake(k)] = toSnake(v as any);
    }
    return out;
  }
  return obj;
}
