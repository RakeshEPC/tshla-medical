import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    // Scoring system removed - redirect to AI-based recommendations
    return new NextResponse(JSON.stringify({
      error: 'Scoring system removed. Use pumpDriveAI.service.ts for AI-based recommendations.'
    }), {
      status: 410, // Gone
    });
  } catch (e: any) {
    return new NextResponse(JSON.stringify({ error: e?.message || 'Unknown error' }), {
      status: 400,
    });
  }
}
