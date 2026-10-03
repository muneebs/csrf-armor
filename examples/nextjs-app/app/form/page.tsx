'use client';
import {useCsrf} from '@csrf-armor/nextjs/client';
import {useSearchParams} from 'next/navigation';
import {Suspense} from 'react';

function CounterForm() {
    const {csrfToken} = useCsrf();
    const submitted = useSearchParams().get('submitted');

    return (
        <form method="post" action="/api/counter">
            {/* The middleware reads the token from the csrf_token form field */}
            <input type="hidden" name="csrf_token" value={csrfToken ?? ''} />
            <button type="submit" id="submit" disabled={!csrfToken}>
                Increment counter
            </button>
            {submitted && <p id="result">Submitted. Check the counter on the home page.</p>}
        </form>
    );
}

export default function FormPage() {
    return (
        <main>
            <h1>HTML form</h1>
            <p>A plain form post with the token in a hidden <code>csrf_token</code> field.</p>
            <Suspense>
                <CounterForm />
            </Suspense>
        </main>
    );
}
