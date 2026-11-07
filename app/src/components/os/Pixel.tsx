import type { Grid } from "@/lib/pixels";

// 把网格画成 SVG:同一行相邻同色的格子合并成一个 rect,减少节点数量
function runs(grid: Grid) {
  const out: { x: number; y: number; w: number; c: string }[] = [];
  grid.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const c = row[x];
      if (!c) {
        x++;
        continue;
      }
      let w = 1;
      while (row[x + w] === c) w++;
      out.push({ x, y, w, c });
      x += w;
    }
  });
  return out;
}

export function PixelGrid({ grid, className }: { grid: Grid; className?: string }) {
  return (
    <g className={className}>
      {runs(grid).map((r) => (
        <rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width={r.w} height={1} fill={r.c} />
      ))}
    </g>
  );
}

export function Pixel({
  grid,
  size,
  className,
  label,
}: {
  grid: Grid;
  size: number;
  className?: string;
  label?: string;
}) {
  return (
    <svg
      viewBox={`0 0 ${grid.length} ${grid.length}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className={className}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <PixelGrid grid={grid} />
    </svg>
  );
}
