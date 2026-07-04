import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import "./theme.css";

/** Render a widget into #root. */
export function mount(node: ReactNode) {
  const el = document.getElementById("root");
  if (!el) throw new Error("#root not found");
  createRoot(el).render(<StrictMode>{node}</StrictMode>);
}
