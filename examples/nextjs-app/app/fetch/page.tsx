'use client';
import {useCsrf} from '@csrf-armor/nextjs/client';
import {useState} from 'react';

export default function FetchPage() {
    const {csrfToken, csrfFetch} = useCsrf();
    const [result, setResult] = useState('');

    const increment = async () => {
        const response = await csrfFetch('/api/counter', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({}),
        });
        setResult(`${response.status} ${JSON.stringify(await response.json())}`);
    };

    return (
        <main>
            <h1>Fetch</h1>
            <p><code>csrfFetch</code> sends the token in the <code>x-csrf-token</code> header.</p>
            <button type="button" id="increment" onClick={increment} disabled={!csrfToken}>
                Increment counter
            </button>
            <p>Result: <code id="result">{result}</code></p>
        </main>
    );
}
