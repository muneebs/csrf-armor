import { useEffect, useState, useCallback } from 'react';
import { getCsrfToken, csrfFetch, type CsrfClientConfig } from './client.js';

export function useCsrf(config?: CsrfClientConfig) {
	const [csrfToken, setCsrfToken] = useState<string | null>(null);

	useEffect(() => {
		const updateToken = (): void => {
			setCsrfToken(getCsrfToken(config));
		};

		updateToken();

		// Check for token updates periodically
		const interval = setInterval(updateToken, 1000);

		return () => clearInterval(interval);
	}, [config]);

	const secureFetch = useCallback(
		(input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
			return csrfFetch(input, init, config);
		},
		[config],
	);

	return { csrfToken, csrfFetch: secureFetch };
}
