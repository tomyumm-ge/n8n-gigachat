import { configWithoutCloudSupport } from '@n8n/node-cli/eslint';

const n8nConventionRules = Object.fromEntries(
	configWithoutCloudSupport
		.flatMap((entry) => Object.keys(entry.rules ?? {}))
		.filter(
			(rule) =>
				rule.startsWith('@n8n/community-nodes/') || rule.startsWith('n8n-nodes-base/'),
		)
		.map((rule) => [rule, 'off']),
);

export default [
	...configWithoutCloudSupport,
	{
		files: ['**/*.ts', 'package.json'],
		linterOptions: {
			reportUnusedDisableDirectives: 'off',
		},
		rules: {
			...n8nConventionRules,
			// Preserve the project's existing TypeScript and runtime-boundary conventions.
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-unused-vars': 'off',
			'import-x/no-duplicates': 'off',
			'no-console': 'off',
			'no-empty': 'off',
		},
	},
];
