export const DEFAULT_GIGACHAT_BASE_URL = 'https://api.giga.chat/v1';
export const DEFAULT_GIGACHAT_AUTH_URL = 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth';

const OAUTH_PATH = '/api/v2/oauth';
const AUTH_ORIGIN = /^(https?:\/\/[^/?#]+)\/*([?#].*)?$/i;

/** Full OAuth endpoint; legacy origin-only values still get the standard path. */
export function resolveGigaChatAuthUrl(value?: string | null): string {
	const url = value?.trim() || DEFAULT_GIGACHAT_AUTH_URL;
	return url.replace(AUTH_ORIGIN, `$1${OAUTH_PATH}$2`);
}

/** Preserve explicitly configured backends, including the legacy Sber endpoint. */
export function resolveGigaChatBaseUrl(value?: string | null): string {
	return value?.trim() || DEFAULT_GIGACHAT_BASE_URL;
}

export function resolveGigaChatUrls(
	credentials: { base_url?: string | null; base_back_url?: string | null } = {},
): { authUrl: string; baseUrl: string } {
	return {
		authUrl: resolveGigaChatAuthUrl(credentials.base_url),
		baseUrl: resolveGigaChatBaseUrl(credentials.base_back_url),
	};
}

// Credential tests and declarative requests are evaluated by n8n, outside this module.
// Generate their expressions from the same defaults and origin-matching rule.
export const GIGACHAT_AUTH_URL_EXPRESSION = `={{ ($credentials.base_url?.trim() || ${JSON.stringify(DEFAULT_GIGACHAT_AUTH_URL)}).replace(${AUTH_ORIGIN.toString()}, '$1${OAUTH_PATH}$2') }}`;
export const GIGACHAT_BASE_URL_EXPRESSION = `={{ $credentials.base_back_url?.trim() || ${JSON.stringify(DEFAULT_GIGACHAT_BASE_URL)} }}`;
