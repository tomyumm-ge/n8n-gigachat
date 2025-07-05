import { INodeProperties, NodeConnectionType } from 'n8n-workflow';

export function getConnectionHintNoticeField(
	connectionTypes: NodeConnectionType[],
): INodeProperties {
	const connectionTypeNames = connectionTypes
		.map((type) => {
			switch (type) {
				case NodeConnectionType.AiMemory:
					return 'Memory';
				case NodeConnectionType.AiTool:
					return 'Tool';
				case NodeConnectionType.AiLanguageModel:
					return 'Language Model';
				case NodeConnectionType.AiEmbedding:
					return 'Embedding';
				default:
					return type;
			}
		})
		.join(' or ');

	return {
		displayName: '',
		name: 'notice',
		type: 'notice',
		default: '',
		typeOptions: {
			notice: `Connect ${connectionTypeNames} nodes to the input of this node to use their capabilities.`,
		},
	};
}