/**
 * GigaChat LangChain client
 */

import { GigaChat } from 'langchain-gigachat';
import { GigaChatClientConfig } from 'gigachat';
import { HttpsAgent } from './HttpsAgent';
import { GigaChatApiClient } from './GigaChatApiClient';

class GigaChatLcClientInstance extends GigaChat {
	authorizationKey: string | null = null;

	constructor(config: GigaChatClientConfig) {
		super({ ...config, httpsAgent: HttpsAgent });
	}

	async updateConfig(config: GigaChatClientConfig) {
		if (this.authorizationKey !== config.credentials) {
			this.authorizationKey = config.credentials ?? null;
			await GigaChatApiClient.updateConfig(config);
			this._client = GigaChatApiClient;
		}
	}
}

export const GigaChatLcClient = new GigaChatLcClientInstance({});
