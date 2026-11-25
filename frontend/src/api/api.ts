import { api } from "./client";
import type { AuthResponse, BoardDetail, BoardSummary, Column } from "../types";

export const authApi = {
  login: (email: string, password: string) =>
    api.post<AuthResponse>("/api/auth/login", { email, password }).then((r) => r.data),
  register: (email: string, displayName: string, password: string) =>
    api.post<AuthResponse>("/api/auth/register", { email, displayName, password }).then((r) => r.data),
};

export const boardsApi = {
  list: () => api.get<BoardSummary[]>("/api/boards").then((r) => r.data),
  create: (name: string, description: string) =>
    api
      .post<BoardSummary>("/api/boards", { name, description: description || null })
      .then((r) => r.data),
  get: (id: string) => api.get<BoardDetail>(`/api/boards/${id}`).then((r) => r.data),
  columns: (id: string) => api.get<Column[]>(`/api/boards/${id}/columns`).then((r) => r.data),
};
