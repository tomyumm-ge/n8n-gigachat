import { INodeProperties } from 'n8n-workflow';

const disclaimerBlocks: INodeProperties[] = [
	{
		displayName:
			'Неофициальный узел. Прочтите <a href="https://github.com/tomyumm-ge/n8n-gigachat/wiki/%E2%9A%A0%EF%B8%8F-Disclaimers" target="_blank">дисклеймер</a>.',
		name: 'unofficialWarning',
		type: 'notice',
		default: '',
	},
];

export { disclaimerBlocks };
