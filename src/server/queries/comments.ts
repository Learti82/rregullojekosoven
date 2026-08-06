import "server-only";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/permissions";
import type { CommentNode } from "@/types";

/**
 * Fetch a report's whole comment thread in one query and assemble the tree in
 * memory. Threads are shallow by design (one reply level in the UI), so this
 * avoids the N+1 that recursive fetching would cause.
 */
export async function getCommentTree(reportId: string): Promise<CommentNode[]> {
  const viewer = await getCurrentUser();

  const [rows, likes] = await Promise.all([
    prisma.comment.findMany({
      where: { reportId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            image: true,
            role: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    viewer
      ? prisma.commentLike.findMany({
          where: { userId: viewer.id, comment: { reportId } },
          select: { commentId: true },
        })
      : Promise.resolve([]),
  ]);

  const likedIds = new Set(likes.map((l) => l.commentId));
  const nodes = new Map<string, CommentNode>();
  const roots: CommentNode[] = [];

  for (const row of rows) {
    nodes.set(row.id, {
      ...row,
      // Deleted comments keep their slot so replies stay readable.
      body: row.isDeleted ? "" : row.body,
      likedByViewer: likedIds.has(row.id),
      replies: [],
    } as CommentNode);
  }

  for (const row of rows) {
    const node = nodes.get(row.id)!;
    if (row.parentId && nodes.has(row.parentId)) {
      nodes.get(row.parentId)!.replies.push(node);
    } else {
      roots.push(node);
    }
  }

  // Newest root comments first; replies stay chronological.
  return roots.reverse();
}

export async function getCommentCount(reportId: string): Promise<number> {
  return prisma.comment.count({ where: { reportId, isDeleted: false } });
}
