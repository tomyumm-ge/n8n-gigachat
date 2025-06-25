/**
 * GigaChat Embeddings LangChain client
 */

import { GigaChatEmbeddings } from 'langchain-gigachat';
import { GigaChatClientConfig } from 'gigachat';
import { HttpsAgent } from './HttpsAgent';
import { GigaChatApiClient } from './GigaChatApiClient';

class GigaChatEmbeddingsLcClientInstance extends GigaChatEmbeddings {
	authorizationKey: string | null = null;
	model: string = 'Embeddings';
	protected _settings: any;
	protected _client: any;

	constructor(config: GigaChatClientConfig) {
		super({ ...config, httpsAgent: HttpsAgent, model: config.model ?? 'Embeddings' });
		this.model = config.model ?? 'Embeddings';
	}

	async updateConfig(config: GigaChatClientConfig) {
		const modelChanged = this.model !== (config.model ?? 'Embeddings');
		const credentialsChanged = this.authorizationKey !== config.credentials;

		if (credentialsChanged || modelChanged) {
			this.authorizationKey = config.credentials ?? null;
			this.model = config.model ?? 'Embeddings';
			await GigaChatApiClient.updateConfig(config);
			this.clientConfig = { ...this.clientConfig, ...config, model: this.model } as any;
			this._client = GigaChatApiClient as any;
		}
	}
}

export const GigaChatEmbeddingsLcClient = new GigaChatEmbeddingsLcClientInstance({});
