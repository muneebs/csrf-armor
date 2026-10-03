'use client';
import {useCsrf} from '@csrf-armor/nextjs/client';
import {useState} from 'react';
import {FetchTest, FormTest} from '../../csrf-tests';
import {incrementForDemo} from './actions';

export function StrategyTests({strategy, formSubmitted, attackerUrl}: {
    strategy: string;
    formSubmitted: boolean;
    attackerUrl: string;
}) {
    const {csrfToken, updateToken} = useCsrf();
    const [actionResult, setActionResult] = useState('');
    const endpoint = `/api/demo/${strategy}`;

    const runAction = async (formData: FormData) => {
        try {
            // Pass formData through: it carries the csrf_token field the
            // middleware checks.
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
                <FormTest endpoint={endpoint} submitted={formSubmitted} />
            </section>

            <section>
                <h2>2. Fetch</h2>
                <p><code>csrfFetch</code> sends the token in the <code>x-csrf-token</code> header.</p>
                <FetchTest endpoint={endpoint} />
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
                    <a id="attacker-link" href={attackerUrl}>attacker page for {strategy}</a>{' '}
                    and submit its forms. Each should fail with a 403.
                </p>
            </section>
        </>
    );
}
