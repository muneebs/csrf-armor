import {NextRequest, NextResponse} from 'next/server';
import {getCount, increment} from '../../../lib/counter';

export const dynamic = 'force-dynamic';

export async function GET() {
    return NextResponse.json({count: getCount()});
}

// CSRF validation happens in middleware.ts before this handler runs.
export async function POST(request: NextRequest) {
    const count = increment();

    // Plain HTML form posts get redirected back to the form page.
    const contentType = request.headers.get('content-type') ?? '';
    if (contentType.startsWith('application/x-www-form-urlencoded')) {
        return NextResponse.redirect(new URL('/form?submitted=1', request.url), 303);
    }

    return NextResponse.json({count});
}
