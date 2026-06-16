// app/mobile/layout.tsx

export default function MobileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mobile-app-shell min-h-[100dvh] bg-neutral-100 text-neutral-950">
      <div className="mobile-app-scroll min-h-[100dvh] overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">
        <div className="min-h-[100dvh] pb-[calc(112px+env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </div>
  );
}
