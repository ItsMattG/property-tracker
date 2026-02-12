import { Building2, Shield, Server, Lock } from "lucide-react";

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-(--auth-gradient-from) via-(--auth-gradient-via) to-(--auth-gradient-to) px-4 py-8">
      {/* Geometric dot pattern overlay */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* Glassmorphic card */}
      <div className="relative w-full max-w-[420px] rounded-2xl border border-white/20 bg-white p-8 shadow-2xl">
        {/* Logo + tagline */}
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
            <Building2 className="h-6 w-6 text-primary-foreground" />
          </div>
          <span className="text-xl font-semibold">BrickTrack</span>
          <p className="text-sm text-muted-foreground">
            Track smarter. Tax time sorted.
          </p>
        </div>

        {/* Page-specific form content */}
        {children}

        {/* Trust signals */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t pt-4">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Shield className="h-3 w-3" />
            <span>Bank-grade encryption</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Server className="h-3 w-3" />
            <span>Australian servers</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Lock className="h-3 w-3" />
            <span>Your data stays here</span>
          </div>
        </div>
      </div>
    </div>
  );
}
