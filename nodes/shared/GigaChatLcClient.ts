/**
 * GigaChat LangChain client
 */

import { GigaChat } from 'langchain-gigachat';
import { GigaChatClientConfig } from 'gigachat';
import { HttpsAgent } from './HttpsAgent';
import { GigaChatApiClient } from './GigaChatApiClient';

class GigaChatLcClientInstance extends GigaChat {
	authorizationKey: string | null = null;
	private model: string | undefined;

	constructor(config: GigaChatClientConfig) {
		super({ ...config, httpsAgent: HttpsAgent, model: config.model });
		this.model = config.model;
	}

	async updateConfig(config: GigaChatClientConfig) {
		const modelChanged = this.model !== config.model;
		const credentialsChanged = this.authorizationKey !== config.credentials;

		if (credentialsChanged || modelChanged) {
			this.authorizationKey = config.credentials ?? null;
			this.model = config.model;
			await GigaChatApiClient.updateConfig(config);
			// Обновляем модель в базовом классе, если она изменилась
			this._settings = { ...this._settings, ...config, model: this.model };
			this._client = GigaChatApiClient;
		}
	}
}

export const GigaChatLcClient = new GigaChatLcClientInstance({});
