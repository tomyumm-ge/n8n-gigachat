/**
 * GigaChat API client with session support
 */

import axios from 'axios';
import { GigaChat } from 'gigachat';
import { GigaChatClientConfig } from 'gigachat';
import { HttpsAgent } from './HttpsAgent';
import type { Chat, ChatCompletion, WithXHeaders } from 'gigachat/interfaces';

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

	// Custom chat method with session ID support
	async chatWithSession(data: Chat, sessionId?: string): Promise<ChatCompletion & WithXHeaders> {
		// Ensure we have a valid token
		if (!this._accessToken) {
			await this.updateToken();
		}

		// Check if token is still valid (basic check)
		if (!this._accessToken) {
			throw new Error('Failed to obtain access token');
		}

		// Extract the actual token from the response object
		const tokenString = (this._accessToken as any).access_token || this._accessToken;

		// Prepare headers
		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
			'Accept': 'application/json',
			'Authorization': `Bearer ${tokenString}`,
		};

		// Add User-Agent (we're always in Node.js environment)
		headers['User-Agent'] = 'GigaChat-JS-SDK/0.0.14';

		// Add session ID header if provided
		if (sessionId) {
			headers['X-Session-ID'] = sessionId;
		}

		// Generate request ID for logging
		headers['X-Request-ID'] = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
			const r = Math.random() * 16 | 0;
			const v = c === 'x' ? r : (r & 0x3 | 0x8);
			return v.toString(16);
		});


		// Create a fresh axios instance to avoid any configuration issues
		const freshClient = axios.create({
			baseURL: this._settings.baseUrl || 'https://gigachat.devices.sberbank.ru/api/v1',
			httpsAgent: HttpsAgent,
			timeout: 30000,
			validateStatus: () => true,
		});

		// Make the request using the fresh client
		const response = await freshClient.post('/chat/completions', data, { 
			headers,
		});

		// Check for token expiration
		if (response.status === 401 && response.data?.message?.includes('Token has expired')) {
			// Token expired, try to refresh
			this._accessToken = undefined;
			await this.updateToken();
			
			// Retry with new token
			const newTokenString = (this._accessToken as any).access_token || this._accessToken;
			headers['Authorization'] = `Bearer ${newTokenString}`;
			
			const retryResponse = await freshClient.post('/chat/completions', data, { 
				headers,
			});
			
			if (retryResponse.status !== 200) {
				throw new Error(`GigaChat API error: ${retryResponse.status} ${retryResponse.statusText} - ${JSON.stringify(retryResponse.data)}`);
			}
			
			// Use retry response
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
			throw new Error(`GigaChat API error: ${response.status} ${response.statusText} - ${JSON.stringify(response.data)}`);
		}

		// Return response with X-headers
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

	// Create a singleton instance getter
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
			};
			this.instance.updateConfig(config);
		}

		return this.instance;
	}
}

class GigaChatApiClientWrapper extends GigaChatApiClientInstance {
	// Override getModels to handle token expiration
	async getModels() {
		try {
			// First try with existing token
			const result = await super.getModels();
			return result;
		} catch (error: any) {
			// Check if it's a token expiration error
			if (error?.response?.status === 401 || error?.message?.includes('Token has expired')) {
				// Clear token and retry
				this._accessToken = undefined;
				await this.updateToken();
				return await super.getModels();
			}
			throw error;
		}
	}
}

export const GigaChatApiClient = new GigaChatApiClientWrapper({});
