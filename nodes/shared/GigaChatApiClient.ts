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

	async customCompletion(params: {
		model: string;
		messages: Array<{ role: string; content: string }>;
		stream?: boolean;
		update_interval?: number;
		sessionId?: string;
	}) {
		// Ensure token is available
		if (!this._accessToken) {
			await this.updateToken();
		}

		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
			Accept: 'application/json',
			Authorization: `Bearer ${this._accessToken?.access_token}`,
		};

		// Add session ID if provided
		if (params.sessionId) {
			headers['X-Session-Id'] = params.sessionId;
		}

		const payload = {
			model: params.model,
			messages: params.messages,
			stream: params.stream ?? false,
			update_interval: params.update_interval ?? 0,
		};

		const response = await this._client.post('/chat/completions', payload, {
			headers,
		});

		return response.data;
	}
}

export const GigaChatApiClient = new GigaChatApiClientInstance({});
