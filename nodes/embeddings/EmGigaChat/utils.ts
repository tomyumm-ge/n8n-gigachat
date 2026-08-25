import { ISupplyDataFunctions, SupplyData } from 'n8n-workflow';
import { GigaChatEmbeddingsLcClient } from '../../shared/GigaChatEmbeddingsLcClient';

export async function supplyEmbeddingsModel(
	this: ISupplyDataFunctions,
	itemIndex: number,
): Promise<SupplyData> {
	const credentials = await this.getCredentials<{
		authorizationKey: string;
		scope: string;
		base_url?: string;
		base_back_url?: string;
	}>('gigaChatApi');

	const modelName = this.getNodeParameter('model', itemIndex) as string;

	await GigaChatEmbeddingsLcClient.updateConfig({
		credentials: credentials.authorizationKey,
		model: modelName,
		scope: credentials.scope,
		baseUrl: credentials.base_back_url,
		authUrl: credentials.base_url
			? `${credentials.base_url}/api/v2/oauth`
			: 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth',
	});

	return {
		response: GigaChatEmbeddingsLcClient,
	};
}
