import { z } from "zod";

// Files the user adds next to the idea: reference images (screenshots, sketches, logos) and
// text-like documents (requirements, data samples). They are sent to the model while the
// requirements are written; the approved requirements carry what they contributed.

export const MAX_IMAGES = 4;
export const MAX_TEXT_FILES = 5;
/** Base64 characters per image; the browser downsizes images well below this. */
export const MAX_IMAGE_BASE64 = 1_400_000;
export const MAX_TEXT_CHARS = 60_000;
/** Whole request must stay under the 4.5 MB body limit of serverless functions. */
export const MAX_ATTACHMENT_BYTES = 3_600_000;

export const IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
export type ImageMime = (typeof IMAGE_MIME_TYPES)[number];

export type ImageAttachment = { kind: "image"; name: string; mime: ImageMime; data: string };
export type TextAttachment = { kind: "text"; name: string; text: string };
export type Attachment = ImageAttachment | TextAttachment;

const SIGNATURES: Record<ImageMime, (bytes: Buffer) => boolean> = {
  "image/png": (b) => b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  "image/jpeg": (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/webp": (b) => b.length > 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP",
  "image/gif": (b) => b.length > 6 && ["GIF87a", "GIF89a"].includes(b.toString("ascii", 0, 6)),
};

/** The bytes must really be the image type that is claimed, not just labelled so. */
export function matchesImageSignature(mime: ImageMime, base64: string): boolean {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) return false;
  return SIGNATURES[mime](Buffer.from(base64.slice(0, 64), "base64"));
}

/** Keeps names short and free of markup so they are safe to echo into a prompt. */
export function safeFileName(name: string): string {
  return name.replace(/[^\p{L}\p{N}._\- ]/gu, "").trim().slice(0, 80) || "file";
}

const imageSchema = z
  .object({
    kind: z.literal("image"),
    name: z.string().max(200),
    mime: z.enum(IMAGE_MIME_TYPES),
    data: z.string().min(1).max(MAX_IMAGE_BASE64),
  })
  .refine((value) => matchesImageSignature(value.mime, value.data), { message: "فایل تصویر معتبر نیست." })
  .transform((value) => ({ ...value, name: safeFileName(value.name) }));

const textSchema = z
  .object({
    kind: z.literal("text"),
    name: z.string().max(200),
    text: z.string().min(1).max(MAX_TEXT_CHARS),
  })
  .refine((value) => !value.text.includes("\u0000"), { message: "فقط فایل‌های متنی پشتیبانی می‌شوند." })
  .transform((value) => ({ ...value, name: safeFileName(value.name) }));

export const attachmentsSchema = z
  .array(z.union([imageSchema, textSchema]))
  .max(MAX_IMAGES + MAX_TEXT_FILES)
  .superRefine((items, ctx) => {
    const images = items.filter((i) => i.kind === "image").length;
    if (images > MAX_IMAGES) {
      ctx.addIssue({ code: "custom", message: `حداکثر ${MAX_IMAGES} تصویر مجاز است.` });
    }
    if (items.length - images > MAX_TEXT_FILES) {
      ctx.addIssue({ code: "custom", message: `حداکثر ${MAX_TEXT_FILES} فایل متنی مجاز است.` });
    }
    const size = items.reduce((sum, i) => sum + (i.kind === "image" ? i.data.length : i.text.length), 0);
    if (size > MAX_ATTACHMENT_BYTES) {
      ctx.addIssue({ code: "custom", message: "حجم کل پیوست‌ها بیش از حد مجاز است." });
    }
  });

export function imagesOf(attachments: Attachment[] | null | undefined) {
  return (attachments ?? []).filter((a): a is ImageAttachment => a.kind === "image").map((a) => ({ mime: a.mime, data: a.data }));
}

export function textFilesOf(attachments: Attachment[] | null | undefined) {
  return (attachments ?? []).filter((a): a is TextAttachment => a.kind === "text");
}

/** Names only (never the contents) for the project page. */
export function attachmentSummary(attachments: Attachment[] | null | undefined) {
  return (attachments ?? []).map((a) => ({ kind: a.kind, name: a.name }));
}
