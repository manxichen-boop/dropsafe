"use client";

import { useEffect, useRef } from "react";
import { explorerTx } from "@/lib/config";
import { useI18n } from "@/lib/i18n";
import { Lockie } from "./Lockie";
import { useOS } from "./OS";

// 经典警告框:交易签名前确认、成功、失败
export function SystemDialog() {
  const { dialog, closeDialog } = useOS();
  const { t } = useI18n();
  const primary = useRef<HTMLButtonElement>(null);
  const previous = useRef<Element | null>(null);

  useEffect(() => {
    if (!dialog) return;
    previous.current = document.activeElement;
    primary.current?.focus();
    return () => {
      if (previous.current instanceof HTMLElement && previous.current.isConnected) previous.current.focus();
    };
    // 每次打开一个新对话框时执行
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialog?.type]);

  if (!dialog) return null;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      closeDialog(false);
    }
  };

  return (
    <div className="absolute inset-0 z-[4000] flex items-center justify-center bg-ink/30 p-4" onKeyDown={onKeyDown}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="os-dialog-title" className="os-window !static w-full max-w-[420px]">
        <div className="os-titlebar">
          <span id="os-dialog-title">{dialog.type === "confirm" ? t.os.dialogConfirm : dialog.type === "done" ? t.os.dialogDone : t.os.dialogFail}</span>
          <span className="os-stripes" aria-hidden />
        </div>
        <div className="os-body">
          <div className="flex items-start gap-4">
            <Lockie mood={dialog.type === "confirm" ? dialog.mood : dialog.type === "done" ? "celebrating" : "refunding"} size={64} decorative className="shrink-0" />
            <div className="min-w-0">
              {dialog.type === "confirm" && <p className="leading-relaxed">{dialog.text}</p>}
              {dialog.type === "done" && (
                <>
                  <p className="pixel-title text-lg">Done!</p>
                  <p className="mt-1 leading-relaxed">{dialog.text}</p>
                  {dialog.signature && (
                    <a href={explorerTx(dialog.signature)} target="_blank" rel="noreferrer" className="mt-2 inline-block underline underline-offset-4">
                      {t.detail.viewTx}
                    </a>
                  )}
                </>
              )}
              {dialog.type === "fail" && (
                <>
                  <p className="leading-relaxed">{dialog.error.zh}</p>
                  <p className="mt-2 leading-relaxed">{dialog.error.en}</p>
                </>
              )}
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-3">
            {dialog.type === "confirm" && (
              <>
                <button type="button" className="btn" onClick={() => closeDialog(false)}>
                  {t.os.cancel}
                </button>
                <button ref={primary} type="button" className={dialog.danger ? "btn-danger" : "btn-primary"} onClick={() => closeDialog(true)}>
                  {dialog.confirmLabel}
                </button>
              </>
            )}
            {dialog.type === "done" && (
              <button ref={primary} type="button" className="btn-primary" onClick={() => closeDialog(true)}>
                {t.os.backToDesktop}
              </button>
            )}
            {dialog.type === "fail" && (
              <button ref={primary} type="button" className="btn-primary" onClick={() => closeDialog(true)}>
                OK
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
