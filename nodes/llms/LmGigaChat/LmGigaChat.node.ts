import { Agent } from 'https';
import {
	ILoadOptionsFunctions,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
	ISupplyDataFunctions,
	NodeConnectionType,
	SupplyData,
} from 'n8n-workflow';
import { GigaChat } from 'langchain-gigachat';
import { GigaChat as GigaChatClient } from 'gigachat';

export class LmGigaChat implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'GigaChat',
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

		const httpsAgent = new Agent({
			/**
			 * Do not reject self-signed certificate of
			 * Ministry of Digital Development, Communications and Mass Media
			 */
			rejectUnauthorized: false,
		});

		const model = new GigaChat({
			credentials: credentials.authorizationKey,
			model: modelName,
			httpsAgent,
			scope: credentials.scope,
		});

		return {
			response: model,
		};
	}

	methods = {
		loadOptions: {
			async getGigaChatModels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const credentials = await this.getCredentials<{
					authorizationKey: string;
				}>('gigaChatApi');

				const httpsAgent = new Agent({
					/**
					 * Do not reject self-signed certificate of
					 * Ministry of Digital Development, Communications and Mass Media
					 */
					rejectUnauthorized: false,
				});

				const gigaClient = new GigaChatClient({
					credentials: credentials.authorizationKey,
					httpsAgent,
				});

				const response = await gigaClient.getModels();

				return response.data.map((model: any) => ({
					name: model.id,
					value: model.id,
				}));
			},
		},
	};
}

// export async function getGigaChatModels(this: ISupplyDataFunctions) {
// 	const response = await this.getNode().;
// 	return response.data.map((model: any) => ({
// 		name: model.id,
// 		value: model.id,
// 	}));
// }
