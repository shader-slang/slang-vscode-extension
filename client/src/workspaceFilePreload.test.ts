import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
	preloadWorkspaceSlangFiles,
	WorkspaceFilePreloadCancelledError,
	WorkspaceFilePreloadLimitError,
} from './workspaceFilePreload';

type TestUri = { path: string };
type TestToken = { isCancellationRequested: boolean };

function createAccess(
	paths: string[],
	contents: ReadonlyMap<string, string>,
	readPaths: string[],
	observedMaxResults: number[],
) {
	return {
		findSlangFiles: async (maxResults: number, _token?: TestToken) => {
			observedMaxResults.push(maxResults);
			return paths.slice(0, maxResults).map(path => ({ path }));
		},
		readFile: async (uri: TestUri) => {
			readPaths.push(uri.path);
			const content = contents.get(uri.path);
			if (content === undefined) {
				throw new Error(`Missing test file: ${uri.path}`);
			}
			return new TextEncoder().encode(content);
		},
		uriKey: (uri: TestUri) => `file://${uri.path}`,
		uriLabel: (uri: TestUri) => uri.path,
	};
}

test('loads workspace files without opening text documents and preserves open-document contents', async () => {
	const readPaths: string[] = [];
	const observedMaxResults: number[] = [];
	const access = createAccess(
		['/workspace/main.slang', '/workspace/module.slang'],
		new Map([
			['/workspace/main.slang', 'disk main'],
			['/workspace/module.slang', 'module'],
		]),
		readPaths,
		observedMaxResults,
	);

	const result = await preloadWorkspaceSlangFiles(
		access,
		new Map([['file:///workspace/main.slang', 'unsaved main']]),
		{ maxFiles: 10, maxBytes: 1024 },
	);

	assert.deepEqual(observedMaxResults, [11]);
	assert.deepEqual(readPaths, ['/workspace/module.slang']);
	assert.deepEqual(result.files, [
		{ uri: 'file:///workspace/main.slang', content: 'unsaved main' },
		{ uri: 'file:///workspace/module.slang', content: 'module' },
	]);
	assert.equal(result.totalBytes, 18);
	assert.deepEqual(result.readErrors, []);
});

test('rejects an oversized file set before reading file contents', async () => {
	const readPaths: string[] = [];
	const observedMaxResults: number[] = [];
	const access = createAccess(
		['/1.slang', '/2.slang', '/3.slang'],
		new Map(),
		readPaths,
		observedMaxResults,
	);

	await assert.rejects(
		preloadWorkspaceSlangFiles(access, new Map(), { maxFiles: 2, maxBytes: 1024 }),
		(error: unknown) => error instanceof WorkspaceFilePreloadLimitError
			&& error.kind === 'fileCount'
			&& error.limit === 2,
	);
	assert.deepEqual(observedMaxResults, [3]);
	assert.deepEqual(readPaths, []);
});

test('rejects when aggregate source bytes exceed the configured limit', async () => {
	const access = createAccess(
		['/1.slang', '/2.slang'],
		new Map([
			['/1.slang', '1234'],
			['/2.slang', '5678'],
		]),
		[],
		[],
	);

	await assert.rejects(
		preloadWorkspaceSlangFiles(access, new Map(), { maxFiles: 10, maxBytes: 7 }),
		(error: unknown) => error instanceof WorkspaceFilePreloadLimitError
			&& error.kind === 'totalBytes'
			&& error.observed === 8,
	);
});

test('reports unreadable files and continues loading other modules', async () => {
	const access = createAccess(
		['/missing.slang', '/module.slang'],
		new Map([['/module.slang', 'module']]),
		[],
		[],
	);

	const result = await preloadWorkspaceSlangFiles(
		access,
		new Map(),
		{ maxFiles: 10, maxBytes: 1024 },
	);

	assert.deepEqual(result.files, [{ uri: 'file:///module.slang', content: 'module' }]);
	assert.equal(result.readErrors.length, 1);
	assert.equal(result.readErrors[0].uri, '/missing.slang');
});

test('honors cancellation after workspace discovery', async () => {
	const token = { isCancellationRequested: false };
	const access = {
		findSlangFiles: async (_maxResults: number, receivedToken?: TestToken) => {
			assert.equal(receivedToken, token);
			token.isCancellationRequested = true;
			return [{ path: '/module.slang' }];
		},
		readFile: async (_uri: TestUri) => new TextEncoder().encode('module'),
		uriKey: (uri: TestUri) => `file://${uri.path}`,
		uriLabel: (uri: TestUri) => uri.path,
	};

	await assert.rejects(
		preloadWorkspaceSlangFiles(access, new Map(), { maxFiles: 10, maxBytes: 1024 }, token),
		WorkspaceFilePreloadCancelledError,
	);
});
