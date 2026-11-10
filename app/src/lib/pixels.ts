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

const SUN_LIGHT = "#FFE08A";
const TOMATO_DEEP = "#B8431F";

// 逐行的半宽:蛋形身体,上窄下宽。手写的宽度序列,边缘是干净的像素曲线
const BODY_TOP = 7;
const BODY_HALF = [3, 6, 7, 8, 9, 10, 10, 11, 11, 11, 12, 12, 12, 12, 12, 12, 12, 12, 11, 11, 10, 8];
const inBody = (x: number, y: number, dy: number) => {
  const half = BODY_HALF[y - BODY_TOP - dy];
  return half !== undefined && x >= 16 - half && x < 16 + half;
};

// 圆形硬币,逐行半宽。外圈深色,内圈留一道高光
const COIN_LG = [3, 5, 6, 7, 7, 7, 7, 7, 7, 6, 5, 3];
const COIN_SM = [2, 3, 3, 3, 3, 2];

function setPx(grid: Grid, x: number, y: number, c: string | null) {
  if (y >= 0 && y < grid.length && x >= 0 && x < grid.length) grid[y][x] = c;
}
function fill(grid: Grid, x: number, y: number, w: number, h: number, c: string) {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) setPx(grid, xx, yy, c);
}

function drawCoin(grid: Grid, rows: number[], cx: number, top: number) {
  rows.forEach((half, i) => {
    for (let x = cx - half; x < cx + half; x++) setPx(grid, x, top + i, SUN_DARK);
    const prev = rows[i - 1] ?? 0;
    const next = rows[i + 1] ?? 0;
    const inner = Math.min(half, prev, next) - 1;
    for (let x = cx - inner; x < cx + inner; x++) setPx(grid, x, top + i, SUN);
  });
  if (rows.length > 6) {
    fill(grid, cx - 3, top + 2, 3, 1, SUN_LIGHT);
    fill(grid, cx - 4, top + 3, 1, 2, SUN_LIGHT);
  } else {
    setPx(grid, cx - 1, top + 2, SUN_LIGHT);
  }
}

// 短胳膊:圆头小块。压在身体上的边用深色收边,伸出身体的边交给外描边
function drawArm(grid: Grid, x: number, y: number, w: number, h: number) {
  const inside = (xx: number, yy: number) => {
    const cornerX = xx === x || xx === x + w - 1;
    const cornerY = yy === y || yy === y + h - 1;
    return xx >= x && xx < x + w && yy >= y && yy < y + h && !(cornerX && cornerY);
  };
  const before = grid.map((row) => [...row]);
  for (let yy = y; yy < y + h; yy++)
    for (let xx = x; xx < x + w; xx++) {
      if (!inside(xx, yy)) continue;
      const edge = !inside(xx - 1, yy) || !inside(xx + 1, yy) || !inside(xx, yy - 1) || !inside(xx, yy + 1);
      const shaded = yy >= y + h - 2 && !edge;
      setPx(grid, xx, yy, edge && before[yy]?.[xx] ? TOMATO_DEEP : shaded ? TOMATO_DARK : TOMATO);
    }
}

type Eye = "open" | "up" | "right" | "left" | "shut" | "happy" | "sad";

// 眼睛 4x5,切掉四角成椭圆,右上角一颗高光,和定稿形象一致
function drawEye(grid: Grid, x: number, y: number, kind: Eye, flip: boolean) {
  if (kind === "shut") {
    // 闭眼:向下弯的弧线
    fill(grid, x + 1, y + 3, 2, 1, INK);
    setPx(grid, x, y + 2, INK);
    setPx(grid, x + 3, y + 2, INK);
    return;
  }
  if (kind === "happy") {
    // 开心:向上弯的弧线
    fill(grid, x + 1, y + 1, 2, 1, INK);
    setPx(grid, x, y + 2, INK);
    setPx(grid, x + 3, y + 2, INK);
    return;
  }
  fill(grid, x + 1, y, 2, 5, INK);
  fill(grid, x, y + 1, 4, 3, INK);
  const shift = kind === "right" ? 1 : kind === "left" ? -1 : 0;
  const hy = kind === "up" ? y : y + 1;
  setPx(grid, x + 2 + shift, hy, PAPER);
  setPx(grid, x + 2 + shift, hy + 1, PAPER);
  if (kind === "sad") {
    // 八字眉:内侧高、外侧低,用深橙色,不抢眼睛
    const dx = flip ? [0, 1, 2, 3] : [3, 2, 1, 0];
    setPx(grid, x + dx[0], y - 3, TOMATO_DEEP);
    setPx(grid, x + dx[1], y - 3, TOMATO_DEEP);
    setPx(grid, x + dx[2], y - 2, TOMATO_DEEP);
    setPx(grid, x + dx[3], y - 2, TOMATO_DEEP);
  }
}

// 画一帧 Lockie:32x32 手工定位,按整数倍放大。frame 0 和 1 组成两帧逐帧动画
export function drawLockie(mood: LockieMood, frame: 0 | 1): Grid {
  const grid = makeGrid(32);
  const dy = mood === "celebrating" && frame === 1 ? -2 : 0;

  // 脚:两只小椭圆,先画,身体压在上面
  for (const x of [7, 19]) {
    fill(grid, x, 28 + dy, 6, 1, TOMATO_DARK);
    fill(grid, x, 29 + dy, 6, 1, TOMATO_DARK);
    fill(grid, x + 1, 30 + dy, 4, 1, TOMATO_DEEP);
  }

  // 身体和体积:右下暗面,左上亮面
  for (let y = BODY_TOP + dy; y < BODY_TOP + dy + BODY_HALF.length; y++)
    for (let x = 0; x < 32; x++) {
      if (!inBody(x, y, dy)) continue;
      let c = TOMATO;
      if (!inBody(x + 2, y + 2, dy) || !inBody(x + 1, y + 3, dy)) c = TOMATO_DARK;
      setPx(grid, x, y, c);
    }
  fill(grid, 12, 9 + dy, 3, 1, TOMATO_LIGHT);
  fill(grid, 10, 10 + dy, 3, 1, TOMATO_LIGHT);
  fill(grid, 9, 11 + dy, 2, 1, TOMATO_LIGHT);

  // 脸:眼睛分得很开,嘴在两眼之间
  const eyeY = 13 + dy;
  const [ex1, ex2] = [8, 20];
  const eye = (kind: Eye) => {
    drawEye(grid, ex1, eyeY, kind, false);
    drawEye(grid, ex2, eyeY, kind, true);
  };
  const smile = () => {
    setPx(grid, 13, eyeY + 2, INK);
    fill(grid, 14, eyeY + 3, 4, 1, INK);
    setPx(grid, 18, eyeY + 2, INK);
  };

  switch (mood) {
    case "guarding": {
      eye(frame === 1 ? "shut" : "open");
      smile();
      drawCoin(grid, COIN_LG, 16, 18);
      drawArm(grid, 3, 21, 6, 6);
      drawArm(grid, 23, 21, 6, 6);
      break;
    }
    case "waiting": {
      eye("up");
      fill(grid, 15, eyeY + 2, 2, 2, INK);
      drawCoin(grid, COIN_SM, 16, frame === 1 ? 1 : 0);
      drawArm(grid, 2, 20, 5, 6);
      drawArm(grid, 25, 20, 5, 6);
      break;
    }
    case "celebrating": {
      eye("happy");
      // 张大的笑嘴和舌头
      fill(grid, 13, eyeY + 2, 6, 1, INK);
      fill(grid, 14, eyeY + 3, 4, 2, INK);
      fill(grid, 15, eyeY + 4, 2, 1, TOMATO_LIGHT);
      drawArm(grid, 2, 12 + dy, 5, 7);
      drawArm(grid, 25, 12 + dy, 5, 7);
      drawCoin(grid, COIN_SM, 5, frame === 1 ? 2 : 4);
      drawCoin(grid, COIN_SM, 27, frame === 1 ? 4 : 2);
      break;
    }
    case "paying": {
      eye("right");
      smile();
      drawArm(grid, 2, 20, 5, 6);
      drawArm(grid, 21, 20, 8, 5);
      drawCoin(grid, COIN_SM, frame === 1 ? 28 : 27, 15);
      break;
    }
    case "refunding": {
      eye("sad");
      // 向下的嘴
      fill(grid, 14, eyeY + 2, 4, 1, INK);
      setPx(grid, 13, eyeY + 3, INK);
      setPx(grid, 18, eyeY + 3, INK);
      // 眼泪
      fill(grid, 9, eyeY + (frame === 1 ? 6 : 5), 1, 2, PAPER);
      drawArm(grid, 25, 20, 5, 6);
      drawArm(grid, 3, 20, 8, 5);
      drawCoin(grid, COIN_SM, frame === 1 ? 4 : 5, 15);
      break;
    }
    case "sleeping": {
      eye("shut");
      fill(grid, 15, eyeY + 3, 2, 1, INK);
      drawArm(grid, 2, 20, 5, 6);
      drawArm(grid, 25, 20, 5, 6);
      break;
    }
  }

  const done = outline(grid);
  if (mood === "sleeping") {
    // 像素 z 放在描边之后,不被描边
    const z = (x: number, y: number) => {
      fill(done, x, y, 3, 1, INK);
      setPx(done, x + 1, y + 1, INK);
      fill(done, x, y + 2, 3, 1, INK);
    };
    z(frame === 1 ? 27 : 26, 1);
    if (frame === 1) z(23, 4);
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
  | "orders"
  | "rules"
  | "privacy";

// 图标全部是 16x16 手工点阵,在 16、32、48、64 像素下都是整数倍放大
const SPRITE: Record<string, string | null> = {
  ".": null,
  K: INK,
  W: PAPER,
  T: TOMATO,
  D: TOMATO_DARK,
  L: TOMATO_LIGHT,
  Y: SUN,
  O: SUN_DARK,
  G: SAFE,
  l: LINE,
};
const spriteGrid = (rows: string[], extra: Record<string, string> = {}): Grid =>
  rows.map((row) => [...row].map((ch) => extra[ch] ?? SPRITE[ch] ?? null));

const SHIELD_ROWS = [
  "................",
  "..KKKKKKKKKKKK..",
  ".KCCCCCCCCCCCCK.",
  ".KWCCCCCCCCCCDK.",
  ".KCCCCCCCCCKCDK.",
  ".KCCCCCCCCKKCDK.",
  ".KCCKCCCCKKCCDK.",
  ".KCCKKCCKKCCCDK.",
  "..KCCKKKKCCCDK..",
  "..KCCCKKCCCCDK..",
  "...KCCCCCCCDK...",
  "....KCCCCCDK....",
  ".....KCCCDK.....",
  "......KCDK......",
  ".......KK.......",
  "................",
];
const SHIELD_SHADE: Record<string, string> = { [TOMATO]: TOMATO_DARK, [SAFE]: "#1F8F59", [SUN]: SUN_DARK, [GRAY]: "#6B665E" };

export function drawShield(color: string): Grid {
  return spriteGrid(SHIELD_ROWS, { C: color, D: SHIELD_SHADE[color] ?? color });
}

const LOCKIE_ICON = [
  "................",
  "................",
  ".....KKKKKK.....",
  "....KLLTTTTK....",
  "...KLTTTTTTTK...",
  "..KTTTTTTTTTDK..",
  "..KTKWTTTTKWDK..",
  "..KTKKTTTTKKDK..",
  "..KTTTTKKTTTDK..",
  "..KTTTYYYYTTDK..",
  "..KTTYYYYYYTDK..",
  "..KDTYYYYYYDDK..",
  "...KDDYYYYDDK...",
  "....KKKKKKKK....",
  "....KDK..KDK....",
  "....KKK..KKK....",
];

const ICONS: Record<Exclude<IconName, "rules">, string[]> = {
  readme: [
    "................",
    "...KKKKKKKK.....",
    "...KWWWWWWKK....",
    "...KWWWWWWKlK...",
    "...KWWWWWWKKKK..",
    "...KWWWWWWWWWK..",
    "...KWKKKKKKKWK..",
    "...KWWWWWWWWWK..",
    "...KWKKKKKKKWK..",
    "...KWWWWWWWWWK..",
    "...KWKKKKKKKWK..",
    "...KWWWWWWWWWK..",
    "...KWKKKKWWWWK..",
    "...KWWWWWWWWWK..",
    "...KKKKKKKKKKK..",
    "................",
  ],
  groupbuys: LOCKIE_ICON.map((row, y) => (y === 0 ? "..KK...KK...KK.." : y === 1 ? ".KYOK.KYOK.KYOK." : row)),
  new: LOCKIE_ICON.map((row, y) => {
    const badge = ["..KKKKK", "..KGGGK", "KKKGKGK".replace("KKKGKGK", "..KGKGK"), "..KGGGK", "..KKKKK"][y];
    return badge ? row.slice(0, 9) + badge : row;
  }),
  wallet: [
    "................",
    "................",
    "..KKKKKKKKKKK...",
    ".KLLLLLLLLLLLK..",
    ".KTTTTTTTTTTTK..",
    ".KTTTTTTTTTKKKK.",
    ".KTTTTTTTTKDDDDK",
    ".KTTTTTTTTKDYDDK",
    ".KTTTTTTTTKDDDDK",
    ".KTTTTTTTTTKKKK.",
    ".KTTTTTTTTTTTK..",
    ".KDDDDDDDDDDDK..",
    "..KKKKKKKKKKK...",
    "................",
    "................",
    "................",
  ],
  orders: [
    "................",
    "......KKKK......",
    ".....K....K.....",
    ".....K....K.....",
    "..KKKKKKKKKKKK..",
    "..KOOOOOOOOOOK..",
    "..KYYKYYYYKYYK..",
    "..KYYYYYYYYYYK..",
    "..KYYYYYYYYYYK..",
    "..KYYTTTTTTYYK..",
    "..KYYYYYYYYYYK..",
    "..KYYTTTYYYYYK..",
    "..KYYYYYYYYYYK..",
    "..KOOOOOOOOOOK..",
    "..KKKKKKKKKKKK..",
    "................",
  ],
  organizer: [
    "................",
    "................",
    "................",
    ".KKKKKKKKKKKKKK.",
    ".KWWWWWWWWWWWWK.",
    ".KWWTTWWWWWWWWK.",
    ".KWTTTTWKKKKKWK.",
    ".KWTTTTWWWWWWWK.",
    ".KWWTTWWKKKKWWK.",
    ".KWTTTTWWWWWWWK.",
    ".KWTTTTWKKKWWWK.",
    ".KWWWWWWWWWWWWK.",
    ".KKKKKKKKKKKKKK.",
    "................",
    "................",
    "................",
  ],
  buyer: [
    "................",
    "...KKKKKKKKKK...",
    "...KWWWWWWWWK...",
    "...KWKKKKKKWK...",
    "...KWWWWWWWWK...",
    "...KWKKKKKKWK...",
    "...KWWWWWWWWK...",
    "...KWKKKKKKWK...",
    "...KWWWWWWWWK...",
    "...KWTTTWKKWK...",
    "...KWWWWWWWWK...",
    "...KWWWWWWWWK...",
    "...KKWKKWKKWK...",
    "....K..K..K.....",
    "................",
    "................",
  ],
  escrow: [
    "................",
    "................",
    "...KKKK.....KKK.",
    "..KK..KK....KGK.",
    "..K....K....KGK.",
    "..K....K.KKKKGK.",
    ".KKKKKKKKKTKKGK.",
    ".KYYYYYYKKTKKGK.",
    ".KYYKKYYKKTKKGK.",
    ".KYYKKYYKKTKKGK.",
    ".KYYYYYYKKTKKGK.",
    ".KOOOOOOKKTKKGK.",
    ".KKKKKKKKKKKKKK.",
    "................",
    "................",
    "................",
  ],
  activity: [
    "................",
    ".....KKKKKK.....",
    "..KKKKllllKKKK..",
    "..KWWKKKKKKWWK..",
    "..KWWWWWWWWWWK..",
    "..KWGWKKKKKKWK..",
    "..KWWWWWWWWWWK..",
    "..KWTWKKKKKKWK..",
    "..KWWWWWWWWWWK..",
    "..KWGWKKKKKKWK..",
    "..KWWWWWWWWWWK..",
    "..KWGWKKKKWWWK..",
    "..KWWWWWWWWWWK..",
    "..KKKKKKKKKKKK..",
    "................",
    "................",
  ],
  privacy: [
    "................",
    "................",
    ".KKKKK..........",
    "KOOOOOKKKKKKKKK.",
    "KOOOOOOOOOOOOOOK",
    "KYYYYYYYYYYYYYYK",
    "KYYYYYYYYYYYYYYK",
    "KYYYYYYYYYYYYYYK",
    "KYYYYYYYYYYYYYYK",
    "KYYYYYYYYYYYYYYK",
    "KYYYYYYYYYYYYYYK",
    "KYYYYYYYYYYYYYYK",
    "KOOOOOOOOOOOOOOK",
    "KKKKKKKKKKKKKKKK",
    "................",
    "................",
  ],
};

export function drawIcon(name: IconName): Grid {
  if (name === "rules") return drawShield(TOMATO);
  return spriteGrid(ICONS[name]);
}

// 外框平铺用的小图案:硬币、锁、星点。返回 SVG 字符串
export const FRAME_PATTERN = `<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96' shape-rendering='crispEdges' fill='%23FF6B3D' fill-opacity='0.16'><rect x='10' y='8' width='8' height='2'/><rect x='8' y='10' width='12' height='8'/><rect x='10' y='18' width='8' height='2'/><rect x='58' y='14' width='2' height='6'/><rect x='66' y='14' width='2' height='6'/><rect x='58' y='12' width='10' height='2'/><rect x='55' y='20' width='16' height='10'/><rect x='30' y='56' width='2' height='2'/><rect x='28' y='58' width='6' height='2'/><rect x='30' y='60' width='2' height='2'/><rect x='76' y='66' width='8' height='2'/><rect x='74' y='68' width='12' height='8'/><rect x='76' y='76' width='8' height='2'/><rect x='12' y='82' width='2' height='2'/></svg>`;

// 像素商品图:全部在这里自己画,不用任何官方商品图。
// 没有图片链接的团购按标题里的关键词挑一种
export type ProductKind = "album" | "cards" | "sneaker" | "figure" | "book" | "box";

export function productKindOf(title: string): ProductKind {
  const text = title.toLowerCase();
  if (/photocard|card|小卡|卡/.test(text)) return "cards";
  if (/album|cd|vinyl|专辑|唱片/.test(text)) return "album";
  if (/sneaker|shoe|鞋/.test(text)) return "sneaker";
  if (/figure|figurine|手办|模型/.test(text)) return "figure";
  if (/artbook|book|zine|画集|书/.test(text)) return "book";
  return "box";
}

export function drawProduct(kind: ProductKind): Grid {
  const grid = makeGrid(32);
  const p = painter(grid);
  switch (kind) {
    case "album":
      // 唱片从封套右边露出来
      p.ell(21, 16, 9, 9, INK);
      p.ell(21, 16, 8, 8, GRAY);
      p.ell(21, 16, 3, 3, SUN);
      p.ell(21, 16, 1, 1, INK);
      p.rect(3, 5, 20, 22, TOMATO);
      p.rect(3, 5, 20, 2, TOMATO_LIGHT);
      p.ell(13, 15, 5, 5, PAPER);
      p.ell(13, 15, 2, 2, TOMATO_DARK);
      p.rect(6, 23, 9, 1, PAPER);
      p.rect(6, 25, 6, 1, PAPER);
      break;
    case "cards":
      // 三张叠放的小卡
      p.rect(4, 8, 13, 18, SAFE);
      p.rect(5, 9, 11, 9, PAPER);
      p.rect(10, 5, 13, 18, SUN);
      p.rect(11, 6, 11, 9, PAPER);
      p.rect(16, 10, 13, 18, TOMATO);
      p.rect(17, 11, 11, 10, PAPER);
      p.ell(22.5, 15, 2.5, 2.5, TOMATO_LIGHT);
      p.rect(19, 23, 7, 1, PAPER);
      p.rect(19, 25, 4, 1, PAPER);
      break;
    case "sneaker":
      p.rect(3, 23, 27, 4, PAPER);
      p.rect(3, 26, 27, 1, GRAY);
      p.rect(4, 14, 12, 9, TOMATO);
      p.rect(8, 10, 8, 4, TOMATO);
      p.ell(20, 19, 10, 5, TOMATO);
      p.rect(4, 22, 26, 1, TOMATO_DARK);
      p.rect(11, 13, 2, 1, PAPER);
      p.rect(13, 15, 2, 1, PAPER);
      p.rect(15, 17, 2, 1, PAPER);
      p.rect(5, 16, 4, 4, SUN);
      break;
    case "figure":
      p.rect(6, 26, 20, 3, GRAY);
      p.rect(8, 25, 16, 1, LINE);
      p.rect(12, 17, 8, 8, SAFE);
      p.rect(9, 18, 3, 5, SAFE);
      p.rect(20, 18, 3, 5, SAFE);
      p.ell(16, 11, 6, 6, SUN);
      p.rect(10, 4, 12, 4, INK);
      p.rect(13, 11, 1, 2, INK);
      p.rect(18, 11, 1, 2, INK);
      p.rect(13, 25, 2, 1, INK);
      p.rect(17, 25, 2, 1, INK);
      break;
    case "book":
      // 摊开的画集
      p.rect(2, 8, 14, 19, PAPER);
      p.rect(16, 8, 14, 19, PAPER);
      p.rect(15, 7, 2, 21, TOMATO_DARK);
      p.rect(4, 10, 10, 8, SUN);
      p.ell(9, 15, 3, 2, SAFE);
      for (const y of [20, 22, 24]) p.rect(4, y, 10, 1, GRAY);
      p.rect(18, 10, 10, 10, TOMATO);
      p.ell(23, 14, 2, 2, PAPER);
      for (const y of [22, 24]) p.rect(18, y, 10, 1, GRAY);
      break;
    case "box":
      p.rect(4, 11, 24, 17, TOMATO);
      p.rect(4, 11, 24, 3, TOMATO_LIGHT);
      p.rect(14, 11, 4, 17, SUN);
      p.rect(7, 6, 18, 5, TOMATO_DARK);
      p.rect(14, 6, 4, 5, SUN_DARK);
      p.rect(7, 22, 5, 1, PAPER);
      p.rect(7, 24, 3, 1, PAPER);
      break;
  }
  return outline(grid);
}

// 桌面壁纸:费尔岛毛衣式的横向花纹带,主花纹是一排小 Lockie。
// 一块花纹 16 x 44 针,横竖都能无缝重复
const MINI_LOCKIE = [
  "...TTTTT...",
  ".TTTTTTTTT.",
  "TTTTTTTTTTT",
  "TTKTTTTTKTT",
  "TTTTTTTTTTT",
  "TTTTPPPTTTT",
  "TTTPPPPPTTT",
  ".TTTPPPTTT.",
  "..TTTTTTT..",
  "..TT...TT..",
];

// 牛皮纸色系:饱和度低,花纹和底色的对比很弱,不抢视线
const KRAFT = {
  base: "#D3C8B0",
  light: "#DAD0BB",
  band: "#CCC0A7",
  main: "#C9BDA3",
  motif: "#BDB197",
  dark: "#ADA28B",
};

export function drawFairIsle(): Grid {
  const W = 16;
  const H = 44;
  const rows: Grid = Array.from({ length: H }, () => Array<string | null>(W).fill(KRAFT.base));
  const band = (y0: number, bg: string, fg: string) => {
    // 五针高的小菱形带
    for (let x = 0; x < W; x++) for (let y = y0; y < y0 + 5; y++) rows[y][x] = bg;
    for (let x = 0; x < W; x++) {
      if (x % 4 === 2) rows[y0 + 1][x] = fg;
      if (x % 4 === 1 || x % 4 === 3) rows[y0 + 2][x] = fg;
      if (x % 4 === 2) rows[y0 + 3][x] = fg;
    }
  };
  for (let x = 0; x < W; x += 2) rows[1][x] = KRAFT.motif;
  band(3, KRAFT.band, KRAFT.dark);
  // 主花纹带:一排 Lockie 抱着硬币,中间夹一个小十字
  for (let y = 9; y < 23; y++) for (let x = 0; x < W; x++) rows[y][x] = KRAFT.main;
  const colors: Record<string, string> = { T: KRAFT.motif, K: KRAFT.dark, P: KRAFT.light };
  MINI_LOCKIE.forEach((line, dy) =>
    [...line].forEach((ch, dx) => {
      if (ch !== ".") rows[11 + dy][2 + dx] = colors[ch];
    })
  );
  for (const [x, y] of [[14, 14], [14, 15], [14, 16], [13, 15], [15, 15]]) rows[y][x] = KRAFT.motif;
  band(24, KRAFT.band, KRAFT.light);
  // 花纹带之间留一段米色,稀疏的小点像毛衣上的间隔花
  for (let x = 4; x < W; x += 8) rows[33][x] = KRAFT.motif;
  for (let x = 0; x < W; x += 8) rows[38][x] = KRAFT.motif;
  return rows;
}

// 把网格变成可以平铺的 SVG(每一针一个方块)
export function gridToSvg(grid: Grid): string {
  const h = grid.length;
  const w = grid[0].length;
  let rects = "";
  grid.forEach((row, y) => {
    let x = 0;
    while (x < w) {
      const c = row[x];
      let run = 1;
      while (x + run < w && row[x + run] === c) run++;
      if (c) rects += `<rect x='${x}' y='${y}' width='${run}' height='1' fill='${c}'/>`;
      x += run;
    }
  });
  return `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' shape-rendering='crispEdges'>${rects}</svg>`;
}
