import { IExecuteFunctions } from 'n8n-workflow';
import { FunctionCall, Function as GigaFunction } from 'gigachat/interfaces';
import { toJsonSchema } from '@langchain/core/utils/json_schema';

type ToolSchema = Record<string, any>;

function isObject(value: unknown): value is Record<string, any> {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function getToolSchema(tool: any): ToolSchema | undefined {
	// The schema used by the tool's validator takes precedence over display metadata.
	let source = tool.schema ?? tool.parameters;
	if (source == null) return undefined;

	try {
		if (typeof source === 'string') source = JSON.parse(source);
		if (!isObject(source)) throw new Error('Expected an object schema');
		// Use the input schema: defaults/transforms are applied by the tool, not the model.
		// LangChain supports Zod 3/4 from other package copies without instanceof checks.
		const converted: unknown = toJsonSchema(source, { io: 'input' });
		if (!isObject(converted)) throw new Error('Expected a JSON Schema object');
		const { $schema, ...schema } = converted;
		return schema;
	} catch (error) {
		throw new Error(
			`Cannot convert schema for tool "${tool.name}": ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

function isLegacyStringTool(tool: any): boolean {
	// Only used for old tools with no schema. A .call method does not imply string input.
	return (
		tool.constructor?.name === 'DynamicTool' || tool.constructor?.lc_name?.() === 'DynamicTool'
	);
}

function getToolParameters(tool: any, schema = getToolSchema(tool)): GigaFunction['parameters'] {
	if (schema === undefined || schema.type === 'string') {
		return {
			type: 'object',
			properties: { input: schema ?? { type: 'string', description: 'Input for the tool' } },
			required: ['input'],
		};
	}
	if (schema.type !== 'object' && !(schema.type === undefined && isObject(schema.properties))) {
		throw new Error(`Unsupported input schema for tool "${tool.name}": expected object or string`);
	}
	// Keep the entire schema, including nested required fields, enums, definitions and refs.
	// An empty object is a valid no-argument tool, not a reason to invent an input field.
	return {
		...schema,
		type: 'object',
		properties: schema.properties ?? {},
		required: schema.required ?? [],
	};
}

export async function prepareGigaTools(
	ctx: IExecuteFunctions,
): Promise<{ functions: GigaFunction[]; tools: any[] }> {
	let tools: any[] = [];

	try {
		const toolsData = await ctx.getInputConnectionData('ai_tool', 0);
		if (toolsData) tools = Array.isArray(toolsData) ? toolsData : [toolsData];
	} catch (error) {}

	const functions: GigaFunction[] = tools.map((tool) => ({
		name: tool.name as string,
		description: (tool.description as string) || '',
		parameters: getToolParameters(tool),
	}));
	return { functions, tools };
}

export async function executeGigaTool(tool: any, functionCall: FunctionCall): Promise<unknown> {
	let functionArgs: unknown;
	try {
		functionArgs =
			typeof functionCall.arguments === 'string'
				? JSON.parse(functionCall.arguments)
				: functionCall.arguments === undefined
					? {}
					: functionCall.arguments;
	} catch (error) {
		throw new Error(`Invalid JSON arguments for tool "${tool.name}"`);
	}

	const schema = getToolSchema(tool);
	let toolInput: unknown = functionArgs;
	if (schema?.type === 'string' || (schema === undefined && isLegacyStringTool(tool))) {
		// Unwrap only the advertised input field, never an arbitrary first property.
		toolInput = isObject(functionArgs) ? functionArgs.input : functionArgs;
		if (typeof toolInput !== 'string') {
			throw new Error(`Tool "${tool.name}" expects a string in "input"`);
		}
	} else if (!isObject(functionArgs)) {
		throw new Error(`Tool "${tool.name}" expects an object of arguments`);
	}

	if (typeof tool.execute === 'function') return await tool.execute(toolInput);
	if (typeof tool.invoke === 'function') return await tool.invoke(toolInput);
	if (typeof tool.call === 'function') return await tool.call(toolInput);
	if (typeof tool.func === 'function') return await tool.func(toolInput);
	throw new Error(`Tool "${tool.name}" has no supported execution method`);
}

export function formatGigaToolResult(toolResult: any, toolInput: any): string {
	// Parse string results that might be JSON
	let parsedResult = toolResult;
	if (typeof toolResult === 'string') {
		try {
			parsedResult = JSON.parse(toolResult);
		} catch (e) {
			// Not JSON, keep as string
		}
	}

	let functionResponseContent: string;

	if (Array.isArray(parsedResult) && parsedResult.length === 0) {
		functionResponseContent = JSON.stringify({
			status: 'no_results',
			message: 'No results found in the knowledge base for query: "' + toolInput + '"',
		});
	} else if (parsedResult === '[]' || parsedResult === '') {
		functionResponseContent = JSON.stringify({
			status: 'no_results',
			message: 'No results found in the knowledge base for query: "' + toolInput + '"',
		});
	} else if (typeof parsedResult === 'string') {
		try {
			JSON.parse(parsedResult);
			functionResponseContent = parsedResult;
		} catch (e) {
			functionResponseContent = JSON.stringify({
				status: 'success',
				result: parsedResult,
			});
		}
	} else {
		functionResponseContent = JSON.stringify({
			status: 'success',
			result: parsedResult,
		});
	}

	return functionResponseContent;
}
