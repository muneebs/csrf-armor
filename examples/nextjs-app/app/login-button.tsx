'use client';
import { useCsrf } from '@csrf-armor/nextjs/client';

export function LoginButton() {
  const { csrfToken, csrfFetch } = useCsrf();

  const login = async () => {
    const response = await csrfFetch('/login', { method: 'POST' });
    if (response.ok) window.location.reload();
    else alert(`Login failed: ${response.status}`);
  };

  return (
    <button type="button" id="login" onClick={login} disabled={!csrfToken}>
      Log in (new fake session)
    </button>
  );
}
