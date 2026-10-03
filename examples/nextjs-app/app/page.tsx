import { cookies } from 'next/headers';
import Link from 'next/link';
import {
  ATTACKER_ORIGIN,
  sessionBinding,
  strategy,
  tokenExpiry,
} from '../lib/config';
import { getCount } from '../lib/counter';
import { SESSION_COOKIE } from '../lib/session';
import { STRATEGIES } from '../lib/strategies';
import { LoginButton } from './login-button';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const session = (await cookies()).get(SESSION_COOKIE)?.value;

  return (
    <main>
      <h1>CSRF Armor: Next.js example</h1>

      <h2>Strategy demos</h2>
      <p>Select a CSRF protection strategy to test:</p>
      <ul id="strategies">
        {STRATEGIES.map((s) => (
          <li key={s}>
            <Link href={`/demo/${s}`}>{s}</Link>
          </li>
        ))}
      </ul>

      <h2>App configuration</h2>
      <p>
        The pages below use the strategy set with <code>CSRF_STRATEGY</code>,
        plus the optional session binding and expiry settings.
      </p>
      <ul>
        <li>
          Strategy: <code id="strategy">{strategy}</code>
        </li>
        <li>
          Session binding: <code>{sessionBinding ? 'on' : 'off'}</code>
        </li>
        <li>
          Token expiry: <code>{tokenExpiry}s</code>
        </li>
        <li>
          Session: <code id="session">{session ?? 'anonymous'}</code>
        </li>
        <li>
          Counter: <code id="count">{getCount()}</code>
        </li>
      </ul>
      <LoginButton />
      <p>
        Use the <a href="/form">form page</a> (plain HTML form post), the{' '}
        <a href="/fetch">fetch page</a> (<code>csrfFetch</code>) or the{' '}
        <a href="/actions">server actions page</a> to increment the counter. The{' '}
        <a href={`${ATTACKER_ORIGIN}/attacker`}>attacker page</a> posts from a
        different origin without a token, so origin checks reject it.
      </p>
    </main>
  );
}
