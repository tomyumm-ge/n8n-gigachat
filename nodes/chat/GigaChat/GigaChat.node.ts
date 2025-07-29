import {
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	INodePropertyOptions,
	IDataObject,
	NodeConnectionType,
	NodeOperationError,
} from 'n8n-workflow';
import { BaseChatMemory } from 'langchain/memory';
import { GigaChatApiClient } from '../../shared/GigaChatApiClient';
import type { Message as GigaChatMessage, Function as GigaChatFunction, FunctionCall } from 'gigachat/interfaces';

async function getOptionalMemory(ctx: IExecuteFunctions): Promise<BaseChatMemory | undefined> {
	return (await ctx.getInputConnectionData(NodeConnectionType.AiMemory, 0)) as
		| BaseChatMemory
		| undefined;
}

export class GigaChat implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'GigaChat',
		name: 'gigaChat',
		icon: 'file:gigachat.svg',
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
						url: 'https://docs.n8n.io/integrations/builtin/cluster-nodes/sub-nodes/n8n-nodes-langchain.lmgigachat/',
					},
				],
			},
		},
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
		outputs: [NodeConnectionType.Main],
		outputNames: ['Response'],
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
			{
				displayName: 'Model',
				name: 'modelId',
				type: 'options',
				description: 'The GigaChat model to use for chat completion',
				typeOptions: {
					loadOptionsMethod: 'getGigaChatModels',
				},
				default: 'GigaChat',
			},
			{
				displayName: 'Prompt (User Message)',
				name: 'prompt',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'Type your message here',
				displayOptions: {
					show: {
						'@version': [1],
					},
				},
				typeOptions: {
					rows: 3,
				},
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				default: {},
				placeholder: 'Add Option',
				options: [
					{
						displayName: 'Function Call Mode',
						name: 'functionCall',
						type: 'options',
						default: 'auto',
						description: 'How the model should handle function calls',
						options: [
							{
								name: 'Auto',
								value: 'auto',
								description: 'Model decides when to call functions',
							},
							{
								name: 'None',
								value: 'none',
								description: 'Model will not call functions',
							},
							{
								name: 'Required',
								value: 'required',
								description: 'Model must call at least one function',
							},
						],
					},
					{
						displayName: 'Max Tokens',
						name: 'maxTokensToSample',
						type: 'number',
						default: 1024,
						description: 'Maximum number of tokens to generate',
						typeOptions: {
							minValue: 1,
						},
					},
					{
						displayName: 'Repetition Penalty',
						name: 'repetitionPenalty',
						type: 'number',
						default: 1.0,
						description: 'Penalty for repeated tokens',
						typeOptions: {
							minValue: 0.1,
							maxValue: 2,
							numberPrecision: 1,
						},
					},
					{
						displayName: 'System Message',
						name: 'systemMessage',
						type: 'string',
						default: '',
						description: 'System message to set the behavior of the assistant',
						typeOptions: {
							rows: 3,
						},
					},
					{
						displayName: 'Temperature',
						name: 'temperature',
						type: 'number',
						default: 0.7,
						description: 'Controls randomness in generation (0-2)',
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
						description: 'Nucleus sampling parameter',
						typeOptions: {
							minValue: 0,
							maxValue: 1,
							numberPrecision: 2,
						},
					},
				],
			},
			{
				displayName: 'Simplify Output',
				name: 'simplifyOutput',
				type: 'boolean',
				default: false,
				description: 'Whether to return only the response text or include full statistics',
			},
		],
	};

	methods = {
		loadOptions: {
			async getGigaChatModels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const credentials = await this.getCredentials<{
					authorizationKey: string;
					scope?: string;
					base_url?: string;
				}>('gigaChatApi');

				const scope = credentials.scope ? String(credentials.scope) : 'GIGACHAT_API_PERS';
				await GigaChatApiClient.updateConfig({
					credentials: credentials.authorizationKey,
					scope: scope,
					authUrl: credentials.base_url ? `${credentials.base_url}/api/v2/oauth` : 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth',
				});

				const response = await GigaChatApiClient.getModels();

				return response.data.map((model: any) => ({
					name: model.id,
					value: model.id,
				}));
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		// Get credentials
		const credentials = await this.getCredentials('gigaChatApi');
		
		// Initialize GigaChat client - ensure scope is properly used
		const scope = credentials.scope ? String(credentials.scope) : 'GIGACHAT_API_PERS';
		await GigaChatApiClient.updateConfig({
			credentials: credentials.authorizationKey as string,
			scope: scope,
			model: 'GigaChat',
			timeout: 600,
			authUrl: credentials.base_url ? `${credentials.base_url}/api/v2/oauth` : 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth',
		});

		// Get connected nodes
		const memory = await getOptionalMemory(this);
		let tools: IDataObject[] = [];

		try {
			// Try to get tools if connected
			const toolsData = await this.getInputConnectionData(NodeConnectionType.AiTool, 0);
			if (toolsData) {
				tools = Array.isArray(toolsData) ? toolsData : [toolsData];
			}
		} catch (error) {
			// No tools connected, continue without them
		}

		for (let i = 0; i < items.length; i++) {
			try {
				const modelId = this.getNodeParameter('modelId', i) as string;
				const prompt = this.getNodeParameter('prompt', i) as string;
				const options = this.getNodeParameter('options', i) as IDataObject;

				// Prepare messages with proper ordering
				const messages: GigaChatMessage[] = [];

				// System message must be first if provided
				if (options.systemMessage) {
					messages.push({
						role: 'system',
						content: options.systemMessage as string,
					});
				}

				// Add chat history from memory if available (but skip system messages from history)
				if (memory) {
					try {
						// Get chat history from LangChain memory
						const chatHistory = await memory.chatHistory.getMessages();
						
						// Convert LangChain messages to GigaChat format
						let gigaChatMessages = chatHistory.map(msg => ({
							role: msg._getType() === 'human' ? 'user' as const : 'assistant' as const,
							content: msg.content.toString(),
						}));
						
						// Apply context window length limit if specified in memory
						const memoryInstance = memory as any;
						let contextWindowLength: number | undefined;
						
						// Try to get contextWindowLength from memory node configuration
						if (memoryInstance.contextWindowLength && typeof memoryInstance.contextWindowLength === 'number') {
							contextWindowLength = memoryInstance.contextWindowLength;
						} else if (memoryInstance.maxTokenLimit && typeof memoryInstance.maxTokenLimit === 'number') {
							contextWindowLength = memoryInstance.maxTokenLimit;
						}
						
						if (contextWindowLength && contextWindowLength > 0) {
							// Keep only the most recent messages within the context window
							gigaChatMessages = gigaChatMessages.slice(-contextWindowLength);
						}
						
						// Add messages (no system messages in LangChain history)
						messages.push(...gigaChatMessages);
					} catch (error) {
						console.log('Error loading chat history from memory:', error);
					}
				}

				// Add current user message
				messages.push({
					role: 'user',
					content: prompt,
				});

				// Prepare functions if tools are connected
				let functions: GigaChatFunction[] | undefined;
				if (tools.length > 0) {
					functions = tools.map((tool) => {
						// Convert n8n tool parameters to GigaChat format
						const toolParams = tool.parameters as any;
						
						// Handle different tool parameter formats
						let properties = {};
						let required: string[] = [];
						
						if (toolParams) {
							if (typeof toolParams === 'object') {
								properties = toolParams.properties || {};
								required = toolParams.required || [];
							} else if (typeof toolParams === 'string') {
								// If parameters is a string, try to parse it
								try {
									const parsed = JSON.parse(toolParams);
									properties = parsed.properties || {};
									required = parsed.required || [];
								} catch (e) {
									// If parsing fails, use empty objects
									properties = {};
									required = [];
								}
							}
						}
						
						// If no properties defined, check if tool has a schema
						if (Object.keys(properties).length === 0 && tool.schema) {
							// Some tools might have schema defined differently
							const toolSchema = tool.schema as any;
							if (toolSchema && typeof toolSchema === 'object' && toolSchema.properties) {
								properties = toolSchema.properties;
								required = toolSchema.required || [];
							}
						}
						
						// If still no properties, create a generic input parameter
						if (Object.keys(properties).length === 0) {
							properties = {
								input: {
									type: 'string',
									description: 'Input for the tool'
								}
							};
							required = ['input'];
						}
						
						return {
							name: tool.name as string,
							description: tool.description as string || '',
							parameters: {
								type: "object",
								properties: properties,
								required: required
							}
						};
					});
				}

				// Prepare chat request with only supported parameters
				const chatRequest: any = {
					model: modelId,
					messages,
				};

				// Add optional parameters only if they have valid values
				if (options.maxTokensToSample && (options.maxTokensToSample as number) > 0) {
					chatRequest.max_tokens = options.maxTokensToSample as number;
				}

				if (options.temperature !== undefined && (options.temperature as number) >= 0) {
					chatRequest.temperature = options.temperature as number;
				}

				if (options.topP !== undefined && (options.topP as number) >= 0 && (options.topP as number) <= 1) {
					chatRequest.top_p = options.topP as number;
				}

				if (options.repetitionPenalty !== undefined && (options.repetitionPenalty as number) > 0) {
					chatRequest.repetition_penalty = options.repetitionPenalty as number;
				}

				// Add function handling if tools are connected
				if (functions && functions.length > 0) {
					chatRequest.functions = functions;
					
					const functionCallMode = options.functionCall || 'auto';
					if (functionCallMode !== 'auto') {
						chatRequest.function_call = functionCallMode;
					}
				}

				// Always set stream to false for now
				chatRequest.stream = false;

				// Get session ID from memory node's sessionKey if available
				let sessionId: string | undefined;
				if (memory) {
					try {
						// Access the sessionKey from the memory node
						const memoryInstance = memory as any;
						
						// Try different ways to get the sessionId
						if (memoryInstance.sessionId) {
							sessionId = memoryInstance.sessionId;
						} else if (memoryInstance.chatHistory) {
							const chatHistory = memoryInstance.chatHistory;
							
							if (chatHistory.sessionId) {
								sessionId = chatHistory.sessionId;
							}
						}
					} catch (error) {
						console.log('Error loading session ID from memory:', error);
					}
				}

				// Make the API call
				const response = await GigaChatApiClient.chatWithSession(chatRequest, sessionId);

				// Handle the response
				const responseMessage = response.choices[0]?.message;
				if (!responseMessage) {
					throw new NodeOperationError(this.getNode(), 'No response from GigaChat', { itemIndex: i });
				}

				// Check if we need to execute a function
				if (responseMessage.function_call) {
					// Find the matching tool
					const functionCall = responseMessage.function_call as FunctionCall;
					const matchingTool = tools.find((tool) => tool.name === functionCall.name);
					
					if (matchingTool) {
						try {
							// Parse function arguments
							let functionArgs;
							try {
								functionArgs = typeof functionCall.arguments === 'string' 
									? JSON.parse(functionCall.arguments) 
									: functionCall.arguments || {};
							} catch (e) {
								console.error('Error parsing function arguments:', e);
								functionArgs = {};
							}
							
							// Try to execute the tool - n8n tools might have different execution methods
							let toolResult;
							
							// For n8n DynamicTool (Vector Store), extract the string input
							let toolInput = functionArgs;
							if (matchingTool.constructor?.name === 'DynamicTool' || 
								matchingTool.call && !matchingTool.execute) {
								// DynamicTool expects a string input
								if (typeof functionArgs === 'object') {
									// Try to extract the first string value from the arguments
									const firstKey = Object.keys(functionArgs)[0];
									if (firstKey && typeof functionArgs[firstKey] === 'string') {
										toolInput = functionArgs[firstKey];
									} else {
										toolInput = JSON.stringify(functionArgs);
									}
								}
							}
							
							if (typeof matchingTool.execute === 'function') {
								toolResult = await matchingTool.execute(toolInput);
							} else if (typeof matchingTool.call === 'function') {
								toolResult = await matchingTool.call(toolInput);
							} else if (typeof matchingTool.func === 'function') {
								toolResult = await matchingTool.func(toolInput);
							} else {
								toolResult = { error: 'Tool execution method not found' };
							}
							
							// Parse string results that might be JSON
							let parsedResult = toolResult;
							if (typeof toolResult === 'string') {
								try {
									parsedResult = JSON.parse(toolResult);
								} catch (e) {
									// Not JSON, keep as string
								}
							}
							
							// Add function call message
							messages.push(responseMessage);
							
							// Add function response message
							let functionResponseContent: string;
							
							// Handle empty array results from vector search
							if (Array.isArray(parsedResult) && parsedResult.length === 0) {
								functionResponseContent = JSON.stringify({
									status: 'no_results',
									message: 'No results found in the knowledge base for query: "' + toolInput + '"'
								});
							} else if (parsedResult === '[]' || parsedResult === '') {
								functionResponseContent = JSON.stringify({
									status: 'no_results',
									message: 'No results found in the knowledge base for query: "' + toolInput + '"'
								});
							} else if (typeof parsedResult === 'string') {
								// If it's already a JSON string, use it directly
								try {
									JSON.parse(parsedResult);
									functionResponseContent = parsedResult;
								} catch (e) {
									// Not valid JSON, wrap it
									functionResponseContent = JSON.stringify({
										status: 'success',
										result: parsedResult
									});
								}
							} else {
								functionResponseContent = JSON.stringify({
									status: 'success',
									result: parsedResult
								});
							}
							
							messages.push({
								role: 'function',
								name: functionCall.name,
								content: functionResponseContent,
							});

							// Make another API call with the function result
							const finalResponse = await GigaChatApiClient.chatWithSession({
								...chatRequest,
								messages,
							}, sessionId);

							const finalMessage = finalResponse.choices[0]?.message;
							if (finalMessage && finalMessage.content) {
								responseMessage.content = finalMessage.content;
							} else {
								// If no content in final response, use the function result
								responseMessage.content = `Tool ${functionCall.name} executed with result: ${functionResponseContent}`;
							}
						} catch (error) {
							// Include error information in response
							responseMessage.content = `Error executing tool ${functionCall.name}: ${error.message || String(error)}`;
							
							// Also add the error as a function response if we were in the middle of function calling
							if (messages[messages.length - 1]?.role === 'assistant' && messages[messages.length - 1]?.function_call) {
								const errorFunctionResponse = JSON.stringify({
									status: 'error',
									error: error.message || String(error)
								});
								
								messages.push({
									role: 'function',
									name: functionCall.name,
									content: errorFunctionResponse,
								});
							}
						}
					} else {
						// Tool not found
						responseMessage.content = `Tool ${functionCall.name} not found`;
					}
				}

				// Save to memory if available
				if (memory && responseMessage) {
					try {
						// Save the conversation to memory
						await memory.saveContext(
							{ input: prompt },
							{ output: responseMessage.content || '' }
						);
					} catch (error) {
						console.log('Error saving conversation to memory:', error);
					}
				}

				// Get simplify output setting
				const simplifyOutput = this.getNodeParameter('simplifyOutput', i) as boolean;

				// Prepare output based on simplify setting
				const outputData = simplifyOutput 
					? { response: responseMessage.content || '' }
					: {
						response: responseMessage.content || '',
						model: modelId,
						usage: response.usage,
						sessionId: response.xHeaders?.xSessionID || sessionId,
						finishReason: response.choices[0]?.finish_reason,
					};

				const executionData = this.helpers.constructExecutionMetaData(
					this.helpers.returnJsonArray(outputData),
					{ itemData: { item: i } },
				);

				if (Array.isArray(executionData)) {
					returnData.push(...executionData);
				} else {
					returnData.push(executionData);
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
}