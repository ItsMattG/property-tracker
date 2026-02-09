import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/**
 * GET: Read the httpOnly referral_code cookie.
 * DELETE: Clear it after successful referral recording.
 */
export async function GET() {
  const cookieStore = await cookies();
  const code = cookieStore.get("referral_code")?.value;
  return NextResponse.json({ code: code ?? null });
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete("referral_code");
  return NextResponse.json({ ok: true });
}
