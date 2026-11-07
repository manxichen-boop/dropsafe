// 根据钱包地址确定性地生成团子的颜色和表情:同一个买家在哪都长一样
const COLORS = [
  { body: "#FF6B3D", shade: "#E3552A" },
  { body: "#FFC93C", shade: "#E0A91F" },
  { body: "#2BB673", shade: "#1F9A5E" },
  { body: "#FF8F6B", shade: "#E86F48" },
  { body: "#F2A93B", shade: "#D18C22" },
  { body: "#7BD6A8", shade: "#52BC88" },
];

function hash(text: string): number {
  let value = 2166136261;
  for (let i = 0; i < text.length; i++) {
    value ^= text.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

export function buddyLook(seed: string) {
  const value = hash(seed);
  return { color: COLORS[value % COLORS.length], face: (value >>> 8) % 3 };
}
