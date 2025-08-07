import { ILoadOptionsFunctions, INodePropertyOptions } from 'n8n-workflow';
import { GigaChatApiClient } from './GigaChatApiClient';

export async function getGigaChatModels(
	this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
	const credentials = await this.getCredentials<{
		authorizationKey: string;
		scope?: string;
		base_url?: string;
	}>('gigaChatApi');

	const nodeName = this.getNode().type;
	// e.g. CUSTOM.apiGigaChat
	let filterExpression = '';
	if (nodeName.indexOf('apiGigaChat') !== -1) {
		filterExpression = 'Embeddings.*';
	}
	if (nodeName.indexOf('gigaChat') !== -1) {
		filterExpression = 'Embeddings.*';
	}
	if (nodeName.indexOf('emGigaChat') !== -1) {
		filterExpression = 'Giga.*';
	}

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
		.map((model: any) => ({
			name: model.id,
			value: model.id,
		}))
		.filter((model: any) => !model.value.match(new RegExp(filterExpression, 'gi')));
}
