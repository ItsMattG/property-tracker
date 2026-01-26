import { NextResponse } from "next/server";

// Health check endpoint for CI/CD and monitoring
// Returns 200 OK without requiring authentication
export async function GET() {
  return NextResponse.json({ status: "ok", timestamp: new Date().toISOString() });
}
