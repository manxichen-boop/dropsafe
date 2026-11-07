// 公共 Devnet 对 getProgramAccounts 单独限流,同时发几个就会 429。
// 所以这类查询排队依次发送,结果缓存一小段时间,切换页面时不重复请求。
const CACHE_MS = 15_000;
const GAP_MS = 350;
const GAP_AFTER_ERROR_MS = 1_500;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const cache = new Map<string, { at: number; value: Promise<unknown> }>();
let queue: Promise<unknown> = Promise.resolve();

export function chainRead<T>(key: string, read: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value as Promise<T>;

  const value = queue.then(read);
  queue = value.then(
    () => sleep(GAP_MS),
    () => sleep(GAP_AFTER_ERROR_MS)
  );
  cache.set(key, { at: Date.now(), value });
  value.catch(() => cache.delete(key));
  return value;
}

// 交易成功后调用,下一次读取拿最新数据
export const clearChainCache = () => cache.clear();
