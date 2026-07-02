import { withSupabase } from 'npm:@supabase/server@^1';
import {
  functionError,
  readJson,
  RequestError,
  stringValue,
  tmdbRequest,
} from '../_shared/tmdb.ts';

export default {
  fetch: withSupabase({ auth: ['user', 'publishable'] }, async (req) => {
    try {
      const body = await readJson(req);
      const query = stringValue(body, 'query', true)!;
      const mediaType = stringValue(body, 'mediaType') ?? 'movie';

      if (!['movie', 'tv'].includes(mediaType)) {
        throw new RequestError('Parameter "mediaType" muss "movie" oder "tv" sein.');
      }
      if (query.length > 200) throw new RequestError('Die Suchanfrage ist zu lang.');

      return Response.json(await tmdbRequest(`/search/${mediaType}`, {
        query,
        include_adult: 'false',
      }));
    } catch (error) {
      return functionError(error);
    }
  }),
};
