import { NextResponse } from "next/server";
import { publicCatalog } from "@/lib/datasets/catalog";

export function GET() {
  return NextResponse.json({ datasets: publicCatalog() });
}
