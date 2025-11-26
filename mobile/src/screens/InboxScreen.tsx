import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function InboxScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Inbox</Text>
        <Text style={styles.message}>
          Écran réservé pour l'intégration email et OCR dans un prochain milestone.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f7',
    padding: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
});
