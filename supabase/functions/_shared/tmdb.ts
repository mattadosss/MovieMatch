const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

export class RequestError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    return await req.json();
  } catch {
    throw new RequestError('Der Request-Body muss gültiges JSON enthalten.');
  }
}

export async function tmdbRequest(
  path: string,
  params: Record<string, string> = {},
) {
  const token = Deno.env.get('TMDB_ACCESS_TOKEN');
  if (!token) {
    throw new RequestError(
      'TMDB_ACCESS_TOKEN ist in den Supabase Edge Function Secrets nicht konfiguriert.',
      500,
    );
  }

  const query = new URLSearchParams({ language: 'de-DE', ...params });
  const response = await fetch(`${TMDB_BASE_URL}${path}?${query}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const details = await response.text();
    console.error(`TMDb ${response.status} for ${path}: ${details.slice(0, 500)}`);
    if (response.status === 401) {
      throw new RequestError(
        'TMDB_ACCESS_TOKEN ist ungültig. Verwende den vollständigen API Read Access Token ohne "Bearer "-Präfix.',
        502,
      );
    }
    throw new RequestError(
      `TMDb-Anfrage fehlgeschlagen (${response.status}).`,
      response.status >= 500 ? 502 : response.status,
    );
  }

  return response.json();
}

export function functionError(error: unknown) {
  if (error instanceof RequestError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error(error);
  return Response.json({ error: 'Unerwarteter Fehler in der Edge Function.' }, { status: 500 });
}

export function stringValue(
  body: Record<string, unknown>,
  key: string,
  required = false,
) {
  const value = body[key];
  if (required && (typeof value !== 'string' || !value.trim())) {
    throw new RequestError(`Parameter "${key}" fehlt.`);
  }
  return typeof value === 'string' ? value.trim() : undefined;
}

export function positiveInteger(body: Record<string, unknown>, key: string) {
  const value = body[key];
  if (!Number.isInteger(value) || Number(value) <= 0) {
    throw new RequestError(`Parameter "${key}" muss eine positive Ganzzahl sein.`);
  }
  return Number(value);
}
