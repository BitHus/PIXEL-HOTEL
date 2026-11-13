// Where saves are kept (brief section 2: one small storage interface, so the place can change
// later, e.g. a file in the Windows app). The browser uses localStorage.

export interface SaveStorage {
  get(key: string): string | null;
  /** Returns false if the value could not be written (storage full or blocked). */
  set(key: string, value: string): boolean;
  remove(key: string): void;
}

/** localStorage, with every access guarded (private windows and blocked storage throw). */
export function browserStorage(): SaveStorage {
  return {
    get(key) {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    set(key, value) {
      try {
        window.localStorage.setItem(key, value);
        return true;
      } catch {
        return false;
      }
    },
    remove(key) {
      try {
        window.localStorage.removeItem(key);
      } catch {
        // Nothing to do: the storage is not available.
      }
    },
  };
}

/** In-memory storage (tests). */
export function memoryStorage(initial: Record<string, string> = {}): SaveStorage & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    get: (key) => data.get(key) ?? null,
    set: (key, value) => {
      data.set(key, value);
      return true;
    },
    remove: (key) => void data.delete(key),
  };
}
