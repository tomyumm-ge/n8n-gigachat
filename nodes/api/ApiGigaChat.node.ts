import {
	BINARY_ENCODING,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeConnectionType,
	NodeOperationError,
} from 'n8n-workflow';
import { disclaimerBlocks } from '../shared/Disclaimers';
import { GigaChatApiClient } from '../shared/GigaChatApiClient';
import { getGigaChatModels } from '../shared/GigaChatModels';
import removeMd from 'remove-markdown';

export class ApiGigaChat implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'GigaChat API',
		name: 'apiGigaChat',
		icon: 'file:../gigachat.svg',
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
				default: '',
			},
			{
				// eslint-disable-next-line
				displayName: 'Model',
				name: 'modelId',
				type: 'options',
				// eslint-disable-next-line
				description: 'GigaChat модель, которая опишет изображение',
				typeOptions: {
					loadOptionsMethod: 'getGigaChatModels',
				},
				default: '',
			},
			{
				displayName: 'Prompt',
				name: 'prompt',
				type: 'string',
				required: true,
				default: 'Опиши изображение',
				placeholder: 'Например, Опиши изображение...',
				displayOptions: {
					show: {
						operation: ['analyze'],
						resource: ['image'],
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
		],
	};

	methods = {
		loadOptions: {
			getGigaChatModels,
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const operation = this.getNodeParameter('operation', 0);
		const modelId = this.getNodeParameter('modelId', 0) as string;
		const prompt = this.getNodeParameter('prompt', 0);
		const binaryPropertyName = this.getNodeParameter('binaryPropertyName', 0);

		const credentials = await this.getCredentials('gigaChatApi');

		const scope = credentials.scope ? String(credentials.scope) : 'GIGACHAT_API_PERS';
		await GigaChatApiClient.updateConfig({
			credentials: credentials.authorizationKey as string,
			scope: scope,
			model: 'GigaChat',
			timeout: 600,
			authUrl: credentials.base_url
				? `${credentials.base_url}/api/v2/oauth`
				: 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth',
		});

		for (let i = 0; i < items.length; i++) {
			try {
				if (operation === 'analyze') {
					const itemBinaryData = items[i].binary![binaryPropertyName];
					const itemBuffer = Buffer.from(itemBinaryData.data, BINARY_ENCODING);

					const fileUploaded = await GigaChatApiClient.uploadFile(
						new File(
							[itemBuffer],
							itemBinaryData.fileName || `file${itemBinaryData.fileExtension || 'bin'}`,
							{
								type: itemBinaryData.mimeType,
							},
						),
						'general',
					);

					const attachmentId = fileUploaded.id;

					const finalResponse = await GigaChatApiClient.chatWithSession({
						model: modelId,
						stream: false,
						messages: [
							{
								role: 'user',
								content: prompt ? String(prompt) : 'Что изображено на фото?',
								attachments: [attachmentId],
							},
						],
					});

					const removeMarkdown = this.getNodeParameter('removeMarkdown', i) as boolean;

					let finalMessage = finalResponse.choices[0]?.message?.content || '';

					if (removeMarkdown) {
						finalMessage = removeMd(finalMessage);
					}

					const executionData = this.helpers.constructExecutionMetaData(
						this.helpers.returnJsonArray({ response: finalMessage }),
						{
							itemData: { item: i },
						},
					);

					if (Array.isArray(executionData)) {
						returnData.push(...executionData);
					} else {
						returnData.push(executionData);
					}
				}
			} catch (error) {
				let errorMessage: string;

				if (error instanceof Error) {
					errorMessage = error.message;
				} else if (typeof error === 'object' && error !== null) {
					// Try to extract meaningful information from the error object
					if (
						'response' in error &&
						typeof error.response === 'object' &&
						error.response !== null
					) {
						const response = error.response as any;
						if (response.data && typeof response.data === 'object') {
							errorMessage = JSON.stringify(response.data);
						} else if (response.statusText) {
							errorMessage = `HTTP ${response.status}: ${response.statusText}`;
						} else {
							errorMessage = `HTTP Error: ${response.status}`;
						}
					} else {
						errorMessage = JSON.stringify(error);
					}
				} else {
					errorMessage = String(error);
				}

				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: errorMessage,
						},
						pairedItem: { item: i },
					});
					continue;
				}
				throw new NodeOperationError(this.getNode(), errorMessage, { itemIndex: i });
			}
		}
		return [returnData];
	}
}
