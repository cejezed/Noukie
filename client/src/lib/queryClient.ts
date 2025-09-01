// client/src/lib/queryClient.ts
import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase"; // <-- belangrijk: jouw supabase client

const getApiBaseUrl = () => {
  return import.meta.env.VITE_API_BASE_URL || "";
};

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

// Haal per request het access token op
async function getAuthHeader(): Promise<Record<string, string>> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined
): Promise<Response> {
  const fullUrl = url.startsWith("/api") ? `${getApiBaseUrl()}${url}` : url;

  // Handle FormData separately (don't set Content-Type for FormData)
  const isFormData = data instanceof FormData;
  const baseHeaders: Record<string, string> = isFormData
    ? {}
    : data
    ? { "Content-Type": "application/json" }
    : {};

  const authHeader = await getAuthHeader();
  const headers = { ...baseHeaders, ...authHeader };

  const res = await fetch(fullUrl, {
    method,
    headers,
    body: isFormData ? (data as FormData) : data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = queryKey.join("/") as string;
    const fullUrl = url.startsWith("/api") ? `${getApiBaseUrl()}${url}` : url;

    const authHeader = await getAuthHeader();

    const res = await fetch(fullUrl, {
      credentials: "include",
      headers: {
        ...authHeader,
      },
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null as T;
    }

    await throwIfResNotOk(res);
    return (await res.json()) as T;
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
