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
import {
  assignOmniConversation,
  createOmniConversationNote,
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
} from "@/lib/omni-inbox-api";

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
  | "settings";

const WORKSPACE_TITLES: Record<WorkspaceKey, string> = {
  inbox: "Hộp thư đến",
  facebook: "Facebook Messenger",
  instagram: "Instagram Direct",
  comments: "Bình luận",
  livestream: "Livestream",
  customers: "Khách hàng",
  tags: "Nhãn hội thoại",
  assignments: "Phân công nhân viên",
  orders: "Tạo đơn từ hội thoại",
  quickReplies: "Mẫu trả lời nhanh",
  reports: "Báo cáo inbox",
  settings: "Cài đặt kết nối",
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

const ASSIGNEE_OPTIONS = [
  { id: "", name: "Chưa gán" },
  { id: "admin", name: "Admin" },
  { id: "minh-anh", name: "Minh Anh" },
  { id: "thu-ha", name: "Thu Hà" },
  { id: "mai-trang", name: "Mai Trang" },
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

export default function MessagesPageClient() {
  const [conversations, setConversations] = useState<OmniConversation[]>([]);
  const [activeConversation, setActiveConversation] =
    useState<OmniConversation | null>(null);
  const [activeId, setActiveId] = useState("");
  const [status, setStatus] = useState<StatusTab>("ALL");
  const [channel, setChannel] = useState<OmniChannel | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [tagDraft, setTagDraft] = useState("");
  const [error, setError] = useState("");
  const [sseStatus, setSseStatus] = useState<
    "connecting" | "online" | "offline"
  >("connecting");
  const [workspace, setWorkspace] = useState<WorkspaceKey>("inbox");
  const listRequestId = useRef(0);

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

  const selectedSummary = useMemo(() => {
    const unread = conversations.reduce(
      (sum, item) => sum + Number(item.unreadCount || 0),
      0,
    );
    const open = conversations.filter((item) => item.status === "OPEN").length;
    const processing = conversations.filter(
      (item) => item.status === "PROCESSING",
    ).length;
    const closed = conversations.filter(
      (item) => item.status === "CLOSED",
    ).length;
    return { unread, open, processing, closed };
  }, [conversations]);

  async function handleSend() {
    const text = draft.trim();
    if (!activeConversation?.id || !text || sending) return;

    setSending(true);
    setError("");

    try {
      const message = await sendOmniMessage(activeConversation.id, { text });
      setDraft("");
      setActiveConversation((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: [...(prev.messages || []), message],
          lastMessageText: text,
          lastMessageAt: message.sentAt,
        };
      });
      await loadList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không gửi được tin nhắn.");
    } finally {
      setSending(false);
    }
  }

  async function handleAssign(assigneeId: string) {
    if (!activeConversation?.id) return;
    const assignee = ASSIGNEE_OPTIONS.find((item) => item.id === assigneeId);
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

    if (key === "inbox") {
      setChannel("ALL");
      setStatus("ALL");
    }
  }, []);

  const isInboxWorkspace = workspace === "inbox" || workspace === "facebook" || workspace === "instagram";

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
                Meta Configured
              </div>
              <p className="mt-1 text-xs font-semibold text-emerald-700">
                Facebook Page · The 1970
              </p>
              <p className="mt-0.5 text-[11px] text-emerald-700/80">
                Messenger webhook configured
              </p>
            </div>
          </div>

          <nav className="flex-1 space-y-6 overflow-y-auto p-4 text-sm">
            <OmniNavSection
              title="Inbox"
              activeKey={workspace}
              onSelect={openWorkspace}
              items={[
                { key: "inbox", label: "Hộp thư đến", icon: <MessageCircle className="h-4 w-4" />, badge: selectedSummary.open },
                { key: "facebook", label: "Facebook Messenger", icon: channelBadge("FACEBOOK"), badge: selectedSummary.unread },
                { key: "instagram", label: "Instagram Direct", icon: channelBadge("INSTAGRAM") },
                { key: "comments", label: "Bình luận", icon: <Mail className="h-4 w-4" /> },
                { key: "livestream", label: "Livestream", icon: <Sparkles className="h-4 w-4" /> },
              ]}
            />

            <OmniNavSection
              title="Quản lý khách"
              activeKey={workspace}
              onSelect={openWorkspace}
              items={[
                { key: "customers", label: "Khách hàng", icon: <Users className="h-4 w-4" /> },
                { key: "tags", label: "Nhãn hội thoại", icon: <Tag className="h-4 w-4" /> },
                { key: "assignments", label: "Phân công nhân viên", icon: <UserPlus className="h-4 w-4" /> },
              ]}
            />

            <OmniNavSection
              title="Vận hành"
              activeKey={workspace}
              onSelect={openWorkspace}
              items={[
                { key: "orders", label: "Tạo đơn từ hội thoại", icon: <ShoppingBag className="h-4 w-4" /> },
                { key: "quickReplies", label: "Mẫu trả lời nhanh", icon: <Sparkles className="h-4 w-4" /> },
                { key: "reports", label: "Báo cáo inbox", icon: <CheckCircle2 className="h-4 w-4" /> },
                { key: "settings", label: "Cài đặt kết nối", icon: <Settings className="h-4 w-4" /> },
              ]}
            />
          </nav>

          <div className="border-t border-neutral-200 p-4">
            <div className="rounded-3xl bg-neutral-950 p-4 text-white">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-400">
                Review mode
              </p>
              <p className="mt-2 text-sm font-bold">Meta App Review Ready</p>
              <p className="mt-1 text-xs text-neutral-400">
                Messenger, webhook, page connection
              </p>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 flex h-20 items-center gap-4 border-b border-neutral-200 bg-white/95 px-6 backdrop-blur">
            <button className="rounded-full p-2 text-neutral-500 hover:bg-neutral-100">
              <Menu className="h-5 w-5" />
            </button>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-neutral-400">
                The 1970 Omni Inbox
              </p>
              <div className="mt-1 flex items-center gap-3">
                <h2 className="text-xl font-bold">{WORKSPACE_TITLES[workspace]}</h2>
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
                placeholder="Tìm kiếm hội thoại, khách hàng, SĐT..."
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
                  A
                </div>
                <div>
                  <p className="text-sm font-bold">ADMIN - ALL</p>
                  <p className="text-xs text-neutral-500">Chi nhánh làm việc</p>
                </div>
              </div>
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
                      The 1970 · Facebook Messenger
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => void loadList()}
                      className="rounded-full border border-neutral-200 p-2 text-neutral-600 hover:bg-neutral-50"
                    >
                      <RefreshCw
                        className={cx("h-4 w-4", loadingList && "animate-spin")}
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
                          The 1970
                        </p>
                        <p className="text-xs font-semibold text-blue-700">
                          Facebook Messenger · Page ID 1435304586691707
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
                    onChange={(event) => setAssigneeFilter(event.target.value)}
                    className="rounded-2xl border border-neutral-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none"
                  >
                    <option value="">Tất cả nhân viên</option>
                    {ASSIGNEE_OPTIONS.filter((item) => item.id).map((item) => (
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

              <div className="h-[calc(100%-220px)] overflow-y-auto">
                {loadingList && !conversations.length ? (
                  <ListSkeleton />
                ) : conversations.length ? (
                  conversations.map((item) => (
                    <ConversationRow
                      key={item.id}
                      item={item}
                      active={activeId === item.id}
                      onClick={() => setActiveId(item.id)}
                    />
                  ))
                ) : (
                  <div className="p-8 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-neutral-100">
                      <MessageCircle className="h-6 w-6 text-neutral-400" />
                    </div>
                    <p className="mt-4 font-bold">Chưa có hội thoại</p>
                    <p className="mt-1 text-sm text-neutral-500">
                      Khi Facebook Messenger gửi sự kiện mới, hội thoại sẽ xuất
                      hiện tại đây.
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
                        {ASSIGNEE_OPTIONS.map((item) => (
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

                  <div className="flex-1 overflow-y-auto bg-[#fbfbfa] p-6">
                    {loadingDetail ? (
                      <ChatSkeleton />
                    ) : activeConversation.messages?.length ? (
                      <div className="space-y-5">
                        <div className="text-center text-xs font-bold text-neutral-400">
                          Hôm nay
                        </div>
                        {activeConversation.messages.map((message) => (
                          <MessageBubble
                            key={message.id}
                            message={message}
                            avatar={customerAvatar(activeConversation)}
                            name={customerName(activeConversation)}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="flex h-full items-center justify-center text-center">
                        <div>
                          <MessageCircle className="mx-auto h-10 w-10 text-neutral-300" />
                          <p className="mt-3 font-bold text-neutral-700">
                            Chưa có tin nhắn
                          </p>
                          <p className="text-sm text-neutral-500">
                            Hội thoại đã được tạo nhưng chưa có lịch sử message.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-neutral-200 bg-white p-5">
                    <div className="mb-3 flex gap-2 overflow-x-auto">
                      {QUICK_REPLIES.map((reply) => (
                        <button
                          key={reply}
                          onClick={() => setDraft(reply)}
                          className="whitespace-nowrap rounded-full border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
                        >
                          {reply.length > 30
                            ? `${reply.slice(0, 30)}...`
                            : reply}
                        </button>
                      ))}
                    </div>

                    <div className="rounded-3xl border border-neutral-200 bg-white p-4">
                      <textarea
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            void handleSend();
                          }
                        }}
                        rows={3}
                        className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-neutral-400"
                        placeholder="Nhập tin nhắn... Enter để gửi, Shift + Enter để xuống dòng"
                      />

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
                          disabled={!draft.trim() || sending}
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
                    <p className="mt-4 text-lg font-bold">Chọn một hội thoại</p>
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
                    {["Thông tin", "Đơn hàng", "Ghi chú"].map((item, index) => (
                      <button
                        key={item}
                        className={cx(
                          "border-b-2 px-3 py-5 text-sm font-bold",
                          index === 0
                            ? "border-blue-600 text-blue-600"
                            : "border-transparent text-neutral-500",
                        )}
                      >
                        {item}
                      </button>
                    ))}
                  </div>

                  <div className="h-[calc(100%-64px)] overflow-y-auto p-5">
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
                        value="The 1970"
                      />
                      <InfoRow
                        icon={<Users className="h-4 w-4" />}
                        label="Page ID"
                        value="1435304586691707"
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
                        value={formatDateTime(activeConversation.lastMessageAt)}
                      />
                    </div>

                    <Panel title="Nhãn">
                      <div className="flex flex-wrap gap-2">
                        {(activeConversation.tags || []).map((tag) => (
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
                          onChange={(event) => setTagDraft(event.target.value)}
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
                        {ASSIGNEE_OPTIONS.map((item) => (
                          <option key={item.id || "none-right"} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </Panel>

                    <Panel title="Ghi chú nội bộ">
                      <textarea
                        value={noteDraft}
                        onChange={(event) => setNoteDraft(event.target.value)}
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
                        {(activeConversation.notes || [])
                          .slice(0, 5)
                          .map((note) => (
                            <div
                              key={note.id}
                              className="rounded-2xl bg-neutral-50 p-3"
                            >
                              <p className="text-sm text-neutral-700">
                                {note.note}
                              </p>
                              <p className="mt-1 text-xs text-neutral-400">
                                {note.staffName || "Admin"} ·{" "}
                                {formatDateTime(note.createdAt)}
                              </p>
                            </div>
                          ))}
                      </div>
                    </Panel>

                    <Panel title="Tổng đơn hàng">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-neutral-500">Số đơn</span>
                        <span className="font-bold">0 đơn</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-sm">
                        <span className="text-neutral-500">Tổng chi tiêu</span>
                        <span className="font-bold">{formatCurrency(0)}</span>
                      </div>
                    </Panel>

                    <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700">
                      <ShoppingBag className="h-4 w-4" />
                      Tạo đơn hàng
                    </button>

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
              conversations={conversations}
              quickReplies={QUICK_REPLIES}
              assignees={ASSIGNEE_OPTIONS}
              selectedSummary={selectedSummary}
              onOpenInbox={() => openWorkspace("inbox")}
            />
          )}
        </main>
      </div>
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
                    isActive ? "bg-white text-neutral-950" : "bg-blue-600 text-white",
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
  onOpenInbox,
}: {
  workspace: WorkspaceKey;
  conversations: OmniConversation[];
  quickReplies: string[];
  assignees: Array<{ id: string; name: string }>;
  selectedSummary: { unread: number; open: number; processing: number; closed: number };
  onOpenInbox: () => void;
}) {
  const title = WORKSPACE_TITLES[workspace];
  const total = conversations.length;
  const tagged = conversations.reduce((sum, item) => sum + (item.tags?.length || 0), 0);
  const [pageConnectModalOpen, setPageConnectModalOpen] = useState(false);
  const [reviewPageConnected, setReviewPageConnected] = useState(true);

  if (workspace === "customers") {
    return (
      <WorkspaceShell title={title} description="Danh sách khách nhắn tin qua Facebook Messenger và các kênh bán hàng đa kênh.">
        <div className="grid gap-4 lg:grid-cols-3">
          <StatCard label="Tổng khách hội thoại" value={total} />
          <StatCard label="Khách chưa trả lời" value={selectedSummary.open} />
          <StatCard label="Đã phân công" value={conversations.filter((item) => item.assigneeId).length} />
        </div>
        <div className="mt-5 overflow-hidden rounded-3xl border border-neutral-200 bg-white">
          {conversations.map((item) => (
            <button key={item.id} onClick={onOpenInbox} className="flex w-full items-center justify-between border-b border-neutral-100 px-5 py-4 text-left hover:bg-neutral-50">
              <div className="flex items-center gap-3">
                <Avatar src={item.customer?.avatarUrl || ""} name={customerName(item)} size="md" />
                <div>
                  <p className="font-black">{customerName(item)}</p>
                  <p className="text-sm text-neutral-500">{channelLabel(item.channel)} · {formatDateTime(item.lastMessageAt)}</p>
                </div>
              </div>
              <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-bold text-neutral-600">{statusLabel(item.status)}</span>
            </button>
          ))}
        </div>
      </WorkspaceShell>
    );
  }

  if (workspace === "tags") {
    const tags = Array.from(new Set(conversations.flatMap((item) => item.tags?.map((tag) => tag.tag) || [])));
    return (
      <WorkspaceShell title={title} description="Quản lý nhãn phân loại hội thoại để lọc khách, ưu tiên xử lý và chăm sóc lại.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {(tags.length ? tags : ["Khách mới", "Cần tư vấn size", "Chờ chốt đơn", "Đã mua hàng"]).map((tag) => (
            <div key={tag} className="rounded-3xl border border-neutral-200 bg-white p-5">
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-black text-blue-700">{tag}</span>
                <Tag className="h-4 w-4 text-neutral-400" />
              </div>
              <p className="mt-4 text-2xl font-black">{conversations.filter((item) => item.tags?.some((t) => t.tag === tag)).length}</p>
              <p className="text-sm text-neutral-500">hội thoại</p>
            </div>
          ))}
        </div>
      </WorkspaceShell>
    );
  }

  if (workspace === "assignments") {
    return (
      <WorkspaceShell title={title} description="Theo dõi hội thoại theo nhân viên phụ trách để chia việc CSKH rõ ràng.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {assignees.map((staff) => (
            <div key={staff.id || "none"} className="rounded-3xl border border-neutral-200 bg-white p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-neutral-950 font-black text-white">{staff.name.charAt(0)}</div>
                <div>
                  <p className="font-black">{staff.name}</p>
                  <p className="text-xs text-neutral-500">Phụ trách hội thoại</p>
                </div>
              </div>
              <p className="mt-5 text-3xl font-black">{conversations.filter((item) => (staff.id ? item.assigneeId === staff.id : !item.assigneeId)).length}</p>
            </div>
          ))}
        </div>
      </WorkspaceShell>
    );
  }

  if (workspace === "quickReplies") {
    return (
      <WorkspaceShell title={title} description="Các mẫu phản hồi nhanh dùng trong ô chat để nhân viên trả lời thống nhất.">
        <div className="grid gap-4 xl:grid-cols-2">
          {quickReplies.map((reply, index) => (
            <div key={reply} className="rounded-3xl border border-neutral-200 bg-white p-5">
              <p className="text-xs font-black uppercase tracking-widest text-neutral-400">Mẫu #{index + 1}</p>
              <p className="mt-3 text-base font-bold leading-7">{reply}</p>
            </div>
          ))}
        </div>
      </WorkspaceShell>
    );
  }

  if (workspace === "reports") {
    return (
      <WorkspaceShell title={title} description="Tổng quan hiệu suất inbox Messenger phục vụ chăm sóc khách và chốt đơn.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Tổng hội thoại" value={total} />
          <StatCard label="Chưa trả lời" value={selectedSummary.open} />
          <StatCard label="Đang xử lý" value={selectedSummary.processing} />
          <StatCard label="Đã chốt" value={selectedSummary.closed} />
        </div>
        <div className="mt-5 rounded-3xl border border-neutral-200 bg-white p-6">
          <p className="font-black">Kênh đang kết nối</p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <ChannelHealth label="Facebook Messenger" value={conversations.filter((item) => item.channel === "FACEBOOK").length} active />
            <ChannelHealth label="Instagram Direct" value={conversations.filter((item) => item.channel === "INSTAGRAM").length} />
            <ChannelHealth label="Bình luận/Livestream" value={0} />
          </div>
        </div>
      </WorkspaceShell>
    );
  }

  if (workspace === "settings") {
    return (
      <WorkspaceShell
        title={title}
        description="Cấu hình Page, webhook và quyền Messenger dùng cho Meta App Review. Màn này có flow chọn Page để quay riêng quyền pages_show_list."
      >
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-neutral-400">Facebook Page Connection</p>
                <h4 className="mt-2 text-xl font-black">Kết nối Facebook Page</h4>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
                  Dùng cho video pages_show_list: nhân viên mở danh sách Page mà tài khoản quản lý, chọn Page The 1970 rồi lưu vào Omni Inbox.
                </p>
              </div>

              <div className="flex gap-2">
                {reviewPageConnected ? (
                  <button
                    type="button"
                    onClick={() => setReviewPageConnected(false)}
                    className="rounded-2xl border border-neutral-200 px-4 py-2 text-sm font-black text-neutral-700 hover:bg-neutral-50"
                  >
                    Reset để quay
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setPageConnectModalOpen(true)}
                  className="rounded-2xl bg-neutral-950 px-4 py-2 text-sm font-black text-white hover:bg-neutral-800"
                >
                  {reviewPageConnected ? "Đổi Facebook Page" : "Kết nối Facebook Page"}
                </button>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <SettingCard
                label="Facebook Page"
                value={reviewPageConnected ? "The 1970" : "Chưa chọn Page"}
                status={reviewPageConnected ? "Selected" : "Not connected"}
              />
              <SettingCard
                label="Page ID"
                value={reviewPageConnected ? "1435304586691707" : "Chưa có Page ID"}
                status={reviewPageConnected ? "Verified" : "Waiting"}
              />
              <SettingCard label="Webhook URL" value="/webhooks/meta/inbox" status="Verified" />
              <SettingCard
                label="Subscribed fields"
                value={reviewPageConnected ? "messages, reads, deliveries, reactions, postbacks" : "Sẽ đăng ký sau khi chọn Page"}
                status={reviewPageConnected ? "Configured" : "Pending"}
              />
            </div>

            <div className="mt-5 rounded-3xl border border-blue-100 bg-blue-50 p-4">
              <p className="text-sm font-black text-blue-950">Script quay pages_show_list</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-6 text-blue-900">
                <li>Bấm <b>Reset để quay</b> để đưa màn hình về trạng thái chưa chọn Page.</li>
                <li>Bấm <b>Kết nối Facebook Page</b>.</li>
                <li>Chọn <b>The 1970</b> trong danh sách Page.</li>
                <li>Bấm <b>Lưu kết nối</b> và cho thấy Page ID được hiển thị lại trong hệ thống.</li>
              </ol>
            </div>
          </div>

          <div className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-widest text-neutral-400">Review Status</p>
            <div className="mt-4 space-y-3">
              <ReviewCheck label="pages_show_list" active={reviewPageConnected} />
              <ReviewCheck label="pages_manage_metadata" active={reviewPageConnected} />
              <ReviewCheck label="pages_read_engagement" active={reviewPageConnected} />
              <ReviewCheck label="pages_messaging" active={reviewPageConnected} />
              <ReviewCheck label="business_management" active />
              <ReviewCheck label="pages_utility_messaging" active={reviewPageConnected} />
            </div>
          </div>
        </div>

        {pageConnectModalOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm">
            <div className="w-full max-w-2xl rounded-[28px] bg-white p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-neutral-400">pages_show_list</p>
                  <h4 className="mt-2 text-2xl font-black">Chọn Facebook Page</h4>
                  <p className="mt-2 text-sm leading-6 text-neutral-500">
                    Omni Inbox hiển thị danh sách Page mà tài khoản quản trị có quyền quản lý. Chọn Page cần kết nối để nhận và trả lời Messenger.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPageConnectModalOpen(false)}
                  className="rounded-full p-2 text-neutral-500 hover:bg-neutral-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-5 space-y-3">
                <button
                  type="button"
                  onClick={() => {
                    setReviewPageConnected(true);
                    setPageConnectModalOpen(false);
                  }}
                  className="flex w-full items-center justify-between rounded-3xl border border-blue-200 bg-blue-50 p-4 text-left hover:bg-blue-100"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm">
                      {channelBadge("FACEBOOK")}
                    </div>
                    <div>
                      <p className="font-black text-blue-950">The 1970</p>
                      <p className="text-sm font-semibold text-blue-700">Page ID: 1435304586691707</p>
                      <p className="text-xs text-blue-700/80">Facebook Messenger · Business asset</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-black text-white">Chọn</span>
                </button>

                <div className="flex w-full items-center justify-between rounded-3xl border border-neutral-200 bg-white p-4 opacity-60">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-500">
                      f
                    </div>
                    <div>
                      <p className="font-black">The 1970 Test Page</p>
                      <p className="text-sm text-neutral-500">Page ID: 100000000000000</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-black text-neutral-500">Không dùng</span>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPageConnectModalOpen(false)}
                  className="rounded-2xl border border-neutral-200 px-4 py-2 text-sm font-black text-neutral-700 hover:bg-neutral-50"
                >
                  Huỷ
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReviewPageConnected(true);
                    setPageConnectModalOpen(false);
                  }}
                  className="rounded-2xl bg-neutral-950 px-4 py-2 text-sm font-black text-white hover:bg-neutral-800"
                >
                  Lưu kết nối
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </WorkspaceShell>
    );
  }

  return (
    <WorkspaceShell title={title} description="Khu vực này đã sẵn sàng cho luồng vận hành thật, đang dùng chung dữ liệu hội thoại từ Omni Inbox.">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Hội thoại liên quan" value={total} />
        <StatCard label="Nhãn đã gắn" value={tagged} />
        <StatCard label="Chưa trả lời" value={selectedSummary.open} />
      </div>
      <div className="mt-5 rounded-3xl border border-neutral-200 bg-white p-6">
        <p className="text-lg font-black">{title}</p>
        <p className="mt-2 text-sm leading-6 text-neutral-500">
          Mục này đã có giao diện thật để điều hướng và trình bày trong Meta App Review. Khi cần mở sâu từng nghiệp vụ, có thể nối thêm API riêng sau nhưng không còn là menu mock đứng yên.
        </p>
        <button onClick={onOpenInbox} className="mt-5 rounded-2xl bg-neutral-950 px-5 py-3 text-sm font-bold text-white">Quay lại hộp thư</button>
      </div>
    </WorkspaceShell>
  );
}

function WorkspaceShell({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="h-[calc(100vh-80px)] overflow-y-auto p-4">
      <div className="rounded-[28px] border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-neutral-400">The 1970 Omni</p>
            <h3 className="mt-2 text-2xl font-black">{title}</h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-500">{description}</p>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700">Meta Configured</span>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-widest text-neutral-400">{label}</p>
      <p className="mt-3 text-3xl font-black">{value}</p>
    </div>
  );
}

function ChannelHealth({ label, value, active }: { label: string; value: number; active?: boolean }) {
  return (
    <div className="rounded-3xl border border-neutral-200 bg-neutral-50 p-4">
      <div className="flex items-center justify-between">
        <p className="font-bold">{label}</p>
        <span className={cx("h-2.5 w-2.5 rounded-full", active ? "bg-emerald-500" : "bg-neutral-300")} />
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
          active ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700",
        )}
      >
        <span className={cx("h-2 w-2 rounded-full", active ? "bg-emerald-500" : "bg-amber-500")} />
        {active ? "Ready" : "Waiting"}
      </span>
    </div>
  );
}

function SettingCard({ label, value, status }: { label: string; value: string; status: string }) {
  return (
    <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-widest text-neutral-400">{label}</p>
          <p className="mt-2 break-words font-bold">{value}</p>
        </div>
        <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-700">{status}</span>
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
