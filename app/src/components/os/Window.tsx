"use client";

import { useCallback, useEffect, useId, useRef, type PointerEvent, type ReactNode } from "react";
import type { IconName } from "@/lib/pixels";
import { useI18n } from "@/lib/i18n";
import { DesktopIcon } from "./icons";
import { useOS, type OSWindow } from "./OS";

const isMobile = () => window.matchMedia("(max-width: 767px)").matches;

export function Window({
  win,
  z,
  active,
  title,
  icon,
  width = 480,
  children,
}: {
  win: OSWindow;
  z: number;
  active: boolean;
  title: string;
  icon: IconName;
  width?: number;
  children: ReactNode;
}) {
  const { close, focus, move, commitPosition } = useOS();
  const { t } = useI18n();
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  // 打开时焦点移到窗口内
  useEffect(() => {
    ref.current?.focus();
  }, []);

  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (isMobile() || (e.target as HTMLElement).closest("button")) return;
      focus(win.id);
      drag.current = { dx: e.clientX - win.x, dy: e.clientY - win.y };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [focus, win.id, win.x, win.y]
  );
  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!drag.current) return;
      const desk = ref.current?.parentElement?.getBoundingClientRect();
      const self = ref.current?.getBoundingClientRect();
      if (!desk || !self) return;
      // 标题栏不能拖出桌面
      const x = Math.min(Math.max(e.clientX - drag.current.dx, 60 - self.width), desk.width - 60);
      const y = Math.min(Math.max(e.clientY - drag.current.dy, 0), desk.height - 32);
      move(win.id, x, y);
    },
    [move, win.id]
  );
  const onPointerUp = useCallback(() => {
    if (!drag.current) return;
    drag.current = null;
    commitPosition(win.id);
  }, [commitPosition, win.id]);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-labelledby={titleId}
      tabIndex={-1}
      data-active={active}
      className="os-window"
      // 不管记住的位置在哪,窗口都不会超出桌面右边和下边
      style={{
        left: `max(0px, min(${win.x}px, calc(100% - ${width + 12}px)))`,
        top: `max(0px, min(${win.y}px, calc(100% - 120px)))`,
        width,
        zIndex: z,
      }}
      onPointerDownCapture={() => focus(win.id)}
    >
      <div className="os-titlebar" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
        <button type="button" className="os-back pixel-title" onClick={() => close(win.id)}>
          ← {t.os.back}
        </button>
        <DesktopIcon name={icon} size={16} />
        <span id={titleId} className="max-w-[60%] truncate">
          {title}
        </span>
        <span className="os-stripes" aria-hidden />
        <button type="button" aria-label={t.os.closeWindow} className="os-close" onClick={() => close(win.id)}>
          <svg viewBox="0 0 8 8" width={8} height={8} shapeRendering="crispEdges" aria-hidden>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <g key={i}>
                <rect x={i} y={i} width={1} height={1} fill="#1F1D1A" />
                <rect x={7 - i} y={i} width={1} height={1} fill="#1F1D1A" />
              </g>
            ))}
          </svg>
        </button>
      </div>
      <div className="os-body">{children}</div>
    </div>
  );
}
