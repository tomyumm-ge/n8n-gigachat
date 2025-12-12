import { INodeType, INodeTypeDescription, NodeConnectionType } from 'n8n-workflow';
import { disclaimerBlocks } from '../../shared/Disclaimers';
import { getLangchainGigaChatModels, supplyLangchainGigaChatInstance } from './utils';

export class LmGigaChat implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'GigaChat Model',
		name: 'lmGigaChat',
		icon: 'file:../../gigachat.svg',
		group: ['transform'],
		version: 1,
		description: 'Языковые модели от Сбера',
		defaults: {
			name: 'GigaChat Model',
		},
		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Language Models'],
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
				...disclaimerBlocks,
				// eslint-disable-next-line
				displayName: 'Имя модели',
				name: 'model',
				type: 'options',
				// eslint-disable-next-line
				description: 'Какую модель использовать для чата',
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
				displayName: 'Настройки',
				name: 'options',
				placeholder: 'Добавить настройку',
				description: 'Дополнительные настройки для модели',
				type: 'collection',
				default: {},
				options: [
					{
						displayName: 'Макс. токенов',
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
						displayName: 'Температура',
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

	supplyData = supplyLangchainGigaChatInstance;

	methods = {
		loadOptions: {
			getGigaChatModels: getLangchainGigaChatModels,
		},
	};
}
