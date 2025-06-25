import {
    IExecuteFunctions,
    ILoadOptionsFunctions,
    INodeExecutionData,
    INodePropertyOptions,
    INodeType,
    INodeTypeDescription,
    NodeConnectionType,
} from 'n8n-workflow';
import { GigaChatApiClient } from '../../shared/GigaChatApiClient';

interface MessageInput {
    type: 'system' | 'human' | 'ai';
    content: string;
}

export class ChatGigaChat implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'GigaChat Chat',
        name: 'chatGigaChat',
        icon: 'file:gigachat.svg',
        group: ['transform'],
        version: 1,
        description: 'Send chat messages to GigaChat',
        defaults: {
            name: 'GigaChat Chat',
        },
        codex: {
            categories: ['AI'],
            subcategories: {
                AI: ['Root Nodes'],
            },
        },
        // eslint-disable-next-line n8n-nodes-base/node-class-description-inputs-wrong-regular-node
        inputs: [NodeConnectionType.Main, NodeConnectionType.AiMemory],
        inputNames: ['Main', 'Memory'],
        // eslint-disable-next-line n8n-nodes-base/node-class-description-outputs-wrong
        outputs: [NodeConnectionType.Main],
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
                default: '',
                required: true,
                description:
                    'The name of the model to use. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
                typeOptions: {
                    loadOptionsMethod: 'getGigaChatModels',
                },
            },
            {
                displayName: 'Cache Input?',
                name: 'cacheInput',
                type: 'boolean',
                default: false,
            },
            {
                displayName: 'X-Session ID',
                name: 'sessionId',
                type: 'string',
                default: '',
                displayOptions: {
                    show: {
                        cacheInput: [true],
                    },
                },
            },
            {
                displayName: 'Output Mode',
                name: 'outputMode',
                type: 'options',
                default: 'textOnly',
                options: [
                    {
                        name: 'Text Only',
                        value: 'textOnly',
                    },
                    {
                        name: 'Text and Token Usage',
                        value: 'withUsage',
                    },
                ],
            },
            {
                displayName: 'User Message',
                name: 'userMessage',
                type: 'string',
                default: '',
            },
            {
                displayName: 'Messages',
                name: 'messages',
                type: 'fixedCollection',
                typeOptions: {
                    multipleValues: true,
                },
                default: {},
                placeholder: 'Add Message',
                options: [
                    {
                        displayName: 'Message',
                        name: 'message',
                        values: [
                            {
                                displayName: 'Type',
                                name: 'type',
                                type: 'options',
                                options: [
                                    {
                                        name: 'System',
                                        value: 'system',
                                    },
                                    {
                                        name: 'Human',
                                        value: 'human',
                                    },
                                    {
                                        name: 'AI',
                                        value: 'ai',
                                    },
                                ],
                                default: 'human',
                            },
                            {
                                displayName: 'Content',
                                name: 'content',
                                type: 'string',
                                default: '',
                            },
                        ],
                    },
                ],
            },
        ],
    };

    async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
        const items = this.getInputData();
        const returnData: INodeExecutionData[] = [];
        const credentials = await this.getCredentials<{
            authorizationKey: string;
            scope: string;
        }>('gigaChatApi');

        const modelName = this.getNodeParameter('model', 0) as string;
        await GigaChatApiClient.updateConfig({
            credentials: credentials.authorizationKey,
            scope: credentials.scope,
            model: modelName,
        });

        for (let i = 0; i < items.length; i++) {
            const cacheInput = this.getNodeParameter('cacheInput', i) as boolean;
            const sessionId = this.getNodeParameter('sessionId', i) as string;
            const outputMode = this.getNodeParameter('outputMode', i) as string;
            const userMessage = this.getNodeParameter('userMessage', i) as string;
            const messageCollection = (this.getNodeParameter('messages.message', i, []) as MessageInput[]);

            const messages: Array<{ role: string; content: string }> = [];

            const memoryData = (await this.getInputConnectionData(NodeConnectionType.AiMemory, i, 0)) as any[];
            let memory: any;
            if (Array.isArray(memoryData) && memoryData.length > 0) {
                const entry = memoryData[0];
                memory = entry?.json?.memory ?? entry?.json ?? entry;
                if (Array.isArray(memory?.messages)) {
                    for (const m of memory.messages) {
                        if (m.role && m.content) {
                            messages.push({ role: m.role, content: m.content });
                        }
                    }
                }
            }

            const newConversation: Array<{ role: string; content: string }> = [];
            for (const msg of messageCollection) {
                const roleMap: Record<string, string> = {
                    system: 'system',
                    human: 'user',
                    ai: 'assistant',
                };
                const mapped = { role: roleMap[msg.type], content: msg.content };
                messages.push(mapped);
                newConversation.push(mapped);
            }

            if (userMessage) {
                const userMsg = { role: 'user', content: userMessage };
                messages.push(userMsg);
                newConversation.push(userMsg);
            }

            if (cacheInput && sessionId) {
                (GigaChatApiClient as any)._client.defaults.headers['X-Session-Id'] = sessionId;
            }

            const response = await GigaChatApiClient.chat({ model: modelName, messages });

            if (cacheInput && sessionId) {
                delete (GigaChatApiClient as any)._client.defaults.headers['X-Session-Id'];
            }

            let output: any;
            const text = response.choices?.[0]?.message?.content ?? '';
            if (Array.isArray(memory?.messages)) {
                memory.messages.push(...newConversation, { role: 'assistant', content: text });
            }
            if (outputMode === 'withUsage') {
                output = { text, usage: response.usage };
            } else if (outputMode === 'textOnly') {
                output = { text };
            } else {
                output = response;
            }

            returnData.push({ json: output });
        }

        return [returnData];
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
