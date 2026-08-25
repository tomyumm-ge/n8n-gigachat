import { ISupplyDataFunctions, SupplyData } from 'n8n-workflow';
import { GigaChatLcClient } from '../../shared/GigaChatLcClient';

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
		baseUrl: credentials.base_back_url,
		authUrl: credentials.base_url || 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth',
	});

	return {
		response: GigaChatLcClient,
	};
}
