import { NextRequest, NextResponse } from 'next/server';
import { getCount, incrementResponse } from '../../../lib/counter';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ count: getCount() });
}

export async function POST(request: NextRequest) {
  return incrementResponse(request, '/form?submitted=form');
}
