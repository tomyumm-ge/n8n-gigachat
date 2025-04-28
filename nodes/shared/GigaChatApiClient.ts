/**
 * GigaChat API client
 */

import axios from 'axios';
import { GigaChat } from 'gigachat';
import { GigaChatClientConfig } from 'gigachat';
import { HttpsAgent } from './HttpsAgent';

class GigaChatApiClientInstance extends GigaChat {
	authorizationKey: string | null = null;

	constructor(config: GigaChatClientConfig) {
		super({ ...config, httpsAgent: HttpsAgent });
	}

	async updateConfig(config: GigaChatClientConfig) {
		if (this.authorizationKey !== config.credentials) {
			// We must to do dirty hacks here, because GigaChat made stateful architecture
			this.authorizationKey = config.credentials ?? null;
			this._settings = { ...this._settings, ...config };
			const axiosConfig = {
				timeout: this._settings.timeout * 1000,
				httpsAgent: this._settings.httpsAgent,
				validateStatus: () => true,
			};

			// Re-create clients
			this._client = axios.create({
				baseURL: this._settings.baseUrl,
				...axiosConfig,
			});
			this._authClient = axios.create(axiosConfig);

			// Reset token
			this._accessToken = undefined;
			this._settings.accessToken = undefined;

			// Re-initialize token
			await this.updateToken();
		}
	}
}

export const GigaChatApiClient = new GigaChatApiClientInstance({});
