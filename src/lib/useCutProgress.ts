"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Remembers which boards have been cut. Lives in the page while you work and,
// once the cut list is saved, is also stored with it (so it is still there
// after a refresh or on another device).
export function useCutProgress() {
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [savedId, setSavedId] = useState<string | null>(null);
  const dirty = useRef(false);

  const setCount = useCallback((key: string, n: number) => {
    dirty.current = true;
    setProgress(p => ({ ...p, [key]: Math.max(0, n) }));
  }, []);

  // Start fresh (a newly generated list) or load a saved list's progress.
  const load = useCallback((id: string | null, initial?: Record<string, number> | null) => {
    dirty.current = false;
    setSavedId(id);
    setProgress(initial && typeof initial === "object" ? initial : {});
  }, []);

  // Once we know the saved list's id (also covers marking boards a moment
  // before the save finished), keep the saved copy up to date.
  useEffect(() => {
    if (!savedId || !dirty.current) return;
    const t = setTimeout(() => {
      dirty.current = false;
      fetch(`/api/cutlist/saved/${savedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cutProgress: progress })
      }).catch(() => { dirty.current = true; });
    }, 400);
    return () => clearTimeout(t);
  }, [progress, savedId]);

  // The list was just saved: remember its id but keep whatever is marked.
  const attach = useCallback((id: string) => setSavedId(id), []);

  return { progress, setCount, load, attach, savedId };
}
