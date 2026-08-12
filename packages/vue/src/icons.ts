import { h, type VNode } from "vue";

export type ChatGateIconName =
  | "attach"
  | "back"
  | "chat"
  | "file"
  | "image"
  | "microphone"
  | "more"
  | "send"
  | "stop";

const strokeProps = {
  fill: "none",
  stroke: "currentColor",
  "stroke-width": "1.8",
  "stroke-linecap": "round",
  "stroke-linejoin": "round",
} as const;

function paths(name: ChatGateIconName): VNode[] {
  switch (name) {
    case "attach":
      return [h("path", { d: "M20.5 11.5 12 20a6 6 0 0 1-8.5-8.5l9-9a4 4 0 0 1 5.7 5.7l-9 9a2 2 0 0 1-2.9-2.8l8.3-8.3" })];
    case "back":
      return [h("path", { d: "m15 18-6-6 6-6" }), h("path", { d: "M9 12h10" })];
    case "chat":
      return [
        h("path", { d: "M20 15a3 3 0 0 1-3 3H9l-5 3V7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3Z" }),
        h("path", { d: "M8 9h8M8 13h5" }),
      ];
    case "file":
      return [
        h("path", { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" }),
        h("path", { d: "M14 2v6h6M8 13h8M8 17h5" }),
      ];
    case "image":
      return [
        h("rect", { x: "3", y: "3", width: "18", height: "18", rx: "3" }),
        h("circle", { cx: "9", cy: "9", r: "1.6" }),
        h("path", { d: "m21 15-4.2-4.2a1.5 1.5 0 0 0-2.1 0L6 19.5" }),
      ];
    case "microphone":
      return [
        h("rect", { x: "9", y: "2", width: "6", height: "12", rx: "3" }),
        h("path", { d: "M5 10v1a7 7 0 0 0 14 0v-1M12 18v4M8 22h8" }),
      ];
    case "more":
      return [
        h("circle", { cx: "5", cy: "12", r: "1", fill: "currentColor", stroke: "none" }),
        h("circle", { cx: "12", cy: "12", r: "1", fill: "currentColor", stroke: "none" }),
        h("circle", { cx: "19", cy: "12", r: "1", fill: "currentColor", stroke: "none" }),
      ];
    case "send":
      return [h("path", { d: "m22 2-7 20-4-9-9-4Z" }), h("path", { d: "M22 2 11 13" })];
    case "stop":
      return [h("rect", { x: "7", y: "7", width: "10", height: "10", rx: "2", fill: "currentColor", stroke: "none" })];
  }
}

export function icon(name: ChatGateIconName, size = 18): VNode {
  return h(
    "svg",
    {
      "aria-hidden": "true",
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      ...strokeProps,
    },
    paths(name),
  );
}
