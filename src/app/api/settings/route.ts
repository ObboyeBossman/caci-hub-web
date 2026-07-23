import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import type { AssemblySettingsDTO } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const settings = await db.assemblySetting.findFirst();
  if (!settings) {
    return NextResponse.json({
      settings: {
        id: "default",
        assemblyName: "Assakae Central Assembly",
        assemblyLocation: "Assakae District",
        assemblyAddress: null,
        contactPhone: null,
        contactEmail: null,
        defaultPassword: "CACI@2026!",
        forcePasswordReset: true,
      } as AssemblySettingsDTO,
    });
  }

  return NextResponse.json({
    settings: {
      id: settings.id,
      assemblyName: settings.assemblyName,
      assemblyLocation: settings.assemblyLocation,
      assemblyAddress: settings.assemblyAddress,
      contactPhone: settings.contactPhone,
      contactEmail: settings.contactEmail,
      defaultPassword: settings.defaultPassword,
      forcePasswordReset: settings.forcePasswordReset,
    } as AssemblySettingsDTO,
  });
}

// PATCH (admin)
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const existing = await db.assemblySetting.findFirst();

  const data: any = {};
  for (const f of [
    "assemblyName", "assemblyLocation", "assemblyAddress",
    "contactPhone", "contactEmail", "defaultPassword", "forcePasswordReset",
  ]) {
    if (body[f] !== undefined) data[f] = body[f];
  }

  let settings;
  if (existing) {
    settings = await db.assemblySetting.update({ where: { id: existing.id }, data });
  } else {
    settings = await db.assemblySetting.create({ data });
  }

  return NextResponse.json({
    settings: {
      id: settings.id,
      assemblyName: settings.assemblyName,
      assemblyLocation: settings.assemblyLocation,
      assemblyAddress: settings.assemblyAddress,
      contactPhone: settings.contactPhone,
      contactEmail: settings.contactEmail,
      defaultPassword: settings.defaultPassword,
      forcePasswordReset: settings.forcePasswordReset,
    } as AssemblySettingsDTO,
  });
}
