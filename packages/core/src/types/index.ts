// Shared contracts for the tech-docs platform (LOCAL-U1, Wave 1).
// Wave-2 units (U2-U4) consume but must not modify this file.

export type EngineDialect = 'mdx' | 'docusaurus' | 'starlight';

export interface CanonicalDocInput {
  filePath: string;
  rawContent: string;
  frontmatter?: Record<string, unknown>;
}

export interface DialectCompileResult {
  target: EngineDialect;
  compiledContent: string;
  exportedFrontmatter: Record<string, unknown>;
  synthesizedImports: string[];
  diagnostics: Array<{ level: 'info' | 'warn' | 'error'; message: string; line?: number }>;
}

export interface DialectCompiler {
  normalizeToCanonical(rawMarkdown: string, sourceHint?: EngineDialect): CanonicalDocInput;
  compileCanonicalMarkdown(input: CanonicalDocInput, target: EngineDialect): DialectCompileResult;
}

export type SupportedLang = 'typescript' | 'javascript' | 'python' | 'go';

export interface SymbolRecord {
  symbolName: string;
  symbolKind: 'function' | 'class' | 'method' | 'interface' | 'type' | 'variable';
  sourceFile: string;
  sourceRepo?: string;
  startLine: number;
  endLine: number;
  signatureText: string;
  signatureHash: string;
  bodyHash: string;
  snippetContent: string;
}

export type SymbolTable = Map<string, SymbolRecord>;

export interface DocSyncLockManifest {
  version: 1;
  updatedAt: string;
  trackedReferences: Array<{
    docPath: string;
    sourceRepo?: string;
    sourceFile: string;
    symbolName?: string;
    regionName?: string;
    signatureHash: string;
    bodyHash: string;
    lastVerifiedAt: string;
  }>;
}

export interface ProseDriftRecommendation {
  docPath: string;
  symbolName: string;
  suggestedEditDiff: string;
  explanation: string;
}

export interface SyncReport {
  status: 'clean' | 'drift_detected' | 'broken_references';
  verifiedCount: number;
  brokenReferences: Array<{ docPath: string; reference: string; reason: string }>;
  proseDriftRecommendations: ProseDriftRecommendation[];
}

export interface DocSyncEngine {
  indexRepositorySymbols(rootDir: string, langs?: SupportedLang[]): Promise<SymbolTable>;
  bindDocReferences(
    docPath: string,
    docContent: string,
    symbols: SymbolTable,
  ): { boundDoc: string; trackedManifest: DocSyncLockManifest };
  verifyAndSyncDocs(options: {
    rootDir: string;
    docRootDir: string;
    manifestPath: string;
    autoWriteSnippets?: boolean;
    diffBaseSha?: string;
    diffHeadSha?: string;
    gateway?: RewriteModelGateway;
    docStyle?: StylePresetConfig;
  }): Promise<SyncReport>;
}

export interface StylePresetConfig {
  id: 'diataxis-howto' | 'diataxis-reference' | 'architecture-deep-dive' | 'stripe-developer-guide' | 'chisle-terse';
  label: string;
  systemPromptModifiers: string;
  structuralRules: string[];
  userGuidance?: string;
}

export interface RewriteModelGateway {
  generateRewrite(options: {
    filePath: string;
    sourceContent: string;
    preset: StylePresetConfig;
    docGraphSummary: string;
    styleExemplar?: string;
    repairErrorContext?: string;
  }): Promise<{ rewrittenContent: string }>;
  evaluateProseDrift(options: {
    docPath: string;
    docContent: string;
    symbolName: string;
    previousSignature: string;
    currentSignature: string;
    codeDiffPatch: string;
    docStyle?: StylePresetConfig;
  }): Promise<ProseDriftRecommendation | null>;
}

export interface SampleRewriteRequest {
  filePaths: string[];
  sourceDocs: Map<string, string>;
  stylePresets: StylePresetConfig[];
  repoContextSummary: string;
}

export interface SampleCandidateResult {
  filePath: string;
  presetId: string;
  rewrittenContent: string;
  canonicalAstValid: boolean;
  mdxValid: boolean;
  validationErrors: string[];
}

export interface BatchRewriteRequest {
  projectRootDir: string;
  docFilePaths: string[];
  selectedPreset: StylePresetConfig;
  styleExemplar?: string;
  maxConcurrency?: number; // default 5
}

export interface BatchRewriteReport {
  totalFiles: number;
  completedFiles: string[];
  repairedFiles: string[];
  failedFiles: Array<{ filePath: string; error: string }>;
  rewrittenContents: Map<string, string>;
  durationMs: number;
}

export interface JobProgressSink {
  onFileStarted(filePath: string): Promise<void>;
  onFileCompleted(filePath: string, result: { rewrittenContent: string }): Promise<void>;
  onFileFailed(filePath: string, error: string): Promise<void>;
}

export interface RewriteOrchestrator {
  runSampleRewrite(req: SampleRewriteRequest, gateway: RewriteModelGateway): Promise<SampleCandidateResult[]>;
  runBatchRewrite(req: BatchRewriteRequest, gateway: RewriteModelGateway, sink: JobProgressSink): Promise<BatchRewriteReport>;
}

export interface RepoSpec {
  projectId: string;
  docsRepoUrl: string;
  docsRepoBranch?: string;
  codeRepoUrl?: string; // Optional for split repo layout
  codeRepoBranch?: string;
}

export interface LocalRepoHandle {
  projectId: string;
  docsLocalPath: string;
  codeLocalPath?: string;
  gitLockPath: string;
}

export interface CreatePrRequest {
  repoHandle: LocalRepoHandle;
  branchName: string;
  commitMessage: string;
  prTitle: string;
  prBody: string;
  includeEngineScaffolding?: boolean;
  engineToScaffold?: EngineDialect;
}

export interface GitHubGateway {
  resolveAuthToken(): Promise<string>;
  createPullRequest(options: {
    owner: string;
    repo: string;
    title: string;
    head: string;
    base: string;
    body: string;
  }): Promise<{ prNumber: number; prUrl: string }>;
  postReviewComment(options: {
    owner: string;
    repo: string;
    pullNumber: number;
    commitId: string;
    path: string;
    line: number;
    body: string;
  }): Promise<void>;
}

export interface GitWorkspaceManager {
  ensureRepoCheckout(spec: RepoSpec): Promise<LocalRepoHandle>;
  acquireRepoLock<T>(repoHandle: LocalRepoHandle, task: () => Promise<T>): Promise<T>;
  createRewritePullRequest(req: CreatePrRequest, gh: GitHubGateway): Promise<{ prNumber: number; prUrl: string }>;
}

export interface RunnerStatus {
  engine: EngineDialect;
  status: 'stopped' | 'starting' | 'healthy' | 'unhealthy' | 'crashed';
  port: number;
  previewUrl: string;
  pid?: number;
  lastHealthCheckAt?: string;
}

export interface RenderedFileMap {
  [filePath: string]: string; // Dialect-compiled content keyed by canonical relative path
}

export interface PreviewRunnerManager {
  getRunnerStatus(engine: EngineDialect): Promise<RunnerStatus>;
  ensureRunnerStarted(engine: EngineDialect): Promise<RunnerStatus>;
  resolvePreviewUrl(engine: EngineDialect, canonicalFilePath: string): Promise<string>;
  syncPreviewContent(engine: EngineDialect, files: RenderedFileMap): Promise<{ syncedCount: number; timestamp: number }>;
  shutdownAllRunners(): Promise<void>;
}

function errorClass(name: string) {
  return class extends Error {
    constructor(message?: string) {
      super(message);
      this.name = name;
    }
  };
}

export const DialectParseError = errorClass('DialectParseError');
export const UnsupportedDirectiveError = errorClass('UnsupportedDirectiveError');
export const FrontmatterValidationError = errorClass('FrontmatterValidationError');
export const WasmGrammarLoadError = errorClass('WasmGrammarLoadError');
export const GrammarParseTimeoutError = errorClass('GrammarParseTimeoutError');
export const CorruptLockfileError = errorClass('CorruptLockfileError');
export const MissingCodeReferenceError = errorClass('MissingCodeReferenceError');
export const ModelRateLimitError = errorClass('ModelRateLimitError');
export const MaxRetriesExceededError = errorClass('MaxRetriesExceededError');
export const MdxCompileValidationError = errorClass('MdxCompileValidationError');
export const BrokenLinkValidationError = errorClass('BrokenLinkValidationError');
export const GitAuthError = errorClass('GitAuthError');
export const GitCloneError = errorClass('GitCloneError');
export const GitLockTimeoutError = errorClass('GitLockTimeoutError');
export const GitHubApiRateLimitError = errorClass('GitHubApiRateLimitError');
export const RunnerStartTimeoutError = errorClass('RunnerStartTimeoutError');
export const RunnerPortConflictError = errorClass('RunnerPortConflictError');
export const ContentSyncFilesystemError = errorClass('ContentSyncFilesystemError');
