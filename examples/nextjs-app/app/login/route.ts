import {NextResponse} from 'next/server';
import {SESSION_COOKIE} from '../../lib/session';

// Starts a new fake session. Each call issues a fresh id, so logging in twice
// switches to a different session.
export async function POST() {
    const sessionId = crypto.randomUUID();
    const response = NextResponse.json({session: sessionId});
    response.cookies.set(SESSION_COOKIE, sessionId, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
    });
    return response;
}
