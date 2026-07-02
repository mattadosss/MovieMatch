import type { User } from '@supabase/supabase-js';
import { loadStreamingPreferences, saveStreamingPreferences } from '@/lib/storage';
import { supabase } from '@/src/lib/supabase';
import type { StreamingPreferences } from '@/types/movie';

export async function syncStreamingPreferences(user: User): Promise<StreamingPreferences> {
  const local = await loadStreamingPreferences();
  const { data, error } = await supabase
    .from('user_streaming_preferences')
    .select('provider_ids, updated_at')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) throw error;

  const remote = data as StreamingPreferences | null;
  const localIsNewer = !remote
    || Date.parse(local.updated_at) > Date.parse(remote.updated_at);
  const winner = localIsNewer ? local : remote;

  if (localIsNewer) {
    const { error: upsertError } = await supabase
      .from('user_streaming_preferences')
      .upsert({
        user_id: user.id,
        provider_ids: local.provider_ids,
        updated_at: local.updated_at,
      });
    if (upsertError) throw upsertError;
  }

  await saveStreamingPreferences(winner);
  return winner;
}
