"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSessionToken, setSessionCookie, clearSessionCookie } from "@/lib/auth";
import { audit } from "@/lib/audit";

export async function loginAction(formData: FormData) {
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "");
  const user = await prisma.user.findFirst({
    where: { username: { equals: username } },
    include: { role: true },
  });
  if (!user || !user.isActive) throw new Error("Invalid username or password.");
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw new Error("Invalid username or password.");
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  const token = await createSessionToken({
    id: user.id,
    username: user.username,
    name: user.name,
    roleName: user.role.name,
    permissions: user.role.permissions,
  });
  await setSessionCookie(token);
  await audit({
    user: { id: user.id, username: user.username, name: user.name, roleName: user.role.name, permissions: user.role.permissions },
    action: "LOGIN",
    entityType: "User",
    entityId: user.id,
    entityLabel: user.username,
  });
  redirect("/dashboard");
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/login");
}
