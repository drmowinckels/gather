import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { setTimeFormat } from "../lib/datetime";

// Pin time display to 24h so slot-time assertions ("09:00") are deterministic
// regardless of the jsdom locale's default clock. The real app defaults to
// "auto" (locale-driven); format-specific behaviour is covered in datetime.test.
setTimeFormat("24h");

// This jsdom build doesn't expose the Web Storage API; provide a minimal
// in-memory implementation so storage-backed code is exercised in tests.
class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length(): number {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
}

if (typeof globalThis.localStorage === "undefined") {
  Object.defineProperty(globalThis, "localStorage", {
    value: new MemoryStorage(),
    configurable: true,
  });
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});
