import { INodeType, INodeTypeDescription, NodeConnectionType } from 'n8n-workflow';
import { disclaimerBlocks } from '../../shared/Disclaimers';
import { chatLoadGigaChatModels } from './utils';
import { gigaChatWithModel } from '../../shared/methods/ChatWithModel';

export class GigaChat implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'GigaChat AI',
		name: 'gigaChat',
		icon: 'file:../../gigachat.svg',
		group: ['transform'],
		version: 1,
		description: 'Chat with GigaChat AI models with full memory persistence and tool support',
		defaults: {
			name: 'GigaChat',
		},
		codex: {
			categories: ['AI', 'Chat'],
			subcategories: {
				AI: ['Chains', 'Root Nodes'],
				Chat: ['Conversational Agents'],
			},
			resources: {
				primaryDocumentation: [
					{
						url: 'https://developers.sber.ru/docs/ru/gigachat/api/overview',
					},
				],
			},
		},
		// eslint-disable-next-line
		inputs: [
			NodeConnectionType.Main,
			{
				type: NodeConnectionType.AiMemory,
				displayName: 'Memory',
				required: false,
				maxConnections: 1,
			},
			{
				type: NodeConnectionType.AiTool,
				displayName: 'Tools',
				required: false,
				maxConnections: Infinity,
			},
		],
		// eslint-disable-next-line
		outputs: [NodeConnectionType.Main],
		outputNames: [''],
		credentials: [
			{
				name: 'gigaChatApi',
				required: true,
			},
		],
		requestDefaults: {
			baseURL: '={{ $credentials.baseUrl || "https://gigachat.devices.sberbank.ru/api/v1" }}',
			skipSslCertificateValidation: true,
		},
		properties: [
			...disclaimerBlocks,
			{
				// eslint-disable-next-line
				displayName: 'Model',
				name: 'modelId',
				type: 'options',
				// eslint-disable-next-line
				description: 'Название и версия модели, которая сгенерирует ответ',
				typeOptions: {
					loadOptionsMethod: 'getGigaChatModels',
				},
				// eslint-disable-next-line
				default: 'GigaChat',
			},
			{
				displayName: 'Промпт (польз. сообщение)',
				name: 'prompt',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'Напишите ваш промпт здесь...',
				typeOptions: {
					rows: 3,
				},
			},
			{
				displayName: 'Настройки',
				name: 'options',
				type: 'collection',
				default: {},
				placeholder: 'Добавить настройку',
				// eslint-disable-next-line
				options: [
					{
						displayName: 'Способ вызова функций',
						name: 'functionCall',
						type: 'options',
						default: 'auto',
						description: 'Как модель должна вести себя с функциями',
						options: [
							{
								name: 'Авто',
								value: 'auto',
								description: 'Модель сама решает когда вызывать функции',
							},
							{
								name: 'Никогда',
								value: 'none',
								description: 'Модель не будет вызывать функции',
							},
						],
					},
					{
						displayName: 'Макс. итераций вызова функций',
						name: 'maxIterations',
						type: 'number',
						default: 5,
						description:
							'Сколько максимально инструментов может вызвать GigaChat прежде, чем мы будем считать это бесконечным циклом',
						typeOptions: {
							minValue: 1,
						},
					},
					{
						displayName: 'Макс. токенов',
						name: 'maxTokensToSample',
						type: 'number',
						default: 1024,
						description: 'Как много можно генерировать токенов модели',
						typeOptions: {
							minValue: 1,
						},
					},
					{
						displayName: 'Repetition Penalty',
						name: 'repetitionPenalty',
						type: 'number',
						default: 1.0,
						description: 'Количество повторений слов. Значение 1.0 — нейтральное значение.',
						typeOptions: {
							minValue: 0.1,
							maxValue: 2,
							numberPrecision: 1,
						},
					},
					{
						displayName: 'Системное сообщение (Промпт)',
						name: 'systemMessage',
						type: 'string',
						default: '',
						description: 'Системное сообщение. Пишите сюда роль и инструкции ассистента.',
						typeOptions: {
							rows: 3,
						},
					},
					{
						displayName: 'Температура',
						name: 'temperature',
						type: 'number',
						default: 0.7,
						description: 'Чем выше значение, тем более случайным будет ответ модели (0-2)',
						typeOptions: {
							minValue: 0,
							maxValue: 2,
							numberPrecision: 1,
						},
					},
					{
						displayName: 'Top P',
						name: 'topP',
						type: 'number',
						default: 0.9,
						description: 'Задает вероятностную массу токенов, которые должна учитывать модель',
						typeOptions: {
							minValue: 0,
							maxValue: 1,
							numberPrecision: 2,
						},
					},
				],
			},
			{
				displayName: 'Упростить ответ модели',
				name: 'simplifyOutput',
				type: 'boolean',
				default: false,
				// eslint-disable-next-line
				description:
					'Вернуть либо только текст ответа, либо оставить ещё больше информации о запросе',
			},
			{
				displayName: 'Убрать Markdown',
				name: 'removeMarkdown',
				type: 'boolean',
				default: false,
				// eslint-disable-next-line
				description:
					'Либо оставить запрос форматированным, либо попытаться убрать всё форматирование (markdown)',
			},
		],
	};

	methods = {
		loadOptions: {
			getGigaChatModels: chatLoadGigaChatModels,
		},
	};

	execute = gigaChatWithModel;
}
