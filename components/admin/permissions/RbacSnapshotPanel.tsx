"use client";

import { useEffect, useState } from "react";
import { apiJson } from "@/lib/api";

type Snapshot = {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string;
  createdByName?: string | null;
  restoredAt?: string | null;
  restoredByName?: string | null;
};

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("vi-VN");
}

export default function RbacSnapshotPanel() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const loadSnapshots = async () => {
    try {
      setLoading(true);
      const data = await apiJson<Snapshot[]>("/rbac-snapshots", { method: "GET" });
      setSnapshots(Array.isArray(data) ? data : []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không tải được snapshot phân quyền.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSnapshots();
  }, []);

  const createSnapshot = async () => {
    const confirmed = window.confirm(
      "Đóng băng toàn bộ cấu hình phân quyền hiện tại trên database production?\n\nSau này có thể rollback về bản này.",
    );
    if (!confirmed) return;

    try {
      setCreating(true);
      setMessage("");
      await apiJson("/rbac-snapshots", {
        method: "POST",
        body: JSON.stringify({
          name: `operation-rbac-freeze-${new Date().toISOString().slice(0, 10)}`,
          description: "Snapshot phân quyền operation.the1970 hiện tại",
        }),
      });
      setMessage("Đã đóng băng cấu hình phân quyền hiện tại.");
      await loadSnapshots();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không tạo được snapshot.");
    } finally {
      setCreating(false);
    }
  };

  const restoreSnapshot = async (snapshot: Snapshot) => {
    const confirmed = window.confirm(
      `Rollback toàn bộ phân quyền về bản "${snapshot.name}"?\n\nTất cả role, quyền theo chi nhánh, phòng ban sẽ quay lại đúng thời điểm đóng băng. Tất cả nhân viên sẽ bị đăng xuất để nhận quyền mới.`,
    );
    if (!confirmed) return;

    try {
      setRestoringId(snapshot.id);
      setMessage("");
      await apiJson(`/rbac-snapshots/${snapshot.id}/restore`, { method: "POST" });
      setMessage("Đã rollback phân quyền. Nhân viên cần đăng nhập lại.");
      await loadSnapshots();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không rollback được snapshot.");
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <div className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-neutral-400">RBAC Freeze</p>
          <h3 className="mt-2 text-lg font-bold text-neutral-950">Đóng băng / rollback phân quyền</h3>
          <p className="mt-1 max-w-2xl text-sm text-neutral-500">
            Chốt cấu hình quyền đang chạy trên operation.the1970. Nếu local thao tác nhầm vào DB production, có thể rollback về bản đã đóng băng.
          </p>
        </div>
        <button
          type="button"
          onClick={createSnapshot}
          disabled={creating}
          className="rounded-2xl bg-neutral-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {creating ? "Đang đóng băng..." : "Đóng băng cấu hình hiện tại"}
        </button>
      </div>

      {message ? <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{message}</div> : null}

      <div className="mt-5 overflow-hidden rounded-2xl border border-neutral-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-[0.18em] text-neutral-500">
            <tr>
              <th className="px-4 py-3">Tên snapshot</th>
              <th className="px-4 py-3">Ngày tạo</th>
              <th className="px-4 py-3">Người tạo</th>
              <th className="px-4 py-3">Rollback gần nhất</th>
              <th className="px-4 py-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-neutral-500">Đang tải snapshot...</td></tr>
            ) : snapshots.length ? (
              snapshots.map((snapshot) => (
                <tr key={snapshot.id}>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-neutral-900">{snapshot.name}</div>
                    {snapshot.description ? <div className="mt-1 text-xs text-neutral-500">{snapshot.description}</div> : null}
                  </td>
                  <td className="px-4 py-3 text-neutral-600">{formatDateTime(snapshot.createdAt)}</td>
                  <td className="px-4 py-3 text-neutral-600">{snapshot.createdByName || "—"}</td>
                  <td className="px-4 py-3 text-neutral-600">
                    {snapshot.restoredAt ? `${formatDateTime(snapshot.restoredAt)} · ${snapshot.restoredByName || ""}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => restoreSnapshot(snapshot)}
                      disabled={restoringId === snapshot.id}
                      className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                    >
                      {restoringId === snapshot.id ? "Đang rollback..." : "Rollback về bản này"}
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-neutral-500">Chưa có bản đóng băng nào.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
