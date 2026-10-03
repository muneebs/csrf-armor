import {STRATEGIES, isStrategy} from '../../lib/strategies';

export const dynamic = 'force-dynamic';

// Forged cross-site form posts. Open this page from a different origin than
// the target (for example http://127.0.0.1:3000/attacker) so the browser sends
// a foreign Origin header. It needs no client JavaScript.
// ?strategy=<name> shows only that strategy's forms.
export default async function AttackerPage({searchParams}: {
    searchParams: Promise<{strategy?: string}>;
}) {
    const origin = `http://localhost:${process.env.PORT ?? '3000'}`;
    const {strategy} = await searchParams;
    const targets = strategy && isStrategy(strategy) ? [strategy] : STRATEGIES;

    return (
        <main>
            <h1>Attacker page</h1>
            <p>
                Each form posts to the app at <code>{origin}</code> without a valid CSRF token,
                the way a malicious site would. Every submission should fail with a 403.
            </p>

            {targets.map((s) => (
                <section key={s}>
                    <h2><code>{s}</code></h2>
                    <form method="post" action={`${origin}/api/demo/${s}`}>
                        <button type="submit" id={`forge-${s}`}>Send forged request (no token)</button>
                    </form>
                    <form method="post" action={`${origin}/api/demo/${s}`}>
                        <input type="hidden" name="csrf_token" value="attacker-guessed-token" />
                        <button type="submit" id={`forge-guessed-${s}`}>
                            Send forged request (guessed token)
                        </button>
                    </form>
                </section>
            ))}

            {!strategy && (
                <section>
                    <h2>App counter (<code>CSRF_STRATEGY</code>)</h2>
                    <form method="post" action={`${origin}/api/counter`}>
                        <input type="hidden" name="amount" value="1" />
                        <button type="submit" id="forge">Send forged request</button>
                    </form>
                </section>
            )}
        </main>
    );
}
