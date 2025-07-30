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
		{
			displayName: 'Base URL',
			name: 'base_url',
			type: 'string',
			default: 'https://ngw.devices.sberbank.ru:9443',
			required: true,
			description:
				'Base url for authorization flow (change it ONLY if you know what are you doing)',
		},
		{
			displayName:
				'<b>Это не официальный Community узел!</b><br/>Все права на товарные знаки, логотипы и иные обозначения принадлежат их законным правообладателям. Товарный знак "Сбер", логотипы и наименования сервисов Сбера являются собственностью ПАО "СберБанк". Настоящий проект не является официальным продуктом Сбера и создан независимым разработчиком в некоммерческих целях.',
			name: 'unofficialWarning',
			type: 'notice',
			default: '',
		},
		{
			displayName:
				'<b>И ещё раз Disclaimer</b><br/>Это программное обеспечение предоставляется "как есть", без каких-либо явных или подразумеваемых гарантий, включая, но не ограничиваясь, гарантией товарной пригодности или пригодности для конкретной цели. Автор не несёт ответственности за любые убытки, включая упущенную выгоду, возникшие в результате использования этого ПО. Используется на ваш страх и риск.',
			name: 'disclaimer',
			type: 'notice',
			default: '',
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
