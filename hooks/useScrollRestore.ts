"use client";

import { useEffect } from "react";

export function useScrollRestore(key: string) {
  useEffect(() => {
    const storageKey = `scroll:${key}`;
    const saved = sessionStorage.getItem(storageKey);

    if (saved) {
      requestAnimationFrame(() => {
        window.scrollTo(0, Number(saved));
      });
    }

    const save = () => {
      sessionStorage.setItem(storageKey, String(window.scrollY));
    };

    window.addEventListener("beforeunload", save);
    window.addEventListener("pagehide", save);

    return () => {
      save();
      window.removeEventListener("beforeunload", save);
      window.removeEventListener("pagehide", save);
    };
  }, [key]);
}
