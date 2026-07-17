export type AIRole = "assistant" | "copilot";

export type AIUserRole =
  | "super_admin"
  | "admin"
  | "support"
  | "driver"
  | "passenger";

export type AIMessageRole =
  | "user"
  | "assistant"
  | "system";

export type AIConversationStatus =
  | "active"
  | "closed"
  | "waiting_human";

export type AITicketDepartment =
  | "support"
  | "finance"
  | "operations"
  | "marketing"
  | "security";

export type AITicketPriority =
  | "low"
  | "medium"
  | "high"
  | "critical";

export interface AIMessage {
  id: string;
  role: AIMessageRole;
  content: string;
  createdAt: string;
}

export interface AIConversation {
  id: string;
  userId: string;
  title: string;
  status: AIConversationStatus;
  createdAt: string;
  updatedAt: string;
  messages: AIMessage[];
}

export interface AITicket {
  id: string;
  department: AITicketDepartment;
  priority: AITicketPriority;
  title: string;
  description: string;
  summary: string;
}

export interface AIAction {
  id: string;
  name: string;
  description: string;
  requiresConfirmation: boolean;
}
