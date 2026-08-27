/**
 * GigaChat LangChain client
 */

import { GigaChat } from 'langchain-gigachat';
import { GigaChatClientConfig } from 'gigachat';
import { HttpsAgent } from './HttpsAgent';
import { GigaChatApiClient } from './GigaChatApiClient';
import { resolveGigaChatAuthUrl, resolveGigaChatBaseUrl } from './GigaChatUrls';

class GigaChatLcClientInstance extends GigaChat {
	authorizationKey: string | null = null;
	model: string = '';
	protected _settings: any;
	protected _client: any;

	constructor(config: GigaChatClientConfig = {}) {
		super({
			...config,
			authUrl: resolveGigaChatAuthUrl(config.authUrl),
			baseUrl: resolveGigaChatBaseUrl(config.baseUrl),
			httpsAgent: HttpsAgent,
			model: config.model ?? '',
		});
		this.model = config.model ?? '';
	}

	async updateConfig(config: GigaChatClientConfig) {
		// URL changes must reach the API client even when the key/model is unchanged.
		// Only remember the configuration after initialization succeeds, so retries work.
		await GigaChatApiClient.updateConfig(config);
		this.authorizationKey = config.credentials ?? null;
		this.model = config.model ?? '';
		this._settings = { ...this._settings, ...config, model: this.model };
		this._client = GigaChatApiClient;
	}
}

export const GigaChatLcClient = new GigaChatLcClientInstance({});
