import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "./prisma";
import type { ModuleKey, AccessLevel } from "./permissions";
import { can } from "./permissions";

const COOKIE = "lihcc_session";

function secret() {
  const s = process.env.AUTH_SECRET || "dev-secret-change-me-please-32chars!!";
  return new TextEncoder().encode(s);
}

export type SessionUser = {
  id: string;
  username: string;
  name: string;
  roleName: string;
  permissions: string;
};

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({
    uid: user.id,
    username: user.username,
    name: user.name,
    roleName: user.roleName,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(secret());
}

export async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 12,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(COOKIE);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const uid = String(payload.uid || "");
    if (!uid) return null;
    const user = await prisma.user.findUnique({
      where: { id: uid },
      include: { role: true },
    });
    if (!user || !user.isActive) return null;
    return {
      id: user.id,
      username: user.username,
      name: user.name,
      roleName: user.role.name,
      permissions: user.role.permissions,
    };
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u) throw new Error("UNAUTHENTICATED");
  return u;
}

export async function requireAccess(module: ModuleKey, level: AccessLevel = "view"): Promise<SessionUser> {
  const u = await requireUser();
  if (!can(u.permissions, module, level)) throw new Error("FORBIDDEN");
  return u;
}
