import { useState, useEffect, useCallback } from "react";
import { storageService } from "../services/storageService";

export function usePluginStorage<T>(
  key: string,
  initialValue: T
): [T, (val: T | ((prev: T) => T)) => Promise<void>, boolean] {
  const [data, setData] = useState<T>(initialValue);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        const val = await storageService.getItem<T>(key, initialValue);
        if (isMounted) {
          setData(val);
          setLoading(false);
        }
      } catch {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [key, initialValue]);

  const updateData = useCallback(
    async (updater: T | ((prev: T) => T)) => {
      setData((prev) => {
        const nextVal = typeof updater === "function" ? (updater as (prev: T) => T)(prev) : updater;
        storageService.setItem(key, nextVal).catch((err) => {
          console.error(`[usePluginStorage] Failed to persist key "${key}":`, err);
        });
        return nextVal;
      });
    },
    [key]
  );

  return [data, updateData, loading];
}
