// 像素画引擎:所有图形都在这里自己绘制。网格里的每一格是一个颜色或空。
export type Grid = (string | null)[][];

export const INK = "#1F1D1A";
export const PAPER = "#FBF7F1";
export const TOMATO = "#FF6B3D";
const TOMATO_DARK = "#D9532A";
const TOMATO_LIGHT = "#FF9470";
export const SAFE = "#2BB673";
export const SUN = "#FFC93C";
const SUN_DARK = "#C99A1E";
export const RED = "#E5484D";
export const LINE = "#E8E1D6";
export const GRAY = "#8A847A";

export const makeGrid = (n: number): Grid => Array.from({ length: n }, () => Array<string | null>(n).fill(null));

// 下面的坐标都按 32 格计算,n 变大时自动画得更细
function painter(grid: Grid) {
  const n = grid.length;
  const u = n / 32;
  const set = (x: number, y: number, c: string | null) => {
    if (x >= 0 && y >= 0 && x < n && y < n) grid[y][x] = c;
  };
  return {
    u,
    rect(x: number, y: number, w: number, h: number, c: string | null) {
      for (let yy = Math.round(y * u); yy < Math.round((y + h) * u); yy++)
        for (let xx = Math.round(x * u); xx < Math.round((x + w) * u); xx++) set(xx, yy, c);
    },
    ell(cx: number, cy: number, rx: number, ry: number, c: string | null) {
      for (let yy = 0; yy < n; yy++)
        for (let xx = 0; xx < n; xx++) {
          const dx = (xx + 0.5) / u - cx;
          const dy = (yy + 0.5) / u - cy;
          if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1) set(xx, yy, c);
        }
    },
    // 只在已有颜色 from 的格子上涂色,用来画明暗
    shade(from: string, test: (x: number, y: number) => boolean, c: string) {
      for (let yy = 0; yy < n; yy++)
        for (let xx = 0; xx < n; xx++) if (grid[yy][xx] === from && test((xx + 0.5) / u, (yy + 0.5) / u)) grid[yy][xx] = c;
    },
  };
}

// 给所有已填充的形状加一圈深色描边
export function outline(grid: Grid, c = INK): Grid {
  const n = grid.length;
  const out = grid.map((row) => [...row]);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      if (grid[y][x]) continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => grid[y + dy]?.[x + dx])) out[y][x] = c;
    }
  return out;
}

export type LockieMood = "guarding" | "waiting" | "celebrating" | "paying" | "refunding" | "sleeping";

function coin(p: ReturnType<typeof painter>, cx: number, cy: number, r: number) {
  p.ell(cx, cy, r, r, SUN_DARK);
  p.ell(cx - 0.3, cy - 0.3, r - 0.8, r - 0.8, SUN);
}

// 画一帧 Lockie。frame 0 和 1 组成两帧逐帧动画
export function drawLockie(mood: LockieMood, n: 32 | 64, frame: 0 | 1): Grid {
  const grid = makeGrid(n);
  const p = painter(grid);
  const hop = mood === "celebrating" && frame === 1 ? -2 : 0;
  const by = 18 + hop;

  // 脚和手臂先画,身体盖在上面
  p.rect(9, 26 + hop, 5, 3, TOMATO_DARK);
  p.rect(18, 26 + hop, 5, 3, TOMATO_DARK);
  if (mood === "celebrating") {
    p.rect(3, 10 + hop, 3, 7, TOMATO_DARK);
    p.rect(26, 10 + hop, 3, 7, TOMATO_DARK);
  } else if (mood === "paying") {
    p.rect(3, 16, 3, 6, TOMATO_DARK);
    p.rect(26, 15, 3, 3, TOMATO_DARK);
  } else if (mood === "refunding") {
    p.rect(26, 16, 3, 6, TOMATO_DARK);
    p.rect(3, 15, 3, 3, TOMATO_DARK);
  } else if (mood !== "guarding") {
    p.rect(3, 16, 3, 6, TOMATO_DARK);
    p.rect(26, 16, 3, 6, TOMATO_DARK);
  }

  // 身体:同色系明暗做体积
  p.ell(16, by, 11.5, 10.5, TOMATO);
  p.shade(TOMATO, (_, y) => y > by + 7, TOMATO_DARK);
  p.ell(11, by - 7, 3.2, 1.6, TOMATO_LIGHT);

  // 肚子和投币口
  p.ell(16, by + 4, 7, 4.4, TOMATO_LIGHT);
  p.rect(12, by + 2.5, 8, 2, INK);

  const eyeY = by - 6;
  const openEyes = (lookX = 0, lookY = 0) => {
    for (const x of [10, 19]) {
      p.rect(x, eyeY, 4, 5, PAPER);
      p.rect(x + 1 + lookX, eyeY + 1 + lookY, 2, 3, INK);
    }
  };
  const closedEyes = () => {
    for (const x of [10, 19]) p.rect(x, eyeY + 2, 4, 1, INK);
  };
  const mouthSmile = () => {
    p.rect(14, by - 0.5, 1, 1, INK);
    p.rect(17, by - 0.5, 1, 1, INK);
    p.rect(15, by + 0.5, 2, 1, INK);
  };

  switch (mood) {
    case "guarding":
      frame === 1 ? closedEyes() : openEyes();
      mouthSmile();
      coin(p, 16, by + 7, 3.6);
      p.rect(7, by + 4, 5, 3, TOMATO_DARK);
      p.rect(20, by + 4, 5, 3, TOMATO_DARK);
      break;
    case "waiting":
      openEyes(0, -1);
      p.rect(15, by - 0.5, 2, 2, INK);
      coin(p, 16, frame === 1 ? 4 : 3.2, 2.6);
      break;
    case "celebrating":
      for (const x of [10, 19]) {
        p.rect(x, eyeY + 1, 1, 1, INK);
        p.rect(x + 1, eyeY, 2, 1, INK);
        p.rect(x + 3, eyeY + 1, 1, 1, INK);
      }
      p.rect(14, by - 1, 4, 2, INK);
      p.rect(15, by, 2, 1, TOMATO_LIGHT);
      coin(p, 5, frame === 1 ? 5 : 7, 2.2);
      coin(p, 27, frame === 1 ? 7 : 5, 2.2);
      break;
    case "paying":
      openEyes(1, 0);
      mouthSmile();
      coin(p, frame === 1 ? 29 : 28.4, 13, 2.8);
      break;
    case "refunding":
      openEyes(0, 1);
      p.rect(10, eyeY - 2, 3, 1, INK);
      p.rect(9, eyeY - 1, 1, 1, INK);
      p.rect(19, eyeY - 2, 3, 1, INK);
      p.rect(22, eyeY - 1, 1, 1, INK);
      p.rect(15, by, 2, 1, INK);
      p.rect(14, by + 1, 1, 1, INK);
      p.rect(17, by + 1, 1, 1, INK);
      p.rect(9, eyeY + (frame === 1 ? 7 : 5), 1, 2, PAPER);
      coin(p, frame === 1 ? 3 : 3.6, 13, 2.8);
      break;
    case "sleeping":
      closedEyes();
      p.rect(15, by, 2, 1, INK);
      break;
  }
  const done = outline(grid);
  if (mood === "sleeping") {
    // 像素 z,放在描边之后,不被描边
    const z = (x: number, y: number) => {
      const q = painter(done);
      q.rect(x, y, 3, 1, INK);
      q.rect(x + 1, y + 1, 1, 1, INK);
      q.rect(x, y + 2, 3, 1, INK);
    };
    z(frame === 1 ? 25 : 24, 2);
    if (frame === 1) z(21, 5);
  }
  return done;
}

// 12x12 的小团子:空位灰色闭眼,已参与彩色睁眼
export const SEAT_VARIANTS = 9;
const SEAT_COLORS = [TOMATO, SAFE, SUN];

export function drawSeat(variant: number | null): Grid {
  const grid = makeGrid(12);
  const fill = variant === null ? LINE : SEAT_COLORS[variant % 3];
  for (let y = 1; y < 11; y++)
    for (let x = 1; x < 11; x++) {
      const dx = (x + 0.5 - 6) / 5;
      const dy = (y + 0.5 - 6.2) / 4.9;
      if (dx * dx + dy * dy <= 1) grid[y][x] = fill;
    }
  const done = outline(grid);
  if (variant === null) {
    done[6][3] = done[6][4] = done[6][7] = done[6][8] = GRAY;
    return done;
  }
  done[5][4] = done[6][4] = done[5][7] = done[6][7] = INK;
  const face = Math.floor(variant / 3) % 3;
  if (face === 0) {
    done[8][5] = done[8][6] = INK;
  } else if (face === 1) {
    done[8][4] = done[8][7] = INK;
    done[9][5] = done[9][6] = INK;
  } else {
    done[8][5] = INK;
  }
  return done;
}

function hash(text: string): number {
  let value = 2166136261;
  for (let i = 0; i < text.length; i++) {
    value ^= text.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

// 颜色和表情按钱包地址确定,同一个买家在哪都长一样
export const seatVariant = (seed: string) => hash(seed) % SEAT_VARIANTS;

export type IconName =
  | "readme"
  | "groupbuys"
  | "new"
  | "wallet"
  | "organizer"
  | "buyer"
  | "escrow"
  | "activity"
  | "rules"
  | "privacy";

function star(p: ReturnType<typeof painter>, x: number, y: number, c: string) {
  p.rect(x + 2, y, 2, 6, c);
  p.rect(x, y + 2, 6, 2, c);
  p.rect(x + 1, y + 1, 4, 4, c);
}

export function drawShield(color: string, n: 16 | 32 = 32): Grid {
  const grid = makeGrid(n);
  const p = painter(grid);
  p.rect(6, 4, 20, 14, color);
  p.rect(7, 18, 18, 3, color);
  p.rect(9, 21, 14, 3, color);
  p.rect(12, 24, 8, 2, color);
  p.rect(14, 26, 4, 2, color);
  p.rect(8, 6, 3, 3, PAPER);
  // 对勾
  p.rect(11, 14, 2, 2, INK);
  p.rect(13, 16, 2, 2, INK);
  p.rect(15, 14, 2, 2, INK);
  p.rect(17, 12, 2, 2, INK);
  p.rect(19, 10, 2, 2, INK);
  return outline(grid);
}

export function drawIcon(name: IconName): Grid {
  if (name === "rules") return drawShield(TOMATO);
  if (name === "groupbuys" || name === "new") {
    const grid = makeGrid(32);
    const body = drawLockie("guarding", 32, 0);
    for (let y = 4; y < 32; y++) for (let x = 0; x < 32; x++) grid[y][x] = body[y - 2]?.[x] ?? null;
    const p = painter(grid);
    if (name === "new") {
      p.rect(21, 0, 11, 11, INK);
      p.rect(22, 1, 9, 9, SAFE);
      p.rect(25, 3, 3, 5, INK);
      p.rect(24, 4, 5, 3, INK);
    } else {
      coin(p, 8, 4, 2.6);
      coin(p, 16, 3, 2.6);
      coin(p, 24, 4, 2.6);
    }
    return grid;
  }
  const grid = makeGrid(32);
  const p = painter(grid);
  switch (name) {
    case "readme":
      p.rect(7, 3, 18, 26, PAPER);
      p.rect(21, 3, 4, 4, LINE);
      for (const y of [9, 13, 17, 21]) p.rect(10, y, y === 21 ? 7 : 12, 1, INK);
      break;
    case "wallet":
      p.rect(4, 9, 24, 17, TOMATO);
      p.rect(4, 9, 24, 3, TOMATO_LIGHT);
      p.rect(19, 15, 9, 6, TOMATO_DARK);
      p.rect(21, 17, 2, 2, SUN);
      break;
    case "organizer":
      p.rect(3, 8, 26, 17, PAPER);
      star(p, 6, 12, TOMATO);
      for (const y of [12, 16, 20]) p.rect(15, y, 11, 1, INK);
      p.rect(6, 20, 6, 1, INK);
      break;
    case "buyer":
      p.rect(8, 3, 16, 24, PAPER);
      for (let x = 8; x < 24; x += 4) p.rect(x, 27, 2, 2, PAPER);
      for (const y of [7, 11, 15]) p.rect(11, y, 10, 1, INK);
      p.rect(11, 20, 5, 2, TOMATO);
      p.rect(18, 20, 3, 2, INK);
      break;
    case "escrow":
      p.rect(5, 17, 14, 11, SUN);
      p.rect(8, 11, 2, 6, INK);
      p.rect(14, 11, 2, 6, INK);
      p.rect(8, 9, 8, 2, INK);
      p.rect(11, 21, 2, 4, INK);
      p.rect(21, 20, 2, 8, SAFE);
      p.rect(24, 14, 2, 14, TOMATO);
      p.rect(27, 8, 2, 20, SAFE);
      break;
    case "activity":
      p.rect(9, 4, 16, 24, PAPER);
      p.rect(6, 4, 3, 5, LINE);
      p.rect(25, 23, 3, 5, LINE);
      for (const y of [9, 13, 17, 21]) {
        p.rect(12, y, 2, 2, y === 13 ? TOMATO : SAFE);
        p.rect(15, y, 7, 1, INK);
      }
      break;
    case "privacy":
      p.rect(3, 9, 26, 18, SUN);
      p.rect(3, 6, 11, 4, SUN);
      p.rect(3, 12, 26, 1, SUN_DARK);
      break;
  }
  return outline(grid);
}

// 外框平铺用的小图案:硬币、锁、星点。返回 SVG 字符串
export const FRAME_PATTERN = `<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96' shape-rendering='crispEdges' fill='%23FF6B3D' fill-opacity='0.16'><rect x='10' y='8' width='8' height='2'/><rect x='8' y='10' width='12' height='8'/><rect x='10' y='18' width='8' height='2'/><rect x='58' y='14' width='2' height='6'/><rect x='66' y='14' width='2' height='6'/><rect x='58' y='12' width='10' height='2'/><rect x='55' y='20' width='16' height='10'/><rect x='30' y='56' width='2' height='2'/><rect x='28' y='58' width='6' height='2'/><rect x='30' y='60' width='2' height='2'/><rect x='76' y='66' width='8' height='2'/><rect x='74' y='68' width='12' height='8'/><rect x='76' y='76' width='8' height='2'/><rect x='12' y='82' width='2' height='2'/></svg>`;
