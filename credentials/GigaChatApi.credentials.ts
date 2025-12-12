import { Icon, ICredentialTestRequest, ICredentialType, INodeProperties } from 'n8n-workflow';
import { disclaimerBlocks } from '../nodes/shared/Disclaimers';

export class GigaChatApi implements ICredentialType {
	name = 'gigaChatApi';
	icon: Icon = {
		light: 'file:gigachat-light.svg',
		dark: 'file:gigachat-dark.svg',
	};
	// eslint-disable-next-line n8n-nodes-base/cred-class-field-display-name-missing-api
	displayName = 'GigaChat';
	documentationUrl =
		'https://developers.sber.ru/docs/ru/gigachat/quickstart/ind-using-api#poluchenie-avtorizatsionnyh-dannyh';
	properties: INodeProperties[] = [
		...disclaimerBlocks,
		{
			displayName: 'Authorization key',
			name: 'authorizationKey',
			type: 'string',
			default: '',
			required: true,
			description: 'Base64 encoded log:pass pair (authKey)',
			typeOptions: {
				password: true,
			},
		},
		{
			displayName: 'Scope',
			name: 'scope',
			type: 'options',
			description: 'Type of account',
			default: 'GIGACHAT_API_PERS',
			options: [
				{
					name: 'GIGACHAT_API_PERS',
					description: 'Individual account',
					value: 'GIGACHAT_API_PERS',
				},
				{
					name: 'GIGACHAT_API_B2B',
					description: 'Business account (token packages)',
					value: 'GIGACHAT_API_B2B',
				},
				{
					name: 'GIGACHAT_API_CORP',
					description: 'Business account (pay-as-you-go)',
					value: 'GIGACHAT_API_CORP',
				},
			],
		},
		{
			type: 'notice',
			name: 'change_warning',
			default: '',
			displayName:
				'<b>Base URL</b><br/>Поля ниже редактируйте, только если действительно знаете, что делаете',
		},
		{
			displayName: 'Base Auth URL',
			name: 'base_url',
			type: 'string',
			default: 'https://ngw.devices.sberbank.ru:9443',
			required: true,
			description: 'Базовый url для авторизации',
		},
		{
			displayName: 'Base Backend URL',
			name: 'base_back_url',
			type: 'string',
			default: 'https://gigachat.devices.sberbank.ru/api/v1',
			required: true,
			description: 'Базовый url для GigaChat API',
		},
		{
			displayName: 'Debug',
			name: 'debug',
			type: 'boolean',
			default: false,
			required: true,
			description: 'Включить отладку в консоли n8n',
		},
	];

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.base_url ?? "https://ngw.devices.sberbank.ru:9443"}}',
			url: '/api/v2/oauth',
			method: 'POST',
			headers: {
				RqUID:
					'={{"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => (c == "x" ? (Math.random() * 16 | 0) : (Math.random() * 4 | 8)).toString(16))}}',
				Authorization: '={{"Basic " + $credentials.authorizationKey}}',
				'Content-Type': 'application/x-www-form-urlencoded',
				Accept: 'application/json',
			},
			body: {
				scope: '={{$credentials.scope}}',
			},
			skipSslCertificateValidation: true,
		},
	};
}
