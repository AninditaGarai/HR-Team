import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const formData = await request.formData();
  const backendBase = process.env.BACKEND_URL ?? "http://localhost:8000/resume/upload/analyze";

  const resp = await globalThis.fetch(backendBase, {
    method: "POST",
    body: formData,
  });

  const payload = await resp.json().catch(() => null);
  return NextResponse.json(payload, { status: resp.status });
}