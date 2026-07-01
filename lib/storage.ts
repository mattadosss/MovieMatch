import AsyncStorage from '@react-native-async-storage/async-storage';
import { WatchHistoryEntry } from '@/types/movie';

const HISTORY_KEY = '@moviematch/watch_history_entries';

export async function loadHistory(): Promise<WatchHistoryEntry[]> {
  const value = await AsyncStorage.getItem(HISTORY_KEY);
  if (!value) return [];
  try {
    return JSON.parse(value) as WatchHistoryEntry[];
  } catch {
    return [];
  }
}

export async function saveHistory(entries: WatchHistoryEntry[]) {
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
}

export async function mergeHistory(entries: WatchHistoryEntry[]) {
  const current = await loadHistory();
  const keys = new Set(entries.map((item) => `${item.raw_title}|${item.watch_date}`));
  const merged = [...entries, ...current.filter((item) => !keys.has(`${item.raw_title}|${item.watch_date}`))];
  await saveHistory(merged);
  return merged;
}
