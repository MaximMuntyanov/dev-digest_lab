import type { IconName } from "@devdigest/ui";

export interface EditorTab {
  key: string;
  labelKey: string;
  icon: IconName;
}

export const TABS: readonly EditorTab[] = [
  { key: "config", labelKey: "editor.tabs.config", icon: "Settings" },
  { key: "evals", labelKey: "editor.tabs.evals", icon: "Gauge" },
];

export const TYPE_OPTIONS = [
  { value: "rubric", label: "Rubric" },
  { value: "convention", label: "Convention" },
  { value: "security", label: "Security" },
  { value: "custom", label: "Custom" },
];
