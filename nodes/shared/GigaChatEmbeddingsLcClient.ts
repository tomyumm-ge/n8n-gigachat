/**
 * GigaChat Embeddings LangChain client
 */

import { GigaChatEmbeddings } from 'langchain-gigachat';
import { GigaChatClientConfig } from 'gigachat';
import { HttpsAgent } from './HttpsAgent';
import { GigaChatApiClient } from './GigaChatApiClient';
import { resolveGigaChatAuthUrl, resolveGigaChatBaseUrl } from './GigaChatUrls';

class GigaChatEmbeddingsLcClientInstance extends GigaChatEmbeddings {
	authorizationKey: string | null = null;
	model: string = 'Embeddings';
	protected _settings: any;
	protected _client: any;

	constructor(config: GigaChatClientConfig = {}) {
		super({
			...config,
			authUrl: resolveGigaChatAuthUrl(config.authUrl),
			baseUrl: resolveGigaChatBaseUrl(config.baseUrl),
			httpsAgent: HttpsAgent,
			model: config.model ?? 'Embeddings',
		});
		this.model = config.model ?? 'Embeddings';
	}

	async updateConfig(config: GigaChatClientConfig) {
		await GigaChatApiClient.updateConfig(config);
		this.authorizationKey = config.credentials ?? null;
		this.model = config.model ?? 'Embeddings';
		this.clientConfig = { ...this.clientConfig, ...config, model: this.model } as any;
		this._client = GigaChatApiClient as any;
	}
}

export const GigaChatEmbeddingsLcClient = new GigaChatEmbeddingsLcClientInstance({});
