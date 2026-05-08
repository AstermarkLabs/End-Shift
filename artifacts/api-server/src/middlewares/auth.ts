import type { Request, Response, NextFunction, RequestHandler } from "express";
import { db, usersTable, rolesTable, type User, type Role } from "@workspace/db";
import { eq } from "drizzle-orm";
import { verifyAccessToken } from "../lib/auth";

export interface AuthedUser extends User {
  role: Role;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthedUser;
    }
  }
}

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header) return null;
  const m = /^Bearer\s+(.+)$/.exec(header);
  return m ? m[1] : null;
}

export const requireAuth: RequestHandler = async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (!token) {
      res.status(401).json({ error: "Missing bearer token" });
      return;
    }
    const payload = verifyAccessToken(token);
    const rows = await db
      .select({
        user: usersTable,
        role: rolesTable,
      })
      .from(usersTable)
      .innerJoin(rolesTable, eq(usersTable.roleId, rolesTable.id))
      .where(eq(usersTable.id, payload.sub))
      .limit(1);
    if (rows.length === 0 || !rows[0].user.isActive) {
      res.status(401).json({ error: "Invalid session" });
      return;
    }
    req.user = { ...rows[0].user, role: rows[0].role };
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
};

/**
 * Block any non-auth, non-self-update request when the authenticated user
 * still owes a forced password change.  Mounted globally after `requireAuth`
 * for all routes that should be gated by password rotation.
 */
export const blockIfMustChangePassword: RequestHandler = (req, res, next) => {
  const u = req.user;
  if (!u || !u.mustChangePassword) {
    next();
    return;
  }
  // Allow reading own profile and submitting the password change itself.
  const path = req.path;
  const method = req.method.toUpperCase();
  const isSelfRead = method === "GET" && path === "/me";
  const isSelfUpdate = method === "PUT" && path === "/me";
  if (isSelfRead || isSelfUpdate) {
    next();
    return;
  }
  res.status(403).json({
    error: "Password change required",
    code: "must_change_password",
  });
};

export function requireRight(right: string): RequestHandler {
  return (req, res, next) => {
    const u = req.user;
    if (!u) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    if (!u.role.rights.includes(right) && !u.role.isSystem) {
      res.status(403).json({ error: `Missing right: ${right}` });
      return;
    }
    next();
  };
}

/** Authorise the request if the user has any of the listed rights. */
export function requireAnyRight(...rights: string[]): RequestHandler {
  return (req, res, next) => {
    const u = req.user;
    if (!u) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    if (u.role.isSystem) {
      next();
      return;
    }
    if (rights.some((r) => u.role.rights.includes(r))) {
      next();
      return;
    }
    res.status(403).json({ error: `Missing right: ${rights.join(" or ")}` });
  };
}
