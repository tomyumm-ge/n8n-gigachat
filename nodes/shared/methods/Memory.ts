import { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { BaseChatMemory, BufferWindowMemory } from 'langchain/memory';
import { Message } from 'gigachat/interfaces';
import { BaseMessage } from '@langchain/core/messages';

export type MemoryType = BufferWindowMemory | BaseChatMemory | undefined;

export async function convertMessagesGigachat(
	ctx: IExecuteFunctions,
	i: number,
	memory: MemoryType,
): Promise<{ sessionId: string; messages: Message[] }> {
	const aiOptions = ctx.getNodeParameter('options', i) as IDataObject;

	const items = ctx.getInputData();
	const sessionId =
		items[0]?.json?.sessionId ||
		items[0]?.json?.chat_session_id ||
		(ctx.getNodeParameter('sessionId', 0, '') as string);

	if (!sessionId) {
		console.warn('We have not provided Session ID, please provide it in input instead');
	}

	const messages: Message[] = [];

	if (aiOptions.systemMessage) {
		messages.push({
			role: 'system',
			content: aiOptions.systemMessage as string,
		});
	}

	if (memory) {
		const memoryVariables = await memory.loadMemoryVariables({});
		const chatHistory = (memoryVariables['chat_history'] as BaseMessage[]) || [];

		for (const msg of chatHistory) {
			const msgType = msg.getType();

			if (msgType === 'human') {
				messages.push({
					role: 'user',
					content: msg.content.toString(),
				});
			} else if (msgType === 'ai') {
				const content = msg.content.toString();

				const toolCallMatch = content.match(/\[Used tools: (.*?)\] (.*)/s);

				if (toolCallMatch) {
					const toolsText = toolCallMatch[1];
					const actualResponse = toolCallMatch[2];

					// Парсим формат: Tool: name, Input: {...}, Result: {...}
					const toolRegex = /Tool: ([^,]+), Input: (.*?), Result: (.*?)(?:;|$)/g;
					let match;

					while ((match = toolRegex.exec(toolsText)) !== null) {
						const [_, toolName, toolInput, toolResult] = match;

						// 1. Добавляем assistant с function_call
						messages.push({
							role: 'assistant',
							function_call: {
								name: toolName.trim(),
								arguments: JSON.parse(toolInput.trim()) as { [key: string]: any },
							},
						});

						// 2. Добавляем function message с результатом
						messages.push({
							role: 'function',
							name: toolName.trim(),
							content: toolResult.trim(),
						});
					}

					// 3. Добавляем финальный ответ assistant
					messages.push({
						role: 'assistant',
						content: actualResponse,
					});
				} else {
					// Обычный ответ без tool calls
					messages.push({
						role: 'assistant',
						content: content,
					});
				}
			}
		}
	}

	return { sessionId: String(sessionId), messages };
}
