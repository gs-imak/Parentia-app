import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

export default function TasksScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.header}>
          <Feather name="list" size={20} color="#2C3E50" />
          <Text style={styles.title}>Tâches</Text>
        </View>
        <Text style={styles.text}>
          Écran à compléter dans un prochain milestone. Pour l'instant, les tâches s'affichent uniquement sur l'accueil.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E9EEF2',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 19,
    color: '#2C3E50',
    fontWeight: '600',
    marginLeft: 8,
  },
  text: {
    fontSize: 16,
    color: '#6E7A84',
    fontWeight: '400',
  },
});
