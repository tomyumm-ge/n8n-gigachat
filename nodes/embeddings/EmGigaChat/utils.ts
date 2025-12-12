import {
	ILoadOptionsFunctions,
	INodePropertyOptions,
	ISupplyDataFunctions,
	SupplyData,
} from 'n8n-workflow';
import { GigaChatEmbeddingsLcClient } from '../../shared/GigaChatEmbeddingsLcClient';
import { GigaChatApiClient } from '../../shared/GigaChatApiClient';

export async function emLoadGigaChatModels(
	this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
	const credentials = await this.getCredentials<{
		authorizationKey: string;
		scope?: string;
		base_url?: string;
	}>('gigaChatApi');

	await GigaChatApiClient.updateConfig({
		credentials: credentials.authorizationKey,
		scope: credentials.scope || 'GIGACHAT_API_PERS',
		authUrl: credentials.base_url
			? `${credentials.base_url}/api/v2/oauth`
			: 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth',
	});

	const response = await GigaChatApiClient.getModels();

	return response.data
		.filter((model: any) => model.type === 'embedder')
		.map((model: any) => ({
			name: model.id,
			value: model.id,
		}));
}

export async function supplyEmbeddingsModel(
	this: ISupplyDataFunctions,
	itemIndex: number,
): Promise<SupplyData> {
	const credentials = await this.getCredentials<{
		authorizationKey: string;
		scope: string;
		base_url?: string;
	}>('gigaChatApi');

	const modelName = this.getNodeParameter('model', itemIndex) as string;

	await GigaChatEmbeddingsLcClient.updateConfig({
		credentials: credentials.authorizationKey,
		model: modelName,
		scope: credentials.scope,
		authUrl: credentials.base_url
			? `${credentials.base_url}/api/v2/oauth`
			: 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth',
	});

	return {
		response: GigaChatEmbeddingsLcClient,
	};
}
