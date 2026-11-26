import { api } from "./client";
import type { AuthResponse, BoardDetail, BoardSummary, Card, Column, Member } from "../types";

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
  update: (id: string, name: string, description: string) =>
    api.put(`/api/boards/${id}`, { name, description: description || null }),
  addMember: (id: string, email: string, role: string) =>
    api.post<Member>(`/api/boards/${id}/members`, { email, role }).then((r) => r.data),

  columns: (id: string) => api.get<Column[]>(`/api/boards/${id}/columns`).then((r) => r.data),
  createColumn: (boardId: string, name: string) =>
    api.post<Column>(`/api/boards/${boardId}/columns`, { name }).then((r) => r.data),

  createCard: (boardId: string, columnId: string, title: string) =>
    api.post<Card>(`/api/boards/${boardId}/columns/${columnId}/cards`, { title }).then((r) => r.data),
  updateCard: (boardId: string, card: Card) =>
    api.put(`/api/boards/${boardId}/cards/${card.id}`, {
      title: card.title,
      description: card.description,
      dueDate: card.dueDate,
      assigneeId: card.assigneeId,
    }),
  deleteCard: (boardId: string, cardId: string) =>
    api.delete(`/api/boards/${boardId}/cards/${cardId}`),
  moveCard: (boardId: string, cardId: string, columnId: string, index: number) =>
    api.post(`/api/boards/${boardId}/cards/${cardId}/move`, { columnId, index }),
};
