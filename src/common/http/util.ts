export function normalizeValidUrl(url: string): string {
	if (!url.endsWith('/')) return url + '/';
	return url;
}
