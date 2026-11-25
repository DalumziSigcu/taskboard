export type Role = "Viewer" | "Member" | "Admin" | "Owner";

export interface User {
  id: string;
  email: string;
  displayName: string;
}

export interface AuthResponse {
  token: string;
  expiresAt: string;
  user: User;
}

export interface BoardSummary {
  id: string;
  name: string;
  description: string | null;
  role: Role;
  memberCount: number;
}

export interface Member {
  userId: string;
  email: string;
  displayName: string;
  role: Role;
}

export interface BoardDetail {
  id: string;
  name: string;
  description: string | null;
  myRole: Role;
  members: Member[];
}

export interface Card {
  id: string;
  title: string;
  description: string | null;
  position: number;
  dueDate: string | null;
  columnId: string;
  assigneeId: string | null;
}

export interface Column {
  id: string;
  name: string;
  position: number;
  cards: Card[];
}
