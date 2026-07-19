import { NextResponse } from "next/server";
import { getRenormalizeProgress } from "@/lib/audio-queue";
import { db } from "@/lib/db";

export async function GET() {
  const progress = await getRenormalizeProgress();
  return NextResponse.json(progress);
}

export async function POST() {
  await db.renormalizeProgress.upsert({
    where: { id: "singleton" },
    update: { isRunning: false, pending: 0 },
    create: { id: "singleton", total: 0, completed: 0, failed: 0, pending: 0, isRunning: false },
  });
  return NextResponse.json({ success: true });
}
