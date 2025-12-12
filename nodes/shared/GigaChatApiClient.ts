/**
 * GigaChat API client with session support
 */

import axios from 'axios';
import { GigaChat } from 'gigachat';
import { GigaChatClientConfig } from 'gigachat';
import { HttpsAgent } from './HttpsAgent';
import type { Chat, ChatCompletion, WithXHeaders } from 'gigachat/interfaces';
import { ResponseError } from 'gigachat/exceptions';

class GigaChatApiClientInstance extends GigaChat {
	authorizationKey: string | null = null;

	constructor(config: GigaChatClientConfig) {
		super({ ...config, httpsAgent: HttpsAgent });
	}

	async updateConfig(config: GigaChatClientConfig, shouldUpdateToken = true) {
		if (this.authorizationKey !== config.credentials) {
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
			this._authClient = axios.create({ baseURL: this._settings.authUrl, ...axiosConfig });

			// Reset token
			this._accessToken = undefined;
			this._settings.accessToken = undefined;

			if (shouldUpdateToken) {
				await this.updateToken();
			}
		}
	}

	// Custom chat method with session ID support
	async chatWithSession(data: Chat, sessionId?: string): Promise<ChatCompletion & WithXHeaders> {
		if (!this._accessToken) {
			await this.updateToken();
		}

		if (!this._accessToken) {
			throw new Error('Failed to obtain access token');
		}

		const tokenString = (this._accessToken as any).access_token || this._accessToken;

		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
			Accept: 'application/json',
			Authorization: `Bearer ${tokenString}`,
		};

		headers['User-Agent'] = 'GigaChat-JS-SDK/0.0.14';

		if (sessionId) {
			headers['X-Session-ID'] = sessionId;
		}

		headers['X-Request-ID'] = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
			const r = (Math.random() * 16) | 0;
			const v = c === 'x' ? r : (r & 0x3) | 0x8;
			return v.toString(16);
		});

		const freshClient = axios.create({
			baseURL: this._settings.baseUrl || 'https://gigachat.devices.sberbank.ru/api/v1',
			httpsAgent: HttpsAgent,
			timeout: 30000,
			validateStatus: () => true,
		});

		const response = await freshClient.post('/chat/completions', data, {
			headers,
		});

		if (response.status === 401 && response.data?.message?.includes('Token has expired')) {
			this._accessToken = undefined;
			await this.updateToken();

			headers['Authorization'] = `Bearer ${(this._accessToken as any).access_token || this._accessToken}`;

			const retryResponse = await freshClient.post('/chat/completions', data, {
				headers,
			});

			if (retryResponse.status !== 200) {
				throw new Error(
					`GigaChat API error: ${retryResponse.status} ${retryResponse.statusText} - ${JSON.stringify(retryResponse.data)}`,
				);
			}

			const result = retryResponse.data as ChatCompletion;
			const xHeaders = {
				xRequestID: retryResponse.headers['x-request-id'] || '',
				xSessionID: retryResponse.headers['x-session-id'] || '',
				xClientID: retryResponse.headers['x-client-id'] || '',
			};

			return {
				...result,
				xHeaders,
			};
		}

		if (response.status !== 200) {
			throw new Error(
				`GigaChat API error: ${response.status} ${response.statusText} - ${JSON.stringify(response.data)}`,
			);
		}

		const result = response.data as ChatCompletion;
		const xHeaders = {
			xRequestID: response.headers['x-request-id'] || '',
			xSessionID: response.headers['x-session-id'] || '',
			xClientID: response.headers['x-client-id'] || '',
		};

		return {
			...result,
			xHeaders,
		};
	}

	private static instance: GigaChatApiClientInstance | null = null;

	static getInstance(credentials?: any): GigaChatApiClientInstance {
		if (!this.instance) {
			this.instance = new GigaChatApiClientInstance({});
		}

		if (credentials) {
			const config: GigaChatClientConfig = {
				credentials: credentials.credentials || credentials.authorization,
				scope: credentials.scope || 'GIGACHAT_API_PERS',
				model: 'GigaChat',
				timeout: 600,
				authUrl: credentials.base_url
					? `${credentials.base_url}/api/v2/oauth`
					: 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth',
			};
			this.instance.updateConfig(config);
		}

		return this.instance;
	}
}

class GigaChatApiClientWrapper extends GigaChatApiClientInstance {
	async getModels() {
		try {
			const result = await super.getModels();
			return result;
		} catch (error: any) {
			if (error?.response?.status === 401 || error?.message?.includes('Token has expired')) {
				this._accessToken = undefined;
				await this.updateToken();
				return await super.getModels();
			}

			if (error instanceof ResponseError) {
				const response = error.response;
				const errorData = response.data;

				let errorMessage = 'Unknown error';

				if (typeof errorData === 'string') {
					errorMessage = errorData;
				} else if (errorData?.message) {
					errorMessage = errorData.message;
				} else if (errorData?.detail) {
					errorMessage = errorData.detail;
				} else if (errorData?.error) {
					errorMessage = errorData.error;
				} else if (errorData?.error_description) {
					errorMessage = errorData.error_description;
				} else {
					errorMessage = JSON.stringify(errorData);
				}

				throw new Error(`GigaChat API error (${response.status}): ${errorMessage}`);
			}

			throw error;
		}
	}
}

export const GigaChatApiClient = new GigaChatApiClientWrapper({});
