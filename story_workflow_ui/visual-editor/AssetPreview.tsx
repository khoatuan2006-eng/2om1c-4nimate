import React from "react";
export function AssetPreview({ selection, label }: any) {
  const parts = selection.items,
    bounds = parts.map((p: any) => p.bbox),
    left = Math.min(...bounds.map((b: any) => b[0])),
    top = Math.min(...bounds.map((b: any) => b[1])),
    width = Math.max(...bounds.map((b: any) => b[2])) - left,
    height = Math.max(...bounds.map((b: any) => b[3])) - top;
  return (
    <div className="asset-composite" role="img" aria-label={label}>
      <div
        style={{
          position: "relative",
          width: (Math.max(1, width) / Math.max(1, height)) * 160,
          maxWidth: "100%",
          aspectRatio: `${Math.max(1, width)}/${Math.max(1, height)}`,
          '--asset-aspect': Math.max(1, width) / Math.max(1, height),
        } as React.CSSProperties}
      >
        {parts.map((p: any, i: number) => (
          <img
            key={p.id + i}
            draggable={false}
            loading="eager"
            src={p.url}
            alt=""
            style={{
              position: "absolute",
              left: ((p.bbox[0] - left) / width) * 100 + "%",
              top: ((p.bbox[1] - top) / height) * 100 + "%",
              width: (p.width / width) * 100 + "%",
              height: (p.height / height) * 100 + "%",
            }}
          />
        ))}
      </div>
    </div>
  );
}
