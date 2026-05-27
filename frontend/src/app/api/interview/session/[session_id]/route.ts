import { NextResponse } from "next/server";

export async function GET(request: Request, context: any) {
  const sessionId = context.params.session_id;
  const backendUrl = process.env.BACKEND_URL ?? `http://localhost:8000/interview/session/${sessionId}`;
  const resp = await globalThis.fetch(backendUrl);
  const payload = await resp.json().catch(() => null);
  return NextResponse.json(payload, { status: resp.status });
}

export async function DELETE(request: Request, context: any) {
  const sessionId = context.params.session_id;
  const backendUrl = process.env.BACKEND_URL ?? `http://localhost:8000/interview/session/${sessionId}`;
  const resp = await globalThis.fetch(backendUrl, { method: "DELETE" });
  const payload = await resp.json().catch(() => null);
  return NextResponse.json(payload, { status: resp.status });
}
