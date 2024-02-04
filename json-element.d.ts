export type Patch =
  | { op: "add" | "replace"; path: string; value: unknown }
  | { op: "remove"; path: string };

export interface Change {
  op: "add" | "replace" | "remove";
  path: string;
  value: unknown;
  target: HTMLElement;
}

export type JsonChangeEvent = CustomEvent<{ changes: Change[] }>;
