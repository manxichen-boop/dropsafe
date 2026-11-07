"use client";

import { useEffect, useState } from "react";

// 每秒更新的当前时间(Unix 秒),驱动倒计时和按钮状态
export function useNow(): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const timer = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
