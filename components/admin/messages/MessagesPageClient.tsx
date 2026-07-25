"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Bell,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock3,
  Filter,
  ImageIcon,
  Loader2,
  LogOut,
  Mail,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Paperclip,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Tag,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { apiJson } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { useAuth } from "@/components/admin/auth/AuthProvider";
import {
  assignOmniConversation,
  createOmniConversationNote,
  listOmniNoteTemplates,
  createOmniNoteTemplate,
  updateOmniNoteTemplate,
  deleteOmniNoteTemplate,
  createOmniQuickOrder,
  cancelOmniQuickOrder,
  deleteOmniQuickOrder,
  getOmniConversation,
  listOmniConversations,
  markOmniConversationRead,
  openOmniInboxEventSource,
  sendOmniMessage,
  updateOmniConversationStatus,
  updateOmniConversationTags,
  type OmniChannel,
  type OmniConversation,
  type OmniConversationStatus,
  type OmniMessage,
  type OmniNoteTemplate,
  type OmniQuickOrder,
  type OmniQuickReplyTemplate,
  type OmniAssignmentSettings,
  type OmniAssignmentReport,
  getOmniAssignmentSettings,
  getOmniAssignmentReport,
  updateOmniAssignmentSettings,
  listOmniAssignmentHistory,
  sendOmniHeartbeat,
  listOmniQuickReplies,
  createOmniQuickReply,
  updateOmniQuickReply,
  deleteOmniQuickReply,
  deleteAllOmniQuickReplies,
} from "@/lib/omni-inbox-api";
import {
  getProductsForOrder,
  resolveGhnAddress,
  type OrderProduct,
} from "@/lib/create-order-api";
import {
  getProvinces,
  getDistricts,
  getWards,
  type ProvinceItem,
  type DistrictItem,
  type WardItem,
} from "@/lib/address-api";
import * as XLSX from "xlsx";

type StatusTab = OmniConversationStatus;
type WorkspaceKey =
  | "inbox"
  | "facebook"
  | "instagram"
  | "comments"
  | "livestream"
  | "customers"
  | "tags"
  | "assignments"
  | "orders"
  | "quickReplies"
  | "reports"
  | "settings"
  | "noteSettings"
  | "assignmentSettings";

const WORKSPACE_TITLES: Record<WorkspaceKey, string> = {
  inbox: "Hộp thư đến",
  facebook: "Facebook Messenger",
  instagram: "Instagram Direct",
  comments: "Bình luận",
  livestream: "Livestream",
  customers: "Khách hàng",
  tags: "Nhãn hội thoại",
  assignments: "Phân công nhân viên",
  orders: "Đơn nháp từ hội thoại",
  quickReplies: "Mẫu trả lời nhanh",
  reports: "Báo cáo inbox",
  settings: "Cài đặt kết nối",
  noteSettings: "Cài đặt ghi chú",
  assignmentSettings: "Cài đặt chia tin nhắn",
};

const STATUS_TABS: { key: StatusTab; label: string }[] = [
  { key: "ALL", label: "Tất cả" },
  { key: "OPEN", label: "Chưa trả lời" },
  { key: "PROCESSING", label: "Đang xử lý" },
  { key: "PENDING", label: "Cần theo dõi" },
  { key: "CLOSED", label: "Đã chốt" },
];

const CHANNEL_OPTIONS: { key: OmniChannel | "ALL"; label: string }[] = [
  { key: "ALL", label: "Tất cả kênh" },
  { key: "FACEBOOK", label: "Facebook" },
  { key: "INSTAGRAM", label: "Instagram" },
  { key: "SYSTEM", label: "Hệ thống" },
];

const QUICK_REPLIES = [
  "Dạ shop chào mình ạ, em hỗ trợ mình ngay nhé.",
  "Dạ mẫu này hiện còn hàng, mình cho em xin size/màu cần lấy ạ.",
  "Dạ bên em có hỗ trợ đổi size trong 3 ngày nếu sản phẩm còn nguyên tag ạ.",
  "Dạ mình cho em xin SĐT, địa chỉ nhận hàng và mã sản phẩm để em lên đơn nhé.",
];

type AssigneeOption = { id: string; name: string };
type BranchOption = { id: string; name: string; code?: string };

type MetaConnectionStatus = {
  pageId?: string;
  pageName?: string;
  channel?: OmniChannel;
  webhookPath?: string;
  subscribedFields?: string[];
  tokenConfigured?: boolean;
  graphVerified?: boolean;
  subscriptionVerified?: boolean;
  lastWebhookAt?: string | null;
  graphError?: string;
  subscriptionError?: string;
};

const UNASSIGNED_ASSIGNEE: AssigneeOption = { id: "", name: "Chưa gán" };
const DEFAULT_META_PAGE_ID = "1435304586691707";
const DEFAULT_META_PAGE_NAME = "The 1970";
const DEFAULT_WEBHOOK_PATH = "/webhooks/meta/inbox";
const DEFAULT_SUBSCRIBED_FIELDS = [
  "messages",
  "message_echoes",
  "message_reads",
  "message_deliveries",
  "message_reactions",
  "messaging_postbacks",
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value || 0) + "đ";
}

function formatTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });
}

function channelBadge(channel: OmniChannel) {
  if (channel === "FACEBOOK") {
    return (
      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[10px] font-black text-white">
        f
      </span>
    );
  }
  if (channel === "INSTAGRAM") {
    return (
      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-pink-500 text-[10px] font-black text-white">
        ◎
      </span>
    );
  }
  return <MessageCircle className="h-4 w-4 text-neutral-500" />;
}

function channelLabel(channel?: OmniChannel) {
  if (channel === "FACEBOOK") return "Facebook Messenger";
  if (channel === "INSTAGRAM") return "Instagram";
  if (channel === "SYSTEM") return "Hệ thống";
  return "-";
}

function statusLabel(status?: string) {
  if (status === "OPEN") return "Chưa trả lời";
  if (status === "PROCESSING") return "Đang xử lý";
  if (status === "PENDING") return "Cần theo dõi";
  if (status === "CLOSED") return "Đã chốt";
  if (status === "SPAM") return "Spam";
  return status || "-";
}

function customerName(conversation?: OmniConversation | null) {
  return conversation?.customer?.name || "Khách chưa rõ tên";
}

function customerAvatar(conversation?: OmniConversation | null) {
  return conversation?.customer?.avatarUrl || "";
}

function parseEventPayload(event: MessageEvent) {
  try {
    return JSON.parse(event.data);
  } catch {
    return event.data;
  }
}

function normalizeApiList(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.users)) return data.users;
  if (Array.isArray(data?.staff)) return data.staff;
  return [];
}

function normalizeName(value?: string | null) {
  return String(value || "").trim();
}

function getUserDisplayName(user: any) {
  return (
    normalizeName(user?.name) ||
    normalizeName(user?.fullName) ||
    normalizeName(user?.username) ||
    normalizeName(user?.email) ||
    "Tài khoản"
  );
}

function getUserRoleLabel(user: any) {
  const raw = String(
    user?.role || user?.roleName || user?.activeRole || "",
  ).trim();
  if (!raw) return "Người dùng";
  const upper = raw.toUpperCase();
  if (upper === "OWNER") return "Chủ sở hữu";
  if (upper === "ADMIN") return "Quản trị viên";
  if (upper === "MANAGER") return "Quản lý";
  if (upper === "STAFF") return "Nhân viên";
  return raw;
}

function isAdminUser(user: any) {
  const roles = [
    user?.role,
    user?.roleName,
    user?.activeRole,
    ...(Array.isArray(user?.roles) ? user.roles : []),
  ]
    .map((value) => String(value || "").trim().toUpperCase())
    .filter(Boolean);

  return roles.includes("OWNER") || roles.includes("ADMIN");
}

function hasUserPermission(
  user: any,
  permission: string,
  fallbackPermissions: string[] = [],
) {
  if (isAdminUser(user)) return true;

  const keys = new Set(
    [
      ...(Array.isArray(user?.permissions) ? user.permissions : []),
      ...(Array.isArray(user?.permissionKeys) ? user.permissionKeys : []),
      ...(Array.isArray(user?.extraPermissionKeys)
        ? user.extraPermissionKeys
        : []),
    ]
      .map((value) => String(value || "").trim())
      .filter(Boolean),
  );

  return (
    keys.has("*") ||
    keys.has(permission) ||
    fallbackPermissions.some((key) => keys.has(key))
  );
}

function normalizeBranchCode(value?: string | null) {
  const raw = String(value || "")
    .trim()
    .toUpperCase();
  if (!raw) return "";
  if (/^[A-Z0-9]{1,4}$/.test(raw)) return raw;
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/Đ/g, "D")
    .replace(/đ/g, "d")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .slice(0, 4)
    .toUpperCase();
}

function getActiveBranchName(user: any, activeBranchId?: string) {
  const branches = Array.isArray(user?.branchRoles)
    ? user.branchRoles
    : Array.isArray(user?.branches)
      ? user.branches
      : [];
  const activeBranch = branches.find((item: any) => {
    const id = item?.branchId || item?.branch?.id || item?.id;
    return id && activeBranchId && id === activeBranchId;
  });

  return (
    normalizeName(activeBranch?.branchName) ||
    normalizeName(activeBranch?.branch?.name) ||
    normalizeName(user?.branchName) ||
    normalizeName(user?.branch?.name) ||
    normalizeName(user?.branchCode) ||
    "Chi nhánh làm việc"
  );
}

function getUserBranchOptions(user: any): BranchOption[] {
  const sources = [
    ...(Array.isArray(user?.branchRoles) ? user.branchRoles : []),
    ...(Array.isArray(user?.branches) ? user.branches : []),
    ...(Array.isArray(user?.branchPermissions) ? user.branchPermissions : []),
  ];

  const map = new Map<string, BranchOption>();

  for (const item of sources) {
    const id = normalizeName(item?.branchId || item?.branch?.id || item?.id);
    if (!id) continue;

    const name =
      normalizeName(item?.branchName) ||
      normalizeName(item?.branch?.name) ||
      normalizeName(item?.name) ||
      normalizeName(item?.branchCode) ||
      normalizeName(item?.branch?.code) ||
      id;

    const code =
      normalizeName(item?.branchCode) ||
      normalizeName(item?.branch?.code) ||
      undefined;

    map.set(id, { id, name, code });
  }

  const directBranchId = normalizeName(user?.branchId || user?.branch?.id);
  if (directBranchId && !map.has(directBranchId)) {
    map.set(directBranchId, {
      id: directBranchId,
      name:
        normalizeName(user?.branchName) ||
        normalizeName(user?.branch?.name) ||
        normalizeName(user?.branchCode) ||
        directBranchId,
      code:
        normalizeName(user?.branchCode) ||
        normalizeName(user?.branch?.code) ||
        undefined,
    });
  }

  return Array.from(map.values()).sort((a, b) =>
    a.name.localeCompare(b.name, "vi"),
  );
}

function getInitials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "U"
  );
}

function normalizeStaffOption(item: any): AssigneeOption | null {
  const id = String(item?.id || item?.staffId || item?.userId || "").trim();
  const name =
    normalizeName(item?.name) ||
    normalizeName(item?.fullName) ||
    normalizeName(item?.username) ||
    normalizeName(item?.email);
  if (!id || !name) return null;
  return { id, name };
}

function normalizeMetaConnectionStatus(data: any): MetaConnectionStatus | null {
  const source = data?.data || data?.connection || data;
  if (!source || typeof source !== "object") return null;
  return {
    pageId: normalizeName(source.pageId || source.providerPageId || source.id),
    pageName: normalizeName(source.pageName || source.name),
    channel: source.channel || "FACEBOOK",
    webhookPath: normalizeName(source.webhookPath || source.webhookUrl),
    subscribedFields: Array.isArray(source.subscribedFields)
      ? source.subscribedFields.map((item: any) => String(item)).filter(Boolean)
      : undefined,
    tokenConfigured: Boolean(source.tokenConfigured),
    graphVerified: Boolean(source.graphVerified),
    subscriptionVerified: Boolean(source.subscriptionVerified),
    lastWebhookAt: source.lastWebhookAt || null,
    graphError: normalizeName(source.graphError),
    subscriptionError: normalizeName(source.subscriptionError),
  };
}

function getPageName(
  connection?: MetaConnectionStatus | null,
  conversation?: OmniConversation | null,
) {
  return (
    normalizeName(connection?.pageName) ||
    normalizeName((conversation as any)?.page?.pageName) ||
    DEFAULT_META_PAGE_NAME
  );
}

function getPageId(
  connection?: MetaConnectionStatus | null,
  conversation?: OmniConversation | null,
) {
  return (
    normalizeName(connection?.pageId) ||
    normalizeName((conversation as any)?.page?.providerPageId) ||
    DEFAULT_META_PAGE_ID
  );
}

function getConnectionFields(connection?: MetaConnectionStatus | null) {
  const fields = connection?.subscribedFields?.length
    ? connection.subscribedFields
    : DEFAULT_SUBSCRIBED_FIELDS;
  return fields.join(", ");
}


function isFacebookCommentConversation(conversation?: OmniConversation | null) {
  const providerThreadId = normalizeName(conversation?.providerThreadId);
  const lastMessageText = normalizeName(conversation?.lastMessageText);
  return (
    providerThreadId.startsWith("FACEBOOK_COMMENT:") ||
    lastMessageText.startsWith("[Bình luận]") ||
    Boolean(
      conversation?.tags?.some((tag) =>
        ["bình luận", "facebook_comment", "comment"].includes(
          normalizeName(tag.tag).toLowerCase(),
        ),
      ),
    )
  );
}


type QuickReplyImportMetaView = {
  imageUrls: string[];
  sourceUpdatedAt: string | null;
};

function normalizeQuickReplyImportDateValue(value: unknown) {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return new Date(
        Date.UTC(parsed.y, parsed.m - 1, parsed.d, parsed.H, parsed.M, parsed.S),
      ).toISOString();
    }
  }

  const text = String(value).trim();
  const vietnameseDate = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (vietnameseDate) {
    const [, day, month, year] = vietnameseDate;
    return new Date(
      Date.UTC(Number(year), Number(month) - 1, Number(day)),
    ).toISOString();
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function parseQuickReplyImportMeta(
  category?: string | null,
): QuickReplyImportMetaView {
  const empty: QuickReplyImportMetaView = {
    imageUrls: [],
    sourceUpdatedAt: null,
  };
  if (!category) return empty;

  try {
    const parsed = JSON.parse(category);
    if (parsed?.type !== "QUICK_REPLY_IMPORT") return empty;
    return {
      imageUrls: Array.isArray(parsed.imageUrls)
        ? parsed.imageUrls
            .map((item: unknown) => String(item).trim())
            .filter(Boolean)
        : [],
      sourceUpdatedAt: normalizeQuickReplyImportDateValue(
        parsed.sourceUpdatedAt,
      ),
    };
  } catch {
    return empty;
  }
}

function formatQuickReplyImportDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("vi-VN");
}

export default function MessagesPageClient({
  initialWorkspace = "inbox",
}: {
  initialWorkspace?: WorkspaceKey;
} = {}) {
  const { user, activeBranchId } = useAuth();
  const [clientReady, setClientReady] = useState(false);
  const currentUserName = getUserDisplayName(user);
  const currentUserRole = getUserRoleLabel(user);
  const currentBranchName = getActiveBranchName(user, activeBranchId);
  const quickOrderBranchOptions = useMemo(
    () => getUserBranchOptions(user),
    [user],
  );

  // AuthProvider may restore the user from browser storage before hydration.
  // Keep the server render and the first client render identical, then reveal
  // admin-only navigation after React has mounted.
  const canManageOmniSettings =
    clientReady &&
    hasUserPermission(user, PERMISSIONS.OMNI_INBOX_SETTINGS);

  const canViewQuickReplies =
    clientReady &&
    hasUserPermission(user, PERMISSIONS.OMNI_QUICK_REPLIES_VIEW, [
      PERMISSIONS.OMNI_INBOX_VIEW,
    ]);
  const canCreateQuickReplies =
    clientReady &&
    hasUserPermission(user, PERMISSIONS.OMNI_QUICK_REPLIES_CREATE, [
      PERMISSIONS.OMNI_INBOX_SETTINGS,
    ]);
  const canEditQuickReplies =
    clientReady &&
    hasUserPermission(user, PERMISSIONS.OMNI_QUICK_REPLIES_EDIT, [
      PERMISSIONS.OMNI_INBOX_SETTINGS,
    ]);
  const canDeleteQuickReplies =
    clientReady &&
    hasUserPermission(user, PERMISSIONS.OMNI_QUICK_REPLIES_DELETE, [
      PERMISSIONS.OMNI_INBOX_SETTINGS,
    ]);
  const canDeleteAllQuickReplies =
    clientReady &&
    hasUserPermission(user, PERMISSIONS.OMNI_QUICK_REPLIES_DELETE_ALL, [
      PERMISSIONS.OMNI_INBOX_SETTINGS,
    ]);
  const canImportQuickReplies =
    clientReady &&
    hasUserPermission(user, PERMISSIONS.OMNI_QUICK_REPLIES_IMPORT, [
      PERMISSIONS.OMNI_INBOX_SETTINGS,
    ]);
  const canViewAssignmentSettings =
    clientReady &&
    hasUserPermission(user, PERMISSIONS.OMNI_ASSIGNMENT_VIEW, [
      PERMISSIONS.OMNI_INBOX_SETTINGS,
    ]);
  const canManageAssignmentSettings =
    clientReady &&
    hasUserPermission(user, PERMISSIONS.OMNI_ASSIGNMENT_MANAGE, [
      PERMISSIONS.OMNI_INBOX_SETTINGS,
    ]);
  const canViewOmniReports =
    clientReady &&
    hasUserPermission(user, PERMISSIONS.OMNI_REPORTS_VIEW, [
      PERMISSIONS.OMNI_INBOX_SETTINGS,
    ]);

  useEffect(() => {
    setClientReady(true);
  }, []);

  const handleLogout = useCallback(() => {
    if (typeof window === "undefined") return;

    const shouldRemoveKey = (key: string) => {
      const normalized = key.toLowerCase();
      return (
        normalized.includes("token") ||
        normalized.includes("auth") ||
        normalized.includes("user") ||
        normalized.includes("session") ||
        normalized.includes("admin") ||
        normalized.includes("the1970")
      );
    };

    try {
      Object.keys(window.localStorage || {}).forEach((key) => {
        if (shouldRemoveKey(key)) window.localStorage.removeItem(key);
      });
    } catch {
      // Ignore storage errors in private mode.
    }

    try {
      Object.keys(window.sessionStorage || {}).forEach((key) => {
        if (shouldRemoveKey(key)) window.sessionStorage.removeItem(key);
      });
    } catch {
      // Ignore storage errors in private mode.
    }

    try {
      document.cookie.split(";").forEach((cookie) => {
        const name = cookie.split("=")[0]?.trim();
        if (!name) return;
        document.cookie = `${name}=; Max-Age=0; path=/`;
      });
    } catch {
      // Ignore cookie cleanup errors.
    }

    window.location.href = "/login";
  }, []);

  const [conversations, setConversations] = useState<OmniConversation[]>([]);
  const [activeConversation, setActiveConversation] =
    useState<OmniConversation | null>(null);
  const [activeId, setActiveId] = useState("");
  const [status, setStatus] = useState<StatusTab>("ALL");
  const [channel, setChannel] = useState<OmniChannel | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [staffOptions, setStaffOptions] = useState<AssigneeOption[]>([]);
  const [metaConnection, setMetaConnection] =
    useState<MetaConnectionStatus | null>(null);
  const [loadingConnection, setLoadingConnection] = useState(false);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingMoreConversations, setLoadingMoreConversations] = useState(false);
  const [conversationPage, setConversationPage] = useState(1);
  const [hasMoreConversations, setHasMoreConversations] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  const [draftImageUrls, setDraftImageUrls] = useState<string[]>([]);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteTemplates, setNoteTemplates] = useState<OmniNoteTemplate[]>([]);
  const [newNoteTemplateName, setNewNoteTemplateName] = useState("");
  const [quickReplyTemplates, setQuickReplyTemplates] = useState<OmniQuickReplyTemplate[]>([]);
  const [newQuickReplyShortcut, setNewQuickReplyShortcut] = useState("");
  const [newQuickReply, setNewQuickReply] = useState("");
  const [importingQuickReplies, setImportingQuickReplies] = useState(false);
  const [quickReplyImportResult, setQuickReplyImportResult] = useState("");
  const [quickReplySearch, setQuickReplySearch] = useState("");
  const [deletingAllQuickReplies, setDeletingAllQuickReplies] = useState(false);
  const [assignmentSettings, setAssignmentSettings] = useState<OmniAssignmentSettings | null>(null);
  const [savedAssignmentSettings, setSavedAssignmentSettings] = useState<OmniAssignmentSettings | null>(null);
  const [assignmentHistory, setAssignmentHistory] = useState<any[]>([]);
  const [assignmentReport, setAssignmentReport] = useState<OmniAssignmentReport | null>(null);
  const [assignmentReportLoading, setAssignmentReportLoading] = useState(false);
  const [assignmentReportDays, setAssignmentReportDays] = useState<1 | 7 | 30>(7);
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [assignmentSaveState, setAssignmentSaveState] = useState<"idle" | "saved" | "error">("idle");
  const [assignmentSavedAt, setAssignmentSavedAt] = useState<string | null>(null);

  const [orderProducts, setOrderProducts] = useState<OrderProduct[]>([]);
  const [quickOrderOpen, setQuickOrderOpen] = useState(false);
  const [quickOrderSaving, setQuickOrderSaving] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState<
    "info" | "orders" | "notes"
  >("info");
  const [quickOrderSuccess, setQuickOrderSuccess] = useState("");
  const [customerOrderHistory, setCustomerOrderHistory] = useState<
    OmniQuickOrder[]
  >([]);
  const [loadingCustomerOrders, setLoadingCustomerOrders] = useState(false);
  const [tagDraft, setTagDraft] = useState("");
  const [error, setError] = useState("");
  const [sseStatus, setSseStatus] = useState<
    "connecting" | "online" | "offline"
  >("connecting");
  const [workspace, setWorkspace] = useState<WorkspaceKey>(initialWorkspace);
  const listRequestId = useRef(0);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!clientReady) return;
    if (
      ((workspace === "settings" || workspace === "noteSettings") &&
        !canManageOmniSettings) ||
      (workspace === "assignmentSettings" &&
        !canViewAssignmentSettings &&
        !canManageAssignmentSettings) ||
      (workspace === "reports" && !canViewOmniReports) ||
      (workspace === "quickReplies" && !canViewQuickReplies)
    ) {
      setWorkspace("inbox");
    }
  }, [
    clientReady,
    canManageOmniSettings,
    canViewAssignmentSettings,
    canManageAssignmentSettings,
    canViewOmniReports,
    canViewQuickReplies,
    workspace,
  ]);

  useEffect(() => {
    let cancelled = false;

    async function loadStaff() {
      setLoadingStaff(true);
      try {
        const data = await apiJson("/staff", {
          redirectOnUnauthorized: false,
          timeoutMs: 10000,
        } as any);
        if (cancelled) return;
        const options = normalizeApiList(data)
          .map(normalizeStaffOption)
          .filter(Boolean) as AssigneeOption[];
        setStaffOptions(options);
      } catch {
        if (!cancelled) setStaffOptions([]);
      } finally {
        if (!cancelled) setLoadingStaff(false);
      }
    }

    void loadStaff();

    return () => {
      cancelled = true;
    };
  }, []);

  const loadMetaConnection = useCallback(async () => {
    setLoadingConnection(true);
    try {
      const data = await apiJson("/omni-inbox/meta/connection", {
        redirectOnUnauthorized: false,
        timeoutMs: 10000,
      } as any);
      setMetaConnection(normalizeMetaConnectionStatus(data));
    } catch {
      setMetaConnection(null);
    } finally {
      setLoadingConnection(false);
    }
  }, []);

  useEffect(() => {
    void loadMetaConnection();
  }, [loadMetaConnection]);

  useEffect(() => {
    let cancelled = false;
    const ping = () => {
      if (cancelled || document.visibilityState === "hidden") return;
      void sendOmniHeartbeat({ activeBranchId: activeBranchId || undefined }).catch(() => undefined);
    };
    ping();
    const timer = window.setInterval(ping, 30000);
    const onVisibility = () => ping();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [activeBranchId]);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      listOmniNoteTemplates(),
      getProductsForOrder(),
      listOmniQuickReplies(),
    ])
      .then(([templates, products, replies]) => {
        if (cancelled) return;
        setNoteTemplates(Array.isArray(templates) ? templates : []);
        setOrderProducts(Array.isArray(products) ? products : []);
        setQuickReplyTemplates(Array.isArray(replies) ? replies : []);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Không tải được dữ liệu Omni Inbox.");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (
      !clientReady ||
      (!canViewAssignmentSettings &&
        !canManageAssignmentSettings &&
        !canViewOmniReports)
    )
      return;

    let cancelled = false;
    setError("");

    const initialFrom = new Date();
    initialFrom.setDate(initialFrom.getDate() - 6);
    initialFrom.setHours(0, 0, 0, 0);

    Promise.all([
      getOmniAssignmentSettings(),
      listOmniAssignmentHistory(100),
      getOmniAssignmentReport({
        from: initialFrom.toISOString(),
        to: new Date().toISOString(),
      }),
    ])
      .then(([assignment, history, report]) => {
        if (cancelled) return;
        setAssignmentSettings(assignment || null);
        setSavedAssignmentSettings(assignment || null);
        setAssignmentSaveState("idle");
        setAssignmentHistory(Array.isArray(history) ? history : []);
        setAssignmentReport(report || null);
      })
      .catch((err) => {
        if (cancelled) return;
        setAssignmentSettings(null);
        setAssignmentHistory([]);
        setAssignmentReport(null);
        setError(
          err instanceof Error
            ? err.message
            : "Không tải được cài đặt chia tin nhắn.",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [
    clientReady,
    canViewAssignmentSettings,
    canManageAssignmentSettings,
    canViewOmniReports,
  ]);

  const loadAssignmentReport = useCallback(async (days: 1 | 7 | 30) => {
    setAssignmentReportLoading(true);
    try {
      const from = new Date();
      from.setDate(from.getDate() - (days - 1));
      from.setHours(0, 0, 0, 0);
      const report = await getOmniAssignmentReport({
        from: from.toISOString(),
        to: new Date().toISOString(),
      });
      setAssignmentReport(report || null);
      setAssignmentReportDays(days);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Không tải được báo cáo phân công.",
      );
    } finally {
      setAssignmentReportLoading(false);
    }
  }, []);

  const assigneeOptions = useMemo(() => {
    const map = new Map<string, AssigneeOption>();
    map.set(UNASSIGNED_ASSIGNEE.id, UNASSIGNED_ASSIGNEE);

    staffOptions.forEach((item) => map.set(item.id, item));

    if (user?.id) {
      map.set(String(user.id), { id: String(user.id), name: currentUserName });
    }

    conversations.forEach((conversation) => {
      if (conversation.assigneeId && conversation.assigneeName) {
        map.set(conversation.assigneeId, {
          id: conversation.assigneeId,
          name: conversation.assigneeName,
        });
      }
    });

    return Array.from(map.values());
  }, [conversations, currentUserName, staffOptions, user?.id]);

  async function handleSyncMetaConnection() {
    setLoadingConnection(true);
    setError("");
    try {
      const data = await apiJson("/omni-inbox/meta/subscribe-page", {
        method: "POST",
        redirectOnUnauthorized: false,
        timeoutMs: 20000,
      } as any);
      setMetaConnection(normalizeMetaConnectionStatus(data));
      await loadList();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Không đồng bộ được kết nối Facebook Page.",
      );
    } finally {
      setLoadingConnection(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const loadList = useCallback(async () => {
    const requestId = ++listRequestId.current;
    setLoadingList(true);
    setError("");

    try {
      const data = await listOmniConversations({
        q: debouncedSearch,
        status,
        channel,
        assigneeId: assigneeFilter,
        page: 1,
        limit: 40,
      });

      if (requestId !== listRequestId.current) return;

      const items = data?.items || [];
      setConversations(items);
      setConversationPage(data?.page || 1);
      setHasMoreConversations(Boolean(data?.hasNext));

      if (!activeId && items[0]?.id) {
        setActiveId(items[0].id);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Không tải được danh sách hội thoại.",
      );
    } finally {
      if (requestId === listRequestId.current) setLoadingList(false);
    }
  }, [activeId, assigneeFilter, channel, debouncedSearch, status]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const loadMoreConversations = useCallback(async () => {
    if (
      loadingList ||
      loadingMoreConversations ||
      !hasMoreConversations
    ) {
      return;
    }

    setLoadingMoreConversations(true);
    setError("");

    try {
      const nextPage = conversationPage + 1;
      const data = await listOmniConversations({
        q: debouncedSearch,
        status,
        channel,
        assigneeId: assigneeFilter,
        page: nextPage,
        limit: 40,
      });

      const items = data?.items || [];

      setConversations((prev) => {
        const seen = new Set(prev.map((item) => item.id));
        return [
          ...prev,
          ...items.filter((item) => !seen.has(item.id)),
        ];
      });

      setConversationPage(data?.page || nextPage);
      setHasMoreConversations(Boolean(data?.hasNext));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Không tải thêm được hội thoại.",
      );
    } finally {
      setLoadingMoreConversations(false);
    }
  }, [
    assigneeFilter,
    channel,
    conversationPage,
    debouncedSearch,
    hasMoreConversations,
    loadingList,
    loadingMoreConversations,
    status,
  ]);

  const handleConversationListScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      const element = event.currentTarget;
      const remaining =
        element.scrollHeight - element.scrollTop - element.clientHeight;

      if (remaining <= 240) {
        void loadMoreConversations();
      }
    },
    [loadMoreConversations],
  );

  const loadDetail = useCallback(async (id: string) => {
    if (!id) {
      setActiveConversation(null);
      return;
    }

    setLoadingDetail(true);
    setError("");

    try {
      const data = await getOmniConversation(id);
      setActiveConversation(data);
      void markOmniConversationRead(id).catch(() => undefined);
      setConversations((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, unreadCount: 0 } : item,
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Không tải được hội thoại.",
      );
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    if (!activeId) return;
    void loadDetail(activeId);
  }, [activeId, loadDetail]);

  const scrollChatToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const element = chatScrollRef.current;
    if (!element) return;
    element.scrollTo({ top: element.scrollHeight, behavior });
  }, []);

  // Khi mở một hội thoại hoặc lịch sử tin nhắn vừa tải xong, luôn đưa người dùng
  // tới tin mới nhất. Chạy thêm vài nhịp để ảnh đính kèm tải xong không làm lệch vị trí.
  useEffect(() => {
    if (!activeId || loadingDetail) return;

    const frame = window.requestAnimationFrame(() => scrollChatToBottom("auto"));
    const timer1 = window.setTimeout(() => scrollChatToBottom("auto"), 120);
    const timer2 = window.setTimeout(() => scrollChatToBottom("auto"), 500);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer1);
      window.clearTimeout(timer2);
    };
  }, [
    activeId,
    loadingDetail,
    activeConversation?.messages?.length,
    scrollChatToBottom,
  ]);

  useEffect(() => {
    setRightPanelTab("info");
    setQuickOrderSuccess("");
    setCustomerOrderHistory([]);
    setDraft("");
    setDraftImageUrls([]);
  }, [activeId]);

  const loadCustomerOrderHistory = useCallback(async () => {
    if (!activeConversation) return;

    const phone = String(
      activeConversation.customer?.phone || "",
    ).trim();

    if (!phone) {
      setCustomerOrderHistory(activeConversation.orders || []);
      return;
    }

    setLoadingCustomerOrders(true);
    try {
      const response: any = await apiJson(
        `/orders?page=1&pageSize=50&q=${encodeURIComponent(phone)}`,
        {
          redirectOnUnauthorized: false,
          timeoutMs: 15000,
        } as any,
      );

      const rows = Array.isArray(response)
        ? response
        : Array.isArray(response?.items)
          ? response.items
          : Array.isArray(response?.data)
            ? response.data
            : [];

      const normalized = rows.map((order: any) => ({
        id: String(order.id || ""),
        orderCode: String(order.orderCode || ""),
        status: String(order.status || ""),
        source: order.source || order.salesChannel || null,
        customerName: order.customerName || null,
        customerPhone: order.customerPhone || order.shippingPhone || null,
        shippingAddressLine1: order.shippingAddressLine1 || null,
        shippingAddressLine2: order.shippingAddressLine2 || null,
        shippingProvince: order.shippingProvince || null,
        shippingDistrict: order.shippingDistrict || null,
        shippingWard: order.shippingWard || null,
        finalAmount: Number(order.finalAmount || 0),
        createdAt: order.createdAt || null,
        items: Array.isArray(order.items) ? order.items : [],
      })) as OmniQuickOrder[];

      const map = new Map<string, OmniQuickOrder>();
      [...normalized, ...(activeConversation.orders || [])].forEach((order) => {
        if (order?.id) map.set(order.id, order);
      });

      setCustomerOrderHistory(
        Array.from(map.values()).sort((a, b) => {
          const aa = new Date(a.createdAt || 0).getTime();
          const bb = new Date(b.createdAt || 0).getTime();
          return bb - aa;
        }),
      );
    } catch {
      setCustomerOrderHistory(activeConversation.orders || []);
    } finally {
      setLoadingCustomerOrders(false);
    }
  }, [activeConversation]);

  useEffect(() => {
    if (rightPanelTab !== "orders" || !activeConversation) return;
    void loadCustomerOrderHistory();
  }, [activeConversation, loadCustomerOrderHistory, rightPanelTab]);

  useEffect(() => {
    let source: EventSource | null = null;

    try {
      source = openOmniInboxEventSource((event) => {
        setSseStatus("online");
        const payload = parseEventPayload(event);

        if (!payload) return;

        if (event.type === "message.created") {
          const message = payload as OmniMessage;

          if (message?.conversationId === activeId) {
            setActiveConversation((prev) => {
              if (!prev) return prev;
              const existed = prev.messages?.some(
                (item) => item.id === message.id,
              );
              if (existed) return prev;
              return { ...prev, messages: [...(prev.messages || []), message] };
            });
          }

          void loadList();
          return;
        }

        if (
          event.type === "conversation.updated" ||
          event.type === "conversation.assigned" ||
          event.type === "conversation.tagged"
        ) {
          const conversation = payload as OmniConversation;
          setConversations((prev) => {
            const existed = prev.some((item) => item.id === conversation.id);
            if (!existed) return [conversation, ...prev];
            return prev.map((item) =>
              item.id === conversation.id ? { ...item, ...conversation } : item,
            );
          });

          if (conversation.id === activeId) {
            setActiveConversation((prev) =>
              prev
                ? { ...prev, ...conversation, messages: prev.messages }
                : conversation,
            );
          }
        }
      });

      source.onopen = () => setSseStatus("online");
      source.onerror = () => setSseStatus("offline");
    } catch {
      setSseStatus("offline");
    }

    return () => {
      source?.close();
    };
  }, [activeId, loadList]);

  const visibleConversations = useMemo(() => {
    if (workspace === "comments") {
      return conversations.filter(isFacebookCommentConversation);
    }
    return conversations;
  }, [conversations, workspace]);

  useEffect(() => {
    if (workspace !== "comments") return;

    if (!visibleConversations.length) {
      if (activeId) setActiveId("");
      setActiveConversation(null);
      return;
    }

    if (!visibleConversations.some((item) => item.id === activeId)) {
      setActiveId(visibleConversations[0].id);
    }
  }, [activeId, visibleConversations, workspace]);

  const selectedSummary = useMemo(() => {
    const unread = visibleConversations.reduce(
      (sum, item) => sum + Number(item.unreadCount || 0),
      0,
    );
    const open = visibleConversations.filter((item) => item.status === "OPEN").length;
    const processing = visibleConversations.filter(
      (item) => item.status === "PROCESSING",
    ).length;
    const closed = visibleConversations.filter(
      (item) => item.status === "CLOSED",
    ).length;
    return { unread, open, processing, closed };
  }, [visibleConversations]);

  const GENDER_TAGS = ["__GENDER_MALE", "__GENDER_FEMALE", "__GENDER_NEUTRAL"] as const;

  function getCustomerPronoun(conversation?: OmniConversation | null) {
    const tags = conversation?.tags?.map((item) => String(item.tag || "")) || [];
    if (tags.includes("__GENDER_FEMALE")) return "Chị";
    if (tags.includes("__GENDER_NEUTRAL")) return "Bạn";
    if (tags.includes("__GENDER_MALE")) return "Anh";

    // Chỉ nhận diện khi khách tự xưng rất rõ trong tin nhắn đến.
    const incomingText = (conversation?.messages || [])
      .filter((message) => message.direction === "IN")
      .slice(-20)
      .map((message) => String(message.text || "").toLocaleLowerCase("vi-VN"))
      .join(" ");

    if (/\b(chị|em gái|mình là nữ|nữ mặc|chị mặc|chị cao|chị nặng)\b/i.test(incomingText)) {
      return "Chị";
    }
    if (/\b(anh|em trai|mình là nam|nam mặc|anh mặc|anh cao|anh nặng)\b/i.test(incomingText)) {
      return "Anh";
    }

    // Tệp khách của shop chủ yếu là nam nên mặc định là Anh.
    return "Anh";
  }

  function replaceQuickReplyVariables(content: string) {
    const pronoun = getCustomerPronoun(activeConversation);
    return String(content || "")
      .replace(/\{\{\s*Gender-Anh\|Chị\|Bạn\s*\}\}/gi, pronoun)
      .replace(/\{\{\s*Gender\s*\}\}/gi, pronoun);
  }

  function applyQuickReplyTemplate(template: OmniQuickReplyTemplate) {
    const meta = parseQuickReplyImportMeta(template.category);
    setDraft(replaceQuickReplyVariables(template.content || ""));
    setDraftImageUrls(meta.imageUrls);
  }

  async function handleSetCustomerPronoun(pronoun: "Anh" | "Chị" | "Bạn") {
    if (!activeConversation?.id) return;

    const tagByPronoun = {
      Anh: "__GENDER_MALE",
      Chị: "__GENDER_FEMALE",
      Bạn: "__GENDER_NEUTRAL",
    } as const;

    const visibleTags = (activeConversation.tags || [])
      .map((item) => String(item.tag || ""))
      .filter((tag) => !GENDER_TAGS.includes(tag as any));

    try {
      const updated = await updateOmniConversationTags(activeConversation.id, {
        tags: [...visibleTags, tagByPronoun[pronoun]],
      });
      setActiveConversation((prev) =>
        prev ? { ...prev, ...updated, messages: prev.messages } : updated,
      );
      setConversations((prev) =>
        prev.map((item) =>
          item.id === updated.id ? { ...item, ...updated } : item,
        ),
      );

      // Nếu mẫu đang nằm trong ô soạn thì đổi xưng hô ngay, không cần chọn lại mẫu.
      setDraft((current) =>
        current
          .replace(/\bAnh\b/g, pronoun)
          .replace(/\bChị\b/g, pronoun)
          .replace(/\bBạn\b/g, pronoun),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được cách xưng hô.");
    }
  }

  async function handleSend() {
    const text = draft.trim();
    const imageUrls = draftImageUrls.filter(Boolean);
    if (!activeConversation?.id || (!text && !imageUrls.length) || sending) return;

    if (isFacebookCommentConversation(activeConversation)) {
      setError(
        "Hội thoại bình luận hiện chỉ dùng để đọc và phân công. Trả lời bình luận sẽ bật sau khi backend có API reply comment.",
      );
      return;
    }

    const conversationId = activeConversation.id;
    const optimisticPrefix = `optimistic-${Date.now()}`;
    const optimisticMessages: OmniMessage[] = [
      ...(text
        ? ([{
            id: `${optimisticPrefix}-text`,
            conversationId,
            direction: "OUT",
            type: "TEXT",
            text,
            attachmentUrl: null,
            senderName: currentUserName,
            sentAt: new Date().toISOString(),
          }] as any[])
        : []),
      ...imageUrls.map((attachmentUrl, index) => ({
        id: `${optimisticPrefix}-image-${index}`,
        conversationId,
        direction: "OUT",
        type: "IMAGE",
        text: "",
        attachmentUrl,
        senderName: currentUserName,
        sentAt: new Date().toISOString(),
      } as any)),
    ];

    // Phản hồi giao diện ngay, không bắt nhân viên chờ Meta và database xong mới thấy tin.
    setSending(true);
    setError("");
    setDraft("");
    setDraftImageUrls([]);
    setActiveConversation((prev) =>
      prev
        ? {
            ...prev,
            messages: [...(prev.messages || []), ...optimisticMessages],
            lastMessageText: imageUrls.length ? "[Ảnh]" : text,
            lastMessageAt: new Date().toISOString(),
          }
        : prev,
    );
    setConversations((prev) =>
      prev.map((item) =>
        item.id === conversationId
          ? {
              ...item,
              lastMessageText: imageUrls.length ? "[Ảnh]" : text,
              lastMessageAt: new Date().toISOString(),
              status: item.status === "OPEN" ? "PROCESSING" : item.status,
            }
          : item,
      ),
    );

    try {
      const sentMessages: OmniMessage[] = [];

      // Giữ text đi trước; các ảnh gửi đồng thời để mẫu nhiều ảnh không bị chậm nối tiếp.
      if (text) {
        sentMessages.push(await sendOmniMessage(conversationId, { text }));
      }
      if (imageUrls.length) {
        const imageMessages = await Promise.all(
          imageUrls.map((attachmentUrl) =>
            sendOmniMessage(conversationId, { text: "", attachmentUrl }),
          ),
        );
        sentMessages.push(...imageMessages);
      }

      setActiveConversation((prev) => {
        if (!prev || prev.id !== conversationId) return prev;
        const withoutOptimistic = (prev.messages || []).filter(
          (message: any) => !String(message?.id || "").startsWith(optimisticPrefix),
        );
        const lastMessage = sentMessages[sentMessages.length - 1];
        return {
          ...prev,
          messages: [...withoutOptimistic, ...sentMessages],
          lastMessageText: lastMessage?.attachmentUrl ? "[Ảnh]" : text,
          lastMessageAt: lastMessage?.sentAt || prev.lastMessageAt,
        };
      });
      // Không gọi lại toàn bộ danh sách sau mỗi lần gửi; SSE và state cục bộ đã đồng bộ.
    } catch (err) {
      setActiveConversation((prev) => {
        if (!prev || prev.id !== conversationId) return prev;
        return {
          ...prev,
          messages: (prev.messages || []).filter(
            (message: any) => !String(message?.id || "").startsWith(optimisticPrefix),
          ),
        };
      });
      setDraft((current) => current || text);
      setDraftImageUrls((current) => (current.length ? current : imageUrls));
      setError(err instanceof Error ? err.message : "Không gửi được tin nhắn.");
    } finally {
      setSending(false);
    }
  }

  async function handleAssign(assigneeId: string) {
    if (!activeConversation?.id) return;
    const assignee = assigneeOptions.find((item) => item.id === assigneeId);
    if (!assignee || !assignee.id) return;

    try {
      const updated = await assignOmniConversation(activeConversation.id, {
        assigneeId: assignee.id,
        assigneeName: assignee.name,
      });
      setActiveConversation((prev) =>
        prev ? { ...prev, ...updated, messages: prev.messages } : updated,
      );
      setConversations((prev) =>
        prev.map((item) =>
          item.id === updated.id ? { ...item, ...updated } : item,
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Không gán được nhân viên.",
      );
    }
  }

  async function handleCloseConversation() {
    if (!activeConversation?.id) return;
    try {
      const updated = await updateOmniConversationStatus(
        activeConversation.id,
        { status: "CLOSED" },
      );
      setActiveConversation((prev) =>
        prev ? { ...prev, ...updated, messages: prev.messages } : updated,
      );
      setConversations((prev) =>
        prev.map((item) =>
          item.id === updated.id ? { ...item, ...updated } : item,
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Không cập nhật được trạng thái.",
      );
    }
  }

  async function handleAddNote() {
    const note = noteDraft.trim();
    if (!activeConversation?.id || !note) return;

    try {
      const created = await createOmniConversationNote(activeConversation.id, {
        note,
      });
      setNoteDraft("");
      setActiveConversation((prev) =>
        prev ? { ...prev, notes: [created, ...(prev.notes || [])] } : prev,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được ghi chú.");
    }
  }

  async function handleCreateNoteTemplate() {
    const name = newNoteTemplateName.trim();
    if (!name) return;
    try {
      const created = await createOmniNoteTemplate({ name });
      setNoteTemplates((prev) => [...prev, created].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "vi")));
      setNewNoteTemplateName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tạo được mẫu ghi chú.");
    }
  }

  async function handleRenameNoteTemplate(template: OmniNoteTemplate) {
    const nextName = window.prompt("Tên ghi chú mới", template.name)?.trim();
    if (!nextName || nextName === template.name) return;
    try {
      const updated = await updateOmniNoteTemplate(template.id, { name: nextName });
      setNoteTemplates((prev) => prev.map((item) => item.id === template.id ? updated : item));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không sửa được mẫu ghi chú.");
    }
  }

  async function handleDeleteNoteTemplate(template: OmniNoteTemplate) {
    try {
      await deleteOmniNoteTemplate(template.id);
      setNoteTemplates((prev) => prev.filter((item) => item.id !== template.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không ẩn được mẫu ghi chú.");
    }
  }

  async function handleApplyNoteTemplate(template: OmniNoteTemplate) {
    if (!activeConversation?.id) return;
    try {
      const created = await createOmniConversationNote(activeConversation.id, {
        note: template.name,
        templateId: template.id,
      });
      setActiveConversation((prev) =>
        prev ? { ...prev, notes: [created, ...(prev.notes || [])] } : prev,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không áp dụng được ghi chú.");
    }
  }

  async function handleQuickOrderCreated(order: OmniQuickOrder) {
    setQuickOrderOpen(false);
    setQuickOrderSuccess(
      `Đã tạo đơn nháp ${order.orderCode || ""} thành công.`,
    );
    setRightPanelTab("orders");
    setActiveConversation((prev) =>
      prev ? { ...prev, orders: [order, ...(prev.orders || []).filter((item) => item.id !== order.id)] } : prev,
    );
    setCustomerOrderHistory((prev) => [
      order,
      ...prev.filter((item) => item.id !== order.id),
    ]);
    window.setTimeout(() => setQuickOrderSuccess(""), 5000);
    await loadList();
  }

  async function handleCancelQuickOrder(orderId: string) {
    if (!activeConversation?.id) return;
    try {
      const updated = await cancelOmniQuickOrder(activeConversation.id, orderId);
      setActiveConversation((prev) => prev ? { ...prev, orders: (prev.orders || []).map((item) => item.id === orderId ? { ...item, ...updated } : item) } : prev);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không huỷ được đơn nháp.");
    }
  }

  async function handleDeleteQuickOrder(orderId: string) {
    if (!activeConversation?.id) return;
    try {
      await deleteOmniQuickOrder(activeConversation.id, orderId);
      setActiveConversation((prev) => prev ? { ...prev, orders: (prev.orders || []).filter((item) => item.id !== orderId) } : prev);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xoá được đơn nháp.");
    }
  }

  async function handleAddTag() {
    const tag = tagDraft.trim();
    if (!activeConversation?.id || !tag) return;

    const currentTags = activeConversation.tags?.map((item) => item.tag) || [];
    if (currentTags.includes(tag)) {
      setTagDraft("");
      return;
    }

    try {
      const updated = await updateOmniConversationTags(activeConversation.id, {
        tags: [...currentTags, tag],
      });
      setTagDraft("");
      setActiveConversation((prev) =>
        prev ? { ...prev, ...updated, messages: prev.messages } : updated,
      );
      setConversations((prev) =>
        prev.map((item) =>
          item.id === updated.id ? { ...item, ...updated } : item,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thêm được nhãn.");
    }
  }

  async function handleRemoveTag(tag: string) {
    if (!activeConversation?.id) return;
    const currentTags =
      activeConversation.tags
        ?.map((item) => item.tag)
        .filter((item) => item !== tag) || [];

    try {
      const updated = await updateOmniConversationTags(activeConversation.id, {
        tags: currentTags,
      });
      setActiveConversation((prev) =>
        prev ? { ...prev, ...updated, messages: prev.messages } : updated,
      );
      setConversations((prev) =>
        prev.map((item) =>
          item.id === updated.id ? { ...item, ...updated } : item,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xoá được nhãn.");
    }
  }


  function normalizeQuickReplyText(value: unknown) {
    return String(value ?? "")
      .replace(/\r\n/g, "\n")
      .replace(/[ \t]+/g, " ")
      .trim()
      .toLowerCase();
  }

  type QuickReplyImportMeta = {
    imageUrls: string[];
    sourceUpdatedAt: string | null;
  };

  function splitQuickReplyImageUrls(value: unknown) {
    return String(value ?? "")
      .split(/[\n,;]+/)
      .map((item) => item.trim())
      .filter(Boolean)
      .filter((item, index, array) => array.indexOf(item) === index);
  }

  function normalizeQuickReplyImportDate(value: unknown) {
    if (value === null || value === undefined || value === "") return null;

    if (typeof value === "number" && Number.isFinite(value)) {
      const parsed = XLSX.SSF.parse_date_code(value);
      if (parsed) {
        return new Date(
          Date.UTC(parsed.y, parsed.m - 1, parsed.d, parsed.H, parsed.M, parsed.S),
        ).toISOString();
      }
    }

    const text = String(value).trim();
    const vietnameseDate = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if (vietnameseDate) {
      const [, day, month, year] = vietnameseDate;
      return new Date(
        Date.UTC(Number(year), Number(month) - 1, Number(day)),
      ).toISOString();
    }

    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  function parseQuickReplyImportMeta(category?: string | null): QuickReplyImportMeta {
    const empty: QuickReplyImportMeta = { imageUrls: [], sourceUpdatedAt: null };
    if (!category) return empty;

    try {
      const parsed = JSON.parse(category);
      if (parsed?.type !== "QUICK_REPLY_IMPORT") return empty;
      return {
        imageUrls: Array.isArray(parsed.imageUrls)
          ? parsed.imageUrls.map((item: unknown) => String(item).trim()).filter(Boolean)
          : [],
        sourceUpdatedAt: normalizeQuickReplyImportDate(parsed.sourceUpdatedAt),
      };
    } catch {
      return empty;
    }
  }

  function stringifyQuickReplyImportMeta(meta: QuickReplyImportMeta) {
    return JSON.stringify({
      type: "QUICK_REPLY_IMPORT",
      imageUrls: meta.imageUrls,
      sourceUpdatedAt: meta.sourceUpdatedAt,
    });
  }

  function formatQuickReplyImportDate(value?: string | null) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("vi-VN");
  }

  function handleDownloadQuickReplyTemplate() {
    const rows = [
      {
        "Từ viết tắt": "tl",
        "Nội dung": "Dạ em gửi anh các mẫu thắt lưng bên em giá 400k-450k/c ạ",
        "Ảnh đính kèm": "https://social.dktcdn.net/facebook/quick_reply/the1970/anh-1.jpg,\nhttps://social.dktcdn.net/facebook/quick_reply/the1970/anh-2.jpg",
        "Ngày cập nhật": "22/07/2026",
      },
      {
        "Từ viết tắt": "838",
        "Nội dung": "Quần Kaki QKK838 THE1970 giá 540k/1c ạ",
        "Ảnh đính kèm": "",
        "Ngày cập nhật": "20/07/2026",
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet["!cols"] = [
      { wch: 22 },
      { wch: 80 },
      { wch: 80 },
      { wch: 18 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "MauTraLoiNhanh");
    XLSX.writeFile(workbook, "mau-tra-loi-nhanh.xlsx");
  }

  async function handleImportQuickReplyExcel(file?: File | null) {
    if (!file || importingQuickReplies) return;

    setImportingQuickReplies(true);
    setQuickReplyImportResult("");
    setError("");

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) throw new Error("File Excel không có sheet dữ liệu.");

      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
        workbook.Sheets[firstSheetName],
        { defval: "", raw: true },
      );

      const existingByShortcut = new Map(
        quickReplyTemplates
          .filter((item) => normalizeQuickReplyText(item.title))
          .map((item) => [normalizeQuickReplyText(item.title), item]),
      );
      const existingByContent = new Map(
        quickReplyTemplates.map((item) => [normalizeQuickReplyText(item.content), item]),
      );
      const fileShortcuts = new Set<string>();
      const importRows: Array<{
        content: string;
        shortcut: string;
        imageUrls: string[];
        sourceUpdatedAt: string | null;
        sourceRow: number;
        existing?: OmniQuickReplyTemplate;
      }> = [];
      let emptyCount = 0;
      let duplicateCount = 0;
      let unchangedCount = 0;

      rows.forEach((row, index) => {
        const entries = Object.entries(row);
        const findRawValue = (...aliases: string[]) => {
          const normalizedAliases = aliases.map(normalizeQuickReplyText);
          return entries.find(([key]) =>
            normalizedAliases.includes(normalizeQuickReplyText(key)),
          )?.[1];
        };
        const findValue = (...aliases: string[]) =>
          String(findRawValue(...aliases) ?? "").trim();

        const content =
          findValue("Nội dung", "Noi dung", "Content", "Mẫu trả lời", "Mau tra loi", "Câu trả lời", "Cau tra loi") ||
          String(entries[0]?.[1] ?? "").trim();
        const shortcut = findValue("Từ viết tắt", "Tu viet tat", "Viết tắt", "Viet tat", "Shortcut", "Mã", "Ma", "Tiêu đề", "Tieu de", "Title");
        const imageUrls = splitQuickReplyImageUrls(
          findRawValue("Ảnh đính kèm", "Anh dinh kem", "Ảnh", "Anh", "Image", "Images", "Image URLs", "Image URL"),
        );
        const sourceUpdatedAt = normalizeQuickReplyImportDate(
          findRawValue("Ngày cập nhật", "Ngay cap nhat", "Updated at", "UpdatedAt", "Update date"),
        );

        if (!content || !shortcut) {
          emptyCount += 1;
          return;
        }

        const normalizedShortcut = normalizeQuickReplyText(shortcut);
        const normalizedContent = normalizeQuickReplyText(content);
        if (fileShortcuts.has(normalizedShortcut)) {
          duplicateCount += 1;
          return;
        }
        fileShortcuts.add(normalizedShortcut);

        const existing = existingByShortcut.get(normalizedShortcut);
        const sameContentTemplate = existingByContent.get(normalizedContent);
        if (!existing && sameContentTemplate) {
          duplicateCount += 1;
          return;
        }

        if (existing) {
          const currentMeta = parseQuickReplyImportMeta(existing.category);
          const incomingMeta = stringifyQuickReplyImportMeta({ imageUrls, sourceUpdatedAt });
          const currentMetaText = stringifyQuickReplyImportMeta(currentMeta);
          const incomingTime = sourceUpdatedAt ? new Date(sourceUpdatedAt).getTime() : 0;
          const currentTime = currentMeta.sourceUpdatedAt
            ? new Date(currentMeta.sourceUpdatedAt).getTime()
            : 0;
          const changed =
            normalizeQuickReplyText(existing.content) !== normalizedContent ||
            incomingMeta !== currentMetaText;

          if (!changed || (incomingTime > 0 && currentTime > incomingTime)) {
            unchangedCount += 1;
            return;
          }
        }

        importRows.push({
          content,
          shortcut: shortcut.trim(),
          imageUrls,
          sourceUpdatedAt,
          sourceRow: index + 2,
          existing,
        });
      });

      if (!importRows.length) {
        setQuickReplyImportResult(
          `Không có dữ liệu mới để cập nhật. Bỏ qua ${unchangedCount} dòng không đổi, ${duplicateCount} dòng trùng và ${emptyCount} dòng thiếu dữ liệu.`,
        );
        return;
      }

      const results: Array<{
        row: (typeof importRows)[number];
        template?: OmniQuickReplyTemplate;
        mode?: "created" | "updated";
      }> = new Array(importRows.length);
      let cursor = 0;
      const workerCount = Math.min(8, importRows.length);

      await Promise.all(
        Array.from({ length: workerCount }, async () => {
          while (true) {
            const index = cursor++;
            if (index >= importRows.length) return;
            const row = importRows[index];
            const category = stringifyQuickReplyImportMeta({
              imageUrls: row.imageUrls,
              sourceUpdatedAt: row.sourceUpdatedAt,
            });
            try {
              const template = row.existing
                ? await updateOmniQuickReply(row.existing.id, {
                    content: row.content,
                    title: row.shortcut,
                    category,
                  })
                : await createOmniQuickReply({
                    content: row.content,
                    title: row.shortcut,
                    category,
                    sortOrder: quickReplyTemplates.length + index,
                  });
              results[index] = {
                row,
                template,
                mode: row.existing ? "updated" : "created",
              };
            } catch {
              results[index] = { row };
            }
          }
        }),
      );

      const successful = results.filter((item) => item?.template);
      const failedRows = results.filter((item) => !item?.template).map((item) => item.row.sourceRow);
      const createdCount = successful.filter((item) => item.mode === "created").length;
      const updatedCount = successful.filter((item) => item.mode === "updated").length;

      if (successful.length) {
        setQuickReplyTemplates((prev) => {
          const map = new Map(prev.map((item) => [item.id, item]));
          successful.forEach((item) => {
            if (item.template) map.set(item.template.id, item.template);
          });
          return Array.from(map.values()).sort(
            (a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0),
          );
        });
      }

      const parts = [`Đã thêm ${createdCount} mẫu`, `cập nhật ${updatedCount} mẫu`];
      if (unchangedCount) parts.push(`bỏ qua ${unchangedCount} dòng không đổi`);
      if (duplicateCount) parts.push(`bỏ qua ${duplicateCount} dòng trùng`);
      if (emptyCount) parts.push(`bỏ qua ${emptyCount} dòng thiếu dữ liệu`);
      if (failedRows.length) parts.push(`lỗi tại dòng ${failedRows.join(", ")}`);
      setQuickReplyImportResult(parts.join(" · "));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Không đọc được file Excel.";
      setError(message);
      setQuickReplyImportResult("");
    } finally {
      setImportingQuickReplies(false);
    }
  }

  async function handleCreateQuickReply() {
    const shortcut = newQuickReplyShortcut.trim();
    const content = newQuickReply.trim();
    if (!shortcut || !content) {
      setError("Phải nhập đủ từ viết tắt và nội dung mẫu.");
      return;
    }
    const duplicateShortcut = quickReplyTemplates.some(
      (item) =>
        normalizeQuickReplyText(item.title) ===
        normalizeQuickReplyText(shortcut),
    );
    if (duplicateShortcut) {
      setError(`Từ viết tắt "${shortcut}" đã tồn tại.`);
      return;
    }
    try {
      const created = await createOmniQuickReply({
        title: shortcut,
        content,
        sortOrder: quickReplyTemplates.length,
      });
      setQuickReplyTemplates((prev) => [...prev, created]);
      setNewQuickReplyShortcut("");
      setNewQuickReply("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tạo được mẫu trả lời.");
    }
  }

  async function handleEditQuickReply(template: OmniQuickReplyTemplate) {
    const shortcut = window
      .prompt("Sửa từ viết tắt", template.title || "")
      ?.trim();
    if (shortcut === undefined || !shortcut) return;

    const content = window
      .prompt("Sửa nội dung mẫu trả lời", template.content)
      ?.trim();
    if (!content) return;

    const duplicateShortcut = quickReplyTemplates.some(
      (item) =>
        item.id !== template.id &&
        normalizeQuickReplyText(item.title) ===
          normalizeQuickReplyText(shortcut),
    );
    if (duplicateShortcut) {
      setError(`Từ viết tắt "${shortcut}" đã tồn tại.`);
      return;
    }

    if (shortcut === template.title && content === template.content) return;
    try {
      const updated = await updateOmniQuickReply(template.id, {
        title: shortcut,
        content,
      });
      setQuickReplyTemplates((prev) => prev.map((item) => item.id === updated.id ? updated : item));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không sửa được mẫu trả lời.");
    }
  }

  async function handleDeleteQuickReply(template: OmniQuickReplyTemplate) {
    const shortcut = String(template.title || "").trim();
    if (
      !window.confirm(
        `Xóa vĩnh viễn mẫu${shortcut ? ` “${shortcut}”` : ""}? Thao tác này không thể hoàn tác.`,
      )
    ) {
      return;
    }

    try {
      await deleteOmniQuickReply(template.id);
      setQuickReplyTemplates((prev) =>
        prev.filter((item) => item.id !== template.id),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Không xóa được mẫu trả lời.",
      );
    }
  }

  async function handleDeleteAllQuickReplies() {
    if (!quickReplyTemplates.length || deletingAllQuickReplies) return;

    const confirmed = window.confirm(
      `Xóa vĩnh viễn toàn bộ ${quickReplyTemplates.length} mẫu trả lời nhanh? Thao tác này không thể hoàn tác.`,
    );
    if (!confirmed) return;

    const typed = window.prompt(
      'Nhập chính xác chữ "XOA HET" để xác nhận xóa toàn bộ mẫu cũ.',
    );
    if (String(typed || "").trim().toUpperCase() !== "XOA HET") return;

    setDeletingAllQuickReplies(true);
    setError("");
    try {
      const result = await deleteAllOmniQuickReplies();
      setQuickReplyTemplates([]);
      setQuickReplyImportResult(
        `Đã xóa toàn bộ ${Number(result?.deletedCount || 0)} mẫu trả lời.`,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Không xóa được toàn bộ mẫu trả lời.",
      );
    } finally {
      setDeletingAllQuickReplies(false);
    }
  }

  async function handleSaveAssignmentSettings(next?: OmniAssignmentSettings) {
    if (!canManageAssignmentSettings) {
      setError("Bạn chỉ có quyền xem cấu hình chia tin nhắn.");
      return;
    }
    const payload = next || assignmentSettings;
    if (!payload || savingAssignment) return;
    setSavingAssignment(true);
    setAssignmentSaveState("idle");
    try {
      const saved = await updateOmniAssignmentSettings(payload);
      setAssignmentSettings(saved);
      setSavedAssignmentSettings(saved);
      setAssignmentSavedAt(new Date().toISOString());
      setAssignmentSaveState("saved");
      setAssignmentHistory(await listOmniAssignmentHistory(100));
    } catch (err) {
      setAssignmentSaveState("error");
      setError(err instanceof Error ? err.message : "Không lưu được cài đặt chia tin nhắn.");
    } finally {
      setSavingAssignment(false);
    }
  }

  const openWorkspace = useCallback((key: WorkspaceKey) => {
    setWorkspace(key);

    if (key === "facebook") {
      setChannel("FACEBOOK");
      setStatus("ALL");
      return;
    }

    if (key === "instagram") {
      setChannel("INSTAGRAM");
      setStatus("ALL");
      return;
    }

    if (key === "comments") {
      setChannel("FACEBOOK");
      setStatus("ALL");
      return;
    }

    if (key === "inbox") {
      setChannel("ALL");
      setStatus("ALL");
    }
  }, []);

  const isInboxWorkspace =
    workspace === "inbox" ||
    workspace === "facebook" ||
    workspace === "instagram" ||
    workspace === "comments";

  return (
    <div className="min-h-screen bg-[#f6f6f4] text-neutral-950">
      <div className="flex min-h-screen">
        <aside className="hidden w-[268px] shrink-0 border-r border-neutral-200 bg-white xl:flex xl:flex-col">
          <div className="border-b border-neutral-200 px-6 py-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-neutral-400">
              The 1970
            </p>
            <h1 className="mt-3 text-2xl font-black tracking-tight">
              Omni Inbox
            </h1>
            <div className="mt-4 rounded-3xl border border-emerald-100 bg-emerald-50 p-4">
              <div className="flex items-center gap-2 text-sm font-black text-emerald-800">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                {metaConnection?.graphVerified
                  ? "Meta Connected"
                  : "Meta Configured"}
              </div>
              <p className="mt-1 text-xs font-semibold text-emerald-700">
                Facebook Page · {getPageName(metaConnection)}
              </p>
              <p className="mt-0.5 text-[11px] text-emerald-700/80">
                {metaConnection?.lastWebhookAt
                  ? `Webhook ${formatDateTime(metaConnection.lastWebhookAt)}`
                  : "Messenger webhook configured"}
              </p>
            </div>
          </div>

          <nav className="flex-1 space-y-6 overflow-y-auto p-4 text-sm">
            <OmniNavSection
              title="Inbox"
              activeKey={workspace}
              onSelect={openWorkspace}
              items={[
                {
                  key: "inbox",
                  label: "Hộp thư đến",
                  icon: <MessageCircle className="h-4 w-4" />,
                  badge: selectedSummary.open,
                },
                {
                  key: "facebook",
                  label: "Facebook Messenger",
                  icon: channelBadge("FACEBOOK"),
                  badge: selectedSummary.unread,
                },
                {
                  key: "instagram",
                  label: "Instagram Direct",
                  icon: channelBadge("INSTAGRAM"),
                },
                {
                  key: "comments",
                  label: "Bình luận",
                  icon: <Mail className="h-4 w-4" />,
                },
                {
                  key: "livestream",
                  label: "Livestream",
                  icon: <Sparkles className="h-4 w-4" />,
                },
              ]}
            />

            <OmniNavSection
              title="Quản lý khách"
              activeKey={workspace}
              onSelect={openWorkspace}
              items={[
                {
                  key: "customers",
                  label: "Khách hàng",
                  icon: <Users className="h-4 w-4" />,
                },
                {
                  key: "tags",
                  label: "Nhãn hội thoại",
                  icon: <Tag className="h-4 w-4" />,
                },
                {
                  key: "assignments",
                  label: "Phân công nhân viên",
                  icon: <UserPlus className="h-4 w-4" />,
                },
              ]}
            />

            <OmniNavSection
              title="Vận hành"
              activeKey={workspace}
              onSelect={openWorkspace}
              items={[
                {
                  key: "orders",
                  label: "Đơn nháp từ hội thoại",
                  icon: <ShoppingBag className="h-4 w-4" />,
                },
                ...(canViewQuickReplies
                  ? [
                      {
                        key: "quickReplies" as WorkspaceKey,
                        label: "Mẫu trả lời nhanh",
                        icon: <Sparkles className="h-4 w-4" />,
                      },
                    ]
                  : []),
                ...(canViewOmniReports
                  ? [
                      {
                        key: "reports" as WorkspaceKey,
                        label: "Báo cáo inbox",
                        icon: <CheckCircle2 className="h-4 w-4" />,
                      },
                    ]
                  : []),
                ...(canViewAssignmentSettings || canManageAssignmentSettings
                  ? [
                      {
                        key: "assignmentSettings" as WorkspaceKey,
                        label: "Cài đặt chia tin nhắn",
                        icon: <Users className="h-4 w-4" />,
                      },
                    ]
                  : []),
                ...(canManageOmniSettings
                  ? [
                      {
                        key: "noteSettings" as WorkspaceKey,
                        label: "Cài đặt ghi chú",
                        icon: <Tag className="h-4 w-4" />,
                      },
                      {
                        key: "settings" as WorkspaceKey,
                        label: "Cài đặt kết nối",
                        icon: <Settings className="h-4 w-4" />,
                      },
                    ]
                  : []),
              ]}
            />
          </nav>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 flex h-20 items-center gap-4 border-b border-neutral-200 bg-white/95 px-6 backdrop-blur">
            <button
              type="button"
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent("the1970:toggle-admin-sidebar"),
                )
              }
              className="rounded-full p-2 text-neutral-500 hover:bg-neutral-100"
              title="Bật/tắt menu chính"
              aria-label="Bật/tắt menu chính"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-neutral-400">
                The 1970 Omni Inbox
              </p>
              <div className="mt-1 flex items-center gap-3">
                <h2 className="text-xl font-bold">
                  {WORKSPACE_TITLES[workspace]}
                </h2>
                <span
                  className={cx(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
                    sseStatus === "online" && "bg-emerald-50 text-emerald-700",
                    sseStatus === "connecting" && "bg-amber-50 text-amber-700",
                    sseStatus === "offline" && "bg-red-50 text-red-700",
                  )}
                >
                  <span
                    className={cx(
                      "h-2 w-2 rounded-full",
                      sseStatus === "online" && "bg-emerald-500",
                      sseStatus === "connecting" && "bg-amber-500",
                      sseStatus === "offline" && "bg-red-500",
                    )}
                  />
                  {sseStatus === "online"
                    ? "Meta Configured"
                    : sseStatus === "connecting"
                      ? "Đang đồng bộ"
                      : "Đang đồng bộ"}
                </span>
              </div>
            </div>

            <div className="mx-auto hidden w-full max-w-xl items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-3 shadow-sm lg:flex">
              <Search className="h-4 w-4 text-neutral-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full bg-transparent text-sm outline-none placeholder:text-neutral-400"
                placeholder="Tìm tên, SĐT, địa chỉ, nội dung tin, ghi chú, nhãn, nhân viên..."
              />
              {search ? (
                <button
                  onClick={() => setSearch("")}
                  className="rounded-full p-1 text-neutral-400 hover:bg-neutral-100"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : (
                <kbd className="rounded-lg border border-neutral-200 px-2 py-1 text-[11px] text-neutral-400">
                  Ctrl K
                </kbd>
              )}
            </div>

            <div className="ml-auto flex items-center gap-3">
              <button className="relative rounded-full border border-neutral-200 bg-white p-3 shadow-sm">
                <Bell className="h-4 w-4" />
                {selectedSummary.unread > 0 && (
                  <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />
                )}
              </button>
              <div className="hidden items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-3 py-2 shadow-sm md:flex">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-950 text-sm font-bold text-white">
                  {getInitials(currentUserName)}
                </div>
                <div>
                  <p className="text-sm font-bold">{currentUserName}</p>
                  <p className="text-xs text-neutral-500">
                    {currentUserRole} · {currentBranchName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-bold text-neutral-700 shadow-sm transition hover:bg-neutral-50"
              >
                <LogOut className="h-4 w-4" />
                Đăng xuất
              </button>
            </div>
          </header>

          {isInboxWorkspace ? (
            <section className="grid h-[calc(100vh-80px)] grid-cols-1 gap-4 p-4 2xl:grid-cols-[440px_minmax(600px,1fr)_380px]">
              <aside className="min-h-0 overflow-hidden rounded-[28px] border border-neutral-200 bg-white shadow-sm">
                <div className="border-b border-neutral-200 p-5">
                  <div className="mb-4 flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-bold">Hội thoại</h3>
                      <p className="text-sm text-neutral-500">
                        The 1970 · {workspace === "comments" ? "Facebook Comments" : "Facebook Messenger"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => void loadList()}
                        className="rounded-full border border-neutral-200 p-2 text-neutral-600 hover:bg-neutral-50"
                      >
                        <RefreshCw
                          className={cx(
                            "h-4 w-4",
                            loadingList && "animate-spin",
                          )}
                        />
                      </button>
                      <button className="rounded-full border border-neutral-200 p-2 text-neutral-600 hover:bg-neutral-50">
                        <Filter className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mb-4 rounded-3xl border border-blue-100 bg-blue-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm">
                          {channelBadge("FACEBOOK")}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-blue-950">
                            {getPageName(metaConnection, activeConversation)}
                          </p>
                          <p className="text-xs font-semibold text-blue-700">
                            Facebook Messenger · Page ID{" "}
                            {getPageId(metaConnection, activeConversation)}
                          </p>
                        </div>
                      </div>
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-black text-emerald-700">
                        Configured
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    <Metric label="Mới" value={selectedSummary.open} />
                    <Metric
                      label="Đang xử lý"
                      value={selectedSummary.processing}
                    />
                    <Metric label="Đã chốt" value={selectedSummary.closed} />
                    <Metric label="Unread" value={selectedSummary.unread} />
                  </div>

                  <div className="mt-4 flex gap-2 overflow-x-auto">
                    {STATUS_TABS.map((item) => (
                      <button
                        key={item.key}
                        onClick={() => setStatus(item.key)}
                        className={cx(
                          "whitespace-nowrap rounded-full px-3 py-2 text-xs font-bold transition",
                          status === item.key
                            ? "bg-neutral-950 text-white"
                            : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200",
                        )}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <select
                      value={channel}
                      onChange={(event) =>
                        setChannel(event.target.value as OmniChannel | "ALL")
                      }
                      className="rounded-2xl border border-neutral-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none"
                    >
                      {CHANNEL_OPTIONS.map((item) => (
                        <option key={item.key} value={item.key}>
                          {item.label}
                        </option>
                      ))}
                    </select>

                    <select
                      value={assigneeFilter}
                      onChange={(event) =>
                        setAssigneeFilter(event.target.value)
                      }
                      className="rounded-2xl border border-neutral-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none"
                    >
                      <option value="">Tất cả nhân viên</option>
                      {assigneeOptions
                        .filter((item) => item.id)
                        .map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                {error && (
                  <div className="m-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                    {error}
                  </div>
                )}

                <div
                  className="h-[calc(100%-220px)] overflow-y-auto"
                  onScroll={handleConversationListScroll}
                >
                  {loadingList && !visibleConversations.length ? (
                    <ListSkeleton />
                  ) : visibleConversations.length ? (
                    <>
                      {visibleConversations.map((item) => (
                        <ConversationRow
                          key={item.id}
                          item={item}
                          active={activeId === item.id}
                          onClick={() => setActiveId(item.id)}
                        />
                      ))}

                      {loadingMoreConversations ? (
                        <div className="flex items-center justify-center gap-2 border-t border-neutral-100 px-4 py-4 text-xs font-bold text-neutral-500">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Đang tải thêm hội thoại...
                        </div>
                      ) : hasMoreConversations ? (
                        <button
                          type="button"
                          onClick={() => void loadMoreConversations()}
                          className="w-full border-t border-neutral-100 px-4 py-4 text-xs font-bold text-blue-600 hover:bg-blue-50"
                        >
                          Tải thêm hội thoại
                        </button>
                      ) : (
                        <div className="border-t border-neutral-100 px-4 py-4 text-center text-xs font-semibold text-neutral-400">
                          Đã tải hết hội thoại
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="p-8 text-center">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-neutral-100">
                        <MessageCircle className="h-6 w-6 text-neutral-400" />
                      </div>
                      <p className="mt-4 font-bold">Chưa có hội thoại</p>
                      <p className="mt-1 text-sm text-neutral-500">
                        Khi Facebook gửi sự kiện mới, hội thoại sẽ
                        xuất hiện tại đây.
                      </p>
                    </div>
                  )}
                </div>
              </aside>

              <section className="flex min-h-0 flex-col overflow-hidden rounded-[28px] border border-neutral-200 bg-white shadow-sm">
                {activeConversation ? (
                  <>
                    <div className="border-b border-neutral-200">
                      <div className="flex items-center justify-between p-5">
                        <div className="flex items-center gap-3">
                          <Avatar
                            src={customerAvatar(activeConversation)}
                            name={customerName(activeConversation)}
                            size="lg"
                          />
                          <div>
                            <h3 className="text-lg font-bold">
                              {customerName(activeConversation)}
                            </h3>
                            <div className="mt-1 flex items-center gap-2 text-xs font-semibold text-neutral-500">
                              {channelBadge(activeConversation.channel)}
                              {channelLabel(activeConversation.channel)}
                              <span className="text-neutral-300">•</span>
                              <span>
                                {statusLabel(activeConversation.status)}
                              </span>
                            </div>
                            <div className="mt-2 flex items-center gap-1.5">
                              <span className="mr-1 text-[11px] font-semibold text-neutral-400">Xưng hô:</span>
                              {(["Anh", "Chị", "Bạn"] as const).map((pronoun) => {
                                const selected = getCustomerPronoun(activeConversation) === pronoun;
                                return (
                                  <button
                                    key={pronoun}
                                    type="button"
                                    onClick={() => void handleSetCustomerPronoun(pronoun)}
                                    className={cx(
                                      "rounded-full border px-2.5 py-1 text-[11px] font-bold transition",
                                      selected
                                        ? "border-blue-600 bg-blue-600 text-white"
                                        : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50",
                                    )}
                                  >
                                    {pronoun}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-neutral-600">
                          <button className="rounded-full border border-neutral-200 p-2.5 hover:bg-neutral-50">
                            <UserPlus className="h-4 w-4" />
                          </button>
                          <button className="rounded-full border border-neutral-200 p-2.5 hover:bg-neutral-50">
                            <Tag className="h-4 w-4" />
                          </button>
                          <button className="rounded-full border border-neutral-200 p-2.5 hover:bg-neutral-50">
                            <Star className="h-4 w-4" />
                          </button>
                          <button className="rounded-full border border-neutral-200 p-2.5 hover:bg-neutral-50">
                            <Mail className="h-4 w-4" />
                          </button>
                          <button className="rounded-full border border-neutral-200 p-2.5 hover:bg-neutral-50">
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 px-5 pb-4">
                        <select
                          value={activeConversation.assigneeId || ""}
                          onChange={(event) =>
                            void handleAssign(event.target.value)
                          }
                          className="rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold outline-none"
                        >
                          {assigneeOptions.map((item) => (
                            <option key={item.id || "none"} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </select>

                        <button
                          onClick={handleCloseConversation}
                          className="rounded-2xl border border-neutral-200 px-4 py-2 text-sm font-bold text-neutral-700 hover:bg-neutral-50"
                        >
                          Đánh dấu đã chốt
                        </button>

                        <button
                          onClick={() =>
                            void markOmniConversationRead(activeConversation.id)
                          }
                          className="rounded-2xl border border-neutral-200 px-4 py-2 text-sm font-bold text-neutral-700 hover:bg-neutral-50"
                        >
                          Đã đọc
                        </button>
                      </div>
                    </div>

                    <div ref={chatScrollRef} className="flex-1 overflow-y-auto bg-[#fbfbfa] p-6">
                      {loadingDetail ? (
                        <ChatSkeleton />
                      ) : (
                        <div className="space-y-5">
                          <div className="text-center text-xs font-bold text-neutral-400">
                            Hôm nay
                          </div>

                          {Boolean(
                            activeConversation.adId ||
                              activeConversation.adPostId ||
                              activeConversation.adTitle ||
                              activeConversation.adBody ||
                              activeConversation.adImageUrl ||
                              activeConversation.referralSource,
                          ) ? (
                            <MetaAdReferralCard
                              conversation={activeConversation}
                            />
                          ) : null}

                          {activeConversation.messages?.length ? (
                            activeConversation.messages.map((message) => (
                              <MessageBubble
                                key={message.id}
                                message={message}
                                avatar={customerAvatar(activeConversation)}
                                name={customerName(activeConversation)}
                              />
                            ))
                          ) : (
                            <div className="flex min-h-56 items-center justify-center text-center">
                              <div>
                                <MessageCircle className="mx-auto h-10 w-10 text-neutral-300" />
                                <p className="mt-3 font-bold text-neutral-700">
                                  Chưa có tin nhắn
                                </p>
                                <p className="text-sm text-neutral-500">
                                  Hội thoại đã được tạo nhưng chưa có lịch sử
                                  message.
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="border-t border-neutral-200 bg-white p-5">
                      <div className="mb-3 flex gap-2 overflow-x-auto">
                        {(quickReplyTemplates.length
                          ? quickReplyTemplates
                          : QUICK_REPLIES.map((content, index) => ({
                              id: `default-${index}`,
                              title: "",
                              content,
                            } as OmniQuickReplyTemplate))
                        ).map((reply) => (
                          <button
                            key={reply.id}
                            onClick={() => applyQuickReplyTemplate(reply)}
                            className="whitespace-nowrap rounded-full border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
                            title={reply.content}
                          >
                            {reply.title
                              ? `${reply.title} · ${reply.content.slice(0, 24)}${reply.content.length > 24 ? "..." : ""}`
                              : reply.content.length > 30
                                ? `${reply.content.slice(0, 30)}...`
                                : reply.content}
                          </button>
                        ))}
                      </div>

                      <div className="rounded-3xl border border-neutral-200 bg-white p-4">
                        <textarea
                          value={draft}
                          onChange={(event) => {
                            setDraft(event.target.value);
                            if (!event.target.value.trim()) setDraftImageUrls([]);
                          }}
                          onKeyDown={(event) => {
                            const keyTriggersExpansion =
                              event.key === " " ||
                              event.key === "Tab" ||
                              (event.key === "Enter" && !event.shiftKey);

                            if (keyTriggersExpansion) {
                              const typedShortcut = draft.trim().toLowerCase();
                              const matchedTemplate =
                                quickReplyTemplates.find(
                                  (item) =>
                                    String(item.title || "")
                                      .trim()
                                      .toLowerCase() === typedShortcut,
                                );

                              if (matchedTemplate) {
                                event.preventDefault();
                                applyQuickReplyTemplate(matchedTemplate);
                                return;
                              }
                            }

                            if (event.key === "Enter" && !event.shiftKey) {
                              event.preventDefault();
                              void handleSend();
                            }
                          }}
                          rows={3}
                          className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-neutral-400"
                          placeholder={
                            isFacebookCommentConversation(activeConversation)
                              ? "Đây là bình luận Facebook. Hiện chỉ đọc/gán xử lý, chưa bật trả lời comment."
                              : "Nhập tin nhắn... Enter để gửi, Shift + Enter để xuống dòng"
                          }
                        />

                        {draftImageUrls.length ? (
                          <div className="mb-3 flex flex-wrap gap-2 border-t border-neutral-100 pt-3">
                            {draftImageUrls.map((url, index) => (
                              <div
                                key={`${url}-${index}`}
                                className="group relative h-24 w-24 overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50"
                              >
                                <img
                                  src={url}
                                  alt={`Ảnh đính kèm ${index + 1}`}
                                  className="h-full w-full object-cover"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDraftImageUrls((prev) =>
                                      prev.filter((_, itemIndex) => itemIndex !== index),
                                    )
                                  }
                                  className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white opacity-0 transition group-hover:opacity-100"
                                  title="Bỏ ảnh"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : null}

                        <div className="flex items-center justify-between border-t border-neutral-100 pt-3">
                          <div className="flex items-center gap-1 text-neutral-500">
                            <button className="rounded-full p-2 hover:bg-neutral-100">
                              <Sparkles className="h-4 w-4" />
                            </button>
                            <button className="rounded-full p-2 hover:bg-neutral-100">
                              <ImageIcon className="h-4 w-4" />
                            </button>
                            <button className="rounded-full p-2 hover:bg-neutral-100">
                              <Paperclip className="h-4 w-4" />
                            </button>
                          </div>

                          <button
                            onClick={() => void handleSend()}
                            disabled={(!draft.trim() && !draftImageUrls.length) || sending || isFacebookCommentConversation(activeConversation)}
                            className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {sending ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              <Send className="h-4 w-4" />
                            )}
                            Gửi
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex h-full items-center justify-center text-center">
                    <div>
                      <MessageCircle className="mx-auto h-12 w-12 text-neutral-300" />
                      <p className="mt-4 text-lg font-bold">
                        Chọn một hội thoại
                      </p>
                      <p className="text-sm text-neutral-500">
                        Danh sách bên trái hiển thị khách từ Facebook Messenger.
                      </p>
                    </div>
                  </div>
                )}
              </section>

              <aside className="min-h-0 overflow-hidden rounded-[28px] border border-neutral-200 bg-white shadow-sm">
                {activeConversation ? (
                  <>
                    <div className="flex border-b border-neutral-200 px-5">
                      {[
                        { key: "info", label: "Thông tin" },
                        {
                          key: "orders",
                          label: `Đơn hàng${
                            (activeConversation.orders || []).length
                              ? ` (${(activeConversation.orders || []).length})`
                              : ""
                          }`,
                        },
                        { key: "notes", label: "Ghi chú" },
                      ].map((item) => (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() =>
                            setRightPanelTab(
                              item.key as "info" | "orders" | "notes",
                            )
                          }
                          className={cx(
                            "border-b-2 px-3 py-5 text-sm font-bold",
                            rightPanelTab === item.key
                              ? "border-blue-600 text-blue-600"
                              : "border-transparent text-neutral-500 hover:text-neutral-800",
                          )}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>

                    <div className="h-[calc(100%-64px)] overflow-y-auto p-5">
                      {quickOrderSuccess ? (
                        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
                          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="font-black">Tạo đơn nháp thành công</p>
                            <p className="mt-1 text-sm">{quickOrderSuccess}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setQuickOrderSuccess("")}
                            className="rounded-lg p-1 hover:bg-emerald-100"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : null}

                      {rightPanelTab === "info" ? (
                        <>
                      <div className="flex items-center gap-3">
                        <Avatar
                          src={customerAvatar(activeConversation)}
                          name={customerName(activeConversation)}
                          size="xl"
                        />
                        <div>
                          <h3 className="text-xl font-bold">
                            {customerName(activeConversation)}
                          </h3>
                          <span className="mt-1 inline-flex rounded-full bg-pink-50 px-2 py-1 text-xs font-bold text-pink-600">
                            Khách mới
                          </span>
                        </div>
                      </div>

                      <div className="mt-6 space-y-3 border-b border-neutral-200 pb-5">
                        <InfoRow
                          icon={<MessageCircle className="h-4 w-4" />}
                          label="Kênh"
                          value={channelLabel(activeConversation.channel)}
                        />
                        <InfoRow
                          icon={<ShieldCheck className="h-4 w-4" />}
                          label="Facebook Page"
                          value={getPageName(
                            metaConnection,
                            activeConversation,
                          )}
                        />
                        <InfoRow
                          icon={<Users className="h-4 w-4" />}
                          label="Page ID"
                          value={getPageId(metaConnection, activeConversation)}
                        />
                        <InfoRow
                          icon={<Phone className="h-4 w-4" />}
                          label="SĐT"
                          value={activeConversation.customer?.phone || "-"}
                        />
                        <InfoRow
                          icon={<Circle className="h-4 w-4" />}
                          label="Địa chỉ"
                          value={activeConversation.customer?.address || "-"}
                        />
                        <InfoRow
                          icon={<Clock3 className="h-4 w-4" />}
                          label="Lần tương tác"
                          value={formatDateTime(
                            activeConversation.lastMessageAt,
                          )}
                        />
                      </div>

                      <Panel title="Nhãn">
                        <div className="flex flex-wrap gap-2">
                          {(activeConversation.tags || [])
                            .filter((tag) => !String(tag.tag || "").startsWith("__GENDER_"))
                            .map((tag) => (
                            <button
                              key={tag.id || tag.tag}
                              onClick={() => void handleRemoveTag(tag.tag)}
                              className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700"
                            >
                              {tag.tag}
                              <X className="h-3 w-3" />
                            </button>
                          ))}
                        </div>
                        <div className="mt-3 flex gap-2">
                          <input
                            value={tagDraft}
                            onChange={(event) =>
                              setTagDraft(event.target.value)
                            }
                            onKeyDown={(event) => {
                              if (event.key === "Enter") void handleAddTag();
                            }}
                            className="min-w-0 flex-1 rounded-2xl border border-neutral-200 px-3 py-2 text-sm outline-none"
                            placeholder="Thêm nhãn..."
                          />
                          <button
                            onClick={() => void handleAddTag()}
                            className="rounded-2xl bg-neutral-950 px-3 py-2 text-sm font-bold text-white"
                          >
                            Thêm
                          </button>
                        </div>
                      </Panel>

                      <Panel title="Người phụ trách">
                        <select
                          value={activeConversation.assigneeId || ""}
                          onChange={(event) =>
                            void handleAssign(event.target.value)
                          }
                          className="w-full rounded-2xl border border-neutral-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none"
                        >
                          {assigneeOptions.map((item) => (
                            <option
                              key={item.id || "none-right"}
                              value={item.id}
                            >
                              {item.name}
                            </option>
                          ))}
                        </select>
                      </Panel>

                      </>
                      ) : rightPanelTab === "orders" ? (
                        <>
                          <div className="mb-4 flex items-center justify-between gap-3">
                            <div>
                              <h3 className="text-lg font-black">
                                Lịch sử đơn hàng
                              </h3>
                              <p className="mt-1 text-xs text-neutral-500">
                                Các đơn của khách theo số điện thoại, mới nhất trước.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => void loadCustomerOrderHistory()}
                              className="rounded-xl border border-neutral-200 px-3 py-2 text-xs font-bold hover:bg-neutral-50"
                            >
                              Làm mới
                            </button>
                          </div>

                          {loadingCustomerOrders ? (
                            <div className="flex items-center justify-center gap-2 rounded-2xl bg-neutral-50 p-5 text-sm font-bold text-neutral-500">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Đang tải lịch sử đơn...
                            </div>
                          ) : customerOrderHistory.length ? (
                            <div className="space-y-3">
                              {customerOrderHistory.map((order) => (
                                <div
                                  key={order.id}
                                  className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <p className="truncate font-black text-neutral-900">
                                        {order.orderCode}
                                      </p>
                                      <p className="mt-1 text-xs text-neutral-500">
                                        {formatDateTime(order.createdAt)}
                                      </p>
                                    </div>
                                    <span
                                      className={cx(
                                        "shrink-0 rounded-full px-2 py-1 text-[11px] font-bold",
                                        order.status === "NEW"
                                          ? "bg-amber-100 text-amber-700"
                                          : order.status === "CANCELLED"
                                            ? "bg-red-100 text-red-700"
                                            : "bg-emerald-100 text-emerald-700",
                                      )}
                                    >
                                      {order.status === "NEW"
                                        ? "Đơn nháp"
                                        : order.status === "CANCELLED"
                                          ? "Đã huỷ"
                                          : order.status || "—"}
                                    </span>
                                  </div>

                                  <p className="mt-2 line-clamp-2 text-xs text-neutral-500">
                                    {[
                                      order.shippingAddressLine1,
                                      order.shippingWard,
                                      order.shippingDistrict,
                                      order.shippingProvince,
                                    ]
                                      .filter(Boolean)
                                      .join(", ") || "Chưa có địa chỉ"}
                                  </p>

                                  <div className="mt-2 flex items-center justify-between gap-3">
                                    <span className="text-sm font-black">
                                      {formatCurrency(
                                        Number(order.finalAmount || 0),
                                      )}
                                    </span>
                                    <span className="text-xs font-semibold text-neutral-500">
                                      {Array.isArray(order.items)
                                        ? `${order.items.reduce(
                                            (sum, item) =>
                                              sum + Number(item.qty || 0),
                                            0,
                                          )} sản phẩm`
                                        : ""}
                                    </span>
                                  </div>

                                  <div className="mt-3 flex flex-wrap gap-2">
                                    <a
                                      href={`/orders/${order.id}`}
                                      className="rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-bold"
                                    >
                                      Mở đơn
                                    </a>
                                    {order.status === "NEW" ? (
                                      <>
                                        <button
                                          onClick={() =>
                                            void handleCancelQuickOrder(order.id)
                                          }
                                          className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700"
                                        >
                                          Huỷ
                                        </button>
                                        <button
                                          onClick={() =>
                                            void handleDeleteQuickOrder(order.id)
                                          }
                                          className="rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700"
                                        >
                                          Xoá
                                        </button>
                                      </>
                                    ) : null}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="rounded-2xl bg-neutral-50 p-5 text-center text-sm text-neutral-500">
                              Chưa tìm thấy đơn hàng nào của khách này.
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <Panel title="Ghi chú nội bộ">
                            <div className="mb-3 flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold text-neutral-500">
                                Mẫu ghi chú dùng chung
                              </span>
                              {canManageOmniSettings ? (
                                <button
                                  type="button"
                                  onClick={() => openWorkspace("noteSettings")}
                                  className="rounded-xl border border-neutral-200 px-2.5 py-1.5 text-xs font-bold"
                                >
                                  Cài đặt ghi chú
                                </button>
                              ) : null}
                            </div>
                            {noteTemplates.length ? (
                              <div className="mb-3 flex flex-wrap gap-2">
                                {noteTemplates.map((template) => (
                                  <button
                                    key={template.id}
                                    type="button"
                                    onClick={() =>
                                      void handleApplyNoteTemplate(template)
                                    }
                                    className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-bold text-neutral-700 hover:bg-neutral-50"
                                  >
                                    {template.name}
                                  </button>
                                ))}
                              </div>
                            ) : null}
                            <textarea
                              value={noteDraft}
                              onChange={(event) =>
                                setNoteDraft(event.target.value)
                              }
                              rows={4}
                              className="w-full resize-none rounded-2xl border border-neutral-200 p-3 text-sm outline-none placeholder:text-neutral-400"
                              placeholder="Nhập ghi chú nội bộ..."
                            />
                            <div className="mt-2 text-right">
                              <button
                                onClick={() => void handleAddNote()}
                                className="rounded-2xl bg-neutral-950 px-4 py-2 text-sm font-bold text-white"
                              >
                                Lưu
                              </button>
                            </div>
                            <div className="mt-4 space-y-2">
                              {(activeConversation.notes || []).map((note) => (
                                <div
                                  key={note.id}
                                  className="rounded-2xl bg-neutral-50 p-3"
                                >
                                  <p className="text-sm text-neutral-700">
                                    {note.note}
                                  </p>
                                  <p className="mt-1 text-xs text-neutral-400">
                                    {note.staffName || "-"} ·{" "}
                                    {formatDateTime(note.createdAt)}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </Panel>
                        </>
                      )}

                      {rightPanelTab === "info" && quickOrderOpen ? (
                        <QuickOrderForm
                          conversation={activeConversation}
                          products={orderProducts}
                          branchId={activeConversation.branchId || activeBranchId || ""}
                          branchOptions={quickOrderBranchOptions}
                          saving={quickOrderSaving}
                          onCancel={() => setQuickOrderOpen(false)}
                          onSaving={setQuickOrderSaving}
                          onCreated={handleQuickOrderCreated}
                          onError={setError}
                        />
                      ) : rightPanelTab === "info" ? (
                        <button onClick={() => setQuickOrderOpen(true)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700">
                          <ShoppingBag className="h-4 w-4" />
                          Chốt đơn nhanh
                        </button>
                      ) : null}

                      <button
                        onClick={handleCloseConversation}
                        className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-neutral-200 px-4 py-3 text-sm font-bold text-neutral-700 hover:bg-neutral-50"
                      >
                        <ShieldCheck className="h-4 w-4" />
                        Đánh dấu đã xử lý
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex h-full items-center justify-center p-8 text-center text-sm text-neutral-500">
                    Chọn hội thoại để xem thông tin khách.
                  </div>
                )}
              </aside>
            </section>
          ) : (
            <WorkspacePanel
              workspace={workspace}
              conversations={visibleConversations}
              quickReplies={quickReplyTemplates.length ? quickReplyTemplates.map((item) => item.content) : QUICK_REPLIES}
              assignees={assigneeOptions}
              selectedSummary={selectedSummary}
              connectionStatus={metaConnection}
              connectionLoading={loadingConnection}
              onSyncConnection={() => void handleSyncMetaConnection()}
              onReloadConnection={() => void loadMetaConnection()}
              onOpenInbox={() => openWorkspace("inbox")}
              noteTemplates={noteTemplates}
              quickReplyTemplates={quickReplyTemplates}
              newQuickReplyShortcut={newQuickReplyShortcut}
              onNewQuickReplyShortcutChange={setNewQuickReplyShortcut}
              newQuickReply={newQuickReply}
              onNewQuickReplyChange={setNewQuickReply}
              onCreateQuickReply={handleCreateQuickReply}
              onEditQuickReply={handleEditQuickReply}
              onDeleteQuickReply={handleDeleteQuickReply}
              onDeleteAllQuickReplies={() => void handleDeleteAllQuickReplies()}
              deletingAllQuickReplies={deletingAllQuickReplies}
              quickReplySearch={quickReplySearch}
              onQuickReplySearchChange={setQuickReplySearch}
              onImportQuickReplyExcel={(file) => void handleImportQuickReplyExcel(file)}
              onDownloadQuickReplyTemplate={handleDownloadQuickReplyTemplate}
              importingQuickReplies={importingQuickReplies}
              quickReplyImportResult={quickReplyImportResult}
              assignmentSettings={assignmentSettings}
              savedAssignmentSettings={savedAssignmentSettings}
              activeBranchId={activeBranchId}
              assignmentHistory={assignmentHistory}
              assignmentReport={assignmentReport}
              assignmentReportLoading={assignmentReportLoading}
              assignmentReportDays={assignmentReportDays}
              onLoadAssignmentReport={(days) => void loadAssignmentReport(days)}
              staffOptions={staffOptions}
              savingAssignment={savingAssignment}
              assignmentSaveState={assignmentSaveState}
              assignmentSavedAt={assignmentSavedAt}
              canManageOmniSettings={canManageOmniSettings}
              canCreateQuickReplies={canCreateQuickReplies}
              canEditQuickReplies={canEditQuickReplies}
              canDeleteQuickReplies={canDeleteQuickReplies}
              canDeleteAllQuickReplies={canDeleteAllQuickReplies}
              canImportQuickReplies={canImportQuickReplies}
              canManageAssignmentSettings={canManageAssignmentSettings}
              onAssignmentChange={setAssignmentSettings}
              onSaveAssignment={() => void handleSaveAssignmentSettings()}
              newNoteTemplateName={newNoteTemplateName}
              onNewNoteTemplateNameChange={setNewNoteTemplateName}
              onCreateNoteTemplate={() => void handleCreateNoteTemplate()}
              onRenameNoteTemplate={(template) =>
                void handleRenameNoteTemplate(template)
              }
              onDeleteNoteTemplate={(template) =>
                void handleDeleteNoteTemplate(template)
              }
            />
          )}
        </main>
      </div>
    </div>
  );
}


function quickOrderNormalizeSpaces(value?: string | null) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function quickOrderRemoveVietnameseTones(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

function quickOrderNormalizeAddressToken(value?: string | null) {
  return quickOrderRemoveVietnameseTones(String(value || ""))
    .toLowerCase()
    .replace(/[,.;|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function quickOrderStripProvincePrefix(value?: string | null) {
  return quickOrderNormalizeAddressToken(value)
    .replace(/^(tinh|thanh pho|tp)\s+/, "")
    .trim();
}

function quickOrderStripDistrictPrefix(value?: string | null) {
  return quickOrderNormalizeAddressToken(value)
    .replace(/^(quan|huyen|thi xa|thanh pho|tp)\s+/, "")
    .trim();
}

function quickOrderStripWardPrefix(value?: string | null) {
  return quickOrderNormalizeAddressToken(value)
    .replace(/^(xa|phuong|thi tran)\s+/, "")
    .trim();
}

function quickOrderExtractPhone(raw: string) {
  const match = String(raw || "").match(/(?:\+?84|0)[\d.\s-]{8,14}\d/);
  if (!match) return { phone: "", cleaned: raw };
  const digits = match[0].replace(/\D/g, "").replace(/^84/, "0");
  return {
    phone: digits,
    cleaned: raw.replace(match[0], " ").replace(/\s+/g, " ").trim(),
  };
}

function quickOrderExtractRecipientName(raw: string) {
  const normalized = String(raw || "").trim();
  if (!normalized) return { recipientName: "", cleaned: raw };

  for (const splitter of [" - ", " – ", "\n", ",", ";", "|"]) {
    if (!normalized.includes(splitter)) continue;
    const [first, ...rest] = normalized.split(splitter);
    const firstPart = first.trim();
    if (
      firstPart &&
      !/\d/.test(firstPart) &&
      firstPart.length <= 50 &&
      firstPart.split(/\s+/).length <= 7
    ) {
      return {
        recipientName: firstPart,
        cleaned: rest.join(splitter).trim(),
      };
    }
  }

  return { recipientName: "", cleaned: raw };
}

function quickOrderParseSmartAddress(raw: string) {
  let working = String(raw || "").trim();
  const phoneResult = quickOrderExtractPhone(working);
  working = phoneResult.cleaned;
  const nameResult = quickOrderExtractRecipientName(working);
  working = nameResult.cleaned;

  return {
    recipientName: nameResult.recipientName,
    phone: phoneResult.phone,
    addressText: quickOrderNormalizeSpaces(
      working
        .replace(
          /\b(sdt|số điện thoại|so dien thoai|điện thoại|dien thoai|phone)\b[:\-]?\s*/gi,
          " ",
        )
        .replace(
          /\b(người nhận|nguoi nhan|tên|ten|khách hàng|khach hang)\b[:\-]?\s*/gi,
          " ",
        ),
    ),
  };
}

function quickOrderFindProvince(
  raw: string,
  options: ProvinceItem[],
): ProvinceItem | null {
  const token = quickOrderNormalizeAddressToken(raw);
  return (
    options
      .map((item) => ({
        item,
        keys: [
          quickOrderNormalizeAddressToken(item.name),
          quickOrderStripProvincePrefix(item.name),
        ].filter(Boolean),
      }))
      .sort((a, b) => Math.max(...b.keys.map((k) => k.length)) - Math.max(...a.keys.map((k) => k.length)))
      .find((row) => row.keys.some((key) => token.includes(key)))?.item || null
  );
}

function quickOrderFindDistrict(
  raw: string,
  options: DistrictItem[],
): DistrictItem | null {
  const token = quickOrderNormalizeAddressToken(raw);
  return (
    options
      .map((item) => ({
        item,
        keys: [
          quickOrderNormalizeAddressToken(item.name),
          quickOrderStripDistrictPrefix(item.name),
        ].filter(Boolean),
      }))
      .sort((a, b) => Math.max(...b.keys.map((k) => k.length)) - Math.max(...a.keys.map((k) => k.length)))
      .find((row) => row.keys.some((key) => token.includes(key)))?.item || null
  );
}

function quickOrderFindWard(
  raw: string,
  options: WardItem[],
): WardItem | null {
  const token = quickOrderNormalizeAddressToken(raw);
  return (
    options
      .map((item) => ({
        item,
        keys: [
          quickOrderNormalizeAddressToken(item.name),
          quickOrderStripWardPrefix(item.name),
        ].filter(Boolean),
      }))
      .sort((a, b) => Math.max(...b.keys.map((k) => k.length)) - Math.max(...a.keys.map((k) => k.length)))
      .find((row) => row.keys.some((key) => token.includes(key)))?.item || null
  );
}

function quickOrderRemoveAddressParts(raw: string, parts: string[]) {
  let result = String(raw || "");
  for (const part of parts.filter(Boolean)) {
    const escaped = part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(new RegExp(escaped, "ig"), " ");
  }
  return result
    .replace(/\b(tỉnh|thành phố|tp|quận|huyện|thị xã|xã|phường|thị trấn)\b/gi, " ")
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/^,\s*|,\s*$/g, "")
    .trim();
}

function QuickOrderForm({
  conversation,
  products,
  branchId,
  branchOptions,
  saving,
  onCancel,
  onSaving,
  onCreated,
  onError,
}: {
  conversation: OmniConversation;
  products: OrderProduct[];
  branchId: string;
  branchOptions: BranchOption[];
  saving: boolean;
  onCancel: () => void;
  onSaving: (value: boolean) => void;
  onCreated: (order: OmniQuickOrder) => void | Promise<void>;
  onError: (message: string) => void;
}) {
  const defaultBranchId =
    branchId || (branchOptions.length === 1 ? branchOptions[0].id : "");
  const [selectedBranchId, setSelectedBranchId] = useState(defaultBranchId);
  const [customerNameValue, setCustomerNameValue] = useState(customerName(conversation));
  const [phone, setPhone] = useState(conversation.customer?.phone || "");
  const [address, setAddress] = useState(conversation.customer?.address || "");
  const [smartAddressInput, setSmartAddressInput] = useState("");
  const [smartAddressHint, setSmartAddressHint] = useState("");
  const [smartAddressLoading, setSmartAddressLoading] = useState(false);
  const [provinceOptions, setProvinceOptions] = useState<ProvinceItem[]>([]);
  const [districtOptions, setDistrictOptions] = useState<DistrictItem[]>([]);
  const [wardOptions, setWardOptions] = useState<WardItem[]>([]);
  const [province, setProvince] = useState("");
  const [district, setDistrict] = useState("");
  const [ward, setWard] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [ghnDistrictId, setGhnDistrictId] = useState<number | undefined>();
  const [ghnWardCode, setGhnWardCode] = useState<string | undefined>();
  const [note, setNote] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [items, setItems] = useState<Array<{ variantId: string; qty: number; label: string }>>([]);

  useEffect(() => {
    if (branchId) {
      setSelectedBranchId(branchId);
      return;
    }
    if (!selectedBranchId && branchOptions.length === 1) {
      setSelectedBranchId(branchOptions[0].id);
    }
  }, [branchId, branchOptions, selectedBranchId]);

  useEffect(() => {
    void getProvinces()
      .then((rows) => setProvinceOptions(Array.isArray(rows) ? rows : []))
      .catch(() => setProvinceOptions([]));
  }, []);

  const applySmartAddress = async (rawValue: string) => {
    const raw = String(rawValue || "").trim();
    setSmartAddressInput(raw);
    if (!raw) {
      setSmartAddressHint("");
      return;
    }

    setSmartAddressLoading(true);
    setSmartAddressHint("");
    onError("");

    try {
      const parsed = quickOrderParseSmartAddress(raw);
      if (parsed.recipientName) setCustomerNameValue(parsed.recipientName);
      if (parsed.phone) setPhone(parsed.phone);

      const addressText = parsed.addressText || raw;
      const matchedProvince = quickOrderFindProvince(
        addressText,
        provinceOptions,
      );

      if (!matchedProvince?.id) {
        setAddress(addressText);
        setProvince("");
        setDistrict("");
        setWard("");
        setGhnDistrictId(undefined);
        setGhnWardCode(undefined);
        setSmartAddressHint(
          "Đã lấy tên/SĐT nhưng chưa nhận ra tỉnh thành. Hãy chọn lại bên dưới.",
        );
        return;
      }

      setProvince(matchedProvince.name);
      const districts = await getDistricts(matchedProvince.id);
      setDistrictOptions(Array.isArray(districts) ? districts : []);

      const matchedDistrict = quickOrderFindDistrict(addressText, districts);
      if (!matchedDistrict?.id) {
        setAddress(addressText);
        setDistrict("");
        setWard("");
        setGhnDistrictId(undefined);
        setGhnWardCode(undefined);
        setSmartAddressHint(
          "Đã nhận ra tỉnh thành nhưng chưa chắc quận huyện. Hãy chọn lại bên dưới.",
        );
        return;
      }

      setDistrict(matchedDistrict.name);
      const wards = await getWards(matchedDistrict.id);
      setWardOptions(Array.isArray(wards) ? wards : []);

      const matchedWard = quickOrderFindWard(addressText, wards);
      setWard(matchedWard?.name || "");

      const detailAddress =
        quickOrderRemoveAddressParts(addressText, [
          matchedProvince.name,
          matchedDistrict.name,
          matchedWard?.name || "",
        ]) || addressText;
      setAddress(detailAddress);

      let resolved: any = null;
      if (matchedWard?.name) {
        resolved = await resolveGhnAddress({
          province: matchedProvince.name,
          district: matchedDistrict.name,
          ward: matchedWard.name,
        });
      }

      setGhnDistrictId(
        Number(resolved?.districtId || 0) || undefined,
      );
      setGhnWardCode(
        String(resolved?.wardCode || "").trim() || undefined,
      );

      setSmartAddressHint(
        matchedWard?.name && resolved?.districtId && resolved?.wardCode
          ? "Đã tách tên, SĐT, địa chỉ và map đủ mã GHN."
          : matchedWard?.name
            ? "Đã tách tỉnh/huyện/xã nhưng chưa map được mã GHN. Hãy kiểm tra lại."
            : "Đã nhận ra tỉnh/huyện nhưng chưa chắc phường/xã.",
      );
    } catch (error) {
      setSmartAddressHint(
        error instanceof Error
          ? error.message
          : "Không phân tích được địa chỉ.",
      );
    } finally {
      setSmartAddressLoading(false);
    }
  };

  const handleProvinceChange = async (value: string) => {
    setProvince(value);
    setDistrict("");
    setWard("");
    setGhnDistrictId(undefined);
    setGhnWardCode(undefined);
    const item = provinceOptions.find((row) => row.name === value);
    if (!item?.id) {
      setDistrictOptions([]);
      setWardOptions([]);
      return;
    }
    const rows = await getDistricts(item.id);
    setDistrictOptions(Array.isArray(rows) ? rows : []);
    setWardOptions([]);
  };

  const handleDistrictChange = async (value: string) => {
    setDistrict(value);
    setWard("");
    setGhnDistrictId(undefined);
    setGhnWardCode(undefined);
    const item = districtOptions.find((row) => row.name === value);
    if (!item?.id) {
      setWardOptions([]);
      return;
    }
    const rows = await getWards(item.id);
    setWardOptions(Array.isArray(rows) ? rows : []);
  };

  const handleWardChange = async (value: string) => {
    setWard(value);
    setGhnDistrictId(undefined);
    setGhnWardCode(undefined);
    if (!province || !district || !value) return;
    try {
      const resolved = await resolveGhnAddress({
        province,
        district,
        ward: value,
      });
      setGhnDistrictId(
        Number(resolved?.districtId || 0) || undefined,
      );
      setGhnWardCode(
        String(resolved?.wardCode || "").trim() || undefined,
      );
      setSmartAddressHint(
        resolved?.districtId && resolved?.wardCode
          ? "Địa chỉ đã có đủ mã GHN."
          : "Chưa map được mã GHN, hãy kiểm tra lại địa chỉ.",
      );
    } catch {
      setSmartAddressHint(
        "Chưa map được mã GHN, hãy kiểm tra lại địa chỉ.",
      );
    }
  };

  const variants = useMemo(() => products.flatMap((product) => product.variants.map((variant) => ({
    ...variant,
    label: `${variant.sku} · ${product.name}${variant.color || variant.size ? ` · ${[variant.color, variant.size].filter(Boolean).join(" / ")}` : ""}`,
  }))), [products]);
  const filtered = useMemo(() => {
    const q = searchValue.trim().toLocaleLowerCase("vi-VN");
    if (!q) return variants.slice(0, 12);
    return variants.filter((item) => item.label.toLocaleLowerCase("vi-VN").includes(q)).slice(0, 12);
  }, [searchValue, variants]);

  const addItem = (variantId: string, label: string) => {
    setItems((prev) => {
      const existed = prev.find((item) => item.variantId === variantId);
      if (existed) return prev.map((item) => item.variantId === variantId ? { ...item, qty: item.qty + 1 } : item);
      return [...prev, { variantId, qty: 1, label }];
    });
    setSearchValue("");
  };

  const submit = async () => {
    if (!selectedBranchId)
      return onError("Hãy chọn chi nhánh tạo đơn.");
    if (!phone.trim() || !address.trim() || !items.length)
      return onError("Cần nhập SĐT, địa chỉ và ít nhất một sản phẩm.");
    if (!province || !district || !ward)
      return onError(
        "Địa chỉ chưa đủ Tỉnh/Thành, Quận/Huyện và Phường/Xã.",
      );
    if (!ghnDistrictId || !ghnWardCode)
      return onError(
        "Địa chỉ chưa map được mã GHN. Hãy chọn lại Quận/Huyện và Phường/Xã.",
      );
    onSaving(true);
    onError("");
    try {
      const order = await createOmniQuickOrder(conversation.id, {
        customerName: customerNameValue.trim(),
        phone,
        address: [address, addressLine2, ward, district, province]
          .filter(Boolean)
          .join(", "),
        addressLine1: address,
        addressLine2,
        province,
        district,
        ward,
        postalCode,
        ghnDistrictId,
        ghnWardCode,
        branchId: selectedBranchId,
        note,
        requestId: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
        items: items.map(({ variantId, qty }) => ({ variantId, qty })),
      });
      await onCreated(order);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Không tạo được đơn nháp.");
    } finally {
      onSaving(false);
    }
  };

  return (
    <div className="mt-4 rounded-3xl border border-blue-200 bg-blue-50/50 p-4">
      <div className="flex items-center justify-between"><h4 className="font-black">Chốt đơn nhanh</h4><button onClick={onCancel}><X className="h-4 w-4" /></button></div>
      <div className="mt-3 space-y-2">
        <select
          value={selectedBranchId}
          onChange={(event) => {
            setSelectedBranchId(event.target.value);
            onError("");
          }}
          className={cx(
            "w-full rounded-2xl border bg-white px-3 py-2 text-sm font-bold",
            selectedBranchId
              ? "border-neutral-200 text-neutral-900"
              : "border-red-300 text-red-600",
          )}
        >
          <option value="">Chọn chi nhánh tạo đơn *</option>
          {branchOptions.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.code ? `${branch.code} · ` : ""}
              {branch.name}
            </option>
          ))}
        </select>
        {!selectedBranchId ? (
          <p className="px-1 text-xs font-semibold text-red-600">
            Tài khoản đang ở chế độ Tất cả chi nhánh, cần chọn chi nhánh cho đơn này.
          </p>
        ) : null}
        <div className="rounded-2xl border border-blue-200 bg-white p-3">
          <p className="mb-2 text-xs font-black uppercase tracking-wide text-blue-700">
            Địa chỉ thông minh
          </p>
          <textarea
            value={smartAddressInput}
            onChange={(event) => setSmartAddressInput(event.target.value)}
            onBlur={(event) => void applySmartAddress(event.target.value)}
            placeholder={"Paste nguyên thông tin khách:\nTrần Thành 0948123496\n222 ấp Đồng Thành, xã Thạnh Đông A, huyện Tân Hiệp, Kiên Giang"}
            rows={4}
            className="w-full resize-none rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none"
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-xs text-neutral-500">
              {smartAddressLoading
                ? "Đang phân tích địa chỉ..."
                : smartAddressHint ||
                  "Dán nguyên tên, SĐT và địa chỉ; hệ thống sẽ tự tách."}
            </p>
            <button
              type="button"
              disabled={smartAddressLoading || !smartAddressInput.trim()}
              onClick={() => void applySmartAddress(smartAddressInput)}
              className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-black text-white disabled:opacity-40"
            >
              Phân tích
            </button>
          </div>
        </div>

        <input value={customerNameValue} onChange={(e) => setCustomerNameValue(e.target.value)} placeholder="Tên khách" className="w-full rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-sm" />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Số điện thoại *" className="w-full rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-sm" />
        <textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Địa chỉ dòng 1 *" rows={2} className="w-full resize-none rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-sm" />
        <input value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} placeholder="Địa chỉ dòng 2" className="w-full rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-sm" />

        <div className="grid gap-2">
          <select
            value={province}
            onChange={(event) => void handleProvinceChange(event.target.value)}
            className="w-full rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-sm"
          >
            <option value="">Chọn tỉnh / thành *</option>
            {provinceOptions.map((item) => (
              <option key={item.id} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>

          <select
            value={district}
            onChange={(event) => void handleDistrictChange(event.target.value)}
            disabled={!province}
            className="w-full rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-sm disabled:opacity-50"
          >
            <option value="">Chọn quận / huyện *</option>
            {districtOptions.map((item) => (
              <option key={item.id} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>

          <select
            value={ward}
            onChange={(event) => void handleWardChange(event.target.value)}
            disabled={!district}
            className="w-full rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-sm disabled:opacity-50"
          >
            <option value="">Chọn phường / xã *</option>
            {wardOptions.map((item) => (
              <option key={item.code} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <input
            value={postalCode}
            onChange={(event) => setPostalCode(event.target.value)}
            placeholder="Mã bưu chính"
            className="w-full rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-sm"
          />
          <div
            className={cx(
              "rounded-2xl border px-3 py-2 text-xs font-bold",
              ghnDistrictId && ghnWardCode
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-amber-200 bg-amber-50 text-amber-700",
            )}
          >
            {ghnDistrictId && ghnWardCode
              ? `GHN: ${ghnDistrictId} · ${ghnWardCode}`
              : "Chưa có mã GHN"}
          </div>
        </div>
        <div className="relative">
          <input value={searchValue} onChange={(e) => setSearchValue(e.target.value)} placeholder="Tìm SKU hoặc sản phẩm" className="w-full rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-sm" />
          {searchValue ? <div className="absolute left-0 right-0 z-20 mt-1 max-h-56 overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-1 shadow-xl">{filtered.map((item) => <button key={item.id} type="button" onClick={() => addItem(item.id, item.label)} className="block w-full rounded-xl px-3 py-2 text-left text-xs hover:bg-neutral-50">{item.label}</button>)}</div> : null}
        </div>
        {items.map((item) => <div key={item.variantId} className="flex items-center gap-2 rounded-2xl bg-white p-2 text-xs"><span className="min-w-0 flex-1 truncate">{item.label}</span><input type="number" min={1} value={item.qty} onChange={(e) => setItems((prev) => prev.map((row) => row.variantId === item.variantId ? { ...row, qty: Math.max(1, Number(e.target.value || 1)) } : row))} className="w-14 rounded-lg border px-2 py-1" /><button onClick={() => setItems((prev) => prev.filter((row) => row.variantId !== item.variantId))}><X className="h-4 w-4" /></button></div>)}

        <div className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-white px-3 py-3">
          <div>
            <p className="text-sm font-bold text-neutral-700">
              Phí ship mặc định
            </p>
            <p className="text-xs text-neutral-400">
              Có thể sửa lại trong danh sách đơn hàng
            </p>
          </div>
          <span className="text-base font-black text-neutral-900">
            30.000đ
          </span>
        </div>

        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi chú đơn" rows={2} className="w-full resize-none rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-sm" />
      </div>
      <div className="mt-3 flex gap-2"><button onClick={onCancel} className="flex-1 rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-sm font-bold">Đóng</button><button disabled={saving} onClick={() => void submit()} className="flex-1 rounded-2xl bg-blue-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">{saving ? "Đang tạo..." : "Tạo đơn nháp"}</button></div>
    </div>
  );
}

function OmniNavSection({
  title,
  items,
  activeKey,
  onSelect,
}: {
  title: string;
  activeKey: WorkspaceKey;
  onSelect: (key: WorkspaceKey) => void;
  items: Array<{
    key: WorkspaceKey;
    label: string;
    icon: React.ReactNode;
    badge?: number;
  }>;
}) {
  return (
    <div>
      <p className="mb-2 px-2 text-[11px] font-black uppercase tracking-[0.2em] text-neutral-400">
        {title}
      </p>
      <div className="space-y-1">
        {items.map((item) => {
          const isActive = activeKey === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelect(item.key)}
              className={cx(
                "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-bold transition",
                isActive
                  ? "bg-neutral-950 text-white shadow-sm"
                  : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-950",
              )}
            >
              <span
                className={cx(
                  "flex h-8 w-8 items-center justify-center rounded-xl",
                  isActive ? "bg-white/10" : "bg-neutral-100",
                )}
              >
                {item.icon}
              </span>
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {!!item.badge && (
                <span
                  className={cx(
                    "rounded-full px-2 py-0.5 text-[11px] font-black",
                    isActive
                      ? "bg-white text-neutral-950"
                      : "bg-blue-600 text-white",
                  )}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WorkspacePanel({
  workspace,
  conversations,
  quickReplies,
  assignees,
  selectedSummary,
  connectionStatus,
  connectionLoading,
  onSyncConnection,
  onReloadConnection,
  onOpenInbox,
  noteTemplates,
  newNoteTemplateName,
  onNewNoteTemplateNameChange,
  onCreateNoteTemplate,
  onRenameNoteTemplate,
  onDeleteNoteTemplate,
  quickReplyTemplates,
  newQuickReplyShortcut,
  onNewQuickReplyShortcutChange,
  newQuickReply,
  onNewQuickReplyChange,
  onCreateQuickReply,
  onEditQuickReply,
  onDeleteQuickReply,
  onDeleteAllQuickReplies,
  deletingAllQuickReplies,
  quickReplySearch,
  onQuickReplySearchChange,
  onImportQuickReplyExcel,
  onDownloadQuickReplyTemplate,
  importingQuickReplies,
  quickReplyImportResult,
  assignmentSettings,
  savedAssignmentSettings,
  activeBranchId,
  assignmentHistory,
  assignmentReport,
  assignmentReportLoading,
  assignmentReportDays,
  onLoadAssignmentReport,
  staffOptions,
  savingAssignment,
  assignmentSaveState,
  assignmentSavedAt,
  canManageOmniSettings,
  canCreateQuickReplies,
  canEditQuickReplies,
  canDeleteQuickReplies,
  canDeleteAllQuickReplies,
  canImportQuickReplies,
  canManageAssignmentSettings,
  onAssignmentChange,
  onSaveAssignment,
}: {
  workspace: WorkspaceKey;
  conversations: OmniConversation[];
  quickReplies: string[];
  assignees: AssigneeOption[];
  selectedSummary: {
    unread: number;
    open: number;
    processing: number;
    closed: number;
  };
  connectionStatus: MetaConnectionStatus | null;
  connectionLoading: boolean;
  onSyncConnection: () => void;
  onReloadConnection: () => void;
  onOpenInbox: () => void;
  noteTemplates: OmniNoteTemplate[];
  quickReplyTemplates: OmniQuickReplyTemplate[];
  newQuickReplyShortcut: string;
  onNewQuickReplyShortcutChange: (value: string) => void;
  newQuickReply: string;
  onNewQuickReplyChange: (value: string) => void;
  onCreateQuickReply: () => void;
  onEditQuickReply: (template: OmniQuickReplyTemplate) => void;
  onDeleteQuickReply: (template: OmniQuickReplyTemplate) => void;
  onDeleteAllQuickReplies: () => void;
  deletingAllQuickReplies: boolean;
  quickReplySearch: string;
  onQuickReplySearchChange: (value: string) => void;
  onImportQuickReplyExcel: (file?: File | null) => void;
  onDownloadQuickReplyTemplate: () => void;
  importingQuickReplies: boolean;
  quickReplyImportResult: string;
  assignmentSettings: OmniAssignmentSettings | null;
  savedAssignmentSettings: OmniAssignmentSettings | null;
  activeBranchId?: string;
  assignmentHistory: any[];
  assignmentReport: OmniAssignmentReport | null;
  assignmentReportLoading: boolean;
  assignmentReportDays: 1 | 7 | 30;
  onLoadAssignmentReport: (days: 1 | 7 | 30) => void;
  staffOptions: AssigneeOption[];
  savingAssignment: boolean;
  assignmentSaveState: "idle" | "saved" | "error";
  assignmentSavedAt: string | null;
  canManageOmniSettings: boolean;
  canCreateQuickReplies: boolean;
  canEditQuickReplies: boolean;
  canDeleteQuickReplies: boolean;
  canDeleteAllQuickReplies: boolean;
  canImportQuickReplies: boolean;
  canManageAssignmentSettings: boolean;
  onAssignmentChange: (value: OmniAssignmentSettings) => void;
  onSaveAssignment: () => void;
  newNoteTemplateName: string;
  onNewNoteTemplateNameChange: (value: string) => void;
  onCreateNoteTemplate: () => void;
  onRenameNoteTemplate: (template: OmniNoteTemplate) => void;
  onDeleteNoteTemplate: (template: OmniNoteTemplate) => void;
}) {
  const title = WORKSPACE_TITLES[workspace];
  const total = conversations.length;
  const tagged = conversations.reduce(
    (sum, item) => sum + (item.tags?.length || 0),
    0,
  );

  if (workspace === "customers") {
    return (
      <WorkspaceShell
        title={title}
        description="Danh sách khách nhắn tin qua Facebook Messenger và các kênh bán hàng đa kênh."
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <StatCard label="Tổng khách hội thoại" value={total} />
          <StatCard label="Khách chưa trả lời" value={selectedSummary.open} />
          <StatCard
            label="Đã phân công"
            value={conversations.filter((item) => item.assigneeId).length}
          />
        </div>
        <div className="mt-5 overflow-hidden rounded-3xl border border-neutral-200 bg-white">
          {conversations.map((item) => (
            <button
              key={item.id}
              onClick={onOpenInbox}
              className="flex w-full items-center justify-between border-b border-neutral-100 px-5 py-4 text-left hover:bg-neutral-50"
            >
              <div className="flex items-center gap-3">
                <Avatar
                  src={item.customer?.avatarUrl || ""}
                  name={customerName(item)}
                  size="md"
                />
                <div>
                  <p className="font-black">{customerName(item)}</p>
                  <p className="text-sm text-neutral-500">
                    {channelLabel(item.channel)} ·{" "}
                    {formatDateTime(item.lastMessageAt)}
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-bold text-neutral-600">
                {statusLabel(item.status)}
              </span>
            </button>
          ))}
        </div>
      </WorkspaceShell>
    );
  }

  if (workspace === "tags") {
    const tags = Array.from(
      new Set(
        conversations.flatMap((item) => item.tags?.map((tag) => tag.tag) || []),
      ),
    );
    return (
      <WorkspaceShell
        title={title}
        description="Quản lý nhãn phân loại hội thoại để lọc khách, ưu tiên xử lý và chăm sóc lại."
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {(tags.length
            ? tags
            : ["Khách mới", "Cần tư vấn size", "Chờ chốt đơn", "Đã mua hàng"]
          ).map((tag) => (
            <div
              key={tag}
              className="rounded-3xl border border-neutral-200 bg-white p-5"
            >
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-black text-blue-700">
                  {tag}
                </span>
                <Tag className="h-4 w-4 text-neutral-400" />
              </div>
              <p className="mt-4 text-2xl font-black">
                {
                  conversations.filter((item) =>
                    item.tags?.some((t) => t.tag === tag),
                  ).length
                }
              </p>
              <p className="text-sm text-neutral-500">hội thoại</p>
            </div>
          ))}
        </div>
      </WorkspaceShell>
    );
  }

  if (workspace === "assignments") {
    return (
      <WorkspaceShell
        title={title}
        description="Theo dõi hội thoại theo nhân viên phụ trách để chia việc CSKH rõ ràng."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {assignees.map((staff) => (
            <div
              key={staff.id || "none"}
              className="rounded-3xl border border-neutral-200 bg-white p-5"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-neutral-950 font-black text-white">
                  {staff.name.charAt(0)}
                </div>
                <div>
                  <p className="font-black">{staff.name}</p>
                  <p className="text-xs text-neutral-500">
                    Phụ trách hội thoại
                  </p>
                </div>
              </div>
              <p className="mt-5 text-3xl font-black">
                {
                  conversations.filter((item) =>
                    staff.id ? item.assigneeId === staff.id : !item.assigneeId,
                  ).length
                }
              </p>
            </div>
          ))}
        </div>
      </WorkspaceShell>
    );
  }

  if (workspace === "quickReplies") {
    const normalizedQuickReplySearch = quickReplySearch.trim().toLowerCase();
    const visibleQuickReplyTemplates = normalizedQuickReplySearch
      ? quickReplyTemplates.filter((template) =>
          [template.title, template.content, template.category].some((value) =>
            String(value || "")
              .toLowerCase()
              .includes(normalizedQuickReplySearch),
          ),
        )
      : quickReplyTemplates;

    return (
      <WorkspaceShell
        title={title}
        description="Tạo và quản lý mã gõ tắt dùng chung trong ô chat."
      >
        <div className="rounded-3xl border border-neutral-200 bg-white p-5">
          {canCreateQuickReplies || canImportQuickReplies || canDeleteAllQuickReplies ? (
            <>
              {canCreateQuickReplies ? (
              <div className="grid gap-2 lg:grid-cols-[220px_minmax(0,1fr)_110px]">
                <input
                  value={newQuickReplyShortcut}
                  onChange={(e) =>
                    onNewQuickReplyShortcutChange(e.target.value)
                  }
                  placeholder="Từ viết tắt, ví dụ qddh"
                  className="h-12 rounded-xl border border-neutral-200 px-4 text-sm font-black outline-none"
                />
                <textarea
                  value={newQuickReply}
                  onChange={(e) => onNewQuickReplyChange(e.target.value)}
                  placeholder="Nội dung đầy đủ..."
                  className="min-h-12 resize-y rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none"
                />
                <button
                  type="button"
                  onClick={onCreateQuickReply}
                  className="h-12 rounded-xl bg-neutral-950 px-4 text-sm font-black text-white"
                >
                  Thêm mẫu
                </button>
              </div>
              ) : null}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {canImportQuickReplies ? (
                <label
                  className={cx(
                    "cursor-pointer rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white",
                    importingQuickReplies && "pointer-events-none opacity-60",
                  )}
                >
                  {importingQuickReplies ? "Đang nhập..." : "Upload Excel"}
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    disabled={importingQuickReplies}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      onImportQuickReplyExcel(file);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
                ) : null}
                {canImportQuickReplies ? (
                <button
                  type="button"
                  onClick={onDownloadQuickReplyTemplate}
                  className="rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-black"
                >
                  Tải file mẫu
                </button>
                ) : null}
                {canDeleteAllQuickReplies ? (
                <button
                  type="button"
                  disabled={
                    !quickReplyTemplates.length || deletingAllQuickReplies
                  }
                  onClick={onDeleteAllQuickReplies}
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-black text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {deletingAllQuickReplies
                    ? "Đang xóa..."
                    : `Xóa toàn bộ (${quickReplyTemplates.length})`}
                </button>
                ) : null}
                <p className="text-xs text-neutral-500">
                  Excel gồm 4 cột: <b>Từ viết tắt</b>, <b>Nội dung</b>, <b>Ảnh đính kèm</b> và <b>Ngày cập nhật</b>. Mã đã có sẽ được cập nhật thay vì tạo trùng.
                </p>
              </div>

              {quickReplyImportResult ? (
                <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
                  {quickReplyImportResult}
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-neutral-500">
              Nhân viên được dùng mẫu; chỉ Admin/Owner được thêm, sửa và xóa.
            </p>
          )}
        </div>

        <div className="mt-4 overflow-hidden rounded-3xl border border-neutral-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 px-4 py-3">
            <div>
              <p className="font-black">Danh sách mẫu trả lời</p>
              <p className="text-xs text-neutral-500">
                Hiển thị {visibleQuickReplyTemplates.length}/
                {quickReplyTemplates.length} mẫu
              </p>
            </div>
            <input
              value={quickReplySearch}
              onChange={(event) =>
                onQuickReplySearchChange(event.target.value)
              }
              placeholder="Tìm mã hoặc nội dung..."
              className="h-10 w-full rounded-xl border border-neutral-200 px-4 text-sm outline-none sm:w-80"
            />
          </div>

          <div className="max-h-[620px] overflow-auto">
            <table className="w-full min-w-[1180px] table-fixed text-left text-sm">
              <thead className="sticky top-0 z-10 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-400">
                <tr>
                  <th className="w-14 px-4 py-3 text-center">STT</th>
                  <th className="w-40 px-3 py-3">Từ viết tắt</th>
                  <th className="px-3 py-3">Nội dung</th>
                  <th className="w-72 px-3 py-3">Ảnh đính kèm</th>
                  <th className="w-36 px-3 py-3">Ngày cập nhật</th>
                  <th className="w-36 px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {visibleQuickReplyTemplates.map((template, index) => (
                  <tr
                    key={template.id}
                    className="border-t border-neutral-100 align-top hover:bg-neutral-50"
                  >
                    <td className="px-4 py-3 text-center text-xs font-bold text-neutral-400">
                      {index + 1}
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-flex max-w-full rounded-lg bg-neutral-950 px-2.5 py-1 text-xs font-black text-white">
                        <span className="truncate">
                          {template.title || "—"}
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <p
                        className="line-clamp-2 whitespace-pre-wrap font-semibold leading-5 text-neutral-800"
                        title={template.content}
                      >
                        {template.content}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      {parseQuickReplyImportMeta(template.category).imageUrls.length ? (
                        <div className="space-y-1">
                          {parseQuickReplyImportMeta(template.category).imageUrls
                            .slice(0, 2)
                            .map((url) => (
                              <a
                                key={url}
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="block truncate text-xs font-semibold text-blue-600 hover:underline"
                                title={url}
                              >
                                {url}
                              </a>
                            ))}
                          {parseQuickReplyImportMeta(template.category).imageUrls.length > 2 ? (
                            <p className="text-xs font-bold text-neutral-400">
                              +{parseQuickReplyImportMeta(template.category).imageUrls.length - 2} ảnh
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-neutral-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs font-semibold text-neutral-600">
                      {formatQuickReplyImportDate(
                        parseQuickReplyImportMeta(template.category).sourceUpdatedAt ||
                          (template as any).updatedAt,
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {canEditQuickReplies || canDeleteQuickReplies ? (
                        <div className="flex justify-end gap-2">
                          {canEditQuickReplies ? (
                          <button
                            type="button"
                            onClick={() => onEditQuickReply(template)}
                            className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-black hover:bg-neutral-100"
                          >
                            Sửa
                          </button>
                          ) : null}
                          {canDeleteQuickReplies ? (
                          <button
                            type="button"
                            onClick={() => onDeleteQuickReply(template)}
                            className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-black text-red-700 hover:bg-red-100"
                          >
                            Xóa
                          </button>
                          ) : null}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {!visibleQuickReplyTemplates.length ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-5 py-12 text-center text-neutral-400"
                    >
                      {quickReplySearch
                        ? "Không tìm thấy mẫu phù hợp."
                        : "Chưa có mẫu trả lời nhanh."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </WorkspaceShell>
    );
  }

  if (workspace === "reports") {
    const reportRows = assignmentReport?.rows || [];
    return (
      <WorkspaceShell
        title={title}
        description="Theo dõi số hội thoại được chia, tỷ lệ mục tiêu theo trọng số và tỷ lệ thực tế của từng nhân viên."
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex rounded-2xl border border-neutral-200 bg-white p-1">
            {([1, 7, 30] as const).map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => onLoadAssignmentReport(days)}
                className={cx(
                  "rounded-xl px-4 py-2 text-sm font-black",
                  assignmentReportDays === days
                    ? "bg-neutral-950 text-white"
                    : "text-neutral-500 hover:bg-neutral-100",
                )}
              >
                {days === 1 ? "Hôm nay" : `${days} ngày`}
              </button>
            ))}
          </div>
          <p className="text-sm font-semibold text-neutral-500">
            {assignmentReportLoading
              ? "Đang tải báo cáo..."
              : assignmentReport
                ? `${formatDateTime(assignmentReport.from)} – ${formatDateTime(assignmentReport.to)}`
                : "Chưa có dữ liệu"}
          </p>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Tổng lượt phân công" value={assignmentReport?.totalAssigned || 0} />
          <StatCard label="Tự động" value={assignmentReport?.totalAutoAssigned || 0} />
          <StatCard label="Gán thủ công" value={assignmentReport?.totalManualAssigned || 0} />
          <StatCard label="Phân công lại" value={assignmentReport?.totalReassigned || 0} />
        </div>

        <section className="mt-5 overflow-hidden rounded-3xl border border-neutral-200 bg-white">
          <div className="border-b border-neutral-200 p-5">
            <h4 className="text-lg font-black">Phân bổ theo nhân viên</h4>
            <p className="mt-1 text-sm text-neutral-500">
              Tỷ lệ mục tiêu được tính từ trọng số. Ví dụ A=1, B=2, C=3 tương ứng khoảng 16,7% · 33,3% · 50%.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[1050px] w-full text-left text-sm">
              <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-400">
                <tr>
                  <th className="px-5 py-4">Nhân viên</th>
                  <th className="px-4 py-4 text-right">Trọng số</th>
                  <th className="px-4 py-4 text-right">Mục tiêu</th>
                  <th className="px-4 py-4 text-right">Đã chia</th>
                  <th className="px-4 py-4 text-right">Thực tế</th>
                  <th className="px-4 py-4 text-right">Chênh lệch</th>
                  <th className="px-4 py-4 text-right">Tự động</th>
                  <th className="px-4 py-4 text-right">Gán tay</th>
                  <th className="px-5 py-4 text-right">Gán lại</th>
                </tr>
              </thead>
              <tbody>
                {reportRows.map((row) => (
                  <tr key={row.staffId} className="border-t border-neutral-100">
                    <td className="px-5 py-4">
                      <p className="font-black">{row.staffName}</p>
                      <p className="mt-0.5 text-xs text-neutral-400">
                        {row.branchName || "Chưa gán chi nhánh"}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-right font-black">{row.weight}</td>
                    <td className="px-4 py-4 text-right font-bold">
                      {row.targetPercent.toFixed(1)}%
                    </td>
                    <td className="px-4 py-4 text-right text-base font-black">
                      {row.assignedCount}
                    </td>
                    <td className="px-4 py-4 text-right font-bold">
                      {row.actualPercent.toFixed(1)}%
                    </td>
                    <td
                      className={cx(
                        "px-4 py-4 text-right font-black",
                        Math.abs(row.differencePercent) < 1
                          ? "text-emerald-600"
                          : row.differencePercent > 0
                            ? "text-amber-600"
                            : "text-blue-600",
                      )}
                    >
                      {row.differencePercent > 0 ? "+" : ""}
                      {row.differencePercent.toFixed(1)}%
                    </td>
                    <td className="px-4 py-4 text-right">{row.autoAssignedCount}</td>
                    <td className="px-4 py-4 text-right">{row.manualAssignedCount}</td>
                    <td className="px-5 py-4 text-right">{row.reassignedCount}</td>
                  </tr>
                ))}
                {!reportRows.length ? (
                  <tr>
                    <td colSpan={9} className="px-5 py-12 text-center text-neutral-400">
                      Chưa có lượt phân công trong khoảng thời gian này.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <div className="mt-5 rounded-3xl border border-neutral-200 bg-white p-6">
          <p className="font-black">Kênh đang kết nối</p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <ChannelHealth
              label="Facebook Messenger"
              value={
                conversations.filter((item) => item.channel === "FACEBOOK")
                  .length
              }
              active
            />
            <ChannelHealth
              label="Instagram Direct"
              value={
                conversations.filter((item) => item.channel === "INSTAGRAM")
                  .length
              }
            />
            <ChannelHealth
              label="Bình luận/Livestream"
              value={conversations.filter(isFacebookCommentConversation).length}
            />
          </div>
        </div>
      </WorkspaceShell>
    );
  }

  if (workspace === "assignmentSettings") {
    if (!assignmentSettings) {
      return <WorkspaceShell title={title} description="Đang tải cấu hình phân công..."><div className="rounded-3xl border border-neutral-200 bg-white p-6 text-sm text-neutral-500">Đang tải...</div></WorkspaceShell>;
    }

    const priorities = assignmentSettings.priorityOrder || ["ONLINE", "BRANCH", "LOWEST_LOAD", "DRAFT_OWNER"];
    const labels: Record<string, string> = { ONLINE: "Nhân viên trực tuyến", BRANCH: "Đúng chi nhánh", LOWEST_LOAD: "Tải thấp nhất", DRAFT_OWNER: "Người phụ trách đơn nháp" };
    const descriptions: Record<string, string> = {
      ONLINE: "Loại nhân viên offline, tạm vắng hoặc không còn heartbeat hợp lệ trước khi xét các điều kiện khác.",
      BRANCH: "Ưu tiên nhân viên cùng chi nhánh với hội thoại hoặc đơn nháp.",
      LOWEST_LOAD: "Chọn người đang có ít hội thoại cần xử lý nhất để cân bằng tải.",
      DRAFT_OWNER: "Giữ người đã tạo hoặc đang phụ trách đơn nháp của khách nếu vẫn đủ điều kiện nhận tin.",
    };
    const enabledFor = (key: string) => key === "ONLINE" ? assignmentSettings.requireOnline : key === "BRANCH" ? assignmentSettings.branchPriorityEnabled : key === "LOWEST_LOAD" ? assignmentSettings.lowestLoadEnabled : assignmentSettings.draftOwnerPriorityEnabled;
    const toggleFor = (key: string, checked: boolean) => {
      const next: any = { ...assignmentSettings };
      if (key === "ONLINE") next.requireOnline = checked;
      if (key === "BRANCH") next.branchPriorityEnabled = checked;
      if (key === "LOWEST_LOAD") next.lowestLoadEnabled = checked;
      if (key === "DRAFT_OWNER") next.draftOwnerPriorityEnabled = checked;
      onAssignmentChange(next);
    };
    const movePriority = (index: number, delta: number) => {
      const target = index + delta;
      if (target < 0 || target >= priorities.length) return;
      const nextOrder = [...priorities];
      [nextOrder[index], nextOrder[target]] = [nextOrder[target], nextOrder[index]];
      canManageAssignmentSettings && onAssignmentChange({ ...assignmentSettings, priorityOrder: nextOrder });
    };
    const updateMember = (staff: AssigneeOption, checked: boolean) => {
      const current = assignmentSettings.members || [];
      const existed = current.find((item) => item.staffId === staff.id);
      const nextMembers = checked
        ? existed ? current.map((item) => item.staffId === staff.id ? { ...item, isActive: true } : item) : [...current, { staffId: staff.id, staffName: staff.name, isActive: true, receiveMessages: true, receiveComments: false, sortOrder: current.length, weight: 1 } as any]
        : current.filter((item) => item.staffId !== staff.id);
      canManageAssignmentSettings && onAssignmentChange({ ...assignmentSettings, members: nextMembers });
    };
    const dirty = JSON.stringify(assignmentSettings) !== JSON.stringify(savedAssignmentSettings);
    const onlineMembers = (assignmentSettings.members || []).filter((m) => m.isActive && m.receiveMessages && (!assignmentSettings.requireOnline || m.isOnline));
    const simulated = onlineMembers.slice().sort((a, b) => {
      if (assignmentSettings.branchPriorityEnabled) {
        const aBranch = a.branchId && a.branchId === activeBranchId ? 0 : 1;
        const bBranch = b.branchId && b.branchId === activeBranchId ? 0 : 1;
        if (aBranch !== bBranch) return aBranch - bBranch;
      }
      return (a.sortOrder || 0) - (b.sortOrder || 0);
    })[0];
    const saveLabel = savingAssignment ? "Đang lưu..." : assignmentSaveState === "error" ? "Lưu thất bại" : dirty ? "Lưu thay đổi" : "Đã lưu";
    const assignmentModeInfo = {
      OFF: {
        label: "Tắt phân công",
        summary: "Hệ thống không tự gán hội thoại. Toàn bộ cấu hình phân chia bên dưới tạm ngừng áp dụng.",
        detail: "Không dùng cấu hình bên dưới",
      },
      SELF_ASSIGN: {
        label: "Nhân viên tự nhận",
        summary: "Nhân viên chủ động nhận hội thoại. Hệ thống không tự chọn người theo trọng số, tải hoặc rule.",
        detail: "Không chạy chia tự động",
      },
      GROUP: {
        label: "Theo nhóm",
        summary: "Hệ thống chia trong nhóm nhân viên đã chọn, có áp dụng online, giới hạn tải, thời gian và trọng số.",
        detail: "Dùng cấu hình cơ bản + tỷ lệ",
      },
      AUTO: {
        label: "Tự động thông minh",
        summary: "Hệ thống áp dụng toàn bộ cấu hình: online, chi nhánh, tải, trọng số, lịch sử, SLA và phân công lại.",
        detail: "Dùng toàn bộ cấu hình bên dưới",
      },
    }[assignmentSettings.mode || "AUTO"];
    const assignmentDetailsDisabled =
      assignmentSettings.mode === "OFF" ||
      assignmentSettings.mode === "SELF_ASSIGN";

    return (
      <WorkspaceShell title={title} description="Cấu hình cách hệ thống tự động chia hội thoại, giới hạn tải, phạm vi xem và quy tắc ưu tiên nhân viên.">
        <div className="sticky top-3 z-20 rounded-3xl border border-neutral-200 bg-white/95 p-4 shadow-sm backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className={cx("text-sm font-black", dirty ? "text-amber-600" : assignmentSaveState === "error" ? "text-red-600" : "text-emerald-600")}>{dirty ? "Có thay đổi chưa lưu" : assignmentSaveState === "error" ? "Lưu thất bại" : "Cấu hình đã được lưu"}</p>
              <p className="mt-1 text-xs text-neutral-500">{assignmentSavedAt ? `Đã lưu lúc ${formatDateTime(assignmentSavedAt)}` : "Thay đổi chỉ có hiệu lực sau khi bấm Lưu."}</p>
            </div>
            <div className="flex gap-2">
              <button disabled={!dirty || savingAssignment || !savedAssignmentSettings} onClick={() => savedAssignmentSettings && onAssignmentChange(JSON.parse(JSON.stringify(savedAssignmentSettings)))} className="rounded-2xl border border-neutral-200 px-4 py-2.5 text-sm font-black disabled:opacity-40">Khôi phục</button>
              <button disabled={!canManageAssignmentSettings || !dirty || savingAssignment} onClick={canManageAssignmentSettings ? onSaveAssignment : undefined} className={cx("rounded-2xl px-5 py-2.5 text-sm font-black text-white disabled:opacity-50", assignmentSaveState === "error" ? "bg-red-600" : "bg-blue-600")}>{saveLabel}</button>
            </div>
          </div>
        </div>

        <section className="mt-4 rounded-3xl border border-neutral-200 bg-white p-5">
          <p className="text-xs font-black uppercase tracking-widest text-neutral-400">Cài đặt tổng quát</p>
          <h4 className="mt-2 text-xl font-black">Chế độ phân công</h4>
          <p className="mt-1 text-sm text-neutral-500">
            Mỗi chế độ dùng một phạm vi cấu hình khác nhau. Phần bên dưới sẽ tự khóa hoặc mở theo chế độ đang chọn.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            {[
              ["OFF", "Tắt phân công", "Không tự gán hội thoại.", "Không dùng cấu hình"],
              ["SELF_ASSIGN", "Nhân viên tự nhận", "Nhân viên tự bấm nhận; không chia theo tỷ lệ hoặc rule.", "Không chạy tự động"],
              ["GROUP", "Theo nhóm", "Tự chia trong nhóm theo online, tải và trọng số.", "Dùng cấu hình cơ bản"],
              ["AUTO", "Tự động thông minh", "Áp dụng chi nhánh, tải, trọng số, lịch sử và SLA.", "Dùng toàn bộ cấu hình"],
            ].map(([value, label, desc, badge]) => (
              <button
                key={value}
                type="button"
                onClick={() =>
                  canManageAssignmentSettings && onAssignmentChange({
                    ...assignmentSettings,
                    mode: value as any,
                    isActive: value !== "OFF",
                  })
                }
                className={cx(
                  "relative rounded-2xl border p-4 text-left transition",
                  assignmentSettings.mode === value
                    ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100"
                    : "border-neutral-200 hover:border-neutral-300",
                )}
              >
                {assignmentSettings.mode === value ? (
                  <span className="absolute right-3 top-3 rounded-full bg-blue-600 px-2 py-1 text-[10px] font-black uppercase text-white">
                    Đang dùng
                  </span>
                ) : null}
                <p className="pr-20 text-sm font-black">{label}</p>
                <p className="mt-1 text-xs leading-5 text-neutral-500">{desc}</p>
                <p className="mt-3 text-[11px] font-black text-blue-700">{badge}</p>
              </button>
            ))}
          </div>

          <div
            className={cx(
              "mt-4 rounded-2xl border p-4",
              assignmentSettings.mode === "AUTO"
                ? "border-emerald-200 bg-emerald-50"
                : assignmentSettings.mode === "GROUP"
                  ? "border-blue-200 bg-blue-50"
                  : assignmentSettings.mode === "SELF_ASSIGN"
                    ? "border-amber-200 bg-amber-50"
                    : "border-neutral-200 bg-neutral-50",
            )}
          >
            <p className="text-xs font-black uppercase tracking-widest text-neutral-500">
              Chế độ đang áp dụng
            </p>
            <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-lg font-black">{assignmentModeInfo.label}</p>
                <p className="mt-1 max-w-4xl text-sm leading-6 text-neutral-600">
                  {assignmentModeInfo.summary}
                </p>
              </div>
              <span className="rounded-full border border-neutral-200 bg-white px-3 py-2 text-xs font-black">
                {assignmentModeInfo.detail}
              </span>
            </div>
          </div>
        </section>

        <div
          className={cx(
            "relative mt-4",
            assignmentDetailsDisabled && "select-none opacity-50",
          )}
        >
          {assignmentDetailsDisabled ? (
            <div className="absolute inset-0 z-20 flex items-start justify-center rounded-3xl bg-white/35 pt-6 backdrop-blur-[1px]">
              <div className="rounded-2xl border border-neutral-200 bg-white px-5 py-3 text-center shadow-sm">
                <p className="font-black">{assignmentModeInfo.label}</p>
                <p className="mt-1 text-sm text-neutral-500">
                  Cấu hình tự động bên dưới không được áp dụng ở chế độ này.
                </p>
              </div>
            </div>
          ) : null}
        <section className="rounded-3xl border border-neutral-200 bg-white p-5">
          <p className="text-xs font-black uppercase tracking-widest text-neutral-400">Cấu hình chi tiết</p>
          <h4 className="mt-2 text-xl font-black">Cách thức chia hội thoại</h4>
          <p className="mt-1 text-sm text-neutral-500">Các mô tả bên dưới giải thích chính xác hệ thống sẽ làm gì khi bật từng tùy chọn.</p>
          <div className="mt-5 divide-y divide-neutral-100">
            <DetailedSettingRow title="Cách thức chia hội thoại" description="Chỉ phân công khi nhân viên đủ điều kiện nhận tin. Nếu không còn nhân viên phù hợp, hệ thống xử lý theo quy tắc dự phòng." control={<select value={assignmentSettings.requireOnline ? "ONLINE" : "ALL"} onChange={(e)=>canManageAssignmentSettings && onAssignmentChange({...assignmentSettings,requireOnline:e.target.value === "ONLINE"})} className="rounded-xl border border-neutral-200 px-3 py-2 text-sm font-bold"><option value="ONLINE">Chỉ trực tuyến</option><option value="ALL">Tất cả nhân viên</option></select>} />
            <DetailedSettingRow title="Giữ người phụ trách cũ" description="Khách quay lại trong thời gian cấu hình sẽ được ưu tiên giao cho nhân viên từng chăm sóc, nếu người đó còn đủ điều kiện." control={<Toggle checked={assignmentSettings.keepPreviousAssignee} onChange={(checked)=>canManageAssignmentSettings && onAssignmentChange({...assignmentSettings,keepPreviousAssignee:checked})}/>} extra={<div className="mt-3 flex items-center gap-2 text-sm"><span>Giữ trong</span><input type="number" min={1} value={assignmentSettings.keepPreviousDays} onChange={(e)=>canManageAssignmentSettings && onAssignmentChange({...assignmentSettings,keepPreviousDays:Number(e.target.value||1)})} className="w-20 rounded-xl border px-3 py-2"/><span>ngày</span></div>} />
            <DetailedSettingRow title="Xáo trộn danh sách nhân viên" description="Khi bắt đầu vòng chia mới, hệ thống xáo trộn danh sách để tránh nhân viên đầu danh sách luôn được ưu tiên." control={<Toggle checked={assignmentSettings.shuffleEachRound} onChange={(checked)=>canManageAssignmentSettings && onAssignmentChange({...assignmentSettings,shuffleEachRound:checked})}/>} />
            <DetailedSettingRow title="Số lượng tài khoản chính mỗi hội thoại" description="Hiện tại hệ thống giữ một người phụ trách chính cho mỗi hội thoại. Người khác có thể phối hợp qua phân công lại hoặc quy tắc quá hạn." control={<div className="rounded-xl border border-neutral-200 px-4 py-2 text-sm font-black">1 tài khoản</div>} />
            <DetailedSettingRow title="Phân công thêm khi chưa đọc" description="Nếu hội thoại chưa được đọc sau khoảng thời gian này, hệ thống chia lại cho một nhân viên đủ điều kiện khác." control={<Toggle checked={assignmentSettings.reassignUnreadEnabled} onChange={(checked)=>canManageAssignmentSettings && onAssignmentChange({...assignmentSettings,reassignUnreadEnabled:checked})}/>} extra={<div className="mt-3 flex items-center gap-2 text-sm"><span>Sau</span><input type="number" min={1} value={assignmentSettings.reassignAfterMinutes} onChange={(e)=>canManageAssignmentSettings && onAssignmentChange({...assignmentSettings,reassignAfterMinutes:Number(e.target.value||1)})} className="w-24 rounded-xl border px-3 py-2"/><span>phút</span></div>} />
            <DetailedSettingRow
              title="Chia hàng chờ đầu ca"
              description="Tin nhắn đến ngoài giờ được giữ chưa gán. Khi có nhân viên online trong giờ làm việc, hệ thống chia lô đầu; sau đó chia tiếp theo từng đợt. Nếu có thêm người online, hệ thống chạy ngay một đợt nhỏ và ưu tiên người có tải hôm nay thấp hơn."
              control={
                <Toggle
                  checked={(assignmentSettings as any).morningQueueEnabled !== false}
                  onChange={(checked)=>canManageAssignmentSettings && onAssignmentChange({...(assignmentSettings as any),morningQueueEnabled:checked} as any)}
                />
              }
              extra={
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <label className="space-y-1 text-sm">
                    <span className="font-bold text-neutral-700">Lô đầu tiên</span>
                    <div className="flex items-center gap-2">
                      <input type="number" min={1} value={(assignmentSettings as any).morningQueueInitialBatchSize ?? 20} onChange={(e)=>canManageAssignmentSettings && onAssignmentChange({...(assignmentSettings as any),morningQueueInitialBatchSize:Math.max(1,Number(e.target.value||20))} as any)} className="w-24 rounded-xl border px-3 py-2"/>
                      <span>tin</span>
                    </div>
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="font-bold text-neutral-700">Chu kỳ chia tiếp</span>
                    <div className="flex items-center gap-2">
                      <input type="number" min={1} value={(assignmentSettings as any).morningQueueRepeatIntervalMinutes ?? 2} onChange={(e)=>canManageAssignmentSettings && onAssignmentChange({...(assignmentSettings as any),morningQueueRepeatIntervalMinutes:Math.max(1,Number(e.target.value||2))} as any)} className="w-24 rounded-xl border px-3 py-2"/>
                      <span>phút</span>
                    </div>
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="font-bold text-neutral-700">Mỗi đợt tiếp theo</span>
                    <div className="flex items-center gap-2">
                      <input type="number" min={1} value={(assignmentSettings as any).morningQueueRepeatBatchSize ?? 3} onChange={(e)=>canManageAssignmentSettings && onAssignmentChange({...(assignmentSettings as any),morningQueueRepeatBatchSize:Math.max(1,Number(e.target.value||3))} as any)} className="w-24 rounded-xl border px-3 py-2"/>
                      <span>tin</span>
                    </div>
                  </label>
                  <div className="md:col-span-3 rounded-2xl border border-blue-100 bg-blue-50 p-3 text-xs leading-5 text-blue-800">
                    <b>Mặc định:</b> người/nhóm online đầu tiên nhận tổng cộng tối đa 20 tin cũ nhất. Nếu chưa có thêm người online, cứ 2 phút chia tiếp 3 tin. Khi có người mới online, đợt nhỏ chạy ngay và người mới được ưu tiên vì tải hôm nay thấp hơn. Tin đã đọc hoặc đã xử lý không bị thu hồi.
                  </div>
                </div>
              }
            />
            <DetailedSettingRow title="Chia lại nếu người phụ trách offline" description="Khi nhân viên đang phụ trách mất trạng thái trực tuyến, hội thoại chưa xử lý có thể được đưa sang người khác." control={<Toggle checked={assignmentSettings.reassignIfAssigneeOffline} onChange={(checked)=>canManageAssignmentSettings && onAssignmentChange({...assignmentSettings,reassignIfAssigneeOffline:checked})}/>} />
            <DetailedSettingRow title="Giới hạn hội thoại đang xử lý" description="Ngừng chia thêm khi nhân viên đạt số hội thoại đang xử lý tối đa." control={<Toggle checked={assignmentSettings.maxActiveEnabled} onChange={(checked)=>canManageAssignmentSettings && onAssignmentChange({...assignmentSettings,maxActiveEnabled:checked})}/>} extra={<input type="number" min={1} value={assignmentSettings.maxActiveConversations} onChange={(e)=>canManageAssignmentSettings && onAssignmentChange({...assignmentSettings,maxActiveConversations:Number(e.target.value||1)})} className="mt-3 w-28 rounded-xl border px-3 py-2"/>} />
            <DetailedSettingRow title="Giới hạn hội thoại chưa đọc" description="Ngừng chia thêm khi nhân viên đã có quá nhiều hội thoại chưa đọc." control={<Toggle checked={assignmentSettings.maxUnreadEnabled} onChange={(checked)=>canManageAssignmentSettings && onAssignmentChange({...assignmentSettings,maxUnreadEnabled:checked})}/>} extra={<input type="number" min={1} value={assignmentSettings.maxUnreadConversations} onChange={(e)=>canManageAssignmentSettings && onAssignmentChange({...assignmentSettings,maxUnreadConversations:Number(e.target.value||1)})} className="mt-3 w-28 rounded-xl border px-3 py-2"/>} />
            <DetailedSettingRow title="Thời gian phân công hội thoại" description="Trong giờ làm việc hệ thống chia theo ca. Ngoài giờ sẽ áp dụng chế độ dự phòng được chọn." control={<select value={assignmentSettings.workingHoursOnly ? "WORK" : "FULL"} onChange={(e)=>canManageAssignmentSettings && onAssignmentChange({...assignmentSettings,workingHoursOnly:e.target.value === "WORK"})} className="rounded-xl border px-3 py-2 text-sm font-bold"><option value="WORK">Trong giờ làm việc</option><option value="FULL">Toàn thời gian</option></select>} extra={<div className="mt-3 grid max-w-md grid-cols-2 gap-2"><input type="time" value={`${String(Math.floor((assignmentSettings.workStartMinute||480)/60)).padStart(2,"0")}:${String((assignmentSettings.workStartMinute||480)%60).padStart(2,"0")}`} onChange={(e)=>{const [h,m]=e.target.value.split(":").map(Number);canManageAssignmentSettings && onAssignmentChange({...assignmentSettings,workStartMinute:h*60+m})}} className="rounded-xl border px-3 py-2"/><input type="time" value={`${String(Math.floor((assignmentSettings.workEndMinute||1320)/60)).padStart(2,"0")}:${String((assignmentSettings.workEndMinute||1320)%60).padStart(2,"0")}`} onChange={(e)=>{const [h,m]=e.target.value.split(":").map(Number);canManageAssignmentSettings && onAssignmentChange({...assignmentSettings,workEndMinute:h*60+m})}} className="rounded-xl border px-3 py-2"/></div>} />
            <DetailedSettingRow title="Quyền xem hội thoại" description="Nhân viên chỉ nhìn thấy hội thoại theo phạm vi được cấp. Quản lý có thể xem thêm hội thoại thuộc chi nhánh." control={<select value={assignmentSettings.onlyAssignedCanView ? "SELF" : assignmentSettings.managerCanViewBranch ? "BRANCH" : "PAGE"} onChange={(e)=>canManageAssignmentSettings && onAssignmentChange({...assignmentSettings,onlyAssignedCanView:e.target.value === "SELF",managerCanViewBranch:e.target.value === "BRANCH"})} className="rounded-xl border px-3 py-2 text-sm font-bold"><option value="SELF">Được chia cho mình</option><option value="BRANCH">Theo chi nhánh</option><option value="PAGE">Toàn Page</option></select>} extra={<label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={assignmentSettings.onlyAssignedCanReply} onChange={(e)=>canManageAssignmentSettings && onAssignmentChange({...assignmentSettings,onlyAssignedCanReply:e.target.checked})}/> Chỉ người phụ trách được trả lời</label>} />
          </div>
        </section>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-3xl border border-neutral-200 bg-white p-5">
            <h4 className="text-lg font-black">Quy tắc phân chia</h4>
            <p className="mt-1 text-sm text-neutral-500">Thứ tự càng cao được xét càng sớm. Tắt một quy tắc sẽ bỏ qua điều kiện đó nhưng vẫn giữ nguyên vị trí.</p>
            <div className="mt-4 space-y-3">{priorities.map((key,index)=><div key={key} className="flex items-center gap-3 rounded-2xl border border-neutral-200 p-4"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-sm font-black text-white">{index+1}</div><div className="min-w-0 flex-1"><p className="font-black">{labels[key]}</p><p className="mt-1 text-xs leading-5 text-neutral-500">{descriptions[key]}</p></div><button onClick={()=>movePriority(index,-1)} disabled={index===0} className="rounded-lg border px-2 py-1 disabled:opacity-30">↑</button><button onClick={()=>movePriority(index,1)} disabled={index===priorities.length-1} className="rounded-lg border px-2 py-1 disabled:opacity-30">↓</button><Toggle checked={enabledFor(key)} onChange={(checked)=>toggleFor(key,checked)}/></div>)}</div>
            {assignmentSettings.branchPriorityEnabled && assignmentSettings.draftOwnerPriorityEnabled ? <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"><b>Kiểm tra xung đột:</b> Đúng chi nhánh và người phụ trách đơn nháp có thể cùng áp dụng. Hệ thống ưu tiên quy tắc đứng cao hơn trong danh sách.</div> : null}
          </section>
          <section className="rounded-3xl border border-neutral-200 bg-white p-5">
            <h4 className="text-lg font-black">Mô phỏng thời gian thực</h4>
            <p className="mt-1 text-sm text-neutral-500">Kết quả cập nhật ngay khi thay đổi cấu hình, chưa cần bấm Lưu.</p>
            <div className="mt-5 rounded-3xl bg-neutral-950 p-5 text-white"><p className="text-xs font-bold uppercase tracking-widest text-neutral-400">Khách mới Facebook</p><div className="my-4 h-px bg-white/10"/><p className="text-sm text-neutral-400">Nhân viên sẽ nhận</p><p className="mt-1 text-2xl font-black">{simulated?.staffName || "Chưa có ứng viên phù hợp"}</p>{simulated?.branchName ? <p className="mt-1 text-sm text-neutral-400">Chi nhánh {simulated.branchName}</p> : null}<div className="mt-5 space-y-2 text-sm">{assignmentSettings.requireOnline && <p>✓ Có heartbeat và đang online</p>}{assignmentSettings.branchPriorityEnabled && <p>✓ Ưu tiên đúng chi nhánh</p>}{assignmentSettings.lowestLoadEnabled && <p>✓ Ưu tiên tải thấp</p>}{assignmentSettings.draftOwnerPriorityEnabled && <p>✓ Giữ người phụ trách đơn nháp</p>}</div></div>
          </section>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-3xl border border-neutral-200 bg-white p-5"><h4 className="text-lg font-black">Nhân viên tham gia và tỷ lệ chia</h4><p className="mt-1 text-sm text-neutral-500">Nhập trọng số cho từng người. Ví dụ A=1, B=2, C=3 thì mục tiêu phân bổ là 1:2:3. Hệ thống vẫn loại nhân viên offline hoặc vượt tải trước khi tính tỷ lệ.</p><div className="mt-4 max-h-[520px] space-y-2 overflow-y-auto">{staffOptions.filter(s=>s.id).map(staff=>{const member=assignmentSettings.members?.find(m=>m.staffId===staff.id);return <div key={staff.id} className="flex items-center gap-3 rounded-2xl border border-neutral-200 p-3"><input type="checkbox" checked={Boolean(member)} onChange={(e)=>updateMember(staff,e.target.checked)}/><div className="min-w-0 flex-1"><p className="truncate font-bold">{staff.name}</p><p className={cx("text-xs font-bold",member?.isOnline?"text-emerald-600":"text-neutral-400")}>{member?.isOnline?"● Đang online":"○ Offline / chưa mở Inbox"}</p></div>{member ? (
                  <div className="flex flex-wrap items-center justify-end gap-3 text-xs">
                    <label className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={member.receiveMessages}
                        onChange={(e) =>
                          canManageAssignmentSettings && onAssignmentChange({
                            ...assignmentSettings,
                            members: assignmentSettings.members.map((m) =>
                              m.staffId === staff.id
                                ? { ...m, receiveMessages: e.target.checked }
                                : m,
                            ),
                          })
                        }
                      />
                      Tin nhắn
                    </label>
                    <label className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={member.receiveComments}
                        onChange={(e) =>
                          canManageAssignmentSettings && onAssignmentChange({
                            ...assignmentSettings,
                            members: assignmentSettings.members.map((m) =>
                              m.staffId === staff.id
                                ? { ...m, receiveComments: e.target.checked }
                                : m,
                            ),
                          })
                        }
                      />
                      Bình luận
                    </label>
                    <label className="flex items-center gap-2 rounded-xl bg-neutral-100 px-2.5 py-1.5 font-black">
                      Tỷ lệ
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={Math.max(1, Number(member.weight || 1))}
                        onChange={(e) =>
                          canManageAssignmentSettings && onAssignmentChange({
                            ...assignmentSettings,
                            members: assignmentSettings.members.map((m) =>
                              m.staffId === staff.id
                                ? {
                                    ...m,
                                    weight: Math.max(
                                      1,
                                      Math.min(100, Number(e.target.value || 1)),
                                    ),
                                  }
                                : m,
                            ),
                          })
                        }
                        className="w-14 rounded-lg border border-neutral-200 bg-white px-2 py-1 text-center font-black"
                      />
                    </label>
                  </div>
                ) : null}</div>})}</div></section>
          <section className="rounded-3xl border border-neutral-200 bg-white p-5"><h4 className="text-lg font-black">Nhật ký thay đổi và phân công</h4><p className="mt-1 text-sm text-neutral-500">Theo dõi người được gán, lý do và thời gian hệ thống thực hiện.</p><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-xs uppercase text-neutral-400"><th className="py-3">Thời gian</th><th>Khách</th><th>Nhân viên</th><th>Lý do</th></tr></thead><tbody>{assignmentHistory.slice(0,50).map((row:any)=><tr key={row.id} className="border-b border-neutral-100"><td className="py-3 whitespace-nowrap">{formatDateTime(row.createdAt)}</td><td>{row.customerName||"—"}</td><td>{row.assignedStaffName||"Chưa gán"}</td><td className="max-w-[440px] truncate">{row.reason||row.action}</td></tr>)}</tbody></table></div></section>
        </div>
        </div>
      </WorkspaceShell>
    );
  }

  if (workspace === "noteSettings") {
    return (
      <WorkspaceShell
        title={title}
        description="Quản lý các mẫu ghi chú dùng chung. Nhân viên chỉ được sử dụng; chỉ Admin hoặc Owner được thêm, sửa và ẩn mẫu."
      >
        <div className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="max-w-2xl">
            <p className="text-xs font-black uppercase tracking-widest text-neutral-400">
              Mẫu ghi chú dùng chung
            </p>
            <h4 className="mt-2 text-xl font-black">Cài đặt ghi chú</h4>
            <p className="mt-2 text-sm leading-6 text-neutral-500">
              Tên ghi chú được lưu nguyên tiếng Việt có dấu. Khi ẩn, mẫu sẽ
              không còn hiện cho nhân viên nhưng lịch sử ghi chú cũ vẫn được giữ.
            </p>

            <div className="mt-5 flex gap-2">
              <input
                value={newNoteTemplateName}
                onChange={(event) =>
                  onNewNoteTemplateNameChange(event.target.value)
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") onCreateNoteTemplate();
                }}
                placeholder="Ví dụ: Đợi hàng, Chờ chuyển khoản..."
                className="min-w-0 flex-1 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none focus:border-neutral-400"
              />
              <button
                type="button"
                onClick={onCreateNoteTemplate}
                className="rounded-2xl bg-neutral-950 px-5 py-3 text-sm font-black text-white"
              >
                Thêm ghi chú
              </button>
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-3xl border border-neutral-200">
            {noteTemplates.length ? (
              noteTemplates.map((template, index) => (
                <div
                  key={template.id}
                  className={cx(
                    "flex items-center gap-3 bg-white px-5 py-4",
                    index < noteTemplates.length - 1 &&
                      "border-b border-neutral-100",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate font-bold">
                    {template.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRenameNoteTemplate(template)}
                    className="rounded-xl border border-neutral-200 px-3 py-2 text-xs font-black text-blue-700 hover:bg-blue-50"
                  >
                    Sửa tên
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteNoteTemplate(template)}
                    className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-700 hover:bg-red-100"
                  >
                    Ẩn ghi chú
                  </button>
                </div>
              ))
            ) : (
              <div className="px-5 py-10 text-center text-sm text-neutral-500">
                Chưa có mẫu ghi chú dùng chung.
              </div>
            )}
          </div>
        </div>
      </WorkspaceShell>
    );
  }

  if (workspace === "settings") {
    const pageName = getPageName(connectionStatus);
    const pageId = getPageId(connectionStatus);
    const isVerified = Boolean(
      connectionStatus?.graphVerified || connectionStatus?.tokenConfigured,
    );
    const isSubscribed = Boolean(connectionStatus?.subscriptionVerified);

    return (
      <WorkspaceShell
        title={title}
        description="Cấu hình Facebook Page, webhook và quyền Messenger dùng cho hệ thống Omni Inbox."
        connectionStatus={connectionStatus}
      >
        <div className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-neutral-400">
                Facebook Page connection
              </p>
              <h4 className="mt-2 text-xl font-black">
                Kết nối Facebook Page thật
              </h4>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
                Màn này đọc cấu hình thật từ backend và gọi Meta Graph API để
                kiểm tra Page, token, webhook subscription. Không còn dữ liệu
                demo.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={connectionLoading}
                onClick={onReloadConnection}
                className="inline-flex items-center gap-2 rounded-2xl border border-neutral-200 px-4 py-2 text-sm font-black text-neutral-700 hover:bg-neutral-50 disabled:cursor-wait disabled:opacity-70"
              >
                <RefreshCw
                  className={cx("h-4 w-4", connectionLoading && "animate-spin")}
                />
                Kiểm tra lại
              </button>
              <button
                type="button"
                disabled={connectionLoading}
                onClick={onSyncConnection}
                className="inline-flex items-center gap-2 rounded-2xl bg-neutral-950 px-4 py-2 text-sm font-black text-white hover:bg-neutral-800 disabled:cursor-wait disabled:opacity-70"
              >
                {connectionLoading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="h-4 w-4" />
                )}
                {connectionLoading
                  ? "Đang đồng bộ Meta..."
                  : "Đồng bộ Page với Meta"}
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <SettingCard
              label="Facebook Page"
              value={pageName}
              status={isVerified ? "Verified" : "Chưa xác minh"}
              tone={isVerified ? "success" : "muted"}
            />
            <SettingCard
              label="Page ID"
              value={pageId}
              status={connectionStatus?.pageId ? "Live config" : "Env fallback"}
              tone={connectionStatus?.pageId ? "success" : "muted"}
            />
            <SettingCard
              label="Webhook URL"
              value={connectionStatus?.webhookPath || DEFAULT_WEBHOOK_PATH}
              status="Configured"
              tone="success"
            />
            <SettingCard
              label="Subscribed fields"
              value={getConnectionFields(connectionStatus)}
              status={isSubscribed ? "Subscribed" : "Cần đồng bộ"}
              tone={isSubscribed ? "success" : "muted"}
            />
          </div>

          <div className="mt-5 rounded-3xl border border-emerald-100 bg-emerald-50 p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
              <div>
                <p className="text-sm font-black text-emerald-950">
                  Facebook Page đang dùng cấu hình thật
                </p>
                <p className="mt-1 text-sm leading-6 text-emerald-800">
                  Tin nhắn và sự kiện Messenger của Page {pageName} được đồng bộ
                  qua webhook backend. Một số kiểm tra nâng cao của Meta Graph
                  API có thể yêu cầu quyền đang trong quá trình xét duyệt.
                </p>
              </div>
            </div>
          </div>
        </div>
      </WorkspaceShell>
    );
  }

  return (
    <WorkspaceShell
      title={title}
      description="Khu vực này đã sẵn sàng cho luồng vận hành thật, đang dùng chung dữ liệu hội thoại từ Omni Inbox."
    >
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Hội thoại liên quan" value={total} />
        <StatCard label="Nhãn đã gắn" value={tagged} />
        <StatCard label="Chưa trả lời" value={selectedSummary.open} />
      </div>
      <div className="mt-5 rounded-3xl border border-neutral-200 bg-white p-6">
        <p className="text-lg font-black">{title}</p>
        <p className="mt-2 text-sm leading-6 text-neutral-500">
          Mục này đã có giao diện điều hướng riêng trong Omni Inbox. Khi cần mở
          sâu từng nghiệp vụ, có thể nối thêm API xử lý riêng cho từng màn.
        </p>
        <button
          onClick={onOpenInbox}
          className="mt-5 rounded-2xl bg-neutral-950 px-5 py-3 text-sm font-bold text-white"
        >
          Quay lại hộp thư
        </button>
      </div>
    </WorkspaceShell>
  );
}

function WorkspaceShell({
  title,
  description,
  children,
  connectionStatus,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  connectionStatus?: MetaConnectionStatus | null;
}) {
  return (
    <section className="h-[calc(100vh-80px)] overflow-y-auto p-4">
      <div className="rounded-[28px] border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-neutral-400">
              The 1970 Omni
            </p>
            <h3 className="mt-2 text-2xl font-black">{title}</h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-500">
              {description}
            </p>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700">
            {connectionStatus?.graphVerified
              ? "Meta Connected"
              : "Meta Configured"}
          </span>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}



function Toggle({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return <button type="button" onClick={() => onChange(!checked)} className={cx("relative h-7 w-12 rounded-full transition", checked ? "bg-blue-600" : "bg-neutral-300")}><span className={cx("absolute top-1 h-5 w-5 rounded-full bg-white shadow transition", checked ? "left-6" : "left-1")}/></button>;
}

function DetailedSettingRow({ title, description, control, extra }: { title: string; description: string; control: React.ReactNode; extra?: React.ReactNode }) {
  return <div className="grid gap-4 py-5 md:grid-cols-[1fr_auto]"><div><p className="font-black">{title}</p><p className="mt-1 max-w-3xl text-sm leading-6 text-neutral-500">{description}</p>{extra}</div><div className="flex items-start justify-start md:justify-end">{control}</div></div>;
}

function AssignmentSettingCard({ title, rows, settings, onChange }: { title: string; rows: Array<[string, keyof OmniAssignmentSettings]>; settings: OmniAssignmentSettings; onChange: (value: OmniAssignmentSettings) => void }) {
  return <div className="rounded-3xl border border-neutral-200 bg-white p-5"><h4 className="font-black">{title}</h4><div className="mt-4 space-y-3">{rows.map(([label,key])=><label key={String(key)} className="flex items-center justify-between gap-3 text-sm"><span>{label}</span><input type="checkbox" checked={Boolean(settings[key])} onChange={(e)=>onChange({...settings,[key]:e.target.checked})} className="h-5 w-5"/></label>)}</div></div>;
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-widest text-neutral-400">
        {label}
      </p>
      <p className="mt-3 text-3xl font-black">{value}</p>
    </div>
  );
}

function ChannelHealth({
  label,
  value,
  active,
}: {
  label: string;
  value: number;
  active?: boolean;
}) {
  return (
    <div className="rounded-3xl border border-neutral-200 bg-neutral-50 p-4">
      <div className="flex items-center justify-between">
        <p className="font-bold">{label}</p>
        <span
          className={cx(
            "h-2.5 w-2.5 rounded-full",
            active ? "bg-emerald-500" : "bg-neutral-300",
          )}
        />
      </div>
      <p className="mt-3 text-2xl font-black">{value}</p>
      <p className="text-xs text-neutral-500">hội thoại</p>
    </div>
  );
}

function ReviewCheck({ label, active }: { label: string; active?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
      <span className="text-sm font-black text-neutral-700">{label}</span>
      <span
        className={cx(
          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black",
          active
            ? "bg-emerald-50 text-emerald-700"
            : "bg-amber-50 text-amber-700",
        )}
      >
        <span
          className={cx(
            "h-2 w-2 rounded-full",
            active ? "bg-emerald-500" : "bg-amber-500",
          )}
        />
        {active ? "Ready" : "Waiting"}
      </span>
    </div>
  );
}

function SettingCard({
  label,
  value,
  status,
  tone = "success",
}: {
  label: string;
  value: string;
  status: string;
  tone?: "success" | "muted";
}) {
  return (
    <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-widest text-neutral-400">
            {label}
          </p>
          <p className="mt-2 break-words font-bold">{value}</p>
        </div>
        <span
          className={cx(
            "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black",
            tone === "success"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-neutral-100 text-neutral-500",
          )}
        >
          {status}
        </span>
      </div>
    </div>
  );
}

function SidebarGroup({
  title,
  items,
  active,
  badge,
}: {
  title: string;
  items: string[];
  active: boolean;
  badge?: number;
}) {
  if (!items.length) {
    return (
      <button
        className={cx(
          "flex w-full items-center justify-between rounded-3xl px-5 py-4 text-left font-bold",
          active
            ? "bg-neutral-950 text-white"
            : "bg-white text-neutral-900 hover:bg-neutral-50",
        )}
      >
        {title}
      </button>
    );
  }

  return (
    <div className="rounded-3xl border border-neutral-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between px-2 pt-1 text-sm font-bold">
        <span>{title}</span>
        {!!badge && (
          <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs text-white">
            {badge}
          </span>
        )}
      </div>
      <div className="space-y-1">
        {items.map((item, index) => {
          const isActive = active && index === 0;
          return (
            <button
              key={item}
              className={cx(
                "flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm font-semibold",
                isActive
                  ? "bg-blue-50 text-blue-700"
                  : "text-neutral-600 hover:bg-neutral-50",
              )}
            >
              <span>{item}</span>
              {isActive && !!badge && (
                <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs text-white">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
        {label}
      </p>
      <p className="mt-1 text-lg font-black">{value}</p>
    </div>
  );
}

function ConversationRow({
  item,
  active,
  onClick,
}: {
  item: OmniConversation;
  active: boolean;
  onClick: () => void;
}) {
  const tags = item.tags || [];
  return (
    <button
      onClick={onClick}
      className={cx(
        "flex w-full gap-3 border-b border-neutral-100 px-5 py-4 text-left transition hover:bg-neutral-50",
        active && "bg-blue-50/70",
      )}
    >
      <div className="relative shrink-0">
        <Avatar
          src={item.customer?.avatarUrl || ""}
          name={customerName(item)}
          size="md"
        />
        <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-white ring-2 ring-white">
          {channelBadge(item.channel)}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-black">{customerName(item)}</p>
          <span className="shrink-0 text-xs font-medium text-neutral-400">
            {formatTime(item.lastMessageAt)}
          </span>
        </div>

        <p className="mt-1 truncate text-sm text-neutral-600">
          {item.lastMessageText || "Chưa có nội dung"}
        </p>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {item.assigneeName ? (
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-bold text-neutral-500">
              {item.assigneeName}
            </span>
          ) : (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">
              Chưa gán
            </span>
          )}

          {tags.slice(0, 2).map((tag) => (
            <span
              key={tag.id || tag.tag}
              className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-600"
            >
              {tag.tag}
            </span>
          ))}
        </div>
      </div>

      <div className="flex w-6 shrink-0 items-center justify-end">
        {item.unreadCount > 0 ? (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-black text-white">
            {item.unreadCount}
          </span>
        ) : (
          <CheckCircle2 className="h-4 w-4 text-neutral-300" />
        )}
      </div>
    </button>
  );
}

function MetaAdReferralCard({
  conversation,
}: {
  conversation: OmniConversation;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-blue-600">
            Nguồn bài viết Facebook
          </p>
          <p className="mt-1 text-sm font-bold text-neutral-700">
            Khách nhắn tin từ bài viết quảng cáo
          </p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-sm font-black text-white">
          f
        </div>
      </div>

      <div className="flex gap-4 p-4">
        {conversation.adImageUrl ? (
          <img
            src={conversation.adImageUrl}
            alt=""
            className="h-24 w-24 shrink-0 rounded-xl object-cover"
            loading="lazy"
          />
        ) : null}

        <div className="min-w-0 flex-1">
          {conversation.adBody ? (
            <p className="line-clamp-4 whitespace-pre-wrap text-sm leading-6 text-neutral-600">
              {conversation.adBody}
            </p>
          ) : (
            <p className="text-sm text-neutral-500">
              Mở bài viết để xem nội dung quảng cáo khách đã nhắn từ đó.
            </p>
          )}

          {conversation.adUrl ? (
            <a
              href={conversation.adUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex rounded-xl bg-blue-600 px-3 py-2 text-xs font-black text-white hover:bg-blue-700"
            >
              Xem bài viết trên Facebook
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  avatar,
  name,
}: {
  message: OmniMessage;
  avatar: string;
  name: string;
}) {
  const isOut = message.direction === "OUT";

  return (
    <div className={cx("flex gap-3", isOut && "justify-end")}>
      {!isOut && <Avatar src={avatar} name={name} size="sm" />}

      <div className={cx("max-w-[72%]", isOut && "text-right")}>
        <div
          className={cx(
            "inline-block rounded-[22px] px-4 py-3 text-sm shadow-sm",
            isOut
              ? "rounded-br-md bg-blue-600 text-white"
              : "rounded-bl-md bg-white text-neutral-800 ring-1 ring-neutral-200",
          )}
        >
          {message.text && (
            <p className="whitespace-pre-wrap text-left leading-6">
              {message.text}
            </p>
          )}
          {message.attachmentUrl && (
            <img
              src={message.attachmentUrl}
              alt=""
              className="mt-2 max-h-64 rounded-2xl object-cover"
              loading="lazy"
            />
          )}
        </div>
        <p className="mt-1 text-xs font-medium text-neutral-400">
          {formatTime(message.sentAt)}
        </p>
      </div>
    </div>
  );
}

function Avatar({
  src,
  name,
  size,
}: {
  src?: string;
  name: string;
  size: "sm" | "md" | "lg" | "xl";
}) {
  const sizeClass =
    size === "sm"
      ? "h-8 w-8 text-xs"
      : size === "md"
        ? "h-11 w-11 text-sm"
        : size === "lg"
          ? "h-12 w-12 text-sm"
          : "h-16 w-16 text-lg";

  if (src) {
    return (
      <img
        src={src}
        alt=""
        className={cx("shrink-0 rounded-full object-cover", sizeClass)}
      />
    );
  }

  const initial = String(name || "?")
    .trim()
    .charAt(0)
    .toUpperCase();

  return (
    <div
      className={cx(
        "flex shrink-0 items-center justify-center rounded-full bg-neutral-950 font-black text-white",
        sizeClass,
      )}
    >
      {initial}
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-neutral-200 text-neutral-500">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-neutral-400">{label}</p>
        <p className="truncate text-sm font-bold">{value}</p>
      </div>
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-neutral-200 py-5">
      <h4 className="mb-3 text-sm font-black">{title}</h4>
      {children}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-3 p-5">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="flex animate-pulse gap-3">
          <div className="h-11 w-11 rounded-full bg-neutral-100" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/2 rounded bg-neutral-100" />
            <div className="h-3 w-4/5 rounded bg-neutral-100" />
            <div className="h-3 w-1/3 rounded bg-neutral-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ChatSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className={cx("flex animate-pulse", index % 2 === 1 && "justify-end")}
        >
          <div className="h-12 w-72 rounded-3xl bg-neutral-100" />
        </div>
      ))}
    </div>
  );
}
