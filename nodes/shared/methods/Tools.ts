import { IExecuteFunctions } from 'n8n-workflow';
import { FunctionCall, Function as GigaFunction } from 'gigachat/interfaces';

function zodShapeOf(schema: any): Record<string, any> | null {
	if (!schema || typeof schema !== 'object') return null;
	if (schema.shape && typeof schema.shape === 'object') return schema.shape;
	if (schema._def && typeof schema._def.shape === 'function') {
		try {
			return schema._def.shape();
		} catch (e) {}
	}
	return null;
}

function zodTypeOf(field: any): string {
	const name =
		(field && field.constructor && field.constructor.name) ||
		(field && field._def && field._def.typeName) ||
		'';
	if (/ZodString/.test(name)) return 'string';
	if (/ZodNumber/.test(name)) return 'number';
	if (/ZodBoolean/.test(name)) return 'boolean';
	if (/ZodArray/.test(name)) return 'array';
	return 'string';
}

export async function prepareGigaTools(
	ctx: IExecuteFunctions,
): Promise<{ functions: GigaFunction[]; tools: any[] }> {
	let tools: any[] = [];

	try {
		const toolsData = await ctx.getInputConnectionData('ai_tool', 0);
		if (toolsData) {
			tools = Array.isArray(toolsData) ? toolsData : [toolsData];
		}
	} catch (error) {}

	const functions: GigaFunction[] = [];
	if (tools.length > 0) {
		for (const tool of tools) {
			const toolParams = tool.parameters as any;

			let properties = {};
			let required: string[] = [];

			if (toolParams) {
				if (typeof toolParams === 'object') {
					properties = toolParams.properties || {};
					required = toolParams.required || [];
				} else if (typeof toolParams === 'string') {
					// If parameters is a string, try to parse it
					try {
						const parsed = JSON.parse(toolParams);
						properties = parsed.properties || {};
						required = parsed.required || [];
					} catch (e) {
						// If parsing fails, use empty objects
						properties = {};
						required = [];
					}
				}
			}

			// If no properties defined, check if tool has a schema
			if (Object.keys(properties).length === 0 && tool.schema) {
				const toolSchema = tool.schema as any;
				// Zod schemas (DynamicStructuredTool) have no `.properties`; walk the shape instead
				const shape = zodShapeOf(toolSchema);
				if (shape && Object.keys(shape).length > 0) {
					for (const key of Object.keys(shape)) {
						const field = shape[key];
						const prop: any = { type: zodTypeOf(field) };
						if (field && typeof field.description === 'string') {
							prop.description = field.description;
						}
						if (prop.type === 'array') {
							const el = field.element || (field._def && field._def.type);
							if (el) prop.items = { type: zodTypeOf(el) };
						}
						properties[key] = prop;
						let optional = false;
						try {
							optional =
								typeof (field && field.isOptional) === 'function'
									? field.isOptional()
									: !!(
											field &&
											typeof field.safeParse === 'function' &&
											field.safeParse(undefined).success
										);
						} catch (e) {}
						if (!optional) required.push(key);
					}
				} else if (toolSchema && typeof toolSchema === 'object' && toolSchema.properties) {
					properties = toolSchema.properties;
					required = toolSchema.required || [];
				}
			}

			// If still no properties, create a generic input parameter
			if (Object.keys(properties).length === 0) {
				properties = {
					input: {
						type: 'string',
						description: 'Input for the tool',
					},
				};
				required = ['input'];
			}

			functions.push({
				name: tool.name as string,
				description: (tool.description as string) || '',
				parameters: {
					type: 'object',
					properties: properties,
					required: required,
				},
			});
		}
	}

	return { functions, tools };
}

export async function executeGigaTool(tool: any, functionCall: FunctionCall): Promise<string> {
	// Parse function arguments
	let functionArgs;
	try {
		functionArgs =
			typeof functionCall.arguments === 'string'
				? JSON.parse(functionCall.arguments)
				: functionCall.arguments || {};
	} catch (e) {
		functionArgs = {};
	}

	// Try to execute the tool - n8n tools might have different execution methods
	let toolResult;

	// For n8n DynamicTool (Vector Store), extract the string input
	let toolInput = functionArgs;
	// Structured tools must receive the parsed arguments OBJECT; coercing it to a
	// string makes their zod validation fail ("Expected object, received string").
	const isStructuredTool =
		tool.constructor?.name === 'DynamicStructuredTool' ||
		typeof (tool.schema && tool.schema.safeParse) === 'function';
	if (
		!isStructuredTool &&
		(tool.constructor?.name === 'DynamicTool' || (tool.call && !tool.execute))
	) {
		// DynamicTool expects a string input
		if (typeof functionArgs === 'object') {
			// Try to extract the first string value from the arguments
			const firstKey = Object.keys(functionArgs)[0];
			if (firstKey && typeof functionArgs[firstKey] === 'string') {
				toolInput = functionArgs[firstKey];
			} else {
				toolInput = JSON.stringify(functionArgs);
			}
		}
	}

	if (typeof tool.execute === 'function') {
		toolResult = await tool.execute(toolInput);
	} else if (typeof tool.call === 'function') {
		toolResult = await tool.call(toolInput);
	} else if (typeof tool.func === 'function') {
		toolResult = await tool.func(toolInput);
	} else {
		toolResult = { error: 'Tool execution method not found' };
	}

	return toolResult;
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
