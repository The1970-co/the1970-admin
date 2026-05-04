"use client";

import { API_BASE } from "@/lib/api-base";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type BranchNotification = {
  id: string;
  branchId: string;
  branchName?: string | null;
  title: string;
  message: string;
  transferId?: string | null;
  transferCode?: string | null;
  isRead: boolean;
  createdAt: string;
};

function normalizeKey(value: any) {
  return String(value || "").trim();
}

function notificationKey(item: BranchNotification) {
  const transferCode = normalizeKey(item.transferCode);
  if (transferCode) return `transfer:${transferCode}`;
  return `id:${normalizeKey(item.id)}`;
}

function getDismissedKey(branchId: string) {
  return `branch-transfer-dismissed-hard-v17:${branchId}`;
}

function readDismissed(branchId: string) {
  if (typeof window === "undefined") return new Set<string>();
  try {
    const raw = localStorage.getItem(getDismissedKey(branchId));
    const arr = raw ? JSON.parse(raw) : [];
    return new Set<string>(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set<string>();
  }
}

function writeDismissed(branchId: string, values: Set<string>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    getDismissedKey(branchId),
    JSON.stringify(Array.from(values).slice(-500))
  );
}

function playNotificationSound() {
  if (typeof window === "undefined") return;

  try {
    const audio = new Audio("/notification.mp3");
    audio.volume = 0.45;
    void audio.play().catch(() => {});
  } catch {}
}

export default function BranchTransferNotifications() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [items, setItems] = useState<BranchNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const bootedRef = useRef(false);
  const knownKeysRef = useRef<Set<string>>(new Set());

  const branchId = useMemo(() => {
    return normalizeKey(
      currentUser?.branchId ||
        currentUser?.branch?.id ||
        currentUser?.branches?.[0]?.id ||
        currentUser?.assignedBranches?.[0]?.id
    );
  }, [currentUser]);

  const loadCurrentUser = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const res = await fetch(`${API_BASE}/auth/me`, {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) return;

      const data = await res.json();
      setCurrentUser(data?.user || data);
    } catch {}
  }, []);

  const loadNotifications = useCallback(
    async (silent = false) => {
      if (!branchId) return;

      try {
        const token = localStorage.getItem("token");
        const res = await fetch(
          `${API_BASE}/branch-notifications?branchId=${encodeURIComponent(
            branchId
          )}&unreadOnly=true`,
          {
            cache: "no-store",
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          }
        );

        if (!res.ok) return;

        const data = await res.json();
        const raw: BranchNotification[] = Array.isArray(data) ? data : [];
        const dismissed = readDismissed(branchId);

        const uniqueMap = new Map<string, BranchNotification>();

        for (const n of raw) {
          const key = notificationKey(n);
          if (!key || dismissed.has(key)) continue;
          if (!uniqueMap.has(key)) uniqueMap.set(key, n);
        }

        const unique = Array.from(uniqueMap.values()).slice(0, 3);
        const visibleKeys = unique.map(notificationKey);
        const hasNew = visibleKeys.some((key) => !knownKeysRef.current.has(key));

        setItems(unique);
        setUnreadCount(unique.length);

        for (const key of visibleKeys) knownKeysRef.current.add(key);

        if (!silent && bootedRef.current && hasNew && unique.length > 0) {
          playNotificationSound();
        }

        if (!bootedRef.current) bootedRef.current = true;
      } catch {}
    },
    [branchId]
  );

  useEffect(() => {
    void loadCurrentUser();
  }, [loadCurrentUser]);

  useEffect(() => {
    if (!branchId) return;

    void loadNotifications(true);

    const timer = window.setInterval(() => {
      void loadNotifications(false);
    }, 10000);

    return () => window.clearInterval(timer);
  }, [branchId, loadNotifications]);

  async function dismiss(item: BranchNotification) {
    if (!branchId) return;

    const key = notificationKey(item);
    const transferCode = normalizeKey(item.transferCode);
    const dismissed = readDismissed(branchId);
    dismissed.add(key);
    writeDismissed(branchId, dismissed);

    setItems((prev) => prev.filter((n) => notificationKey(n) !== key));
    setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      const token = localStorage.getItem("token");
      const payload = {
        notificationId: item.id,
        branchId: item.branchId || branchId,
        transferCode: transferCode || undefined,
      };

      const res = await fetch(`${API_BASE}/branch-notifications/mark-read`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const result = await res.json().catch(() => null);
      console.log("branch notification mark-read result:", result);
    } catch {}

    window.setTimeout(() => {
      void loadNotifications(true);
    }, 300);
  }

  function openTransfer(item: BranchNotification) {
    if (typeof window === "undefined") return;
    const url = item.transferId
      ? `/control/stock-transfers?transferId=${encodeURIComponent(item.transferId)}`
      : "/control/stock-transfers";
    window.open(url, "_blank", "noopener,noreferrer");
  }

  if (!branchId || items.length === 0) return null;

  return (
    <>
      <div className="fixed right-5 top-24 z-[70] w-[360px] max-w-[calc(100vw-24px)] space-y-3">
        {items.map((item) => (
          <div
            key={notificationKey(item)}
            className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-xl ring-1 ring-black/5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-neutral-900">{item.title}</p>
                <p className="mt-1 text-xs text-neutral-500">
                  {item.transferCode || ""} · {item.branchName || item.branchId}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void dismiss(item)}
                className="rounded-full px-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                aria-label="Ẩn thông báo"
              >
                ×
              </button>
            </div>

            <p className="mt-3 text-sm leading-6 text-neutral-600">{item.message}</p>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => openTransfer(item)}
                className="rounded-xl bg-neutral-900 px-3 py-2 text-xs font-medium text-white hover:bg-neutral-800"
              >
                Xem phiếu
              </button>
              <button
                type="button"
                onClick={() => void dismiss(item)}
                className="rounded-xl border border-neutral-300 px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="fixed right-5 top-20 z-[69] pointer-events-none">
        <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700 shadow-sm">
          🔔 {unreadCount} thông báo kho
        </span>
      </div>
    </>
  );
}
