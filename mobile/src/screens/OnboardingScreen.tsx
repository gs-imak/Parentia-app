import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { getOrCreateUserId, getUserEmailAddress, setOnboardingCompleted } from '../utils/storage';

interface OnboardingScreenProps {
  onDone: () => void;
}

export default function OnboardingScreen({ onDone }: OnboardingScreenProps) {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const uid = await getOrCreateUserId();
      setUserId(uid);
    })();
  }, []);

  const userEmail = useMemo(() => {
    return userId ? getUserEmailAddress(userId) : null;
  }, [userId]);

  const handleDone = async () => {
    await setOnboardingCompleted(true);
    onDone();
  };

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <View style={styles.icon}>
          <Feather name="check-circle" size={22} color="#3A82F7" />
        </View>
        <Text style={styles.title}>Bienvenue sur HC Family</Text>
        <Text style={styles.subtitle}>
          Transformez vos emails et vos photos en tâches claires, puis envoyez des messages prêts à partir.
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.row}>
          <Feather name="mail" size={18} color="#2C3E50" />
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Email → tâche</Text>
            <Text style={styles.rowBody}>
              Envoyez un email à votre adresse dédiée, l’app crée automatiquement la tâche.
            </Text>
          </View>
        </View>

        <View style={styles.row}>
          <Feather name="camera" size={18} color="#2C3E50" />
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Photo → tâche</Text>
            <Text style={styles.rowBody}>
              Prenez en photo un document / une capture et obtenez une tâche exploitable.
            </Text>
          </View>
        </View>

        <View style={[styles.row, { marginBottom: 0 }]}>
          <Feather name="send" size={18} color="#2C3E50" />
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Communiquer vite et bien</Text>
            <Text style={styles.rowBody}>
              Depuis une tâche, générez un email / SMS / WhatsApp conforme et prêt à envoyer.
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.emailCard}>
        <Text style={styles.emailLabel}>Votre adresse email personnelle</Text>
        <Text style={styles.emailValue} numberOfLines={1}>
          {userEmail || '...'}
        </Text>
        <Text style={styles.emailHint}>
          À conserver : elle sert à créer des tâches par email.
        </Text>
      </View>

      <TouchableOpacity style={styles.primaryButton} onPress={handleDone} activeOpacity={0.85}>
        <Text style={styles.primaryButtonText}>Commencer</Text>
      </TouchableOpacity>

      <Text style={styles.footerHint}>
        Vous pourrez retrouver cette adresse dans Profil, avec un bouton Copier.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 64 : 24,
    paddingBottom: 24,
  },
  hero: {
    marginBottom: 20,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#EBF5FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2C3E50',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: '#6E7A84',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E9EEF2',
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
    alignItems: 'flex-start',
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2C3E50',
    marginBottom: 2,
  },
  rowBody: {
    fontSize: 14,
    lineHeight: 20,
    color: '#6E7A84',
  },
  emailCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E9EEF2',
    marginBottom: 16,
  },
  emailLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6E7A84',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  emailValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2C3E50',
  },
  emailHint: {
    marginTop: 8,
    fontSize: 13,
    color: '#6E7A84',
    lineHeight: 18,
  },
  primaryButton: {
    backgroundColor: '#3A82F7',
    borderRadius: 12,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3A82F7',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 3,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  footerHint: {
    marginTop: 12,
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 18,
  },
});

