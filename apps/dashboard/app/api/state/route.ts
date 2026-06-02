import { NextResponse } from "next/server";
import { performance } from "@openalpha/analytics";
import { loadState } from "../../../lib/load-state.ts";

export const dynamic = "force-dynamic";

/** JSON state endpoint — also handy for the bots and external tooling. */
export async function GET() {
  const { state, source } = await loadState();
  const perf = performance(state.meta.startingSol, state.positions);
  return NextResponse.json({ source, performance: perf, state });
}
