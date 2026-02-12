import { getAuthSession } from "@/lib/auth";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { users, portfolioMembers } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 401 });
  }

  const { ownerId } = await request.json();

  if (ownerId) {
    // Switching to another user's portfolio — verify membership
    if (ownerId !== user.id) {
      const membership = await db.query.portfolioMembers.findFirst({
        where: and(
          eq(portfolioMembers.ownerId, ownerId),
          eq(portfolioMembers.userId, user.id)
        ),
      });

      if (!membership || !membership.joinedAt) {
        return NextResponse.json(
          { error: "You do not have access to this portfolio" },
          { status: 403 }
        );
      }
    }

    const cookieStore = await cookies();
    cookieStore.set("portfolio_owner_id", ownerId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365, // 1 year
    });
  } else {
    // Clearing — switch back to own portfolio
    const cookieStore = await cookies();
    cookieStore.delete("portfolio_owner_id");
  }

  return NextResponse.json({ success: true });
}
