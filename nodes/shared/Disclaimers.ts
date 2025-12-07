import { INodeProperties } from 'n8n-workflow';

const disclaimerBlocks: INodeProperties[] = [
	{
		displayName:
			'<b>Неофициальный проект</b><br/>На ваш страх и риск. Это не сберовский узел.<br/><a href="https://github.com/tomyumm-ge/n8n-gigachat/wiki/%E2%9A%A0%EF%B8%8F-Disclaimers" target="_blank">Узнать подробнее</a>',
		name: 'unofficialWarning',
		type: 'notice',
		default: '',
	},
];

export { disclaimerBlocks };
