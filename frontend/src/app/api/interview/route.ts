import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { category?: string; keywords?: string[] }
    | null;

  // Forward to backend FastAPI service running on localhost:8000
  const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8000/interview/generate";

  const resp = await globalThis.fetch(backendUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });

  const payload = await resp.json().catch(() => null);
  return NextResponse.json(payload, { status: resp.status });
}
