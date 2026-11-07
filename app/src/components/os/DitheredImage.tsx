"use client";

import { useEffect, useRef, useState } from "react";
import { isHttpUrl } from "@/lib/campaign";
import { drawProduct, productKindOf } from "@/lib/pixels";
import { Pixel } from "./Pixel";

// 调色板加灰阶
const PALETTE: [number, number, number][] = [
  [0x1f, 0x1d, 0x1a],
  [0xfb, 0xf7, 0xf1],
  [0xff, 0x6b, 0x3d],
  [0x2b, 0xb6, 0x73],
  [0xff, 0xc9, 0x3c],
  [0xe5, 0x48, 0x4d],
  [0xe8, 0xe1, 0xd6],
  [0x8a, 0x84, 0x7a],
  [0x55, 0x51, 0x4b],
  [0xbb, 0xb5, 0xaa],
];

function nearest(r: number, g: number, b: number) {
  let best = PALETTE[0];
  let bestDistance = Infinity;
  for (const c of PALETTE) {
    const d = (c[0] - r) ** 2 + (c[1] - g) ** 2 + (c[2] - b) ** 2;
    if (d < bestDistance) {
      bestDistance = d;
      best = c;
    }
  }
  return best;
}

// Floyd–Steinberg 抖动
function dither(data: Uint8ClampedArray, w: number, h: number) {
  const buf = Float32Array.from(data);
  const push = (x: number, y: number, e: number[], k: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = (y * w + x) * 4;
    for (let c = 0; c < 3; c++) buf[i + c] += e[c] * k;
  };
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const [r, g, b] = nearest(buf[i], buf[i + 1], buf[i + 2]);
      const e = [buf[i] - r, buf[i + 1] - g, buf[i + 2] - b];
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      push(x + 1, y, e, 7 / 16);
      push(x - 1, y + 1, e, 3 / 16);
      push(x, y + 1, e, 5 / 16);
      push(x + 1, y + 1, e, 1 / 16);
    }
}

export function DitheredImage({
  url,
  alt,
  width = 96,
  placeholderSize = 64,
  className = "",
}: {
  url: string;
  alt: string;
  width?: number;
  placeholderSize?: number;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const valid = !!url && isHttpUrl(url);
  // 很多图片网站不允许跨域读取像素,这时直接显示像素化的原图
  const [mode, setMode] = useState<"dither" | "plain" | "none">("dither");

  useEffect(() => {
    if (!valid) return;
    setMode("dither");
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.referrerPolicy = "no-referrer";
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const h = Math.max(1, Math.round((img.height / img.width) * width));
      canvas.width = width;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return setMode("plain");
      try {
        ctx.drawImage(img, 0, 0, width, h);
        const frame = ctx.getImageData(0, 0, width, h);
        dither(frame.data, width, h);
        ctx.putImageData(frame, 0, 0);
      } catch {
        setMode("plain");
      }
    };
    img.onerror = () => setMode("plain");
    img.src = url;
  }, [url, valid, width]);

  // 没有图片或图片打不开时,按标题画一张自制的像素商品图
  if (!valid || mode === "none") {
    return (
      <div role="img" aria-label={alt} className={`flex items-center justify-center bg-line ${className}`}>
        <Pixel grid={drawProduct(productKindOf(alt))} size={placeholderSize} />
      </div>
    );
  }
  if (mode === "plain") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={alt}
        referrerPolicy="no-referrer"
        className={`object-cover [image-rendering:pixelated] ${className}`}
        onError={() => setMode("none")}
      />
    );
  }
  return <canvas ref={canvasRef} role="img" aria-label={alt} className={`object-cover [image-rendering:pixelated] ${className}`} />;
}
