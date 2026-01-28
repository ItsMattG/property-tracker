import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export default async function ReferralPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  // Set referral cookie (30 day expiry)
  const cookieStore = await cookies();
  cookieStore.set("referral_code", code, {
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });

  // Redirect to sign-up
  redirect("/sign-up");
}
