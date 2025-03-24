import { INodeType, INodeTypeDescription } from 'n8n-workflow';
import { chatFields, chatOperations } from './ChatDescription';

export class GigaChat implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'GigaChat',
		name: 'gigaChat',
		icon: { light: 'file:GigaChat.svg', dark: 'file:GigaChat-dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'GigaChat API for individuals',
		defaults: {
			name: 'GigaChat',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'gigaChatApi',
				required: true,
			},
		],
		requestDefaults: {
			ignoreHttpStatusErrors: true,
			skipSslCertificateValidation: true,
			baseURL: 'https://gigachat.devices.sberbank.ru/api/v1',
		},
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Чат',
						value: 'chat',
					},
					{
						name: 'Токен',
						value: 'token',
					},
				],
				default: 'chat',
			},
			...chatOperations,
			...chatFields,
		],
	};
}
