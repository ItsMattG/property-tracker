import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { users, portfolioMembers } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(request: Request) {
  // Require authentication
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get user from database
  const user = await db.query.users.findFirst({
    where: eq(users.clerkId, clerkId),
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 401 });
  }

  const { entityId } = await request.json();

  // Validate entityId - must be user's own ID or a portfolio they have access to
  if (entityId !== user.id) {
    // Check if user is a member of this portfolio
    const membership = await db.query.portfolioMembers.findFirst({
      where: and(
        eq(portfolioMembers.ownerId, entityId),
        eq(portfolioMembers.userId, user.id)
      ),
    });

    // Must have membership AND have actually joined (joinedAt not null)
    if (!membership || !membership.joinedAt) {
      return NextResponse.json(
        { error: "You do not have access to this portfolio" },
        { status: 403 }
      );
    }
  }

  const cookieStore = await cookies();
  cookieStore.set("active_entity_id", entityId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });

  return NextResponse.json({ success: true });
}
