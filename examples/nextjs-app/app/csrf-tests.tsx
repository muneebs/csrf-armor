'use client';
import {useCsrf} from '@csrf-armor/nextjs/client';
import {useState} from 'react';

// A plain HTML form post. The middleware reads the token from the csrf_token
// form field. The route handler redirects back with ?submitted=form.
export function FormTest({endpoint, submitted}: {endpoint: string; submitted: boolean}) {
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

// csrfFetch sends the token in the x-csrf-token header.
export function FetchTest({endpoint}: {endpoint: string}) {
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
