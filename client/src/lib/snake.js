// src/lib/snake.ts
function camelToSnake(s) {
    return s.replace(/([A-Z])/g, "_$1").toLowerCase();
}
export function toSnake(obj) {
    if (Array.isArray(obj))
        return obj.map(toSnake);
    if (obj && typeof obj === "object") {
        const out = {};
        for (const [k, v] of Object.entries(obj)) {
            out[camelToSnake(k)] = toSnake(v);
        }
        return out;
    }
    return obj;
}
