import {
	BINARY_ENCODING,
	IExecuteFunctions,
	INodeExecutionData,
	NodeOperationError,
} from 'n8n-workflow';
import { GigaChatApiClient } from '../../shared/GigaChatApiClient';
import removeMd from 'remove-markdown';

export async function apiGigaChatExecute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
	const items = this.getInputData();
	const returnData: INodeExecutionData[] = [];

	const resource = this.getNodeParameter('resource', 0) as string;
	const operation = this.getNodeParameter('operation', 0) as string;

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
			// -------------------------
			//      image:analyze
			// -------------------------
			if (resource === 'image' && operation === 'analyze') {
				const binaryPropertyName = this.getNodeParameter('binaryPropertyName', 0);
				const modelId = this.getNodeParameter('modelId', 0) as string;
				const prompt = this.getNodeParameter('prompt', 0) as string;
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
			// -------------------------
			//      tokens:count
			// -------------------------
			if (resource === 'tokens' && operation === 'count') {
				const modelId = this.getNodeParameter('modelId', 0) as string;
				const prompt = this.getNodeParameter('prompt', 0) as string;
				const tokenCountResponse = await GigaChatApiClient.tokensCount([prompt], modelId);

				const executionData = this.helpers.constructExecutionMetaData(
					this.helpers.returnJsonArray({
						response: {
							tokens: tokenCountResponse.tokens[0].tokens,
							characters: tokenCountResponse.tokens[0].characters,
						},
					}),
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
			// -------------------------
			//      tokens:balance
			// -------------------------
			if (resource === 'tokens' && operation === 'balance') {
				const tokenBalanceResponse = await GigaChatApiClient.balance();

				// Пока не развито достаточно хорошо, чтобы сделать другое решение - расписываем сами
				const usage = {
					GigaChat: tokenBalanceResponse.balance.find((el) => el.usage === 'GigaChat')?.value ?? 0,
					'GigaChat-Pro':
						tokenBalanceResponse.balance.find((el) => el.usage === 'GigaChat-Pro')?.value ?? 0,
					'GigaChat-Max':
						tokenBalanceResponse.balance.find((el) => el.usage === 'GigaChat-Max')?.value ?? 0,
					embeddings:
						tokenBalanceResponse.balance.find((el) => el.usage === 'embeddings')?.value ?? 0,
				};

				const executionData = this.helpers.constructExecutionMetaData(
					this.helpers.returnJsonArray({ response: usage }),
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
				if ('response' in error && typeof error.response === 'object' && error.response !== null) {
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
