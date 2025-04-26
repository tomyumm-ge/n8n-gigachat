import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tsParser from '@typescript-eslint/parser';
import n8nNodesBase from 'eslint-plugin-n8n-nodes-base';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import js from '@eslint/js';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
	baseDirectory: __dirname,
	recommendedConfig: js.configs.recommended,
	allConfig: js.configs.all,
});

export default defineConfig([
	globalIgnores(['**/.eslintrc.js', '**/*.js', '**/node_modules/**/*', '**/dist/**/*']),
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node,
			},

			parser: tsParser,
			ecmaVersion: 5,
			sourceType: 'module',

			parserOptions: {
				project: ['./tsconfig.json'],
				extraFileExtensions: ['.json'],
			},
		},
	},
	{
		files: ['**/package.json'],
		extends: compat.extends('plugin:n8n-nodes-base/community'),

		plugins: {
			'n8n-nodes-base': n8nNodesBase,
		},

		rules: {
			'n8n-nodes-base/community-package-json-name-still-default': 'off',
		},
	},
	{
		files: ['./credentials/**/*.ts'],
		extends: compat.extends('plugin:n8n-nodes-base/credentials'),

		plugins: {
			'n8n-nodes-base': n8nNodesBase,
		},

		rules: {
			'n8n-nodes-base/cred-class-field-documentation-url-missing': 'off',
			'n8n-nodes-base/cred-class-field-documentation-url-miscased': 'off',
		},
	},
	{
		files: ['./nodes/**/*.ts'],
		extends: compat.extends('plugin:n8n-nodes-base/nodes'),

		plugins: {
			'n8n-nodes-base': n8nNodesBase,
		},

		rules: {
			'n8n-nodes-base/node-execute-block-missing-continue-on-fail': 'off',
			'n8n-nodes-base/node-resource-description-filename-against-convention': 'off',
			'n8n-nodes-base/node-param-fixed-collection-type-unsorted-items': 'off',
		},
	},
]);
