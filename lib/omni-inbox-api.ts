"use client";

import { apiJson } from "@/lib/api";

export type OmniChannel = "FACEBOOK" | "INSTAGRAM" | "SYSTEM";
export type OmniConversationStatus = "OPEN" | "PENDING" | "PROCESSING" | "CLOSED" | "SPAM" | "ALL";
export type OmniMessageDirection = "IN" | "OUT" | "SYSTEM";

export type OmniCustomer = {
  id: string;
  providerUserId?: string | null;
  name: string;
  avatarUrl?: string | null;
  phone?: string | null;
  address?: string | null;
};

export type OmniTag = {
  id: string;
  tag: string;
};

export type OmniNoteTemplate = {
  id: string;
  name: string;
  normalizedName: string;
  color?: string | null;
  sortOrder: number;
  isActive: boolean;
};

export type OmniQuickOrder = {
  id: string;
  orderCode: string;
  status: string;
  source?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  shippingAddressLine1?: string | null;
  shippingAddressLine2?: string | null;
  shippingProvince?: string | null;
  shippingDistrict?: string | null;
  shippingWard?: string | null;
  shippingPostalCode?: string | null;
  shippingGhnDistrictId?: number | null;
  shippingGhnWardCode?: string | null;
  finalAmount?: number;
  createdAt?: string;
  items?: Array<{ id?: string; sku?: string; productName?: string; color?: string | null; size?: string | null; qty: number; unitPrice?: number; lineTotal?: number }>;
};

export type OmniNote = {
  id: string;
  note: string;
  staffId?: string | null;
  staffName?: string | null;
  createdAt: string;
};

export type OmniMessage = {
  id: string;
  providerMessageId?: string | null;
  direction: OmniMessageDirection;
  type: "TEXT" | "IMAGE" | "FILE" | "STICKER" | "UNKNOWN";
  text?: string | null;
  attachmentUrl?: string | null;
  senderId?: string | null;
  senderName?: string | null;
  sentAt: string;
  createdAt: string;
  conversationId: string;
};

export type OmniConversation = {
  id: string;
  channel: OmniChannel;
  providerThreadId: string;
  status: Exclude<OmniConversationStatus, "ALL">;
  assigneeId?: string | null;
  assigneeName?: string | null;
  branchId?: string | null;
  lastMessageText?: string | null;
  lastMessageAt?: string | null;
  unreadCount: number;
  lockedById?: string | null;
  lockedAt?: string | null;
  closedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: OmniCustomer | null;
  tags?: OmniTag[];
  notes?: OmniNote[];
  messages?: OmniMessage[];
  orders?: OmniQuickOrder[];
  _count?: { messages?: number; notes?: number };
};

export type OmniConversationQuery = {
  q?: string;
  status?: OmniConversationStatus;
  channel?: OmniChannel | "ALL";
  assigneeId?: string;
  branchId?: string;
  page?: number;
  limit?: number;
};

function qs(params: Record<string, any>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    query.set(key, String(value));
  });
  const value = query.toString();
  return value ? `?${value}` : "";
}

export function listOmniConversations(params: OmniConversationQuery = {}) {
  return apiJson<{ items: OmniConversation[]; page: number; limit: number; total: number; hasNext: boolean }>(
    `/omni-inbox/conversations${qs(params)}`,
  );
}

export function getOmniConversation(id: string) {
  return apiJson<OmniConversation>(`/omni-inbox/conversations/${id}`);
}

export function sendOmniMessage(id: string, body: { text: string; attachmentUrl?: string }) {
  return apiJson<OmniMessage>(`/omni-inbox/conversations/${id}/messages`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function assignOmniConversation(id: string, body: { assigneeId: string; assigneeName: string }) {
  return apiJson<OmniConversation>(`/omni-inbox/conversations/${id}/assign`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function updateOmniConversationStatus(id: string, body: { status: Exclude<OmniConversationStatus, "ALL"> }) {
  return apiJson<OmniConversation>(`/omni-inbox/conversations/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function updateOmniConversationTags(id: string, body: { tags: string[] }) {
  return apiJson<OmniConversation>(`/omni-inbox/conversations/${id}/tags`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function createOmniConversationNote(id: string, body: { note: string; templateId?: string }) {
  return apiJson<OmniNote>(`/omni-inbox/conversations/${id}/notes`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function markOmniConversationRead(id: string) {
  return apiJson<OmniConversation>(`/omni-inbox/conversations/${id}/read`, {
    method: "PATCH",
  });
}


export function listOmniNoteTemplates(includeInactive = false) {
  return apiJson<OmniNoteTemplate[]>(`/omni-inbox/note-templates${includeInactive ? "?includeInactive=true" : ""}`);
}

export function createOmniNoteTemplate(body: { name: string; color?: string; sortOrder?: number }) {
  return apiJson<OmniNoteTemplate>("/omni-inbox/note-templates", { method: "POST", body: JSON.stringify(body) });
}

export function updateOmniNoteTemplate(id: string, body: Partial<{ name: string; color: string; sortOrder: number; isActive: boolean }>) {
  return apiJson<OmniNoteTemplate>(`/omni-inbox/note-templates/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

export function deleteOmniNoteTemplate(id: string) {
  return apiJson<OmniNoteTemplate>(`/omni-inbox/note-templates/${id}`, { method: "DELETE" });
}

export type CreateOmniQuickOrderPayload = {
  customerName?: string;
  phone: string;
  address: string;
  addressLine1?: string;
  addressLine2?: string;
  province?: string;
  district?: string;
  ward?: string;
  postalCode?: string;
  ghnDistrictId?: number;
  ghnWardCode?: string;
  branchId: string;
  note?: string;
  requestId?: string;
  items: Array<{ variantId: string; qty: number }>;
};

export function createOmniQuickOrder(
  id: string,
  body: CreateOmniQuickOrderPayload,
) {
  return apiJson<OmniQuickOrder>(
    `/omni-inbox/conversations/${id}/quick-orders`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

export function cancelOmniQuickOrder(conversationId: string, orderId: string) {
  return apiJson<OmniQuickOrder>(`/omni-inbox/conversations/${conversationId}/quick-orders/${orderId}/cancel`, { method: "POST" });
}

export function deleteOmniQuickOrder(conversationId: string, orderId: string) {
  return apiJson<{ ok?: boolean }>(`/omni-inbox/conversations/${conversationId}/quick-orders/${orderId}`, { method: "DELETE" });
}

export function getApiBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    ""
  ).replace(/\/$/, "");
}

export function openOmniInboxEventSource(onEvent: (event: MessageEvent) => void) {
  const baseUrl = getApiBaseUrl();
  const source = new EventSource(`${baseUrl}/omni-inbox/events`, {
    withCredentials: true,
  });

  const names = [
    "message.created",
    "conversation.created",
    "conversation.updated",
    "conversation.assigned",
    "conversation.tagged",
    "conversation.note_created",
    "conversation.quick_order_created",
    "conversation.quick_order_updated",
    "conversation.quick_order_cancelled",
    "conversation.quick_order_deleted",
  ];

  names.forEach((name) => {
    source.addEventListener(name, onEvent as EventListener);
  });

  source.onmessage = onEvent;
  return source;
}


export type OmniQuickReplyTemplate = {
  id: string;
  title?: string | null;
  content: string;
  category?: string | null;
  sortOrder: number;
  isActive: boolean;
};

export type OmniAssignmentMember = {
  id?: string;
  staffId: string;
  staffName: string;
  branchId?: string | null;
  branchName?: string | null;
  isActive: boolean;
  receiveMessages: boolean;
  receiveComments: boolean;
  sortOrder: number;
  weight: number;
  maxActiveConversations?: number | null;
  maxUnreadConversations?: number | null;
  isOnline?: boolean;
  presence?: { status?: string; manualAway?: boolean; lastHeartbeatAt?: string; activeBranchId?: string | null } | null;
};

export type OmniAssignmentReportRow = {
  staffId: string;
  staffName: string;
  branchId?: string | null;
  branchName?: string | null;
  weight: number;
  assignedCount: number;
  uniqueConversationCount: number;
  autoAssignedCount: number;
  manualAssignedCount: number;
  reassignedCount: number;
  targetPercent: number;
  actualPercent: number;
  differencePercent: number;
};

export type OmniAssignmentReport = {
  from: string;
  to: string;
  totalAssigned: number;
  totalAutoAssigned: number;
  totalManualAssigned: number;
  totalReassigned: number;
  rows: OmniAssignmentReportRow[];
};

export type OmniAssignmentSettings = {
  id: string;
  isActive: boolean;
  mode: "OFF" | "SELF_ASSIGN" | "AUTO" | "GROUP";
  priorityOrder: Array<"ONLINE" | "BRANCH" | "LOWEST_LOAD" | "DRAFT_OWNER">;
  requireOnline: boolean;
  branchPriorityEnabled: boolean;
  lowestLoadEnabled: boolean;
  draftOwnerPriorityEnabled: boolean;
  keepPreviousAssignee: boolean;
  keepPreviousDays: number;
  reassignIfAssigneeOffline: boolean;
  workingHoursOnly: boolean;
  workStartMinute: number;
  workEndMinute: number;
  workDays: number[];
  outsideHoursMode: string;
  onlineWindowSeconds: number;
  maxActiveEnabled: boolean;
  maxActiveConversations: number;
  maxUnreadEnabled: boolean;
  maxUnreadConversations: number;
  branchRoutingEnabled: boolean;
  fallbackBranchId?: string | null;
  noCandidateMode: string;
  onlyAssignedCanView: boolean;
  managerCanViewBranch: boolean;
  onlyAssignedCanReply: boolean;
  shuffleEachRound: boolean;
  reassignUnreadEnabled: boolean;
  reassignAfterMinutes: number;
  members: OmniAssignmentMember[];
};

export function sendOmniHeartbeat(body: { activeBranchId?: string; manualAway?: boolean }) {
  return apiJson("/omni-inbox/presence/heartbeat", { method: "POST", body: JSON.stringify(body) });
}

export function getOmniAssignmentSettings() {
  return apiJson<OmniAssignmentSettings>("/omni-inbox/assignment/settings");
}

export function updateOmniAssignmentSettings(body: Partial<OmniAssignmentSettings>) {
  return apiJson<OmniAssignmentSettings>("/omni-inbox/assignment/settings", { method: "PATCH", body: JSON.stringify(body) });
}

export function listOmniAssignmentHistory(limit = 100) {
  return apiJson<any[]>(`/omni-inbox/assignment/history?limit=${limit}`);
}

export function getOmniAssignmentReport(params: {
  from?: string;
  to?: string;
  branchId?: string;
  staffId?: string;
  channel?: OmniChannel | "ALL";
  assignmentType?: "ALL" | "AUTO" | "MANUAL" | "REASSIGNED";
} = {}) {
  return apiJson<OmniAssignmentReport>(
    `/omni-inbox/assignment/report${qs(params)}`,
  );
}

export function listOmniQuickReplies(includeInactive = false) {
  return apiJson<OmniQuickReplyTemplate[]>(`/omni-inbox/quick-replies${includeInactive ? "?includeInactive=true" : ""}`);
}

export function createOmniQuickReply(body: { title?: string; content: string; category?: string; sortOrder?: number }) {
  return apiJson<OmniQuickReplyTemplate>("/omni-inbox/quick-replies", { method: "POST", body: JSON.stringify(body) });
}

export function updateOmniQuickReply(id: string, body: Partial<{ title: string; content: string; category: string; sortOrder: number; isActive: boolean }>) {
  return apiJson<OmniQuickReplyTemplate>(`/omni-inbox/quick-replies/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

export function deleteOmniQuickReply(id: string) {
  return apiJson<{ success: boolean; id: string }>(
    `/omni-inbox/quick-replies/${id}`,
    { method: "DELETE" },
  );
}

export function deleteAllOmniQuickReplies() {
  return apiJson<{ success: boolean; deletedCount: number }>(
    "/omni-inbox/quick-replies",
    { method: "DELETE" },
  );
}
