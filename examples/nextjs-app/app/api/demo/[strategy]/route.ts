import {NextRequest, NextResponse} from 'next/server';
import {increment} from '../../../../lib/counter';
import {isStrategy} from '../../../../lib/strategies';

// CSRF validation for this strategy happens in middleware.ts before this runs.
export async function POST(request: NextRequest, {params}: {params: Promise<{strategy: string}>}) {
    const {strategy} = await params;
    if (!isStrategy(strategy)) {
        return NextResponse.json({error: 'Unknown strategy'}, {status: 404});
    }

    const count = increment();

    // Plain HTML form posts go back to the strategy page; fetch gets JSON.
    const contentType = request.headers.get('content-type') ?? '';
    if (contentType.startsWith('application/x-www-form-urlencoded')) {
        return NextResponse.redirect(new URL(`/demo/${strategy}?submitted=form`, request.url), 303);
    }
    return NextResponse.json({count});
}
