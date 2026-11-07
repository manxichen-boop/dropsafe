// 根据钱包地址确定性地选一只团子:同一个买家在哪都长一样
export const SEAT_VARIANTS = 6;

function hash(text: string): number {
  let value = 2166136261;
  for (let i = 0; i < text.length; i++) {
    value ^= text.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

export const seatImage = (seed: string | null) =>
  seed ? `/lockie/seat-${hash(seed) % SEAT_VARIANTS}.webp` : "/lockie/seat-empty.webp";
