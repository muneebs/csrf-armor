import {cookies} from 'next/headers';
import {APP_COOKIE_NAME} from '../../lib/config';
import {getCount} from '../../lib/counter';
import {incrementCounter} from './actions';

export const dynamic = 'force-dynamic';

export default async function ActionsPage() {
    const csrfToken = (await cookies()).get(APP_COOKIE_NAME)?.value ?? '';

    return (
        <main>
            <h1>Server actions</h1>
            <p>
                A server component with a server action. Server actions are POSTs, so the
                middleware checks the <code>csrf_token</code> field before the action runs.
            </p>
            <p>Counter: <code id="count">{getCount()}</code></p>
            <form action={incrementCounter}>
                <input type="hidden" name="csrf_token" value={csrfToken} />
                <button type="submit" id="form-action">Increment with a server action</button>
            </form>
        </main>
    );
}
