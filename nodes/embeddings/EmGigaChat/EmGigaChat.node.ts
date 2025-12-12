import { INodeType, INodeTypeDescription, NodeConnectionType } from 'n8n-workflow';
import { disclaimerBlocks } from '../../shared/Disclaimers';
import { emLoadGigaChatModels, supplyEmbeddingsModel } from './utils';

export class EmGigaChat implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'GigaChat Embeddings',
		name: 'emGigaChat',
		icon: 'file:../../gigachat.svg',
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
			...disclaimerBlocks,
			{
				// eslint-disable-next-line
				displayName: 'Имя модели',
				name: 'model',
				type: 'options',
				// eslint-disable-next-line
				description: 'Имя модели для векторизации',
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

	supplyData = supplyEmbeddingsModel;

	methods = {
		loadOptions: {
			getGigaChatModels: emLoadGigaChatModels,
		},
	};
}
