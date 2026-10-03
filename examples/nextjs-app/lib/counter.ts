import {NextRequest, NextResponse} from 'next/server';

// In-memory counter so you can see whether a POST got through. Kept on
// globalThis so it survives dev-server module reloads.
const store = globalThis as typeof globalThis & {__csrfDemoCount?: number};

export function getCount(): number {
    return store.__csrfDemoCount ?? 0;
}

export function increment(): number {
    store.__csrfDemoCount = getCount() + 1;
    return store.__csrfDemoCount;
}

// Increments for a route handler. Plain HTML form posts are redirected to
// formRedirect; fetch calls get JSON.
export function incrementResponse(request: NextRequest, formRedirect: string): NextResponse {
    const count = increment();
    const contentType = request.headers.get('content-type') ?? '';
    if (contentType.startsWith('application/x-www-form-urlencoded')) {
        return NextResponse.redirect(new URL(formRedirect, request.url), 303);
    }
    return NextResponse.json({count});
}
