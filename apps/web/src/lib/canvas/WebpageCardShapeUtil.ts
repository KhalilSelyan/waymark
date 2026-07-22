import React from "react";
import { BaseBoxShapeUtil, Rectangle2d, type TLShape } from "tldraw";

export type WebpageCardShape = TLShape & { type: "webpage-card"; props: { w: number; h: number; title: string; url: string; screenshotUrl: string } };

function displayUrl(value: string) {
  try {
    const parsed = new URL(value);
    const path = parsed.pathname === "/" ? "" : parsed.pathname;
    const compactPath = path.length > 28 ? `${path.slice(0, 27)}…` : path;
    return `${parsed.hostname}${compactPath}`;
  } catch {
    return value.length > 36 ? `${value.slice(0, 35)}…` : value;
  }
}

export class WebpageCardShapeUtil extends BaseBoxShapeUtil<any> {
  static override type = "webpage-card" as const;
  override getDefaultProps() { return { w: 720, h: 560, title: "Captured webpage", url: "", screenshotUrl: "" }; }
  override getGeometry(shape: any) { return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true }); }
  override getIndicatorPath() { return undefined; }
  override component(shape: any) {
    const { title, url, screenshotUrl } = shape.props;
    const styles = { card: { pointerEvents: "all", width: "100%", height: "100%", overflow: "hidden", border: "1px solid #d8d1c5", borderRadius: 18, background: "#fffdf8", boxShadow: "0 12px 28px rgba(47,43,35,.14)", color: "#302d27", fontFamily: "Georgia,serif" }, image: { width: "100%", height: "100%", objectFit: "cover", objectPosition: "top", pointerEvents: "none" }, body: { padding: "19px 21px 17px" }, eyebrow: { marginBottom: 8, color: "#a05a32", fontFamily: "ui-monospace,monospace", fontSize: 10, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase" }, title: { margin: "0 0 8px", overflow: "hidden", fontSize: 23, lineHeight: 1.08, textOverflow: "ellipsis", whiteSpace: "nowrap" }, url: { margin: "0 0 17px", overflow: "hidden", color: "#847d70", fontFamily: "ui-monospace,monospace", fontSize: 11, textOverflow: "ellipsis", whiteSpace: "nowrap" }, button: { cursor: "pointer", border: 0, borderRadius: 999, background: "#302d27", color: "#fffdf8", padding: "9px 15px", fontFamily: "ui-monospace,monospace", fontSize: 11, fontWeight: 700 } } as const;
    return React.createElement("article", { style: styles.card, onPointerDown: (event: React.PointerEvent) => { if ((event.target as HTMLElement).closest("a,button")) event.stopPropagation(); } }, React.createElement("div", { style: { height: "calc(100% - 150px)", minHeight: 300, overflow: "hidden", background: "#e9e3d8" } }, React.createElement("img", { src: screenshotUrl, alt: `Screenshot of ${title}`, style: styles.image })), React.createElement("div", { style: styles.body }, React.createElement("div", { style: styles.eyebrow }, "Waymark capture"), React.createElement("h2", { style: styles.title }, title || "Captured webpage"), React.createElement("a", { href: url, target: "_blank", rel: "noreferrer", title: url, style: styles.url, onClick: (event: React.MouseEvent) => event.stopPropagation() }, displayUrl(url)), React.createElement("button", { type: "button", onPointerDown: (event: React.PointerEvent) => event.stopPropagation(), onClick: (event: React.MouseEvent) => { event.stopPropagation(); window.open(url, "_blank", "noopener,noreferrer"); }, style: styles.button }, "Open source ↗")));
  }
}
