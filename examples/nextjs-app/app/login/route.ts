import {NextResponse} from 'next/server';
import {SESSION_COOKIE} from '../../lib/session';

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
