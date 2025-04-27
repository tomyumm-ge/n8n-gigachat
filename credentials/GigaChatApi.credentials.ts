import {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class GigaChatApi implements ICredentialType {
	name = 'gigaChatApi';
	icon: Icon = {
		light: 'file:gigachat-light.svg',
		dark: 'file:gigachat-dark.svg',
	};
	displayName = 'GigaChat API';
	documentationUrl = 'https://developers.sber.ru/docs/ru/gigachat/individuals-quickstart';
	properties: INodeProperties[] = [
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
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '={{"Basic " + $credentials.authorizationKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://ngw.devices.sberbank.ru:9443',
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
		},
	};
}
