import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "il-bandito-reservas",
    timestamp: new Date().toISOString(),
  });
}
