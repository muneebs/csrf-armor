import { FetchTest } from '../csrf-tests';

export default function FetchPage() {
  return (
    <main>
      <h1>Fetch</h1>
      <p>
        <code>csrfFetch</code> sends the token in the <code>x-csrf-token</code>{' '}
        header.
      </p>
      <FetchTest endpoint="/api/counter" />
    </main>
  );
}
