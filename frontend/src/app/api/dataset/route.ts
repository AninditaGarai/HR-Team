import { NextResponse } from "next/server";
import { getDatasetStats } from "@/lib/resume-analysis";

export async function GET() {
  const stats = await getDatasetStats();

  return NextResponse.json(stats);
}
