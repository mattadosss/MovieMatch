import { withSupabase } from 'npm:@supabase/server@^1';
import {
  functionError,
  positiveInteger,
  readJson,
  RequestError,
  stringValue,
  tmdbRequest,
} from '../_shared/tmdb.ts';

const discoverParams = new Set([
  'with_genres',
  'vote_average.gte',
  'vote_count.gte',
  'sort_by',
  'watch_region',
  'with_watch_providers',
  'with_watch_monetization_types',
]);

function mediaType(body: Record<string, unknown>) {
  const value = stringValue(body, 'mediaType') ?? 'movie';
  if (!['movie', 'tv'].includes(value)) {
    throw new RequestError('Parameter "mediaType" muss "movie" oder "tv" sein.');
  }
  return value;
}

export default {
  fetch: withSupabase({ auth: ['user', 'publishable'] }, async (req) => {
    try {
      const body = await readJson(req);
      const operation = stringValue(body, 'operation', true)!;

      if (operation === 'genres') {
        return Response.json(await tmdbRequest(`/genre/${mediaType(body)}/list`));
      }
      if (operation === 'details') {
        return Response.json(await tmdbRequest(`/${mediaType(body)}/${positiveInteger(body, 'id')}`));
      }
      if (operation === 'watch-providers') {
        return Response.json(await tmdbRequest(
          `/${mediaType(body)}/${positiveInteger(body, 'id')}/watch/providers`,
        ));
      }
      if (operation === 'watch-provider-list') {
        const region = stringValue(body, 'region') ?? 'CH';
        if (!/^[A-Z]{2}$/.test(region)) throw new RequestError('Ungültige Anbieterregion.');
        return Response.json(await tmdbRequest('/watch/providers/movie', {
          watch_region: region,
        }));
      }
      if (operation === 'recommendations' || operation === 'similar') {
        return Response.json(await tmdbRequest(
          `/movie/${positiveInteger(body, 'id')}/${operation}`,
        ));
      }
      if (operation === 'discover') {
        const rawParams = body.params;
        if (!rawParams || typeof rawParams !== 'object' || Array.isArray(rawParams)) {
          throw new RequestError('Parameter "params" fehlt.');
        }
        const params = Object.fromEntries(
          Object.entries(rawParams)
            .filter(([key, value]) => discoverParams.has(key) && typeof value === 'string'),
        ) as Record<string, string>;
        return Response.json(await tmdbRequest('/discover/movie', params));
      }

      throw new RequestError('Unbekannte movie-details Operation.');
    } catch (error) {
      return functionError(error);
    }
  }),
};
