import { describe, it, expect, vi, afterEach } from 'vitest';
import { assertTransportAllowed, guardedFetch, readBodyBuffer } from './fetch-guard.js';

function redirectResponse(location: string): Response {
  return new Response(null, { status: 302, headers: { location } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('assertTransportAllowed', () => {
  it('rejects non-loopback http URLs', () => {
    expect(() => assertTransportAllowed('http://example.com')).toThrow(/https/i);
    expect(() => assertTransportAllowed('http://192.168.1.10:8080/x')).toThrow(/https/i);
  });

  it('allows loopback http URLs', () => {
    expect(() => assertTransportAllowed('http://localhost:8787')).not.toThrow();
    expect(() => assertTransportAllowed('http://127.0.0.1:8787')).not.toThrow();
    expect(() => assertTransportAllowed('http://[::1]:8787')).not.toThrow();
  });

  it('allows https everywhere and rejects other schemes', () => {
    expect(() => assertTransportAllowed('https://example.com')).not.toThrow();
    expect(() => assertTransportAllowed('ftp://example.com/x')).toThrow(/https/i);
  });
});

describe('guardedFetch', () => {
  it('does not issue a request for a rejected URL', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(guardedFetch('http://example.com/index.json')).rejects.toThrow(/https/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a redirect that leaves the original host without reading the body', async () => {
    const bodyRead = vi.fn();
    const crossHost = redirectResponse('https://evil.example.net/a');
    Object.defineProperty(crossHost, 'text', { value: bodyRead });
    const fetchMock = vi.fn(async () => crossHost);
    vi.stubGlobal('fetch', fetchMock);

    await expect(guardedFetch('https://example.com/index.json')).rejects.toThrow(/host/i);
    expect(bodyRead).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('follows a same-host redirect', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(redirectResponse('https://example.com/final.json'))
      .mockResolvedValueOnce(new Response('{"ok":true}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await guardedFetch('https://example.com/index.json');

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('{"ok":true}');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('aborts after too many redirects', async () => {
    const fetchMock = vi.fn(async () => redirectResponse('https://example.com/next'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(guardedFetch('https://example.com/index.json')).rejects.toThrow(/redirect/i);
  });
});

describe('readBodyBuffer', () => {
  it('returns the full body under the cap', async () => {
    const buffer = await readBodyBuffer(new Response('hello'), 1024);

    expect(buffer.toString()).toBe('hello');
  });

  it('rejects a body over the cap', async () => {
    await expect(readBodyBuffer(new Response('hello world'), 4)).rejects.toThrow(/limit/i);
  });
});
