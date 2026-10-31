"use client";

import { useRef, useState } from "react";
import type { Attachment } from "@/lib/attachments";
import { MAX_IMAGES, MAX_TEXT_FILES } from "@/lib/attachments";
import { ATTACHMENT_ACCEPT } from "@/lib/attachments-client";
import { Icon } from "./ui/Icon";

/** Reference images and text files next to the idea: pick, drag and drop (pasting is handled by the idea box). */
export function AttachmentPicker({
  value,
  onAdd,
  onRemove,
  working,
  errors,
  disabled,
}: {
  value: Attachment[];
  onAdd: (files: File[]) => void;
  onRemove: (index: number) => void;
  working: boolean;
  errors: string[];
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const images = value.filter((item) => item.kind === "image").length;
  const texts = value.length - images;

  return (
    <div
      className={`rounded-xl border border-dashed p-3 text-xs transition ${
        dragging ? "border-primary bg-primary-soft" : "border-line-strong bg-surface-2"
      }`}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        if (!disabled) onAdd(Array.from(event.dataTransfer.files));
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5 text-sm font-semibold text-fg">
            <Icon name="paperclip" size={15} />
            پیوست تصویر یا فایل (اختیاری)
          </div>
          <div className="mt-1 leading-6 text-muted">
            اسکرین‌شات، طرح دستی، لوگو یا فایل متنی (txt، md، csv، json…) را بکشید و رها کنید، انتخاب کنید یا تصویر را در کادر ایده Paste کنید. تا{" "}
            {MAX_IMAGES.toLocaleString("fa-IR")} تصویر و {MAX_TEXT_FILES.toLocaleString("fa-IR")} فایل متنی.
          </div>
        </div>
        <button type="button" className="btn-secondary btn-sm" disabled={disabled || working} onClick={() => input.current?.click()}>
          {working ? <span className="spinner" aria-hidden="true" /> : <Icon name="upload" size={15} />}
          {working ? "در حال آماده‌سازی…" : "انتخاب فایل"}
        </button>
        <input
          ref={input}
          type="file"
          multiple
          hidden
          accept={ATTACHMENT_ACCEPT}
          onChange={(event) => {
            onAdd(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
        />
      </div>

      {value.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {value.map((item, index) => (
            <li
              key={`${item.name}-${index}`}
              className="flex max-w-full items-center gap-2 rounded-xl border border-line bg-surface p-1.5 pe-2"
            >
              {item.kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`data:${item.mime};base64,${item.data}`} alt="" className="size-10 rounded-lg object-cover" />
              ) : (
                <span className="grid size-10 place-items-center rounded-lg bg-surface-3 text-muted" aria-hidden="true">
                  <Icon name="file" size={18} />
                </span>
              )}
              <span className="max-w-40 truncate" dir="auto" title={item.name}>
                {item.name}
              </span>
              <button
                type="button"
                aria-label={`حذف ${item.name}`}
                className="rounded-full px-1.5 text-faint hover:bg-surface-3 hover:text-danger-fg"
                onClick={() => onRemove(index)}
              >
                <Icon name="x" size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {value.length > 0 && (
        <p className="mt-2 text-[11px] text-muted">
          {images.toLocaleString("fa-IR")} تصویر · {texts.toLocaleString("fa-IR")} فایل متنی. تصویرها برای ارسال کوچک می‌شوند و فقط هنگام نوشتن نیازمندی‌ها به مدل داده می‌شوند.
        </p>
      )}

      {errors.length > 0 && (
        <ul className="mt-2 space-y-1 text-[11px] text-danger-fg" role="alert">
          {errors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
