export interface CancellationTokenLike {
	readonly isCancellationRequested: boolean;
}

export interface WorkspaceFileAccess<TUri, TToken extends CancellationTokenLike> {
	findSlangFiles(maxResults: number, token?: TToken): PromiseLike<readonly TUri[]>;
	readFile(uri: TUri): PromiseLike<Uint8Array>;
	uriKey(uri: TUri): string;
	uriLabel(uri: TUri): string;
}

export interface WorkspaceFilePreloadLimits {
	maxFiles: number;
	maxBytes: number;
}

export interface WorkspaceFilePreloadResult {
	files: { uri: string, content: string }[];
	totalBytes: number;
	readErrors: { uri: string, error: unknown }[];
}

export type WorkspaceFilePreloadLimitKind = 'fileCount' | 'totalBytes';

export class WorkspaceFilePreloadLimitError extends Error {
	constructor(
		readonly kind: WorkspaceFilePreloadLimitKind,
		readonly limit: number,
		readonly observed: number,
	) {
		super(kind === 'fileCount'
			? `The workspace contains more than ${limit} Slang files.`
			: `The Slang workspace files exceed the ${limit}-byte preload limit.`);
		this.name = 'WorkspaceFilePreloadLimitError';
	}
}

export class WorkspaceFilePreloadCancelledError extends Error {
	constructor() {
		super('Loading Slang workspace files was cancelled.');
		this.name = 'WorkspaceFilePreloadCancelledError';
	}
}

function throwIfCancelled(token?: CancellationTokenLike): void {
	if (token?.isCancellationRequested) {
		throw new WorkspaceFilePreloadCancelledError();
	}
}

export async function preloadWorkspaceSlangFiles<TUri, TToken extends CancellationTokenLike>(
	access: WorkspaceFileAccess<TUri, TToken>,
	openDocumentContents: ReadonlyMap<string, string>,
	limits: WorkspaceFilePreloadLimits,
	token?: TToken,
): Promise<WorkspaceFilePreloadResult> {
	const maxFiles = Math.max(1, Math.floor(limits.maxFiles));
	const maxBytes = Math.max(1, Math.floor(limits.maxBytes));
	const uris = await access.findSlangFiles(maxFiles + 1, token);

	throwIfCancelled(token);
	if (uris.length > maxFiles) {
		throw new WorkspaceFilePreloadLimitError('fileCount', maxFiles, uris.length);
	}

	const decoder = new TextDecoder();
	const encoder = new TextEncoder();
	const files: { uri: string, content: string }[] = [];
	const readErrors: { uri: string, error: unknown }[] = [];
	let totalBytes = 0;

	for (const uri of uris) {
		throwIfCancelled(token);
		const key = access.uriKey(uri);
		try {
			const openContent = openDocumentContents.get(key);
			const bytes = openContent === undefined ? await access.readFile(uri) : encoder.encode(openContent);
			throwIfCancelled(token);
			const nextTotalBytes = totalBytes + bytes.byteLength;
			if (nextTotalBytes > maxBytes) {
				throw new WorkspaceFilePreloadLimitError('totalBytes', maxBytes, nextTotalBytes);
			}
			const content = openContent ?? decoder.decode(bytes);
			totalBytes = nextTotalBytes;
			files.push({ uri: key, content });
		} catch (error) {
			if (error instanceof WorkspaceFilePreloadLimitError) {
				throw error;
			}
			readErrors.push({ uri: access.uriLabel(uri), error });
		}
	}

	return { files, totalBytes, readErrors };
}
