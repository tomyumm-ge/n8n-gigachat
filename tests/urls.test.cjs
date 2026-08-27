const assert = require('node:assert/strict');
const { test } = require('node:test');
const axios = require('axios');
const {
	DEFAULT_GIGACHAT_AUTH_URL,
	DEFAULT_GIGACHAT_BASE_URL,
	GIGACHAT_AUTH_URL_EXPRESSION,
	GIGACHAT_BASE_URL_EXPRESSION,
	resolveGigaChatAuthUrl,
	resolveGigaChatBaseUrl,
	resolveGigaChatUrls,
} = require('../dist/nodes/shared/GigaChatUrls');
const { GigaChatApi } = require('../dist/credentials/GigaChatApi.credentials');
const { GigaChatApiClient } = require('../dist/nodes/shared/GigaChatApiClient');
const { GigaChatLcClient } = require('../dist/nodes/shared/GigaChatLcClient');
const { GigaChatEmbeddingsLcClient } = require('../dist/nodes/shared/GigaChatEmbeddingsLcClient');

function evaluate(expression, credentials) {
	return new Function('$credentials', `return (${expression.slice(3, -2)});`)(credentials);
}

const authCases = [
	[undefined, DEFAULT_GIGACHAT_AUTH_URL],
	[null, DEFAULT_GIGACHAT_AUTH_URL],
	['', DEFAULT_GIGACHAT_AUTH_URL],
	['  ', DEFAULT_GIGACHAT_AUTH_URL],
	['https://ngw.devices.sberbank.ru:9443', DEFAULT_GIGACHAT_AUTH_URL],
	['https://ngw.devices.sberbank.ru:9443/', DEFAULT_GIGACHAT_AUTH_URL],
	[DEFAULT_GIGACHAT_AUTH_URL, DEFAULT_GIGACHAT_AUTH_URL],
	['https://proxy.example/custom/token', 'https://proxy.example/custom/token'],
	['https://proxy.example/custom/token/', 'https://proxy.example/custom/token/'],
	[
		'https://proxy.example/api/v2/oauth?tenant=a#token',
		'https://proxy.example/api/v2/oauth?tenant=a#token',
	],
	['https://proxy.example/?tenant=a', 'https://proxy.example/api/v2/oauth?tenant=a'],
	[' http://localhost:8080/ ', 'http://localhost:8080/api/v2/oauth'],
];

test('OAuth URLs are idempotent and credential tests use the same contract', () => {
	const credential = new GigaChatApi();
	assert.equal(credential.test.request.baseURL, undefined);
	assert.equal(credential.test.request.url, GIGACHAT_AUTH_URL_EXPRESSION);
	for (const [input, expected] of authCases) {
		assert.equal(resolveGigaChatAuthUrl(input), expected);
		assert.equal(resolveGigaChatAuthUrl(resolveGigaChatAuthUrl(input)), expected);
		assert.equal(evaluate(credential.test.request.url, { base_url: input }), expected);
	}
});

test('new backend defaults do not overwrite explicitly saved URLs', () => {
	const oldBackend = 'https://gigachat.devices.sberbank.ru/api/v1';
	assert.equal(DEFAULT_GIGACHAT_BASE_URL, 'https://api.giga.chat/v1');
	assert.deepEqual(resolveGigaChatUrls(), {
		authUrl: DEFAULT_GIGACHAT_AUTH_URL,
		baseUrl: DEFAULT_GIGACHAT_BASE_URL,
	});
	for (const value of [undefined, null, '', '  ', oldBackend, 'https://proxy.example/giga/v1']) {
		const expected = value?.trim() || DEFAULT_GIGACHAT_BASE_URL;
		assert.equal(resolveGigaChatBaseUrl(value), expected);
		assert.equal(evaluate(GIGACHAT_BASE_URL_EXPRESSION, { base_back_url: value }), expected);
	}
	const credential = new GigaChatApi();
	assert.equal(
		credential.properties.find((p) => p.name === 'base_url').default,
		DEFAULT_GIGACHAT_AUTH_URL,
	);
	assert.equal(
		credential.properties.find((p) => p.name === 'base_back_url').default,
		DEFAULT_GIGACHAT_BASE_URL,
	);
});

test('all client constructors override the SDK legacy default, including undefined URL fields', () => {
	for (const instance of [GigaChatApiClient, GigaChatLcClient, GigaChatEmbeddingsLcClient]) {
		for (const config of [undefined, {}, { baseUrl: undefined, authUrl: undefined }]) {
			const client = new instance.constructor(config);
			const settings =
				client === client._client ? client._settings : client.clientConfig || client._settings;
			assert.equal(settings.baseUrl, DEFAULT_GIGACHAT_BASE_URL);
			assert.equal(settings.authUrl, DEFAULT_GIGACHAT_AUTH_URL);
		}
		const client = new instance.constructor({
			baseUrl: 'https://proxy.example/v1',
			authUrl: 'https://proxy.example/token',
		});
		const settings = client.clientConfig || client._settings;
		assert.equal(settings.baseUrl, 'https://proxy.example/v1');
		assert.equal(settings.authUrl, 'https://proxy.example/token');
	}
});

test('backend/auth changes with the same key reach actual SDK and session requests', async () => {
	const adapter = axios.defaults.adapter;
	const requests = [];
	axios.defaults.adapter = async (config) => {
		requests.push(axios.getUri(config));
		const data = config.url.startsWith('https://auth.example/')
			? { access_token: 'test-token', expires_at: Date.now() + 3600000 }
			: config.url === '/models'
				? { data: [] }
				: { choices: [{ message: { role: 'assistant', content: 'ok' } }] };
		return { config, data, status: 200, statusText: 'OK', headers: {} };
	};
	try {
		const client = new GigaChatApiClient.constructor();
		const config = {
			credentials: 'dGVzdDprZXk=',
			authUrl: 'https://auth.example/token',
			baseUrl: 'https://proxy.example/v1',
		};
		await client.updateConfig(config);
		await client.getModels();
		await client.updateConfig({
			...config,
			authUrl: 'https://auth.example/new-token',
			baseUrl: undefined,
		});
		await client.getModels();
		await client.chatWithSession({
			model: 'GigaChat',
			messages: [{ role: 'user', content: 'test' }],
		});
		await client.updateConfig({
			...config,
			baseUrl: 'https://gigachat.devices.sberbank.ru/api/v1',
		});
		await client.getModels();
		assert.deepEqual(requests, [
			'https://auth.example/token',
			'https://proxy.example/v1/models',
			'https://auth.example/new-token',
			'https://api.giga.chat/v1/models',
			'https://api.giga.chat/v1/chat/completions',
			'https://auth.example/token',
			'https://gigachat.devices.sberbank.ru/api/v1/models',
		]);
	} finally {
		axios.defaults.adapter = adapter;
	}
});

test('LLM and embeddings forward URL-only changes and recover after initialization failure', async () => {
	const original = GigaChatApiClient.updateConfig;
	try {
		for (const instance of [GigaChatLcClient, GigaChatEmbeddingsLcClient]) {
			const configs = [];
			GigaChatApiClient.updateConfig = async (config) => {
				configs.push(config);
				if (configs.length === 1) throw new Error('simulated OAuth failure');
			};
			const client = new instance.constructor();
			const first = {
				credentials: 'test',
				model: 'same-model',
				authUrl: 'https://auth.example/first',
			};
			await assert.rejects(client.updateConfig(first), /simulated OAuth failure/);
			assert.equal(client.authorizationKey, null);
			const corrected = {
				...first,
				authUrl: 'https://auth.example/corrected',
				baseUrl: DEFAULT_GIGACHAT_BASE_URL,
			};
			await client.updateConfig(corrected);
			await client.updateConfig({ ...corrected, baseUrl: 'https://proxy.example/v1' });
			assert.equal(configs.length, 3);
			assert.equal(configs[2].baseUrl, 'https://proxy.example/v1');
			assert.equal(client._client, GigaChatApiClient);
		}
	} finally {
		GigaChatApiClient.updateConfig = original;
	}
});

test('every node entry point forwards explicit URLs and defaults missing credentials fields', async () => {
	const { supplyLangchainGigaChatInstance } = require('../dist/nodes/llms/LmGigaChat/utils');
	const { supplyEmbeddingsModel } = require('../dist/nodes/embeddings/EmGigaChat/utils');
	const { apiGigaChatExecute } = require('../dist/nodes/api/ApiGigaChat/utils');
	const { gigaChatWithModel } = require('../dist/nodes/shared/methods/ChatWithModel');
	const { getGigaChatModels } = require('../dist/nodes/shared/GigaChatModels');
	const instances = [GigaChatApiClient, GigaChatLcClient, GigaChatEmbeddingsLcClient];
	const originals = instances.map((client) => client.updateConfig);
	const originalGetModels = GigaChatApiClient.getModels;
	const configs = [];
	try {
		for (const client of instances)
			client.updateConfig = async (config) => {
				configs.push(config);
			};
		GigaChatApiClient.getModels = async () => ({ data: [] });
		for (const urls of [
			{},
			{ base_url: 'https://proxy.example/token', base_back_url: 'https://proxy.example/v1' },
		]) {
			const ctx = {
				getCredentials: async () => ({
					authorizationKey: 'test',
					scope: 'GIGACHAT_API_PERS',
					...urls,
				}),
				getNodeParameter: () => 'test-model',
				getInputData: () => [],
				getInputConnectionData: async () => undefined,
				getNode: () => ({ type: 'CUSTOM.lmGigaChat' }),
			};
			for (const entry of [
				supplyLangchainGigaChatInstance,
				supplyEmbeddingsModel,
				apiGigaChatExecute,
				gigaChatWithModel,
				getGigaChatModels,
			]) {
				await entry.call(ctx, 0);
				const config = configs.pop();
				assert.equal(config.authUrl, resolveGigaChatUrls(urls).authUrl);
				assert.equal(config.baseUrl, resolveGigaChatUrls(urls).baseUrl);
			}
		}
	} finally {
		instances.forEach((client, index) => {
			client.updateConfig = originals[index];
		});
		GigaChatApiClient.getModels = originalGetModels;
	}
});
