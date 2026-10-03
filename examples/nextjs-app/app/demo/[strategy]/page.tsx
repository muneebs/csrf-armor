import {CsrfProvider} from '@csrf-armor/nextjs/client';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {getCount} from '../../../lib/counter';
import {STRATEGY_NOTES, demoCookieName, isStrategy} from '../../../lib/strategies';
import {StrategyTests} from './strategy-tests';

export const dynamic = 'force-dynamic';

// The middleware protects /demo/<strategy> (including server action posts to
// it) and /api/demo/<strategy> with that strategy. Its token lives in the
// csrf-<strategy> cookie, so the tests get their own CsrfProvider for it.
export default async function StrategyDemoPage({params, searchParams}: {
    params: Promise<{strategy: string}>;
    searchParams: Promise<{submitted?: string}>;
}) {
    const {strategy} = await params;
    if (!isStrategy(strategy)) notFound();
    const {submitted} = await searchParams;

    return (
        <main>
            <h1>Strategy: <code id="strategy">{strategy}</code></h1>
            <p><Link href="/">&larr; Back to strategy list</Link></p>
            <p><strong>Notes:</strong> {STRATEGY_NOTES[strategy]}</p>
            <p>Counter: <code id="count">{getCount()}</code></p>

            <CsrfProvider config={{cookieName: demoCookieName(strategy)}}>
                <StrategyTests strategy={strategy} formSubmitted={submitted === 'form'} />
            </CsrfProvider>
        </main>
    );
}
