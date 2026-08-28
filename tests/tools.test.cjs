const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createRequire } = require('node:module');
const { DynamicTool, DynamicStructuredTool, StructuredTool } = require('@langchain/core/tools');
const { prepareGigaTools, executeGigaTool } = require('../dist/nodes/shared/methods/Tools');

// n8n's tools may carry a different Zod copy/version than this package.
const z3 = createRequire(require.resolve('langchain-gigachat'))('zod').z;
const z4 = createRequire(require.resolve('@langchain/core/tools'))('zod/v4').z;
const prepare = async (tool) =>
	(await prepareGigaTools({ getInputConnectionData: async () => [tool] })).functions[0].parameters;
const execute = (tool, args) => executeGigaTool(tool, { name: tool.name, arguments: args });
const structured = (schema, func = async (args) => args) =>
	new DynamicStructuredTool({
		name: 'structured',
		description: 'Test tool',
		schema,
		func,
	});

for (const [version, z] of [
	['Zod 3', z3],
	['Zod 4', z4],
]) {
	test(`${version}: preserve nested schemas, optional/default values, enums and descriptions`, async () => {
		const schema = z.object({
			URL: z.string().describe('Exact URL'),
			count: z.number().int().min(1).optional(),
			enabled: z.boolean().default(true),
			mode: z.enum(['fast', 'slow']),
			rows: z.array(z.object({ id: z.number(), label: z.string().optional() })),
			ids: z.array(z.number()).optional(),
			metadata: z.object({ active: z.boolean() }),
		});
		const tool = structured(schema);
		const converted = await prepare(tool);
		assert.equal(converted.properties.URL.description, 'Exact URL');
		assert.equal(converted.properties.count.type, 'integer');
		assert.equal(converted.properties.count.minimum, 1);
		assert.equal(converted.properties.enabled.type, 'boolean');
		assert.equal(converted.properties.enabled.default, true);
		assert.deepEqual(converted.properties.mode.enum, ['fast', 'slow']);
		assert.equal(converted.properties.rows.items.type, 'object');
		assert.deepEqual(converted.properties.rows.items.required, ['id']);
		assert.equal(converted.properties.ids.items.type, 'number');
		assert.equal(converted.properties.metadata.properties.active.type, 'boolean');
		assert.deepEqual(converted.required, ['URL', 'mode', 'rows', 'metadata']);
		assert.equal(converted.$schema, undefined);
		const args = {
			URL: 'https://example.test',
			mode: 'fast',
			rows: [{ id: 3 }],
			metadata: { active: true },
		};
		assert.deepEqual(await execute(tool, JSON.stringify(args)), { ...args, enabled: true });
		assert.deepEqual(await execute(tool, args), { ...args, enabled: true });
	});

	test(`${version}: an empty schema stays a no-argument tool`, async () => {
		const tool = structured(z.object({}).strict());
		const schema = await prepare(tool);
		assert.deepEqual(schema.properties, {});
		assert.deepEqual(schema.required, []);
		assert.deepEqual(await execute(tool, '{}'), {});
		assert.deepEqual(await execute(tool, undefined), {});
	});

	test(`${version}: advertise transform input, let the tool apply the transform`, async () => {
		const tool = structured(z.object({ text: z.string().transform((value) => value.length) }));
		assert.equal((await prepare(tool)).properties.text.type, 'string');
		assert.deepEqual(await execute(tool, { text: 'hello' }), { text: 5 });
	});

	test(`${version}: preserve nullable and union fields instead of pretending they are strings`, async () => {
		const tool = structured(
			z.object({ maybe: z.string().nullable(), choice: z.union([z.string(), z.number()]) }),
		);
		const { properties } = await prepare(tool);
		assert.ok(properties.maybe.anyOf || Array.isArray(properties.maybe.type));
		assert.ok(properties.choice.anyOf || Array.isArray(properties.choice.type));
		assert.deepEqual(await execute(tool, { maybe: null, choice: 42 }), { maybe: null, choice: 42 });
	});

	test(`${version}: string-schema tools unwrap only the advertised input field`, async () => {
		const tool = { name: 'string', schema: z.string().min(2), invoke: async (arg) => arg };
		assert.equal((await prepare(tool)).properties.input.minLength, 2);
		assert.equal(await execute(tool, { input: 'hello' }), 'hello');
		await assert.rejects(execute(tool, { wrong: 'hello' }), /expects a string in "input"/);
	});
}

test('Calculator-style DynamicTool continues to accept its object input schema', async () => {
	const tool = new DynamicTool({
		name: 'calculator',
		description: 'Calculator',
		func: async (value) => `received:${value}`,
	});
	const schema = await prepare(tool);
	assert.equal(schema.properties.input.type, 'string');
	assert.equal(await execute(tool, { input: '2+2' }), 'received:2+2');
});

test('JSON Schema StructuredTool subclasses receive objects regardless of constructor name', async () => {
	class CustomTool extends StructuredTool {
		name = 'custom';
		description = 'Custom tool';
		schema = { type: 'object', properties: { URL: { type: 'string' } }, required: ['URL'] };
		async _call(args) {
			return JSON.stringify(args);
		}
	}
	const tool = new CustomTool();
	assert.equal(tool.execute, undefined);
	assert.equal(
		await execute(tool, { URL: 'https://example.test' }),
		'{"URL":"https://example.test"}',
	);
});

test('plain JSON Schema keeps definitions/refs and is not mutated', async () => {
	const schema = {
		type: 'object',
		definitions: {
			row: { type: 'object', properties: { id: { type: 'integer' } }, required: ['id'] },
		},
		properties: { row: { $ref: '#/definitions/row' } },
		required: ['row'],
		additionalProperties: false,
	};
	const original = JSON.stringify(schema);
	assert.deepEqual(await prepare({ name: 'json', schema }), schema);
	assert.equal(JSON.stringify(schema), original);
	assert.deepEqual(await prepare({ name: 'json', parameters: JSON.stringify(schema) }), schema);
});

test('the executable schema takes precedence over stale parameters metadata', async () => {
	const tool = structured(z3.object({ URL: z3.string() }));
	tool.parameters = { properties: { input: { type: 'string' } }, required: ['input'] };
	assert.deepEqual((await prepare(tool)).required, ['URL']);
});

test('invalid or unsupported explicit schemas fail instead of advertising a made-up field', async () => {
	for (const schema of [z3.array(z3.string()), z4.number(), {}, '{broken', false]) {
		await assert.rejects(prepare({ name: 'broken-schema', schema }), /schema.*broken-schema/);
	}
});

test('malformed arguments cannot trigger a tool with empty or coerced arguments', async () => {
	let calls = 0;
	const tool = structured(z3.object({ URL: z3.string() }), async () => {
		calls++;
	});
	for (const input of ['{broken', 'null', '[]', '42', 'false', '"hello"', null, false, []]) {
		await assert.rejects(execute(tool, input), /Invalid JSON|expects an object/);
	}
	await assert.rejects(execute(tool, { input: 'wrong field' }), /schema/);
	assert.equal(calls, 0);
});

test('support invoke/call/execute/func without assuming call means string', async () => {
	for (const method of ['invoke', 'call', 'execute', 'func']) {
		const tool = { name: method, [method]: async (args) => args };
		assert.deepEqual(await execute(tool, { input: 'hello' }), { input: 'hello' });
	}
	const tool = {
		name: 'modern',
		invoke: async () => 'invoke',
		call: async () => {
			throw new Error('deprecated call');
		},
	};
	assert.equal(await execute(tool, {}), 'invoke');
	await assert.rejects(execute({ name: 'missing' }, {}), /no supported execution method/);
});

test('legacy DynamicTool without a schema still receives a string', async () => {
	class DynamicTool {
		name = 'legacy';
		async call(input) {
			return input;
		}
	}
	const tool = new DynamicTool();
	assert.equal((await prepare(tool)).properties.input.type, 'string');
	assert.equal(await execute(tool, { input: 'query' }), 'query');
});

test('a node with no connected tools has no invented functions', async () => {
	assert.deepEqual(await prepareGigaTools({ getInputConnectionData: async () => undefined }), {
		tools: [],
		functions: [],
	});
});

test('chat node sends real schemas, executes structured and string tools, and returns their results', async () => {
	const { gigaChatWithModel } = require('../dist/nodes/shared/methods/ChatWithModel');
	const { GigaChatApiClient } = require('../dist/nodes/shared/GigaChatApiClient');
	const originalConfig = GigaChatApiClient.updateConfig;
	const originalChat = GigaChatApiClient.chatWithSession;
	const requests = [];
	const received = [];
	const structuredTool = structured(
		z4.object({ URL: z4.string(), rows: z4.array(z4.object({ id: z4.number() })) }),
		async (args) => {
			received.push(args);
			return { count: args.rows.length };
		},
	);
	const calculator = new DynamicTool({
		name: 'calculator',
		description: 'Calculator',
		func: async (input) => {
			received.push(input);
			return '4';
		},
	});
	const args = { URL: 'https://example.test', rows: [{ id: 7 }] };
	const messages = [
		{ role: 'assistant', content: '', function_call: { name: 'structured', arguments: args } },
		{
			role: 'assistant',
			content: '',
			function_call: { name: 'calculator', arguments: { input: '2+2' } },
		},
		{ role: 'assistant', content: 'Done' },
	];
	GigaChatApiClient.updateConfig = async () => {};
	GigaChatApiClient.chatWithSession = async (request) => {
		requests.push(JSON.parse(JSON.stringify(request)));
		return { choices: [{ message: messages[requests.length - 1] }] };
	};
	try {
		const parameters = {
			modelId: 'GigaChat',
			prompt: 'Use both tools',
			options: {},
			simplifyOutput: true,
			removeMarkdown: false,
		};
		const result = await gigaChatWithModel.call({
			getCredentials: async () => ({ authorizationKey: 'test', scope: 'GIGACHAT_API_PERS' }),
			getInputData: () => [{ json: { sessionId: 'test-session' } }],
			getNodeParameter: (name) => parameters[name],
			getInputConnectionData: async (type) =>
				type === 'ai_tool' ? [structuredTool, calculator] : undefined,
			helpers: {
				returnJsonArray: (json) => [{ json }],
				constructExecutionMetaData: (items) => items,
			},
		});
		assert.deepEqual(received, [args, '2+2']);
		assert.equal(
			requests[0].functions[0].parameters.properties.rows.items.properties.id.type,
			'number',
		);
		const results = requests[2].messages.filter((message) => message.role === 'function');
		assert.deepEqual(
			results.map((message) => JSON.parse(message.content)),
			[
				{ status: 'success', result: { count: 1 } },
				{ status: 'success', result: 4 },
			],
		);
		assert.deepEqual(result, [[{ json: { response: 'Done' } }]]);
	} finally {
		GigaChatApiClient.updateConfig = originalConfig;
		GigaChatApiClient.chatWithSession = originalChat;
	}
});
