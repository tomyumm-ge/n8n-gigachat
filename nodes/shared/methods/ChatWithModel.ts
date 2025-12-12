import {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	NodeConnectionType,
} from 'n8n-workflow';
import { GigaCredential } from '../ts/GigaChatCredentials';
import { Message as GigaMessage } from 'gigachat/interfaces';
import { executeGigaTool, formatGigaToolResult, prepareGigaTools } from './Tools';
import { Usage as GigaUsage } from 'gigachat/interfaces';
import { Chat as ChatWithModel } from 'gigachat/interfaces';
import { GigaChatApiClient } from '../GigaChatApiClient';
import { convertMessagesGigachat, MemoryType } from './Memory';
import removeMd from 'remove-markdown';

async function getOptionalMemory(ctx: IExecuteFunctions): Promise<MemoryType> {
	return (await ctx.getInputConnectionData(NodeConnectionType.AiMemory, 0)) as MemoryType;
}

export async function gigaChatWithModel(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
	const items = this.getInputData();
	const returnData: INodeExecutionData[] = [];

	const credentials = await this.getCredentials<GigaCredential>('gigaChatApi');

	let accessToken: string | undefined = undefined;
	const input = this.getInputData();
	if (input[0]?.json.accessToken) {
		accessToken = String(input[0]?.json?.accessToken);
	}

	const configUpdate = {
		accessToken,
		credentials: credentials.authorizationKey,
		scope: credentials.scope,
		baseUrl: credentials.base_back_url,
		authUrl: credentials.base_url
			? `${credentials.base_url}/api/v2/oauth`
			: 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth',
		verbose: credentials.debug,
	};

	GigaChatApiClient.updateConfig(configUpdate, !accessToken);

	const memory = await getOptionalMemory(this);

	for (let i = 0; i < items.length; i++) {
		const modelId = this.getNodeParameter('modelId', i) as string;
		const prompt = this.getNodeParameter('prompt', i) as string;
		const options = this.getNodeParameter('options', i) as IDataObject;

		const memoryResponse = await convertMessagesGigachat(this, i, memory);
		const messages: GigaMessage[] = memoryResponse.messages;
		const sessionId = memoryResponse.sessionId;
		const notStoredMessages: GigaMessage[] = [
			{
				role: 'user',
				content: prompt,
			},
		];

		const { functions, tools } = await prepareGigaTools(this);

		const maxIterations = options.maxIterations ? Number(options.maxIterations) : 5;
		let iteration = 0;
		let currentResponse;
		const totalUsage: GigaUsage = {
			prompt_tokens: 0,
			completion_tokens: 0,
			total_tokens: 0,
			precached_prompt_tokens: 0,
		};

		while (iteration < maxIterations) {
			const chatRequest: ChatWithModel = {
				model: modelId,
				messages: [...messages, ...notStoredMessages],
				stream: false,
			};

			// Add optional parameters
			if (options.temperature !== undefined)
				chatRequest.temperature = options.temperature as number;
			if (options.max_tokens) chatRequest.max_tokens = options.max_tokens as number;
			if (options.top_p !== undefined) chatRequest.top_p = options.top_p as number;
			if (options.repetition_penalty)
				chatRequest.repetition_penalty = options.repetition_penalty as number;
			if (functions && functions.length > 0) {
				chatRequest.functions = functions;
				if (options.function_call && options.function_call !== 'auto') {
					if (options.function_call === 'none') chatRequest.function_call = 'none';
					chatRequest.function_call = { name: options.function_call as string };
				}
			}

			currentResponse = await GigaChatApiClient.chatWithSession(chatRequest, sessionId);

			if (currentResponse.usage) {
				totalUsage.prompt_tokens += currentResponse.usage.prompt_tokens || 0;
				totalUsage.completion_tokens += currentResponse.usage.completion_tokens || 0;
				totalUsage.total_tokens += currentResponse.usage.total_tokens || 0;
				totalUsage.precached_prompt_tokens += currentResponse.usage.precached_prompt_tokens || 0;
			}

			const responseMessage = currentResponse.choices[0]?.message;

			if (responseMessage.content)
				notStoredMessages.push({
					role: 'assistant',
					content: responseMessage.content,
				});

			if (!responseMessage.function_call) {
				break;
			}

			notStoredMessages.push({
				role: 'assistant',
				function_call: {
					name: responseMessage.function_call.name,
					arguments: responseMessage.function_call.arguments,
				},
			});

			const matchingTool = tools.find((tool) => tool.name === responseMessage.function_call?.name);

			if (!matchingTool) {
				notStoredMessages.push({
					role: 'function',
					name: responseMessage.function_call?.name,
					content: JSON.stringify({
						error: `Tool ${responseMessage.function_call?.name} not found`,
					}),
				});
				continue;
			}

			try {
				const toolResult = await executeGigaTool(matchingTool, responseMessage.function_call);
				const formattedResult = formatGigaToolResult(
					toolResult,
					responseMessage.function_call?.arguments,
				);
				notStoredMessages.push({
					role: 'function',
					name: matchingTool.name,
					content: formattedResult,
				});
			} catch (e) {
				notStoredMessages.push({
					role: 'function',
					name: responseMessage.function_call?.name,
					content: JSON.stringify({
						error: e.message || String(e),
					}),
				});
			}

			iteration++;
		}
		// While cycle ended
		// Performing saves and results

		const simplifyOutput = this.getNodeParameter('simplifyOutput', i) as boolean;
		const removeMarkdown = this.getNodeParameter('removeMarkdown', i) as boolean;

		let responseContent = currentResponse?.choices[0]?.message.content || '';

		if (removeMarkdown) {
			responseContent = removeMd(responseContent);
		}

		const outputData = simplifyOutput
			? { response: responseContent }
			: {
					response: responseContent,
					model: modelId,
					usage: totalUsage,
					sessionId: currentResponse?.xHeaders?.xSessionID || '',
					iterations: iteration,
				};

		const executionData = this.helpers.constructExecutionMetaData(
			this.helpers.returnJsonArray(outputData),
			{
				itemData: { item: i },
			},
		);

		// Собираем информацию о вызовах функций включая arguments
		const functionCallsData: Array<{ name: string; arguments: string; result: string }> = [];

		for (let idx = 0; idx < notStoredMessages.length; idx++) {
			const msg = notStoredMessages[idx];

			// Ищем assistant с function_call
			if (msg.role === 'assistant' && msg.function_call) {
				const functionName = msg.function_call.name;
				const functionArgs =
					typeof msg.function_call.arguments === 'string'
						? msg.function_call.arguments
						: JSON.stringify(msg.function_call.arguments || {});

				// Ищем следующий function message с таким же именем
				const nextFunctionMsg = notStoredMessages
					.slice(idx + 1)
					.find((m) => m.role === 'function' && m.name === functionName);

				if (nextFunctionMsg) {
					functionCallsData.push({
						name: functionName,
						arguments: functionArgs,
						result: nextFunctionMsg.content || '',
					});
				}
			}
		}

		const functionCalls = functionCallsData
			.map((fc) => `Tool: ${fc.name}, Input: ${fc.arguments}, Result: ${fc.result}`)
			.join('; ');

		const assistantResponses = notStoredMessages
			.filter((m) => m.role === 'assistant' && m.content)
			.map((m) => m.content);

		const finalResponse = assistantResponses[assistantResponses.length - 1] || '';

		let fullOutput = finalResponse;
		if (functionCalls) {
			fullOutput = `[Used tools: ${functionCalls}] ${finalResponse}`;
		}

		if (memory && prompt && fullOutput) {
			await memory.saveContext({ input: prompt }, { output: fullOutput });
		}

		returnData.push(...executionData);
	}
	return [returnData];
}
