import {NextRequest, NextResponse} from 'next/server';
import {incrementResponse} from '../../../../lib/counter';
import {isStrategy} from '../../../../lib/strategies';

// CSRF validation for this strategy happens in middleware.ts before this runs.
export async function POST(request: NextRequest, {params}: {params: Promise<{strategy: string}>}) {
    const {strategy} = await params;
    if (!isStrategy(strategy)) {
        return NextResponse.json({error: 'Unknown strategy'}, {status: 404});
    }
    return incrementResponse(request, `/demo/${strategy}?submitted=form`);
}
