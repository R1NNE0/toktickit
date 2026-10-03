import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { requesterHeaders } from "./legacy-session.js";
import { verifyPassword } from "../../src/auth/password.js";

describe("API-20 through API-24: Administrator User Management", () => {
  const db = getPrisma();
  const marker = "uadmin-" + randomUUID().slice(0, 8);

  let adminId: number;
  let adminHeaders: Record<string, string>;
  let admin2Id: number;
  let admin2Headers: Record<string, string>;
  let staffId: number;
  let staffHeaders: Record<string, string>;
  let requesterId: number;
  let requesterHeadersMap: Record<string, string>;

  let categoryId: number;
  let systemId: number;

  beforeAll(async () => {
    // Primary administrator
    const admin = await db.user.findFirstOrThrow({ where: { role: "ADMINISTRATOR", isActive: true } });
    adminId = admin.id;
    adminHeaders = await requesterHeaders(adminId);

    // Create a second active Administrator for protection and concurrency tests
    const admin2Email = `admin2-${marker}@example.com`;
    const admin2 = await db.user.create({
      data: {
        name: "Second Administrator",
        email: admin2Email,
        emailNormalized: admin2Email.toLowerCase(),
        role: "ADMINISTRATOR",
        isActive: true,
        passwordHash: admin.passwordHash,
        mustChangePassword: false,
      },
    });
    admin2Id = admin2.id;
    admin2Headers = await requesterHeaders(admin2Id);

    // IT Staff
    const staff = await db.user.findFirstOrThrow({ where: { role: "IT_STAFF", isActive: true } });
    staffId = staff.id;
    staffHeaders = await requesterHeaders(staffId);

    // Requester
    const requester = await db.user.findFirstOrThrow({ where: { role: "REQUESTER", isActive: true } });
    requesterId = requester.id;
    requesterHeadersMap = await requesterHeaders(requesterId);

    const cat = await db.category.findFirstOrThrow({ where: { isActive: true } });
    categoryId = cat.id;
    const sys = await db.relatedSystem.findFirstOrThrow({ where: { isActive: true } });
    systemId = sys.id;
  });

  afterAll(async () => {
    await db.publicComment.deleteMany({ where: { ticket: { ticketNumber: { startsWith: marker } } } });
    await db.internalNote.deleteMany({ where: { ticket: { ticketNumber: { startsWith: marker } } } });
    await db.attachment.deleteMany({ where: { ticket: { ticketNumber: { startsWith: marker } } } });
    await db.ticket.deleteMany({ where: { ticketNumber: { startsWith: marker } } });

    // Clean up created test users
    await db.session.deleteMany({ where: { user: { email: { contains: marker } } } });
    await db.user.deleteMany({ where: { email: { contains: marker } } });
  });

  describe("API-20 User Listing, Query Validation & Authorization", () => {
    it("returns sorted user list for Administrator in name asc then id asc order", async () => {
      const res = await request(app)
        .get("/api/admin/users")
        .set(adminHeaders)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(3);

      const users = res.body.data;
      for (let i = 1; i < users.length; i++) {
        const prev = users[i - 1];
        const curr = users[i];
        const cmp = prev.name.localeCompare(curr.name);
        if (cmp === 0) {
          expect(prev.id <= curr.id).toBe(true);
        } else {
          expect(cmp <= 0).toBe(true);
        }
      }

      const sample = users[0];
      expect(sample).toHaveProperty("id");
      expect(sample).toHaveProperty("name");
      expect(sample).toHaveProperty("email");
      expect(sample).toHaveProperty("role");
      expect(sample).toHaveProperty("isActive");
      expect(sample).toHaveProperty("mustChangePassword");
      expect(sample).not.toHaveProperty("passwordHash");
      expect(sample).not.toHaveProperty("password");
    });

    it("filters users by role correctly", async () => {
      const res = await request(app)
        .get("/api/admin/users?role=IT_STAFF")
        .set(adminHeaders)
        .expect(200);

      expect(res.body.data.length).toBeGreaterThan(0);
      for (const u of res.body.data) {
        expect(u.role).toBe("IT_STAFF");
      }
    });

    it("searches users by name or email substring (case-insensitive)", async () => {
      const res = await request(app)
        .get(`/api/admin/users?search=${encodeURIComponent("Second Administrator")}`)
        .set(adminHeaders)
        .expect(200);

      expect(res.body.data.some((u: any) => u.id === admin2Id)).toBe(true);

      const emailSearch = await request(app)
        .get(`/api/admin/users?search=${encodeURIComponent(marker)}`)
        .set(adminHeaders)
        .expect(200);

      expect(emailSearch.body.data.some((u: any) => u.id === admin2Id)).toBe(true);
    });

    it("returns empty array when no users match search criteria", async () => {
      const res = await request(app)
        .get("/api/admin/users?search=NonExistentUserQueryString123456")
        .set(adminHeaders)
        .expect(200);

      expect(res.body.data).toEqual([]);
    });

    it("rejects unknown query parameters with 400", async () => {
      await request(app)
        .get("/api/admin/users?page=1&pageSize=10")
        .set(adminHeaders)
        .expect(400);

      await request(app)
        .get("/api/admin/users?sortBy=createdAt")
        .set(adminHeaders)
        .expect(400);
    });

    it("rejects invalid role enum or search longer than 200 characters with 400", async () => {
      await request(app)
        .get("/api/admin/users?role=SUPERUSER")
        .set(adminHeaders)
        .expect(400);

      const oversizedSearch = "a".repeat(201);
      await request(app)
        .get(`/api/admin/users?search=${oversizedSearch}`)
        .set(adminHeaders)
        .expect(400);
    });

    it("denies IT Staff and Requester access with 403", async () => {
      await request(app).get("/api/admin/users").set(staffHeaders).expect(403);
      await request(app).get("/api/admin/users").set(requesterHeadersMap).expect(403);
    });

    it("denies unauthenticated requests with 401", async () => {
      await request(app).get("/api/admin/users").expect(401);
    });
  });

  describe("API-21 User Creation", () => {
    it("creates a new user with required fields, hashed password, and mustChangePassword=true", async () => {
      const email = `newuser-${marker}@example.com`;
      const res = await request(app)
        .post("/api/admin/users")
        .set(adminHeaders)
        .send({
          name: "Created Test User",
          email,
          role: "IT_STAFF",
          isActive: true,
          initialPassword: "InitialSecretPassword123!",
        })
        .expect(201);

      expect(res.body.name).toBe("Created Test User");
      expect(res.body.email).toBe(email);
      expect(res.body.role).toBe("IT_STAFF");
      expect(res.body.isActive).toBe(true);
      expect(res.body.mustChangePassword).toBe(true);
      expect(res.body).not.toHaveProperty("password");
      expect(res.body).not.toHaveProperty("initialPassword");
      expect(res.body).not.toHaveProperty("passwordHash");

      // Verify hash in DB
      const inDb = await db.user.findUniqueOrThrow({ where: { id: res.body.id } });
      expect(inDb.mustChangePassword).toBe(true);
      expect(inDb.passwordChangedAt).toBeNull();
      const valid = await verifyPassword(inDb.passwordHash, "InitialSecretPassword123!");
      expect(valid).toBe(true);
    });

    it("rejects duplicate email or normalized email conflict with 409 DUPLICATE_EMAIL", async () => {
      const email = `dup-${marker}@example.com`;
      await request(app)
        .post("/api/admin/users")
        .set(adminHeaders)
        .send({
          name: "First User",
          email,
          role: "REQUESTER",
          isActive: true,
          initialPassword: "InitialSecretPassword123!",
        })
        .expect(201);

      // Attempt duplicate with uppercase variations
      const res = await request(app)
        .post("/api/admin/users")
        .set(adminHeaders)
        .send({
          name: "Second User",
          email: email.toUpperCase(),
          role: "REQUESTER",
          isActive: true,
          initialPassword: "InitialSecretPassword123!",
        })
        .expect(409);

      expect(res.body.code).toBe("DUPLICATE_EMAIL");
    });

    it("handles concurrent duplicate user creations safely with exactly one 201 and one 409", async () => {
      const email = `concurrent-${marker}@example.com`;
      const [res1, res2] = await Promise.all([
        request(app)
          .post("/api/admin/users")
          .set(adminHeaders)
          .send({
            name: "Concurrent User A",
            email,
            role: "REQUESTER",
            isActive: true,
            initialPassword: "InitialSecretPassword123!",
          }),
        request(app)
          .post("/api/admin/users")
          .set(adminHeaders)
          .send({
            name: "Concurrent User B",
            email,
            role: "REQUESTER",
            isActive: true,
            initialPassword: "InitialSecretPassword123!",
          }),
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([201, 409]);
    });

    it("rejects invalid role, invalid email, or weak password with 400", async () => {
      // Invalid role
      await request(app)
        .post("/api/admin/users")
        .set(adminHeaders)
        .send({
          name: "Bad Role User",
          email: `badrole-${marker}@example.com`,
          role: "SUPER_ADMIN",
          isActive: true,
          initialPassword: "InitialSecretPassword123!",
        })
        .expect(400);

      // Invalid email
      await request(app)
        .post("/api/admin/users")
        .set(adminHeaders)
        .send({
          name: "Bad Email User",
          email: "not-an-email",
          role: "REQUESTER",
          isActive: true,
          initialPassword: "InitialSecretPassword123!",
        })
        .expect(400);

      // Short password (<15 chars)
      await request(app)
        .post("/api/admin/users")
        .set(adminHeaders)
        .send({
          name: "Weak Password User",
          email: `weak-${marker}@example.com`,
          role: "REQUESTER",
          isActive: true,
          initialPassword: "Short1!",
        })
        .expect(400);

      // Common password
      await request(app)
        .post("/api/admin/users")
        .set(adminHeaders)
        .send({
          name: "Common Password User",
          email: `common-${marker}@example.com`,
          role: "REQUESTER",
          isActive: true,
          initialPassword: "passwordpassword",
        })
        .expect(400);
    });

    it("rejects unexpected or server-owned fields in create payload with 400 VALIDATION_ERROR", async () => {
      const res = await request(app)
        .post("/api/admin/users")
        .set(adminHeaders)
        .send({
          name: "Server Owned Field User",
          email: `srvowned-${marker}@example.com`,
          role: "REQUESTER",
          isActive: true,
          initialPassword: "InitialSecretPassword123!",
          passwordHash: "malicious-hash",
          createdAt: "2026-01-01T00:00:00.000Z",
        })
        .expect(400);

      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("denies IT Staff and Requester from creating users (403)", async () => {
      await request(app)
        .post("/api/admin/users")
        .set(staffHeaders)
        .send({
          name: "Staff Attempt",
          email: `staffattempt-${marker}@example.com`,
          role: "REQUESTER",
          isActive: true,
          initialPassword: "InitialSecretPassword123!",
        })
        .expect(403);
    });
  });

  describe("API-22 User Editing, Ownership Unassignment & Session Revocation", () => {
    it("updates basic user fields (name, email) without requiring concurrency tokens", async () => {
      const email = `editable-${marker}@example.com`;
      const created = await request(app)
        .post("/api/admin/users")
        .set(adminHeaders)
        .send({
          name: "Editable User",
          email,
          role: "IT_STAFF",
          isActive: true,
          initialPassword: "InitialSecretPassword123!",
        })
        .expect(201);

      const updated = await request(app)
        .patch(`/api/admin/users/${created.body.id}`)
        .set(adminHeaders)
        .send({ name: "Edited User Name" })
        .expect(200);

      expect(updated.body.name).toBe("Edited User Name");
      expect(updated.body.email).toBe(email);
    });

    it("rejects duplicate email conflict on update with 409", async () => {
      const email1 = `user1-${marker}@example.com`;
      const email2 = `user2-${marker}@example.com`;

      await request(app)
        .post("/api/admin/users")
        .set(adminHeaders)
        .send({
          name: "User One",
          email: email1,
          role: "REQUESTER",
          isActive: true,
          initialPassword: "InitialSecretPassword123!",
        })
        .expect(201);

      const user2 = await request(app)
        .post("/api/admin/users")
        .set(adminHeaders)
        .send({
          name: "User Two",
          email: email2,
          role: "REQUESTER",
          isActive: true,
          initialPassword: "InitialSecretPassword123!",
        })
        .expect(201);

      // Attempt to change user2's email to user1's email
      const res = await request(app)
        .patch(`/api/admin/users/${user2.body.id}`)
        .set(adminHeaders)
        .send({ email: email1.toUpperCase() })
        .expect(409);

      expect(res.body.code).toBe("DUPLICATE_EMAIL");
    });

    it("atomically unassigns tickets when an eligible owner becomes inactive or is demoted to REQUESTER", async () => {
      // Create an IT Staff user
      const staffEmail = `owner-${marker}@example.com`;
      const staffUser = await request(app)
        .post("/api/admin/users")
        .set(adminHeaders)
        .send({
          name: "Active Owner Staff",
          email: staffEmail,
          role: "IT_STAFF",
          isActive: true,
          initialPassword: "InitialSecretPassword123!",
        })
        .expect(201);

      // Create a ticket owned by this staff user
      const ticket = await db.ticket.create({
        data: {
          ticketNumber: marker + "-owned-01",
          summary: "Ticket for unassignment test",
          description: "Testing BR-27 unassignment",
          requesterId,
          categoryId,
          relatedSystemId: systemId,
          requestedPriority: "MEDIUM",
          itPriority: "MEDIUM",
          currentStatus: "IN_PROGRESS",
          ownerId: staffUser.body.id,
        },
      });

      expect(ticket.ownerId).toBe(staffUser.body.id);

      // 1. Demote staff to REQUESTER
      await request(app)
        .patch(`/api/admin/users/${staffUser.body.id}`)
        .set(adminHeaders)
        .send({ role: "REQUESTER" })
        .expect(200);

      // Verify ticket owner was set to null
      let dbTicket = await db.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
      expect(dbTicket.ownerId).toBeNull();

      // Re-promote to IT_STAFF and re-assign ticket
      await request(app)
        .patch(`/api/admin/users/${staffUser.body.id}`)
        .set(adminHeaders)
        .send({ role: "IT_STAFF" })
        .expect(200);

      await db.ticket.update({
        where: { id: ticket.id },
        data: { ownerId: staffUser.body.id },
      });

      // 2. Deactivate staff user (isActive: false)
      await request(app)
        .patch(`/api/admin/users/${staffUser.body.id}`)
        .set(adminHeaders)
        .send({ isActive: false })
        .expect(200);

      dbTicket = await db.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
      expect(dbTicket.ownerId).toBeNull();
    });

    it("revokes all sessions for target user when role, email, or activation changes", async () => {
      const userEmail = `session-rev-${marker}@example.com`;
      const created = await request(app)
        .post("/api/admin/users")
        .set(adminHeaders)
        .send({
          name: "Session Target",
          email: userEmail,
          role: "REQUESTER",
          isActive: true,
          initialPassword: "InitialSecretPassword123!",
        })
        .expect(201);

      // Establish a session for this user
      const userSessionHeaders = await requesterHeaders(created.body.id);

      // Verify session works
      await request(app).get("/api/auth/me").set(userSessionHeaders).expect(200);

      // Change user role
      await request(app)
        .patch(`/api/admin/users/${created.body.id}`)
        .set(adminHeaders)
        .send({ role: "IT_STAFF" })
        .expect(200);

      // Verify old session is revoked (401)
      await request(app).get("/api/auth/me").set(userSessionHeaders).expect(401);
    });

    it("rejects unexpected or server-owned fields in update payload with 400 VALIDATION_ERROR", async () => {
      const res = await request(app)
        .patch(`/api/admin/users/${staffId}`)
        .set(adminHeaders)
        .send({
          name: "Updated Staff Name",
          passwordHash: "forbidden-hash",
        })
        .expect(400);

      expect(res.body.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("API-23 Administrator Protection (Self-Deactivation & Last Admin)", () => {
    it("rejects self-deactivation with 409 SELF_DEACTIVATION", async () => {
      const res = await request(app)
        .patch(`/api/admin/users/${adminId}`)
        .set(adminHeaders)
        .send({ isActive: false })
        .expect(409);

      expect(res.body.code).toBe("SELF_DEACTIVATION");
    });

    it("protects the last active Administrator from being deactivated or demoted", async () => {
      // First, deactivate the second administrator so only adminId remains active
      await request(app)
        .patch(`/api/admin/users/${admin2Id}`)
        .set(adminHeaders)
        .send({ isActive: false })
        .expect(200);

      // Now attempt to deactivate the last active admin (using admin2's session or admin's session, targeting adminId)
      // Since self-deactivation triggers first if using adminHeaders, reactivate admin2 briefly to test last-admin logic cleanly:
      await db.user.update({ where: { id: admin2Id }, data: { isActive: true } });
      admin2Headers = await requesterHeaders(admin2Id);

      // Deactivate adminId from admin2Headers
      await request(app)
        .patch(`/api/admin/users/${adminId}`)
        .set(admin2Headers)
        .send({ isActive: false })
        .expect(200);

      // Now admin2 is the sole active administrator!
      // Attempting to demote admin2 (by admin2 or anyone) must fail with LAST_ADMIN:
      const demoteRes = await request(app)
        .patch(`/api/admin/users/${admin2Id}`)
        .set(admin2Headers)
        .send({ role: "IT_STAFF" })
        .expect(409);

      expect(demoteRes.body.code).toBe("LAST_ADMIN");

      // Reactivate adminId
      await db.user.update({ where: { id: adminId }, data: { isActive: true } });
      adminHeaders = await requesterHeaders(adminId);
    });

    it("handles concurrent admin deactivations/demotions safely with at least one active admin remaining", async () => {
      // Both adminId and admin2Id are active with fresh sessions
      await db.user.update({ where: { id: adminId }, data: { role: "ADMINISTRATOR", isActive: true } });
      await db.user.update({ where: { id: admin2Id }, data: { role: "ADMINISTRATOR", isActive: true } });
      adminHeaders = await requesterHeaders(adminId);
      admin2Headers = await requesterHeaders(admin2Id);

      // Admin 1 attempts to demote Admin 2, while Admin 2 attempts to demote Admin 1 concurrently
      const [res1, res2] = await Promise.all([
        request(app)
          .patch(`/api/admin/users/${admin2Id}`)
          .set(adminHeaders)
          .send({ role: "IT_STAFF" }),
        request(app)
          .patch(`/api/admin/users/${adminId}`)
          .set(admin2Headers)
          .send({ role: "IT_STAFF" }),
      ]);

      const statuses = [res1.status, res2.status].sort();
      // Exactly one must succeed (200), and the other must be rejected (409)
      expect(statuses).toEqual([200, 409]);

      // Confirm at least one active administrator remains in DB
      const activeAdminCount = await db.user.count({
        where: { role: "ADMINISTRATOR", isActive: true },
      });
      expect(activeAdminCount).toBeGreaterThanOrEqual(1);

      // Restore both admins to active ADMINISTRATOR
      await db.user.update({ where: { id: adminId }, data: { role: "ADMINISTRATOR", isActive: true } });
      await db.user.update({ where: { id: admin2Id }, data: { role: "ADMINISTRATOR", isActive: true } });
      adminHeaders = await requesterHeaders(adminId);
      admin2Headers = await requesterHeaders(admin2Id);
    });
  });

  describe("API-24 Set New Initial Password", () => {
    it("sets new initial password, forces mustChangePassword=true, and revokes sessions", async () => {
      const email = `pw-reset-${marker}@example.com`;
      const user = await request(app)
        .post("/api/admin/users")
        .set(adminHeaders)
        .send({
          name: "Password Reset Target",
          email,
          role: "REQUESTER",
          isActive: true,
          initialPassword: "InitialSecretPassword123!",
        })
        .expect(201);

      // Log user in and simulate completed initial password change
      await db.user.update({
        where: { id: user.body.id },
        data: { mustChangePassword: false, passwordChangedAt: new Date() },
      });

      const userSessionHeaders = await requesterHeaders(user.body.id);
      await request(app).get("/api/auth/me").set(userSessionHeaders).expect(200);

      // Admin resets initial password
      const newPassword = "BrandNewInitialSecret123!";
      const resetRes = await request(app)
        .post(`/api/admin/users/${user.body.id}/initial-password`)
        .set(adminHeaders)
        .send({ initialPassword: newPassword })
        .expect(200);

      expect(resetRes.body.mustChangePassword).toBe(true);

      // In DB: hash is updated, mustChangePassword is true, passwordChangedAt is null
      const inDb = await db.user.findUniqueOrThrow({ where: { id: user.body.id } });
      expect(inDb.mustChangePassword).toBe(true);
      expect(inDb.passwordChangedAt).toBeNull();
      expect(await verifyPassword(inDb.passwordHash, newPassword)).toBe(true);

      // Target session was revoked
      await request(app).get("/api/auth/me").set(userSessionHeaders).expect(401);
    });

    it("does not activate an inactive user when resetting initial password", async () => {
      const email = `inactive-pw-${marker}@example.com`;
      const user = await request(app)
        .post("/api/admin/users")
        .set(adminHeaders)
        .send({
          name: "Inactive User",
          email,
          role: "REQUESTER",
          isActive: false,
          initialPassword: "InitialSecretPassword123!",
        })
        .expect(201);

      expect(user.body.isActive).toBe(false);

      const resetRes = await request(app)
        .post(`/api/admin/users/${user.body.id}/initial-password`)
        .set(adminHeaders)
        .send({ initialPassword: "AnotherNewPassword123!" })
        .expect(200);

      expect(resetRes.body.isActive).toBe(false);

      const inDb = await db.user.findUniqueOrThrow({ where: { id: user.body.id } });
      expect(inDb.isActive).toBe(false);
    });

    it("rejects weak or missing initial password with 400", async () => {
      await request(app)
        .post(`/api/admin/users/${staffId}/initial-password`)
        .set(adminHeaders)
        .send({ initialPassword: "short" })
        .expect(400);

      await request(app)
        .post(`/api/admin/users/${staffId}/initial-password`)
        .set(adminHeaders)
        .send({})
        .expect(400);
    });

    it("rejects unexpected or server-owned fields in reset payload with 400 VALIDATION_ERROR", async () => {
      const res = await request(app)
        .post(`/api/admin/users/${staffId}/initial-password`)
        .set(adminHeaders)
        .send({
          initialPassword: "ValidPassword123456789!",
          mustChangePassword: false,
          passwordChangedAt: "2026-01-01T00:00:00.000Z",
        })
        .expect(400);

      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("denies IT Staff and Requester from resetting passwords (403)", async () => {
      await request(app)
        .post(`/api/admin/users/${staffId}/initial-password`)
        .set(staffHeaders)
        .send({ initialPassword: "ValidPassword123456789!" })
        .expect(403);
    });
  });
});
