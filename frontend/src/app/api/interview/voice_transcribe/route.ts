import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8000/interview/voice_transcribe";

  const form = await request.formData();
  const file = form.get("file");

  const fd = new FormData();
  fd.append("file", file as any);

  const resp = await globalThis.fetch(backendUrl, {
    method: "POST",
    body: fd,
  });

  const payload = await resp.json().catch(() => null);
  return NextResponse.json(payload, { status: resp.status });
}
