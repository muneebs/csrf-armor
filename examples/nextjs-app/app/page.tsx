import {cookies} from 'next/headers';
import {getCount} from '../lib/counter';
import {SESSION_COOKIE} from '../lib/session';
import {LoginButton} from './login-button';

export const dynamic = 'force-dynamic';

export default async function Home() {
    const session = (await cookies()).get(SESSION_COOKIE)?.value;

    return (
        <main>
            <h1>CSRF Armor: Next.js example</h1>
            <ul>
                <li>Strategy: <code id="strategy">{process.env.CSRF_STRATEGY ?? 'signed-double-submit'}</code></li>
                <li>Session binding: <code>{process.env.CSRF_SESSION_BINDING === 'true' ? 'on' : 'off'}</code></li>
                <li>Token expiry: <code>{process.env.CSRF_TOKEN_EXPIRY ?? '3600'}s</code></li>
                <li>Session: <code id="session">{session ?? 'anonymous'}</code></li>
                <li>Counter: <code id="count">{getCount()}</code></li>
            </ul>
            <LoginButton />
            <p>
                Use the <a href="/form">form page</a> (plain HTML form post) or the{' '}
                <a href="/fetch">fetch page</a> (<code>csrfFetch</code>) to increment the counter.
                The <a href="/attacker">attacker page</a> posts without a token; open it from a
                different origin (for example <code>http://127.0.0.1:3000/attacker</code>) to see
                origin checks reject it.
            </p>
        </main>
    );
}
