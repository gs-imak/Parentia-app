import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { getStoredCity, setStoredCity } from '../utils/storage';

export default function ProfileScreen() {
  const [city, setCity] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getStoredCity().then((storedCity) => {
      if (storedCity) setCity(storedCity);
    });
  }, []);

  const handleSave = async () => {
    const trimmed = city.trim();
    if (!trimmed) {
      Alert.alert('Erreur', 'Veuillez saisir une ville ou un code postal.');
      return;
    }

    setSaving(true);
    await setStoredCity(trimmed);
    setSaving(false);

    Alert.alert('Succes', 'Ville enregistree. Retournez a l\'accueil pour voir la meteo.');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Profil</Text>
          <Text style={styles.label}>Ville ou code postal</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex : Paris ou 75001"
            value={city}
            onChangeText={setCity}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[styles.button, saving && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.buttonText}>Enregistrer</Text>
          </TouchableOpacity>
          <Text style={styles.note}>
            Cette information est utilisée pour les appels météo dans l'écran d'accueil.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Profil</Text>
          <Text style={styles.message}>
            Autres paramètres du profil seront ajoutés dans les prochains milestones.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f7',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  label: {
    fontSize: 15,
    color: '#111827',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111827',
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#111827',
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  note: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 8,
  },
  message: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
});
