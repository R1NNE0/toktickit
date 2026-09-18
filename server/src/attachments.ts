import fs from "node:fs/promises";
import path from "node:path";
import type { Prisma } from "@prisma/client";

// Recognizable signatures plus matching extension/MIME; this is not malware scanning.
export async function validAttachment(file: Express.Multer.File): Promise<boolean> {
  if (!file.size) return false;
  const handle = await fs.open(file.path, "r");
  const bytes = Buffer.alloc(12);
  let length: number;
  try { length = (await handle.read(bytes, 0, bytes.length, 0)).bytesRead; }
  finally { await handle.close(); }
  const ext = path.extname(file.originalname).toLowerCase();
  if (file.mimetype === "application/pdf" && ext === ".pdf") return length >= 5 && bytes.subarray(0, 5).toString() === "%PDF-";
  if (file.mimetype === "image/png" && ext === ".png") return length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (file.mimetype === "image/jpeg" && [".jpg", ".jpeg"].includes(ext)) return length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  return file.mimetype === "image/webp" && ext === ".webp" && length >= 12
    && bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP";
}

export const attachmentSelect = {
  id: true, ticketId: true, fileName: true, fileSize: true, mimeType: true,
  isRemoved: true, removedAt: true, removalReason: true, createdAt: true,
} satisfies Prisma.AttachmentSelect;
export const ticketDetailInclude = {
  category: { select: { id: true, name: true } },
  relatedSystem: { select: { id: true, name: true } },
  requester: { select: { id: true, name: true, email: true } },
  owner: { select: { id: true, name: true } },
  attachments: { select: attachmentSelect, orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
} satisfies Prisma.TicketInclude;
