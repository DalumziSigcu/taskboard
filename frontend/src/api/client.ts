import axios from "axios";

const TOKEN_KEY = "taskboard.token";

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:5090",
});

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401 && tokenStore.get()) {
      tokenStore.clear();
      window.location.assign("/login");
    }
    return Promise.reject(error);
  },
);

export function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { message?: string; title?: string; errors?: Record<string, string[]> }
      | undefined;
    if (data?.message) return data.message;
    if (data?.errors) {
      const first = Object.values(data.errors).flat()[0];
      if (first) return first;
    }
    if (!error.response) return "Can't reach the server. Is the API running?";
    return data?.title ?? `Request failed (${error.response.status})`;
  }
  return "Something went wrong.";
}
