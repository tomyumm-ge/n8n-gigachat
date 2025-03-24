import {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class GigaChatApi implements ICredentialType {
	name = 'gigaChatApi';
	displayName = 'GigaChat API';
	documentationUrl = 'https://developers.sber.ru/docs/ru/gigachat/individuals-quickstart';
	properties: INodeProperties[] = [
		{
			displayName: 'Authorization key',
			name: 'authorizationKey',
			type: 'string',
			default: '',
			typeOptions: {
				password: true,
			},
		},
		{
			displayName: 'Domain',
			name: 'domain',
			type: 'string',
			default: 'https://ngw.devices.sberbank.ru:9443',
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
		},
	};
}
