import type { Request, Response } from "express";
import { UserRole, type Prisma } from "@prisma/client";
import { getPrisma } from "./prisma.js";
import { HttpError, requireNormal } from "./auth/http.js";
import { bodyFields, positiveId } from "./middleware/requesterInput.js";
import {
  passwordError,
  hashPassword,
  normalizeEmail,
  validEmail,
} from "./auth/password.js";
import { revokeUserSessions } from "./auth/session.js";

export const adminUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  mustChangePassword: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export function formatAdminUser(user: {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

function requireAdmin(req: Request) {
  const user = requireNormal(req);
  if (user.role !== "ADMINISTRATOR") {
    throw new HttpError(403, "FORBIDDEN", "Administrator role required.");
  }
  return user;
}

export async function getAdminUsers(req: Request, res: Response) {
  requireAdmin(req);

  // Validate allowed query keys (only search and role permitted)
  const allowedKeys = new Set(["search", "role"]);
  for (const key of Object.keys(req.query)) {
    if (!allowedKeys.has(key)) {
      throw new HttpError(400, "INVALID_QUERY", `Unknown query parameter: ${key}`);
    }
  }

  const { search, role } = req.query;

  let searchStr: string | undefined;
  if (search !== undefined) {
    if (typeof search !== "string") {
      throw new HttpError(400, "VALIDATION_ERROR", "search query must be a string.");
    }
    const trimmed = search.trim();
    if (trimmed.length > 200) {
      throw new HttpError(400, "VALIDATION_ERROR", "search query must be at most 200 characters.");
    }
    if (trimmed.length > 0) {
      searchStr = trimmed;
    }
  }

  let roleFilter: UserRole | undefined;
  if (role !== undefined) {
    if (typeof role !== "string" || !Object.values(UserRole).includes(role as UserRole)) {
      throw new HttpError(400, "VALIDATION_ERROR", "Invalid role filter.");
    }
    roleFilter = role as UserRole;
  }

  const where: Prisma.UserWhereInput = {};
  if (roleFilter) {
    where.role = roleFilter;
  }
  if (searchStr) {
    const searchNormalized = normalizeEmail(searchStr);
    where.OR = [
      { name: { contains: searchStr, mode: "insensitive" } },
      { emailNormalized: { contains: searchNormalized } },
    ];
  }

  const prisma = getPrisma();
  const users = await prisma.user.findMany({
    where,
    orderBy: [{ name: "asc" }, { id: "asc" }],
    select: adminUserSelect,
  });

  res.status(200).json({ data: users.map(formatAdminUser) });
}

export async function createAdminUser(req: Request, res: Response) {
  requireAdmin(req);
  bodyFields(req.body, ["name", "email", "role", "isActive", "initialPassword"]);

  const { name, email, role, isActive, initialPassword } = req.body;

  if (typeof name !== "string" || name.trim().length === 0 || name.trim().length > 100) {
    throw new HttpError(400, "VALIDATION_ERROR", "Name must be between 1 and 100 characters.");
  }

  if (!validEmail(email)) {
    throw new HttpError(400, "VALIDATION_ERROR", "Valid email address is required (max 254 characters).");
  }

  if (typeof role !== "string" || !Object.values(UserRole).includes(role as UserRole)) {
    throw new HttpError(400, "VALIDATION_ERROR", "Valid role is required (REQUESTER, IT_STAFF, ADMINISTRATOR).");
  }

  if (typeof isActive !== "boolean") {
    throw new HttpError(400, "VALIDATION_ERROR", "isActive must be a boolean.");
  }

  const pwdErr = passwordError(initialPassword);
  if (pwdErr || typeof initialPassword !== "string") {
    throw new HttpError(400, "VALIDATION_ERROR", pwdErr ?? "Use 15–128 characters.");
  }

  const trimmedEmail = email.trim();
  const normalizedEmail = normalizeEmail(trimmedEmail);

  const prisma = getPrisma();

  // Check duplicate normalized email
  const existing = await prisma.user.findFirst({
    where: { emailNormalized: normalizedEmail },
  });
  if (existing) {
    throw new HttpError(409, "DUPLICATE_EMAIL", "A user with this email address already exists.");
  }

  const passwordHash = await hashPassword(initialPassword);

  try {
    const created = await prisma.user.create({
      data: {
        name: name.trim(),
        email: trimmedEmail,
        emailNormalized: normalizedEmail,
        role: role as UserRole,
        isActive,
        passwordHash,
        mustChangePassword: true,
        passwordChangedAt: null,
      },
      select: adminUserSelect,
    });

    res.status(201).json(formatAdminUser(created));
  } catch (err: any) {
    if (err?.code === "P2002") {
      throw new HttpError(409, "DUPLICATE_EMAIL", "A user with this email address already exists.");
    }
    throw err;
  }
}

export async function updateAdminUser(req: Request, res: Response) {
  const sessionUser = requireAdmin(req);
  const targetId = positiveId(req.params.id, "user");

  bodyFields(req.body, ["name", "email", "role", "isActive"]);
  const body = req.body;
  const allowedKeys = ["name", "email", "role", "isActive"];
  const providedKeys = allowedKeys.filter(k => Object.prototype.hasOwnProperty.call(body, k));

  if (providedKeys.length === 0) {
    throw new HttpError(400, "VALIDATION_ERROR", "At least one field (name, email, role, isActive) must be provided.");
  }

  const { name, email, role, isActive } = body;

  if (name !== undefined) {
    if (typeof name !== "string" || name.trim().length === 0 || name.trim().length > 100) {
      throw new HttpError(400, "VALIDATION_ERROR", "Name must be between 1 and 100 characters.");
    }
  }

  if (email !== undefined) {
    if (!validEmail(email)) {
      throw new HttpError(400, "VALIDATION_ERROR", "Valid email address is required (max 254 characters).");
    }
  }

  if (role !== undefined) {
    if (typeof role !== "string" || !Object.values(UserRole).includes(role as UserRole)) {
      throw new HttpError(400, "VALIDATION_ERROR", "Valid role is required (REQUESTER, IT_STAFF, ADMINISTRATOR).");
    }
  }

  if (isActive !== undefined) {
    if (typeof isActive !== "boolean") {
      throw new HttpError(400, "VALIDATION_ERROR", "isActive must be a boolean.");
    }
  }

  const prisma = getPrisma();

  try {
    const updated = await prisma.$transaction(async tx => {
      // Serialize admin protection checks across concurrent requests
      await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext('admin_user_protection'))");

      const target = await tx.user.findUnique({
        where: { id: targetId },
      });

      if (!target) {
        throw new HttpError(404, "NOT_FOUND", "User not found.");
      }

      // 1. Self-deactivation check (BR-25)
      if (target.id === sessionUser.id && isActive === false) {
        throw new HttpError(409, "SELF_DEACTIVATION", "Administrators cannot deactivate their own account.");
      }

      // 2. Last active administrator protection check (BR-25 / ED-09)
      if (target.role === "ADMINISTRATOR" && target.isActive === true) {
        const isDeactivating = isActive === false;
        const isDemoting = role !== undefined && role !== "ADMINISTRATOR";

        if (isDeactivating || isDemoting) {
          const activeAdminCount = await tx.user.count({
            where: { role: "ADMINISTRATOR", isActive: true },
          });

          if (activeAdminCount <= 1) {
            throw new HttpError(
              409,
              "LAST_ADMIN",
              "Cannot deactivate or demote the last active Administrator."
            );
          }
        }
      }

      // 3. Email duplicate check
      let normalizedEmail: string | undefined;
      let trimmedEmail: string | undefined;
      if (email !== undefined) {
        const trimmed = email.trim();
        trimmedEmail = trimmed;
        normalizedEmail = normalizeEmail(trimmed);

        if (normalizedEmail !== target.emailNormalized) {
          const conflict = await tx.user.findFirst({
            where: {
              emailNormalized: normalizedEmail,
              id: { not: targetId },
            },
          });
          if (conflict) {
            throw new HttpError(409, "DUPLICATE_EMAIL", "A user with this email address already exists.");
          }
        }
      }

      // 4. Ticket unassignment check (BR-27 / ED-09)
      // When an eligible owner becomes inactive or is demoted to REQUESTER, unassign owned tickets.
      const wasEligibleOwner = (target.role === "IT_STAFF" || target.role === "ADMINISTRATOR") && target.isActive;
      const willBeInactive = isActive === false || (isActive === undefined && !target.isActive);
      const willBeRequester = role === "REQUESTER" || (role === undefined && target.role === "REQUESTER");

      if (wasEligibleOwner && (willBeInactive || willBeRequester)) {
        await tx.ticket.updateMany({
          where: { ownerId: targetId },
          data: { ownerId: null },
        });
      }

      // 5. Update user
      const updateData: Prisma.UserUpdateInput = {};
      if (name !== undefined) updateData.name = name.trim();
      if (trimmedEmail !== undefined && normalizedEmail !== undefined) {
        updateData.email = trimmedEmail;
        updateData.emailNormalized = normalizedEmail;
      }
      if (role !== undefined) updateData.role = role as UserRole;
      if (isActive !== undefined) updateData.isActive = isActive;

      const result = await tx.user.update({
        where: { id: targetId },
        data: updateData,
        select: adminUserSelect,
      });

      // 6. Session revocation (BR-10)
      const roleChanged = role !== undefined && role !== target.role;
      const emailChanged = normalizedEmail !== undefined && normalizedEmail !== target.emailNormalized;
      const activationChanged = isActive !== undefined && isActive !== target.isActive;

      if (roleChanged || emailChanged || activationChanged) {
        await revokeUserSessions(tx, targetId);
      }

      return result;
    });

    res.status(200).json(formatAdminUser(updated));
  } catch (err: any) {
    if (err?.code === "P2002") {
      throw new HttpError(409, "DUPLICATE_EMAIL", "A user with this email address already exists.");
    }
    throw err;
  }
}

export async function resetAdminUserInitialPassword(req: Request, res: Response) {
  requireAdmin(req);
  const targetId = positiveId(req.params.id, "user");

  bodyFields(req.body, ["initialPassword"]);
  const { initialPassword } = req.body;

  const pwdErr = passwordError(initialPassword);
  if (pwdErr || typeof initialPassword !== "string") {
    throw new HttpError(400, "VALIDATION_ERROR", pwdErr ?? "Use 15–128 characters.");
  }

  const passwordHash = await hashPassword(initialPassword);
  const prisma = getPrisma();

  const updated = await prisma.$transaction(async tx => {
    const target = await tx.user.findUnique({
      where: { id: targetId },
    });

    if (!target) {
      throw new HttpError(404, "NOT_FOUND", "User not found.");
    }

    const result = await tx.user.update({
      where: { id: targetId },
      data: {
        passwordHash,
        mustChangePassword: true,
        passwordChangedAt: null,
      },
      select: adminUserSelect,
    });

    // Revoke all sessions for target user (BR-10, BR-26)
    await revokeUserSessions(tx, targetId);

    return result;
  });

  res.status(200).json(formatAdminUser(updated));
}
