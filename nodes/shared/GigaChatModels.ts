import { ILoadOptionsFunctions, INodePropertyOptions } from 'n8n-workflow';
import { GigaChatApiClient } from './GigaChatApiClient';
import { Model } from 'gigachat/interfaces/model';
import { resolveGigaChatUrls } from './GigaChatUrls';

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
		...resolveGigaChatUrls(credentials),
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
