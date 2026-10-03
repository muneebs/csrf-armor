'use client';
import {useCsrf} from '@csrf-armor/nextjs/client';
import {useState} from 'react';
import {incrementForDemo} from './actions';

export function StrategyTests({strategy, formSubmitted}: {
    strategy: string;
    formSubmitted: boolean;
}) {
    const {csrfToken, csrfFetch, updateToken} = useCsrf();
    const [fetchResult, setFetchResult] = useState('');
    const [actionResult, setActionResult] = useState('');
    const endpoint = `/api/demo/${strategy}`;

    const runFetch = async () => {
        const response = await csrfFetch(endpoint, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({}),
        });
        setFetchResult(`${response.status} ${JSON.stringify(await response.json())}`);
    };

    const runAction = async (formData: FormData) => {
        try {
            const count = await incrementForDemo(strategy, formData);
            setActionResult(`ok, count ${count}`);
        } catch {
            setActionResult('rejected');
        }
        // The action response rotated the CSRF cookie; pick up the new token.
        updateToken();
    };

    return (
        <>
            <section>
                <h2>1. Form</h2>
                <p>A plain HTML form post with the token in a hidden <code>csrf_token</code> field.</p>
                <form method="post" action={endpoint}>
                    <input type="hidden" name="csrf_token" value={csrfToken ?? ''} />
                    <button type="submit" id="form-submit" disabled={!csrfToken}>Submit form</button>
                </form>
                {formSubmitted && <p>Result: <code id="form-result">submitted</code></p>}
            </section>

            <section>
                <h2>2. Fetch</h2>
                <p><code>csrfFetch</code> sends the token in the <code>x-csrf-token</code> header.</p>
                <button type="button" id="fetch-submit" onClick={runFetch} disabled={!csrfToken}>
                    Send fetch request
                </button>
                <p>Result: <code id="fetch-result">{fetchResult}</code></p>
            </section>

            <section>
                <h2>3. Server action</h2>
                <p>A server action form with the token in a hidden <code>csrf_token</code> field.</p>
                <form action={runAction}>
                    <input type="hidden" name="csrf_token" value={csrfToken ?? ''} />
                    <button type="submit" id="action-submit" disabled={!csrfToken}>Run server action</button>
                </form>
                <p>Result: <code id="action-result">{actionResult}</code></p>
            </section>

            <section>
                <h2>4. Attacker</h2>
                <p>
                    Forged posts from another origin. Open the{' '}
                    <a id="attacker-link" href={`http://127.0.0.1:3000/attacker?strategy=${strategy}`}>
                        attacker page for {strategy}
                    </a>{' '}
                    and submit its forms. Each should fail with a 403.
                </p>
            </section>
        </>
    );
}
