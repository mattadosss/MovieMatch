import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors } from '@/constants/colors';
import { createSessionFromUrl } from '@/src/lib/supabase';

export default function AuthCallbackScreen() {
  const url = Linking.useLinkingURL();
  const handledUrl = useRef<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!url || handledUrl.current === url) return;
    handledUrl.current = url;

    createSessionFromUrl(url)
      .then(() => router.replace('/(tabs)/profile'))
      .catch((cause) => setError(
        cause instanceof Error ? cause.message : 'Der Bestätigungslink konnte nicht verarbeitet werden.',
      ));
  }, [url]);

  return (
    <View style={styles.screen}>
      <View style={styles.icon}>
        <Ionicons
          name={error ? 'alert-circle-outline' : 'mail-open-outline'}
          color={error ? '#FF8A95' : Colors.red}
          size={38}
        />
      </View>
      <Text style={styles.title}>{error ? 'Link ungültig' : 'E-Mail wird bestätigt …'}</Text>
      {error ? (
        <>
          <Text style={styles.message}>{error}</Text>
          <Text style={styles.hint}>Fordere über die Registrierung eine neue Bestätigungsmail an.</Text>
          <Pressable onPress={() => router.replace('/auth')} style={styles.button}>
            <Text style={styles.buttonText}>Zur Anmeldung</Text>
          </Pressable>
        </>
      ) : (
        <ActivityIndicator color={Colors.red} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 28, alignItems: 'center', justifyContent: 'center', gap: 18, backgroundColor: Colors.background },
  icon: { width: 76, height: 76, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: Colors.surface },
  title: { color: Colors.text, fontSize: 27, fontWeight: '800', textAlign: 'center' },
  message: { color: '#FF8A95', lineHeight: 22, textAlign: 'center' },
  hint: { maxWidth: 330, color: Colors.muted, lineHeight: 21, textAlign: 'center' },
  button: { minHeight: 52, marginTop: 8, paddingHorizontal: 25, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: Colors.red },
  buttonText: { color: 'white', fontWeight: '700' },
});
