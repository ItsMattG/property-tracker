import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary">
      <SignUp
        forceRedirectUrl="/dashboard"
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
