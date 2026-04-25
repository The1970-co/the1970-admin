"use client";

export default function AIContentPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">AI Content</h1>

      <div className="rounded-2xl border bg-white p-4">
        <h2 className="mb-2 font-medium">Content Generator</h2>
        <p className="text-sm text-neutral-600">
          Khối này để generate caption, hook, angle và concept ảnh cho ads.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-sm text-neutral-500">Top Product Angle</div>
          <div className="mt-2 font-semibold">Vintage / Heritage / Utility</div>
        </div>

        <div className="rounded-2xl border bg-white p-4">
          <div className="text-sm text-neutral-500">Suggested Hook</div>
          <div className="mt-2 font-semibold">Old-money American mood</div>
        </div>
      </div>
    </div>
  );
}