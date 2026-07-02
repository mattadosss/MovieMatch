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
      const mediaType = stringValue(body, 'mediaType') ?? 'movie';
      const timeWindow = stringValue(body, 'timeWindow') ?? 'week';

      if (!['all', 'movie', 'tv'].includes(mediaType)) {
        throw new RequestError('Parameter "mediaType" muss "all", "movie" oder "tv" sein.');
      }
      if (!['day', 'week'].includes(timeWindow)) {
        throw new RequestError('Parameter "timeWindow" muss "day" oder "week" sein.');
      }

      return Response.json(await tmdbRequest(`/trending/${mediaType}/${timeWindow}`));
    } catch (error) {
      return functionError(error);
    }
  }),
};
