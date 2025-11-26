import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Linking,
} from 'react-native';
import {
  fetchQuote,
  fetchWeather,
  fetchTasks,
  fetchNews,
  type Quote,
  type WeatherSummary,
  type Task,
  type NewsItem,
} from '../api/client';
import { getStoredCity } from '../utils/storage';

export default function HomeScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const [weather, setWeather] = useState<WeatherSummary | null>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksError, setTasksError] = useState<string | null>(null);

  const [news, setNews] = useState<NewsItem[]>([]);
  const [newsError, setNewsError] = useState<string | null>(null);

  const loadData = async () => {
    setQuoteError(null);
    setWeatherError(null);
    setTasksError(null);
    setNewsError(null);

    try {
      const q = await fetchQuote();
      setQuote(q);
    } catch {
      setQuoteError('Impossible de charger la citation pour le moment.');
    }

    const city = await getStoredCity();
    if (city && city.trim()) {
      try {
        const w = await fetchWeather(city);
        setWeather(w);
      } catch {
        setWeatherError('Impossible de charger la météo pour le moment.');
      }
    } else {
      setWeatherError('Aucune ville configurée. Ajoutez votre ville dans l'onglet Profil.');
    }

    try {
      const t = await fetchTasks();
      setTasks(t.tasks);
    } catch {
      setTasksError('Impossible de charger les tâches pour le moment.');
    }

    try {
      const n = await fetchNews();
      setNews(n.items);
    } catch {
      setNewsError('Impossible de charger les news pour le moment.');
    }

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#111827" />
        <Text style={styles.loadingText}>Chargement de votre accueil...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Weather block */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Météo & habits</Text>
        {weatherError ? (
          <Text style={styles.errorText}>{weatherError}</Text>
        ) : weather ? (
          <>
            <View style={styles.weatherTop}>
              <View style={styles.weatherMain}>
                <Text style={styles.weatherTemp}>{Math.round(weather.temperatureC)}°C</Text>
                <Text style={styles.weatherCity}>{weather.city}</Text>
              </View>
              <Text style={styles.weatherIcon}>
                {weather.isSnowing ? '❄️' : weather.isRaining ? '🌧️' : '☀️'}
              </Text>
            </View>
            <Text style={styles.weatherOutfit}>{weather.outfit}</Text>
          </>
        ) : null}
      </View>

      {/* Quote block */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Pour aujourd'hui</Text>
        {quoteError ? (
          <Text style={styles.errorText}>{quoteError}</Text>
        ) : quote ? (
          <View style={styles.quoteWrapper}>
            <Text style={styles.quoteText}>{quote.text}</Text>
            <Text style={styles.quoteLabel}>
              {quote.type === 'morning' ? 'Citation du matin' : 'Citation du soir'}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Tasks block */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Tâches du jour</Text>
        {tasksError ? (
          <Text style={styles.errorText}>{tasksError}</Text>
        ) : tasks.length === 0 ? (
          <Text style={styles.mutedText}>
            Aucune tâche pour aujourd'hui. Ajoutez votre première tâche depuis l'onglet Tâches.
          </Text>
        ) : (
          <View style={styles.tasksList}>
            {tasks.map((task) => {
              const deadline = new Date(task.deadline);
              const formattedDeadline = deadline.toLocaleString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit',
                day: '2-digit',
                month: '2-digit',
              });

              let iconStyle = styles.taskIconTodo;
              if (task.status === 'done') {
                iconStyle = styles.taskIconDone;
              } else if (task.status === 'in_progress') {
                iconStyle = styles.taskIconInProgress;
              }

              return (
                <View key={task.id} style={styles.taskItem}>
                  <View style={[styles.taskIcon, iconStyle]} />
                  <View style={styles.taskContent}>
                    <Text style={styles.taskTitle}>{task.title}</Text>
                    <View style={styles.taskMeta}>
                      <Text style={styles.taskMetaText}>{formattedDeadline}</Text>
                      <View style={styles.taskChip}>
                        <Text style={styles.taskChipText}>{task.category}</Text>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* News block */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>News du jour</Text>
        {newsError ? (
          <Text style={styles.errorText}>{newsError}</Text>
        ) : news.length === 0 ? (
          <Text style={styles.mutedText}>Aucune news disponible pour le moment.</Text>
        ) : (
          <View style={styles.newsList}>
            {news.map((item, index) => {
              const publishedDate = new Date(item.publishedAt);
              const formattedDate = publishedDate.toLocaleDateString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <View key={index} style={styles.newsItem}>
                  <Text style={styles.newsTitle}>{item.title}</Text>
                  <Text style={styles.newsMeta}>
                    {item.source} · {formattedDate}
                  </Text>
                  <Text style={styles.newsSummary}>
                    {item.summary || 'Résumé non disponible.'}
                  </Text>
                  <Text
                    style={styles.newsLink}
                    onPress={() => Linking.openURL(item.link).catch(() => {})}
                  >
                    Lire l'article
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f7',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f7',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#6b7280',
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
    marginBottom: 10,
  },
  mutedText: {
    fontSize: 14,
    color: '#6b7280',
  },
  errorText: {
    fontSize: 14,
    color: '#b91c1c',
  },

  // Weather
  weatherTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  weatherMain: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  weatherTemp: {
    fontSize: 28,
    fontWeight: '600',
    color: '#111827',
  },
  weatherCity: {
    fontSize: 16,
    color: '#4b5563',
  },
  weatherIcon: {
    fontSize: 28,
  },
  weatherOutfit: {
    fontSize: 14,
    color: '#6b7280',
  },

  // Quote
  quoteWrapper: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 12,
  },
  quoteText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#111827',
    textAlign: 'center',
    marginBottom: 6,
  },
  quoteLabel: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
  },

  // Tasks
  tasksList: {
    gap: 10,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  taskIcon: {
    width: 18,
    height: 18,
    borderRadius: 999,
    borderWidth: 2,
    marginTop: 3,
  },
  taskIconTodo: {
    borderColor: '#9ca3af',
  },
  taskIconInProgress: {
    borderColor: '#f59e0b',
  },
  taskIconDone: {
    borderColor: '#22c55e',
    backgroundColor: '#22c55e',
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 4,
  },
  taskMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  taskMetaText: {
    fontSize: 13,
    color: '#6b7280',
  },
  taskChip: {
    backgroundColor: '#eff6ff',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  taskChipText: {
    fontSize: 12,
    color: '#1d4ed8',
  },

  // News
  newsList: {
    gap: 12,
  },
  newsItem: {},
  newsTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 4,
  },
  newsMeta: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 4,
  },
  newsSummary: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 4,
  },
  newsLink: {
    fontSize: 13,
    color: '#2563eb',
    textDecorationLine: 'underline',
  },
});
