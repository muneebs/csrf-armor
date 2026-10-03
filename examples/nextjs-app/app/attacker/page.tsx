// A forged cross-site form post. Open it from a different origin than the
// target (for example http://127.0.0.1:3000/attacker) so the browser sends a
// foreign Origin header. It needs no client JavaScript.
export default function AttackerPage() {
    const target = `http://localhost:${process.env.PORT ?? '3000'}/api/counter`;

    return (
        <main>
            <h1>Attacker page</h1>
            <p>Posts to <code>{target}</code> without a CSRF token.</p>
            <form method="post" action={target}>
                <input type="hidden" name="amount" value="1" />
                <button type="submit" id="forge">Send forged request</button>
            </form>
        </main>
    );
}
