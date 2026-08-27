import { ISupplyDataFunctions, SupplyData } from 'n8n-workflow';
import { GigaChatEmbeddingsLcClient } from '../../shared/GigaChatEmbeddingsLcClient';
import { resolveGigaChatUrls } from '../../shared/GigaChatUrls';

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
		...resolveGigaChatUrls(credentials),
	});

	return {
		response: GigaChatEmbeddingsLcClient,
	};
}
