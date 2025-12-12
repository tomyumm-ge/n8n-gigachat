import { INodeType, INodeTypeDescription, NodeConnectionType } from 'n8n-workflow';
import { disclaimerBlocks } from '../../shared/Disclaimers';
import { getGigaChatModels } from '../../shared/GigaChatModels';
import { apiGigaChatExecute } from './utils';

export class ApiGigaChat implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'GigaChat API',
		name: 'apiGigaChat',
		icon: 'file:../../gigachat.svg',
		group: ['input'],
		version: 1,
		subtitle: '={{$parameter["resource"] + ": " + $parameter["operation"]}}',
		description: 'Consume GigaChat API functions',
		defaults: {
			name: 'GigaChat API',
		},
		usableAsTool: true,
		// eslint-disable-next-line
		inputs: [NodeConnectionType.Main],
		// eslint-disable-next-line
		outputs: [NodeConnectionType.Main],
		credentials: [
			{
				name: 'gigaChatApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Изображение',
						value: 'image',
						description: 'Обработка изображений',
					},
					{ name: 'Токены', value: 'tokens', description: 'Мониторинг токенов' },
				],
				default: 'image',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['image'],
					},
				},
				options: [
					{
						name: 'Анализировать',
						value: 'analyze',
						description: 'Проанализировать изображение',
						action: 'Analyze an image',
					},
				],
				default: 'analyze',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['tokens'],
					},
				},
				options: [
					{
						name: 'Посчитать токены',
						value: 'count',
						description: 'Посчитать токены в сообщении',
						action: 'Count tokens in message',
					},
					{
						name: 'Получить остатки',
						value: 'balance',
						description: 'Получить остаток токенов',
						action: 'Get balance',
					},
				],
				default: 'count',
			},

			// -------------------------
			//      image:analyze
			// -------------------------
			{
				displayName: 'Image Binary Field',
				name: 'binaryPropertyName',
				type: 'string',
				default: 'data',
				required: true,
				hint: 'Имя поля с изображением, которое надо отправить. <a href="https://github.com/tomyumm-ge/n8n-gigachat/wiki/%D0%9A%D0%B0%D0%BA-%D0%B0%D0%BD%D0%B0%D0%BB%D0%B8%D0%B7%D0%B8%D1%80%D0%BE%D0%B2%D0%B0%D1%82%D1%8C-%D0%B8%D0%B7%D0%BE%D0%B1%D1%80%D0%B0%D0%B6%D0%B5%D0%BD%D0%B8%D1%8F%3F">Не получается?</a>',
				displayOptions: {
					show: {
						operation: ['analyze'],
						resource: ['image'],
					},
				},
				placeholder: '',
				description: 'Name of the binary property that contains the data to upload',
			},
			{
				displayName: 'Учтите, что Lite модели не поддерживают обработку изображений',
				name: 'unprocessable',
				type: 'notice',
				displayOptions: {
					show: {
						resource: ['image'],
					},
				},
				default: '',
			},
			{
				// eslint-disable-next-line
				displayName: 'Model',
				name: 'modelId',
				type: 'options',
				displayOptions: {
					show: {
						resource: ['image', 'tokens'],
						operation: ['analyze', 'count'],
					},
				},
				// eslint-disable-next-line
				description: 'GigaChat модель, которая будет использована',
				typeOptions: {
					loadOptionsMethod: 'getGigaChatModels',
				},
				default: '',
			},
			{
				displayName: 'Промпт',
				name: 'prompt',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'Например, Опиши изображение...',
				displayOptions: {
					show: {
						operation: ['analyze', 'count'],
						resource: ['image', 'tokens'],
					},
				},
				typeOptions: {
					rows: 3,
				},
			},
			...disclaimerBlocks,
			{
				displayName: 'Remove Markdown',
				name: 'removeMarkdown',
				type: 'boolean',
				default: false,
				displayOptions: {
					show: {
						operation: ['analyze'],
						resource: ['image'],
					},
				},
				// eslint-disable-next-line
				description:
					'Либо оставить запрос форматированным, либо попытаться убрать всё форматирование (markdown)',
			},

			// -------------------------
			//      tokens:count
			// -------------------------

			// -------------------------
			//      tokens:balance
			// -------------------------
		],
	};

	methods = {
		loadOptions: {
			getGigaChatModels,
		},
	};

	execute = apiGigaChatExecute;
}
