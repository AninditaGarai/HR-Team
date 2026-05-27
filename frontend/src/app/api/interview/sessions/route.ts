import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const backendBase = process.env.BACKEND_URL ?? "http://localhost:8000/interview/sessions";
  const backendUrl = new URL(backendBase);
  backendUrl.search = url.search;
  const resp = await globalThis.fetch(backendUrl.toString());
  const payload = await resp.json().catch(() => null);
  return NextResponse.json(payload, { status: resp.status });
}
