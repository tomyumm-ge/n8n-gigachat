import {
	ILoadOptionsFunctions,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
	ISupplyDataFunctions,
	NodeConnectionType,
	SupplyData,
} from 'n8n-workflow';
import { GigaChatApiClient } from '../../shared/GigaChatApiClient';
import { GigaChatEmbeddingsLcClient } from '../../shared/GigaChatEmbeddingsLcClient';

export class EmGigaChat implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'GigaChat Embeddings',
		name: 'emGigaChat',
		icon: 'file:gigachat.svg',
		group: ['transform'],
		version: 1,
		description: 'GigaChat Embeddings from Sberbank of Russia',
		defaults: {
			name: 'GigaChat Embeddings',
		},
		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Embeddings', 'Root Nodes'],
			},
		},
		// eslint-disable-next-line n8n-nodes-base/node-class-description-inputs-wrong-regular-node
		inputs: [],
		// eslint-disable-next-line n8n-nodes-base/node-class-description-outputs-wrong
		outputs: [NodeConnectionType.AiEmbedding],
		outputNames: ['Embeddings'],
		credentials: [
			{
				name: 'gigaChatApi',
				required: true,
			},
		],
		requestDefaults: {
			ignoreHttpStatusErrors: true,
			baseURL: 'https://gigachat.devices.sberbank.ru/api/v1',
			skipSslCertificateValidation: true,
			headers: {
				Authorization: 'Bearer {{$execution.token}}',
			},
		},
		properties: [
			{
				displayName: 'Model Name or ID',
				name: 'model',
				type: 'options',
				description:
					'The name of the model to use. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
				default: '',
				typeOptions: {
					loadOptionsMethod: 'getGigaChatModels',
				},
				routing: {
					send: {
						type: 'body',
						property: 'model',
					},
				},
			},
		],
	};

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
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
			authUrl: credentials.base_url ? `${credentials.base_url}/api/v2/oauth` : 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth',
		});

		return {
			response: GigaChatEmbeddingsLcClient,
		};
	}

	methods = {
		loadOptions: {
			async getGigaChatModels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const credentials = await this.getCredentials<{
					authorizationKey: string;
					scope?: string;
					base_url?: string;
				}>('gigaChatApi');

				await GigaChatApiClient.updateConfig({
					credentials: credentials.authorizationKey,
					scope: credentials.scope || 'GIGACHAT_API_PERS',
					authUrl: credentials.base_url ? `${credentials.base_url}/api/v2/oauth` : 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth',
				});

				const response = await GigaChatApiClient.getModels();

				return response.data
					.filter((model: any) => model.id?.toLowerCase()?.includes('embeddings'))
					.map((model: any) => ({
						name: model.id,
						value: model.id,
					}));
			},
		},
	};
}
