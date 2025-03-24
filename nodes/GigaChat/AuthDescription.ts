import { INodeProperties } from 'n8n-workflow';

export const authOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['auth'],
			},
		},
		options: [
			{
				name: 'Get Token',
				value: 'getToken',
				action: 'Get token',
				description: 'Get token for authentication',
				routing: {
					request: {
						method: 'POST',
						url: '/oauth',
						baseURL: 'https://ngw.devices.sberbank.ru:9443/api/v2',
						headers: {
							'Content-Type': 'application/x-www-form-urlencoded',
							RqUID:
								'={{ Array(36).fill().map(() => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("") }}',
						},
						body: encodeURIComponent('scope=GIGACHAT_API_PERS'),
					},
					output: {
						postReceive: [
							{
								type: 'set',
								properties: {
									value: '={{ $response.body.access_token }}',
								},
							},
						],
					},
				},
			},
		],
		default: 'getToken',
	},
];

const getTokenOperations: INodeProperties[] = [
	{
		displayName: 'Notice',
		description:
			'You must perform this action before using other operations (the token will be saved in the token field)',
		name: 'notice',
		type: 'notice',
		default: '',
	},
];

export const authFields: INodeProperties[] = [...getTokenOperations];
