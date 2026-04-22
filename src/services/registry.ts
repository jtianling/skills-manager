import { execFileSync } from 'child_process';
import { createWriteStream, mkdirSync, mkdtempSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import { REGISTRY_URL } from '../constants.js';
import type {
  CollectionResolveRequest,
  CollectionResolveResponse,
  Packument,
  PublishPayload,
  SearchResult,
} from '../types.js';
import { removeDir } from '../utils/fs.js';

const FETCH_TIMEOUT_MS = 30_000;

function withTimeout(init?: RequestInit): RequestInit {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  timer.unref();
  return { ...init, signal: controller.signal };
}

export class RegistryService {
  private baseUrl: string;

  constructor(baseUrl: string = REGISTRY_URL) {
    this.baseUrl = baseUrl;
  }

  async getPackument(name: string): Promise<Packument> {
    const encodedName = name.startsWith('@') ? `@${encodeURIComponent(name.slice(1))}` : encodeURIComponent(name);
    const url = `${this.baseUrl}/api/r/${encodedName}`;
    const response = await fetch(url, withTimeout({
      headers: { 'Accept': 'application/json' },
    }));

    if (response.status === 404) {
      throw new Error(`Package "${name}" not found in registry`);
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch package "${name}": ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<Packument>;
  }

  async downloadTarball(url: string, destDir: string): Promise<void> {
    // Workaround: the registry's packument returns tarball URLs pointing to the
    // internal Vercel deployment hostname (skillsmgr-web.vercel.app) which may be
    // behind SSO protection. Rewrite to the public domain so downloads work.
    // This can be removed once the registry sets CANONICAL_URL to the public domain.
    const normalizedUrl = url.replace('https://skillsmgr-web.vercel.app/', `${this.baseUrl}/`);
    const response = await fetch(normalizedUrl, withTimeout());

    if (!response.ok) {
      throw new Error(`Failed to download tarball: ${response.status} ${response.statusText}`);
    }

    const tempDir = mkdtempSync(join(tmpdir(), 'skillsmgr-tarball-'));
    const tarballPath = join(tempDir, 'package.tgz');

    try {
      const body = response.body;
      if (!body) {
        throw new Error('Empty response body');
      }

      const nodeStream = Readable.fromWeb(body as import('stream/web').ReadableStream);
      const fileStream = createWriteStream(tarballPath);
      await pipeline(nodeStream, fileStream);

      mkdirSync(destDir, { recursive: true });
      execFileSync('tar', ['xzf', tarballPath, '-C', destDir, '--strip-components=1']);
    } finally {
      removeDir(tempDir);
    }
  }

  async search(query: string, options?: { from?: number; size?: number }): Promise<SearchResult> {
    const params = new URLSearchParams();
    if (query) params.set('text', query);
    if (options?.from !== undefined) params.set('from', String(options.from));
    if (options?.size !== undefined) params.set('size', String(options.size));

    const url = `${this.baseUrl}/-/v1/search?${params.toString()}`;
    const response = await fetch(url, withTimeout({
      headers: { 'Accept': 'application/json' },
    }));

    if (!response.ok) {
      throw new Error(`Search failed: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<SearchResult>;
  }

  async publish(name: string, payload: PublishPayload, token: string): Promise<{ ok: boolean }> {
    const encodedName = name.startsWith('@') ? `@${encodeURIComponent(name.slice(1))}` : encodeURIComponent(name);
    const url = `${this.baseUrl}/api/r/${encodedName}`;

    const response = await fetch(url, withTimeout({
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    }));

    if (response.status === 401) {
      throw new Error('Authentication failed. Run "skillsmgr login" to re-authenticate.');
    }

    if (response.status === 409) {
      throw new Error(`Version ${payload.version} already exists. Bump version in skill.json and try again.`);
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Publish failed: ${response.status} ${text}`);
    }

    return response.json() as Promise<{ ok: boolean }>;
  }

  async whoami(token: string): Promise<{ username: string }> {
    const url = `${this.baseUrl}/-/whoami`;
    const response = await fetch(url, withTimeout({
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }));

    if (response.status === 401) {
      throw new Error('Token expired or invalid');
    }

    if (!response.ok) {
      throw new Error(`whoami failed: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<{ username: string }>;
  }

  async resolveCollection(
    body: CollectionResolveRequest,
    token?: string | null,
  ): Promise<CollectionResolveResponse> {
    const url = `${this.baseUrl}/api/collections/resolve`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, withTimeout({
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    }));

    if (response.status === 400) {
      const text = await response.text();
      throw new Error(`Invalid collection request: ${text}`);
    }

    if (!response.ok) {
      throw new Error(
        `Failed to resolve collection: ${response.status} ${response.statusText}`,
      );
    }

    return response.json() as Promise<CollectionResolveResponse>;
  }

  async npmLogin(username: string, password: string): Promise<{ ok: boolean; token: string }> {
    const url = `${this.baseUrl}/-/user/org.couchdb.user:${encodeURIComponent(username)}`;
    const response = await fetch(url, withTimeout({
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: username,
        password,
        type: 'user',
      }),
    }));

    if (response.status === 401) {
      throw new Error('Invalid username or password');
    }

    if (!response.ok) {
      throw new Error(`Login failed: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<{ ok: boolean; token: string }>;
  }
}
