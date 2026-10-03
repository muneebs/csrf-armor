'use client';
import {useCsrf} from '@csrf-armor/nextjs/client';
import {useState} from 'react';

export function FormTest({endpoint, submitted}: Readonly<{endpoint: string; submitted: boolean}>) {
    const {csrfToken} = useCsrf();

    return (
        <>
            <form method="post" action={endpoint}>
                <input type="hidden" name="csrf_token" value={csrfToken ?? ''} />
                <button type="submit" id="form-submit" disabled={!csrfToken}>Submit form</button>
            </form>
            {submitted && <p>Result: <code id="form-result">submitted</code></p>}
        </>
    );
}

export function FetchTest({endpoint}: Readonly<{endpoint: string}>) {
    const {csrfToken, csrfFetch} = useCsrf();
    const [result, setResult] = useState('');

    const run = async () => {
        const response = await csrfFetch(endpoint, {method: 'POST'});
        setResult(`${response.status} ${JSON.stringify(await response.json())}`);
    };

    return (
        <>
            <button type="button" id="fetch-submit" onClick={run} disabled={!csrfToken}>
                Send fetch request
            </button>
            <p>Result: <code id="fetch-result">{result}</code></p>
        </>
    );
}
