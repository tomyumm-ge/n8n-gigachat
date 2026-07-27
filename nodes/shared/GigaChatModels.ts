import { ILoadOptionsFunctions, INodePropertyOptions } from 'n8n-workflow';
import { GigaChatApiClient } from './GigaChatApiClient';
import { Model } from 'gigachat/interfaces/model';

export async function getGigaChatModels(
	this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
	const credentials = await this.getCredentials<{
		authorizationKey: string;
		scope?: string;
		base_url?: string;
		base_back_url?: string;
	}>('gigaChatApi');

	const nodeName = this.getNode().type;
	// e.g. CUSTOM.apiGigaChat
	const isEmbedder = nodeName.indexOf('emGigaChat') !== -1;

	const scope = credentials.scope ? String(credentials.scope) : 'GIGACHAT_API_PERS';
	await GigaChatApiClient.updateConfig({
		credentials: credentials.authorizationKey,
		scope: scope,
		authUrl: credentials.base_url
			? `${credentials.base_url}/api/v2/oauth`
			: 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth',
		baseUrl: credentials.base_back_url
			? `${credentials.base_back_url}`
			: 'https://gigachat.devices.sberbank.ru/api/v1',
	});

	const response = await GigaChatApiClient.getModels();

	return response.data
		.filter((model: Model) => {
			if (isEmbedder) {
				return model.type === 'embedder';
			}
			return model.type === 'chat';
		})
		.map((model: any) => ({
			name: model.id,
			value: model.id,
		}));
}
