import { ISupplyDataFunctions, SupplyData } from 'n8n-workflow';
import { GigaChatLcClient } from '../../shared/GigaChatLcClient';
import { resolveGigaChatUrls } from '../../shared/GigaChatUrls';

export async function supplyLangchainGigaChatInstance(
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

	await GigaChatLcClient.updateConfig({
		credentials: credentials.authorizationKey,
		model: modelName,
		scope: credentials.scope,
		...resolveGigaChatUrls(credentials),
	});

	return {
		response: GigaChatLcClient,
	};
}
