import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import type { SermonDTO } from "@/lib/types";

export const runtime = "nodejs";

function toDTO(s: any): SermonDTO {
  return {
    id: s.id,
    title: s.title,
    speaker: s.speaker,
    date: s.date.toISOString(),
    description: s.description,
    scriptureReference: s.scriptureReference,
    audioUrl: s.audioUrl,
    videoUrl: s.videoUrl,
    coverImageUrl: s.coverImageUrl,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (id) {
    const sermon = await db.sermon.findUnique({ where: { id } });
    if (!sermon) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ sermon: toDTO(sermon) });
  }

  const sermons = await db.sermon.findMany({
    orderBy: { date: "desc" },
    take: 100,
  });

  return NextResponse.json({ sermons: sermons.map(toDTO) });
}

// POST /api/sermons (admin)
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { title, speaker, date, description, scriptureReference, audioUrl, videoUrl, coverImageUrl } = body;

  if (!title?.trim() || !speaker?.trim() || !date) {
    return NextResponse.json({ error: "Title, speaker, and date are required." }, { status: 400 });
  }

  const sermon = await db.sermon.create({
    data: {
      title: title.trim(),
      speaker: speaker.trim(),
      date: new Date(date),
      description: description || null,
      scriptureReference: scriptureReference || null,
      audioUrl: audioUrl || null,
      videoUrl: videoUrl || null,
      coverImageUrl: coverImageUrl || null,
      createdById: session.id,
    },
  });

  return NextResponse.json({ sermon: toDTO(sermon) }, { status: 201 });
}

// PATCH /api/sermons (admin) — body: { id, ...updates }
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const data: any = {};
  for (const f of ["title", "speaker", "description", "scriptureReference", "audioUrl", "videoUrl", "coverImageUrl"]) {
    if (updates[f] !== undefined) data[f] = updates[f] || null;
  }
  if (updates.date) data.date = new Date(updates.date);

  const sermon = await db.sermon.update({ where: { id }, data });
  return NextResponse.json({ sermon: toDTO(sermon) });
}

// DELETE /api/sermons?id=...
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  await db.sermon.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
