export default function ForbiddenPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-6">
      <div className="max-w-md rounded-[28px] border border-neutral-200 bg-white p-6 text-center shadow-sm">
        <p className="text-xs font-medium uppercase tracking-[0.28em] text-neutral-400">403</p>
        <h1 className="mt-3 text-2xl font-semibold text-neutral-950">Không có quyền truy cập</h1>
        <p className="mt-2 text-sm leading-6 text-neutral-500">
          Tài khoản này chưa được cấp quyền vào màn hình này. Vui lòng liên hệ quản trị viên.
        </p>
      </div>
    </div>
  );
}
