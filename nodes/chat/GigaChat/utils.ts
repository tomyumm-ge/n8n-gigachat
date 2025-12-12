import { ILoadOptionsFunctions, INodePropertyOptions } from 'n8n-workflow';
import { GigaChatApiClient } from '../../shared/GigaChatApiClient';

export async function chatLoadGigaChatModels(
	this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
	const credentials = await this.getCredentials<{
		authorizationKey: string;
		scope?: string;
		base_url?: string;
	}>('gigaChatApi');

	const scope = credentials.scope ? String(credentials.scope) : 'GIGACHAT_API_PERS';
	await GigaChatApiClient.updateConfig({
		credentials: credentials.authorizationKey,
		scope: scope,
		authUrl: credentials.base_url
			? `${credentials.base_url}/api/v2/oauth`
			: 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth',
	});

	const response = await GigaChatApiClient.getModels();

	return response.data
		.filter((model: any) => model.type === 'chat')
		.map((model: any) => ({
			name: model.id,
			value: model.id,
		}));
}
