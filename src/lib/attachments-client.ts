import {
  MAX_ATTACHMENT_BYTES,
  MAX_IMAGES,
  MAX_IMAGE_BASE64,
  MAX_TEXT_CHARS,
  MAX_TEXT_FILES,
  type Attachment,
} from "./attachments";

// Browser-side preparation of attachments: images are downscaled and re-encoded as JPEG so the
// whole request stays small, text files are read as UTF-8. Anything unsupported gets a clear message.

const TEXT_EXTENSIONS = /\.(txt|md|markdown|csv|tsv|json|xml|html?|css|jsx?|tsx?|ya?ml|sql|log|ini|env|svg)$/i;
const ACCEPTED_IMAGE = /^image\/(png|jpe?g|webp|gif)$/;

export const ATTACHMENT_ACCEPT = "image/png,image/jpeg,image/webp,image/gif,.txt,.md,.csv,.tsv,.json,.xml,.html,.css,.js,.ts,.tsx,.yaml,.yml,.sql,.log";

export function attachmentSize(item: Attachment) {
  return item.kind === "image" ? item.data.length : item.text.length;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("تصویر خوانده نشد."));
    };
    image.src = url;
  });
}

/** Re-encodes as JPEG, shrinking until it fits the per-image limit. */
async function compressImage(file: File): Promise<string> {
  const image = await loadImage(file);
  for (const maxSide of [1600, 1280, 1024, 800]) {
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("مرورگر از پردازش تصویر پشتیبانی نمی‌کند.");
    context.fillStyle = "#ffffff"; // transparent PNGs become white instead of black
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const base64 = canvas.toDataURL("image/jpeg", 0.82).split(",")[1] ?? "";
    if (base64 && base64.length <= MAX_IMAGE_BASE64) return base64;
  }
  throw new Error("حجم تصویر پس از کوچک‌سازی هم زیاد است.");
}

export type AddResult = { items: Attachment[]; errors: string[] };

/** Turns picked/dropped/pasted files into attachments, respecting the count and size limits. */
export async function prepareAttachments(files: File[], existing: Attachment[]): Promise<AddResult> {
  const items = [...existing];
  const errors: string[] = [];
  let total = items.reduce((sum, item) => sum + attachmentSize(item), 0);

  for (const file of files) {
    const label = file.name || "تصویر";
    try {
      if (ACCEPTED_IMAGE.test(file.type)) {
        if (items.filter((i) => i.kind === "image").length >= MAX_IMAGES) {
          errors.push(`حداکثر ${MAX_IMAGES.toLocaleString("fa-IR")} تصویر مجاز است (${label}).`);
          continue;
        }
        const data = await compressImage(file);
        if (total + data.length > MAX_ATTACHMENT_BYTES) {
          errors.push(`حجم کل پیوست‌ها زیاد است؛ «${label}» اضافه نشد.`);
          continue;
        }
        total += data.length;
        items.push({ kind: "image", name: label, mime: "image/jpeg", data });
      } else if (file.type.startsWith("text/") || file.type === "application/json" || TEXT_EXTENSIONS.test(file.name)) {
        if (items.filter((i) => i.kind === "text").length >= MAX_TEXT_FILES) {
          errors.push(`حداکثر ${MAX_TEXT_FILES.toLocaleString("fa-IR")} فایل متنی مجاز است (${label}).`);
          continue;
        }
        const text = await file.text();
        if (text.includes("\u0000")) {
          errors.push(`«${label}» فایل متنی نیست.`);
          continue;
        }
        if (!text.trim()) {
          errors.push(`«${label}» خالی است.`);
          continue;
        }
        if (text.length > MAX_TEXT_CHARS) {
          errors.push(`«${label}» بیش از ${MAX_TEXT_CHARS.toLocaleString("fa-IR")} کاراکتر است؛ فقط بخش مهم آن را کپی کنید.`);
          continue;
        }
        if (total + text.length > MAX_ATTACHMENT_BYTES) {
          errors.push(`حجم کل پیوست‌ها زیاد است؛ «${label}» اضافه نشد.`);
          continue;
        }
        total += text.length;
        items.push({ kind: "text", name: label, text });
      } else if (/\.(pdf|docx?|xlsx?|pptx?)$/i.test(file.name) || file.type === "application/pdf") {
        errors.push(`«${label}»: PDF و فایل‌های Office پشتیبانی نمی‌شوند؛ متن آن را به‌صورت txt یا md پیوست کنید، یا از صفحه عکس بگیرید.`);
      } else {
        errors.push(`«${label}»: نوع فایل پشتیبانی نمی‌شود (تصویر png/jpg/webp/gif یا فایل متنی).`);
      }
    } catch (error) {
      errors.push(`«${label}»: ${(error as Error).message}`);
    }
  }
  return { items, errors };
}
