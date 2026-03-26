"use client";

import { useState } from "react";

export default function AIContentPage() {
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState("");

  const generate = async () => {
    // fake AI (sau nối OpenAI API)
    setResult(`🔥 Content generated for: "${prompt}" 

- Hook mạnh
- Call to action rõ
- Chuẩn vibe The 1970

👉 “Vintage American mood – now redefined.”`);
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">AI Content</h1>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Nhập ý tưởng content..."
        className="w-full p-4 border rounded-xl"
        rows={4}
      />

      <button
        onClick={generate}
        className="px-4 py-2 bg-black text-white rounded-xl"
      >
        Generate
      </button>

      {result && (
        <div className="p-4 border rounded-xl bg-white whitespace-pre-line">
          {result}
        </div>
      )}
    </div>
  );
}