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
import { GigaChatLcClient } from '../../shared/GigaChatLcClient';

export class LmGigaChat implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'GigaChat Model',
		name: 'lmGigaChat',
		icon: 'file:gigachat.svg',
		group: ['transform'],
		version: 1,
		description: 'Language Models from Sberbank of Russia',
		defaults: {
			name: 'GigaChat Model',
		},
		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Language Models', 'Root Nodes'],
				'Language Models': ['Text Completion Models'],
			},
		},
		// eslint-disable-next-line n8n-nodes-base/node-class-description-inputs-wrong-regular-node
		inputs: [],
		// eslint-disable-next-line n8n-nodes-base/node-class-description-outputs-wrong
		outputs: [NodeConnectionType.AiLanguageModel],
		outputNames: ['Model'],
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
			{
				displayName: 'Options',
				name: 'options',
				placeholder: 'Add Option',
				description: 'Additional options for the model',
				type: 'collection',
				default: {},
				options: [
					{
						displayName: 'Max Tokens',
						name: 'maxTokens',
						type: 'number',
						default: 1000,
						typeOptions: {
							minValue: 1,
						},
						routing: {
							send: {
								type: 'body',
								property: 'max_tokens',
							},
						},
					},
					{
						displayName: 'Temperature',
						name: 'temperature',
						type: 'number',
						default: 0.8,
						typeOptions: {
							minValue: 0,
							maxValue: 3,
						},
						routing: {
							send: {
								type: 'body',
								property: 'temperature',
							},
						},
					},
					{
						displayName: 'Top P',
						name: 'topP',
						type: 'number',
						default: 1,
						typeOptions: {
							minValue: 0,
							maxValue: 1,
						},
						routing: {
							send: {
								type: 'body',
								property: 'top_p',
							},
						},
					},
					{
						displayName: 'Repetition Penalty',
						name: 'repetitionPenalty',
						type: 'number',
						default: 1,
						routing: {
							send: {
								type: 'body',
								property: 'repetition_penalty',
							},
						},
					},
				],
			},
		],
	};

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		const credentials = await this.getCredentials<{
			authorizationKey: string;
			scope: string;
		}>('gigaChatApi');

		const modelName = this.getNodeParameter('model', itemIndex) as string;

		await GigaChatLcClient.updateConfig({
			credentials: credentials.authorizationKey,
			model: modelName,
			scope: credentials.scope,
		});

		return {
			response: GigaChatLcClient,
		};
	}

	methods = {
		loadOptions: {
			async getGigaChatModels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const credentials = await this.getCredentials<{
					authorizationKey: string;
				}>('gigaChatApi');

				await GigaChatApiClient.updateConfig({
					credentials: credentials.authorizationKey,
				});

				const response = await GigaChatApiClient.getModels();

				return response.data.map((model: any) => ({
					name: model.id,
					value: model.id,
				}));
			},
		},
	};
}
