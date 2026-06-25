import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { searchSchema, validateInput } from "@/lib/validation";
import { NextResponse } from "next/server";

function findMatchPositions(query: string, target: string): number[] | null {
  const lowerQuery = query.toLowerCase();
  const lowerTarget = target.toLowerCase();
  const positions: number[] = [];

  for (let i = 0; i < lowerTarget.length; i++) {
    if (lowerQuery.includes(lowerTarget[i])) {
      positions.push(i);
    }
  }

  return positions.length > 0 ? positions : null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const validation = validateInput(searchSchema, {
    q: searchParams.get("q")?.trim() || "",
    type: searchParams.get("type") || "video",
  });

  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { q, type } = validation.data;

  if (!q) {
    return NextResponse.json([]);
  }

  if (type === "comment") {
    let session = null;
    try { session = await getSession(); } catch {}

    const comments = await db.comment.findMany({
      include: {
        video: { select: { id: true, title: true, coverUrl: true } },
        author: { select: { id: true, name: true } },
        parent: {
          select: { id: true, content: true, author: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const matched = comments
      .map((comment) => {
        const contentPositions = findMatchPositions(q, comment.content);
        if (contentPositions) {
          return { ...comment, matchField: "content" as const, positions: contentPositions };
        }
        const parentPositions = comment.parent ? findMatchPositions(q, comment.parent.content) : null;
        if (parentPositions) {
          return { ...comment, matchField: "parent" as const, positions: parentPositions };
        }
        return null;
      })
      .filter(Boolean);

    return NextResponse.json(matched.slice(0, 50));
  }

  const videos = await db.video.findMany({
    include: {
      author: { select: { id: true, name: true } },
      _count: { select: { likes: true, favorites: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const matched = videos
    .map((video) => {
      const titlePositions = findMatchPositions(q, video.title);
      if (titlePositions) {
        return { ...video, matchField: "title" as const, positions: titlePositions };
      }
      const descPositions = video.description ? findMatchPositions(q, video.description) : null;
      if (descPositions) {
        return { ...video, matchField: "description" as const, positions: descPositions };
      }
      const authorPositions = findMatchPositions(q, video.author.name);
      if (authorPositions) {
        return { ...video, matchField: "author" as const, positions: authorPositions };
      }
      return null;
    })
    .filter(Boolean);

  return NextResponse.json(matched.slice(0, 50));
}
