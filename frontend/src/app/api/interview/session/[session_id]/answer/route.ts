import { NextResponse } from "next/server";

export async function POST(request: Request, context: any) {
  const sessionId = context.params.session_id;
  const backendUrl = process.env.BACKEND_URL ?? `http://localhost:8000/interview/session/${sessionId}/answer`;

  const body = await request.json().catch(() => null);

  const resp = await globalThis.fetch(backendUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });

  const payload = await resp.json().catch(() => null);
  return NextResponse.json(payload, { status: resp.status });
}
