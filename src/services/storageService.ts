import { framer } from "framer-plugin";

/**
 * StorageService
 * Manages persisting plugin data within Framer's project metadata via getPluginData/setPluginData,
 * with seamless fallback to localStorage when running in standalone browser preview.
 */
class StorageService {
  private isFramerRuntime(): boolean {
    return (
      typeof framer !== "undefined" &&
      typeof framer.getPluginData === "function" &&
      typeof framer.setPluginData === "function"
    );
  }

  async getItem<T>(key: string, defaultValue: T): Promise<T> {
    try {
      if (this.isFramerRuntime()) {
        const raw = await framer.getPluginData(key);
        if (!raw) return defaultValue;
        return JSON.parse(raw) as T;
      }
    } catch (err) {
      console.warn(`[MemberFrame Storage] Framer getPluginData failed for "${key}", falling back to localStorage:`, err);
    }

    // LocalStorage fallback
    try {
      const stored = localStorage.getItem(`memberframe_${key}`);
      if (stored) {
        return JSON.parse(stored) as T;
      }
    } catch (err) {
      console.error(`[MemberFrame Storage] Error reading localStorage for "${key}":`, err);
    }

    return defaultValue;
  }

  async setItem<T>(key: string, value: T): Promise<void> {
    const serialized = JSON.stringify(value);

    // Guardrail against excessive storage payload
    if (serialized.length > 250000) {
      console.warn(`[MemberFrame Storage] Payload for "${key}" is ${serialized.length} bytes, exceeding recommended thresholds.`);
    }

    try {
      if (this.isFramerRuntime()) {
        await framer.setPluginData(key, serialized);
        return;
      }
    } catch (err) {
      console.warn(`[MemberFrame Storage] Framer setPluginData failed for "${key}", saving to localStorage:`, err);
    }

    try {
      localStorage.setItem(`memberframe_${key}`, serialized);
    } catch (err) {
      console.error(`[MemberFrame Storage] Error writing localStorage for "${key}":`, err);
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      if (this.isFramerRuntime()) {
        await framer.setPluginData(key, "");
      }
    } catch {
      // Ignore
    }
    try {
      localStorage.removeItem(`memberframe_${key}`);
    } catch {
      // Ignore
    }
  }
}

export const storageService = new StorageService();
