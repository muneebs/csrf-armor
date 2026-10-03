import {NextRequest, NextResponse} from 'next/server';

const store = globalThis as typeof globalThis & {__csrfDemoCount?: number};

export function getCount(): number {
    return store.__csrfDemoCount ?? 0;
}

export function increment(): number {
    store.__csrfDemoCount = getCount() + 1;
    return store.__csrfDemoCount;
}

export function incrementResponse(request: NextRequest, formRedirect: string): NextResponse {
    const count = increment();
    const contentType = request.headers.get('content-type') ?? '';
    if (contentType.startsWith('application/x-www-form-urlencoded')) {
        return NextResponse.redirect(new URL(formRedirect, request.url), 303);
    }
    return NextResponse.json({count});
}
