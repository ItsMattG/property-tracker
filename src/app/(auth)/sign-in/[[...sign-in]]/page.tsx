import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary">
      <SignIn
        signInForceRedirectUrl="/dashboard"
        appearance={{
          elements: {
            formButtonPrimary: "bg-primary hover:bg-primary-hover",
            card: "shadow-lg",
          },
        }}
      />
    </div>
  );
}
