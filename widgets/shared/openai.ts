import { useEffect, useState } from "react";

/** Subset of the ChatGPT Apps SDK host API exposed on `window.openai`. */
export interface OpenAiHost {
  toolInput?: unknown;
  toolOutput?: unknown;
  widgetState?: unknown;
  theme?: "light" | "dark";
  displayMode?: "inline" | "pip" | "fullscreen";
  locale?: string;
  maxHeight?: number;
  setWidgetState?: (state: unknown) => void | Promise<void>;
  callTool?: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  sendFollowUpMessage?: (arg: { prompt: string }) => void | Promise<void>;
  requestDisplayMode?: (arg: { mode: string }) => void | Promise<unknown>;
  openExternal?: (arg: { href: string }) => void;
}

declare global {
  interface Window {
    openai?: OpenAiHost;
  }
}

const host = (): OpenAiHost => (typeof window !== "undefined" && window.openai) || {};

/** Re-render whenever the host pushes new globals (`openai:set_globals`). */
function useHostTick(): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    const events = ["openai:set_globals", "openai:tool_response"];
    events.forEach((e) => window.addEventListener(e, bump as EventListener));
    return () => events.forEach((e) => window.removeEventListener(e, bump as EventListener));
  }, []);
  return tick;
}

/** The current tool's `structuredContent`. */
export function useToolOutput<T>(): T | undefined {
  useHostTick();
  return host().toolOutput as T | undefined;
}

export function useTheme(): "light" | "dark" {
  useHostTick();
  return host().theme === "light" ? "light" : "dark";
}

/** Widget-scoped persistent state, backed by the host when available. */
export function useWidgetState<T>(initial: T): [T, (next: T) => void] {
  useHostTick();
  const existing = host().widgetState as T | undefined;
  const [local, setLocal] = useState<T>(existing ?? initial);
  const set = (next: T) => {
    setLocal(next);
    host().setWidgetState?.(next);
  };
  return [existing ?? local, set];
}

export function callTool(name: string, args: Record<string, unknown> = {}) {
  return host().callTool?.(name, args);
}

export function sendFollowUp(prompt: string) {
  return host().sendFollowUpMessage?.({ prompt });
}

export function openExternal(href: string) {
  if (host().openExternal) host().openExternal!({ href });
  else if (typeof window !== "undefined") window.open(href, "_blank");
}
