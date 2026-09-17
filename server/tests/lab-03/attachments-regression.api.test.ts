import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { requesterHeaders } from "./legacy-session.js";

const db = getPrisma(), pdf = Buffer.from("%PDF-1.4 test upload");
async function fixture() {
  const user = await db.user.findUniqueOrThrow({ where: { email: "jennifer.anderson@example.com" } });
  const category = await db.category.findFirstOrThrow(), system = await db.relatedSystem.findFirstOrThrow();
  const ticket = await db.ticket.create({ data: { ticketNumber: "FILES-" + randomUUID(), summary: "File regression", description: "Test fixture",
    requesterId: user.id, categoryId: category.id, relatedSystemId: system.id } });
  const headers = await requesterHeaders(user.id);
  return { ticket, headers, upload: (bytes: Buffer = pdf, name = "document.pdf", contentType = "application/pdf") =>
    request(app).post(`/api/tickets/${ticket.id}/attachments`).set(headers).attach("file", bytes, { filename: name, contentType }) };
}
describe("API-10/11 Requester attachment continuity", () => {
  it.each([
    ["document.pdf", "application/pdf", pdf],
    ["photo.jpg", "image/jpeg", Buffer.from([255, 216, 255, 224])],
    ["photo.jpeg", "image/jpeg", Buffer.from([255, 216, 255, 224])],
    ["photo.png", "image/png", Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])],
    ["photo.webp", "image/webp", Buffer.from("RIFF0000WEBP")],
  ])("accepts matching extension/MIME/signature: %s", async (name, mime, bytes) => {
    const f = await fixture();
    const response = await f.upload(bytes as Buffer, name as string, mime as string).expect(201);
    expect(response.body).toMatchObject({ removedAt: null, removalReason: null, isRemoved: false });
    expect(response.body).not.toHaveProperty("storedPath");
    const download = await request(app).get(`/api/attachments/${response.body.id}/download`).set(f.headers).expect(200);
    expect(download.headers["x-content-type-options"]).toBe("nosniff");
  });
  it("cleans rejected empty/signature/extension/body uploads and checks CSRF before disk writes", async () => {
    const f = await fixture(), before = await readdir(process.env.TEST_UPLOAD_ROOT!);
    await f.upload(Buffer.alloc(0)).expect(400);
    await f.upload(Buffer.from("fake PDF")).expect(400);
    await f.upload(pdf, "bad.exe").expect(400);
    await request(app).post(`/api/tickets/${f.ticket.id}/attachments`).set(f.headers)
      .field("requesterId", "999").attach("file", pdf, "a.pdf").expect(400);
    await request(app).post(`/api/tickets/${f.ticket.id}/attachments`).set(f.headers)
      .set("X-CSRF-Token", "invalid").attach("file", pdf, "a.pdf").expect(403);
    await request(app).post(`/api/tickets/${f.ticket.id}/attachments`).set(f.headers).expect(400);
    expect(await readdir(process.env.TEST_UPLOAD_ROOT!)).toEqual(before);
    expect(await db.attachment.count({ where: { ticketId: f.ticket.id } })).toBe(0);
  });
  it("accepts exactly 5 MB and rejects 5 MB plus one without orphan bytes", async () => {
    const f = await fixture(), bytes = Buffer.alloc(5242880); pdf.copy(bytes);
    await f.upload(bytes).expect(201);
    const before = await readdir(process.env.TEST_UPLOAD_ROOT!);
    await f.upload(Buffer.concat([bytes, Buffer.from([0])])).expect(413);
    expect(await readdir(process.env.TEST_UPLOAD_ROOT!)).toEqual(before);
  });
  it("serializes concurrent fifth/sixth uploads and retains only recorded files", async () => {
    const f = await fixture();
    for (let i = 0; i < 4; i++) await f.upload(pdf, `${i}.pdf`).expect(201);
    const before = await readdir(process.env.TEST_UPLOAD_ROOT!);
    const responses = await Promise.all([f.upload(pdf, "fifth.pdf"), f.upload(pdf, "sixth.pdf")]);
    expect(responses.map(r => r.status).sort()).toEqual([201, 400]);
    expect(responses.find(r => r.status === 400)!.body.code).toBe("ATTACHMENT_LIMIT");
    expect(await db.attachment.count({ where: { ticketId: f.ticket.id, isRemoved: false } })).toBe(5);
    expect((await readdir(process.env.TEST_UPLOAD_ROOT!)).length).toBe(before.length + 1);
  });
  it("keeps the first concurrent removal audit, retains bytes and blocks removed downloads", async () => {
    const f = await fixture(), uploaded = await f.upload().expect(201), id = uploaded.body.id;
    const responses = await Promise.all(["First reason", "Second reason"].map(reason =>
      request(app).delete(`/api/attachments/${id}`).set(f.headers).send({ reason })));
    expect(responses.map(r => r.status).sort()).toEqual([200, 409]);
    const kept = await db.attachment.findUniqueOrThrow({ where: { id } });
    expect(kept.removalReason).toBe(responses.find(r => r.status === 200)!.body.removalReason);
    expect(await readFile(kept.storedPath)).toEqual(pdf);
    await request(app).get(`/api/attachments/${id}/download`).set(f.headers).expect(403);
    await request(app).delete(`/api/attachments/${id}`).set(f.headers).send({ reason: "New reason" }).expect(409);
    expect(await db.attachment.findUnique({ where: { id } })).toEqual(kept);
    const detail = await request(app).get(`/api/tickets/${f.ticket.id}`).set(f.headers).expect(200);
    expect(detail.body.attachmentCount).toBe(0);
    expect(detail.body.attachments[0].removalReason).toBe(kept.removalReason);
  });
  it("cleans bytes after failed database insertion and returns a safe error", async () => {
    const f = await fixture(), before = await readdir(process.env.TEST_UPLOAD_ROOT!);
    const spy = vi.spyOn(db, "$transaction").mockRejectedValueOnce(new Error("Private database error"));
    try {
      const response = await f.upload().expect(500);
      expect(response.body).toEqual({ error: "Unable to complete the request.", code: "INTERNAL_ERROR" });
    } finally { spy.mockRestore(); }
    expect(await readdir(process.env.TEST_UPLOAD_ROOT!)).toEqual(before);
  });
});
