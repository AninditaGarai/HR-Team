import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const format = url.searchParams.get("format") ?? "json";
  const evaluatedOnly = url.searchParams.get("evaluated_only") ?? "false";
  const limit = url.searchParams.get("limit") ?? "200";

  const backendBase = process.env.BACKEND_URL ?? "http://localhost:8000/interview/sessions/export";
  const backendUrl = new URL(backendBase);
  backendUrl.searchParams.set("format", format);
  backendUrl.searchParams.set("evaluated_only", evaluatedOnly);
  backendUrl.searchParams.set("limit", limit);

  const resp = await globalThis.fetch(backendUrl.toString());
  const payload = await resp.text();

  return new NextResponse(payload, {
    status: resp.status,
    headers: {
      "Content-Type": resp.headers.get("content-type") ?? "application/octet-stream",
      "Content-Disposition": resp.headers.get("content-disposition") ?? "attachment",
    },
  });
}