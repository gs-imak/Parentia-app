import React, { useEffect, useState } from 'react';
import { RefreshControl, Linking, View, Text, ScrollView, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  fetchQuote,
  fetchWeather,
  fetchTasks,
  fetchNews,
  updateTask,
  type Quote,
  type WeatherSummary,
  type Task,
  type NewsItem,
} from '../api/client';
import { getStoredCity, getStoredQuote, setStoredQuote } from '../utils/storage';
import { AppEvents, EVENTS } from '../utils/events';

export default function HomeScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const [weather, setWeather] = useState<WeatherSummary | null>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksError, setTasksError] = useState<string | null>(null);

  const toggleTaskStatus = async (taskId: string) => {
    // Optimistic update
    setTasks(prevTasks => 
      prevTasks.map(task => {
        if (task.id !== taskId) return task;
        
        // Cycle: todo -> in_progress -> done -> todo
        let newStatus: 'todo' | 'in_progress' | 'done';
        if (task.status === 'todo') {
          newStatus = 'in_progress';
        } else if (task.status === 'in_progress') {
          newStatus = 'done';
        } else {
          newStatus = 'todo';
        }
        
        return { ...task, status: newStatus };
      })
    );

    // Persist to backend
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;
      
      let newStatus: 'todo' | 'in_progress' | 'done';
      if (task.status === 'todo') {
        newStatus = 'in_progress';
      } else if (task.status === 'in_progress') {
        newStatus = 'done';
      } else {
        newStatus = 'todo';
      }
      
      await updateTask(taskId, { status: newStatus });
    } catch (error) {
      // Silently fail, the UI has already updated optimistically
      console.error('Failed to update task status:', error);
    }
  };

  const [news, setNews] = useState<NewsItem[]>([]);
  const [newsError, setNewsError] = useState<string | null>(null);

  const loadData = async () => {
    setQuoteError(null);
    setWeatherError(null);
    setTasksError(null);
    setNewsError(null);

    // Check for cached quote first
    const cachedQuote = await getStoredQuote();
    if (cachedQuote) {
      setQuote(cachedQuote);
    } else {
      try {
        const q = await fetchQuote();
        setQuote(q);
        await setStoredQuote(q);
      } catch {
        setQuoteError('Impossible de charger la citation pour le moment.');
      }
    }

    const city = await getStoredCity();
    console.log('[Home] Stored city from AsyncStorage:', city);
    if (city && city.trim()) {
      try {
        console.log('[Home] Fetching weather for:', city);
        const w = await fetchWeather(city);
        console.log('[Home] Weather response:', w);
        setWeather(w);
      } catch {
        setWeatherError('Impossible de charger la météo pour le moment.');
      }
    } else {
      setWeatherError('Aucune ville configuree. Ajoutez votre ville dans l' + "'" + 'onglet Profil.');
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
    // Reload when city is updated from Profile screen
    const handler = () => {
      setLoading(true);
      loadData();
    };
    // @ts-ignore: EventTarget typing
    AppEvents.addEventListener(EVENTS.CITY_UPDATED, handler);
    return () => {
      // @ts-ignore
      AppEvents.removeEventListener(EVENTS.CITY_UPDATED, handler);
    };
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3A82F7" />
        <Text style={styles.loadingText}>Chargement de votre accueil...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scrollView}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.container}>
        {/* Weather block */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Feather name="cloud" size={20} color="#2C3E50" />
            <Text style={styles.cardTitle}>Météo & habits</Text>
          </View>
          {weatherError ? (
            <Text style={styles.errorText}>{weatherError}</Text>
          ) : weather ? (
            <View>
              <View style={styles.weatherRow}>
                <View style={styles.weatherLeft}>
                  <Text style={styles.temperature}>{Math.round(weather.temperatureC)}°C</Text>
                  <Text style={styles.city}>{weather.city}</Text>
                </View>
                <Text style={styles.weatherEmoji}>
                  {weather.isSnowing ? '❄️' : weather.isRaining ? '🌧️' : '☀️'}
                </Text>
              </View>
              <View style={styles.outfitSection}>
                <Text style={styles.outfitText}>
                  <Text style={styles.outfitLabel}>À prévoir : </Text>
                  {weather.outfit}
                </Text>
              </View>
            </View>
          ) : null}
        </View>

        {/* Quote block - Simplified per client request */}
        {quoteError ? (
          <View style={styles.card}>
            <Text style={styles.errorText}>{quoteError}</Text>
          </View>
        ) : quote ? (
          <View style={styles.quoteCard}>
            <Text style={styles.quoteText}>{quote.text}</Text>
          </View>
        ) : null}

        {/* Tasks block */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Feather name="check-square" size={20} color="#2C3E50" />
            <Text style={styles.cardTitle}>Tâches du jour</Text>
          </View>
          {tasksError ? (
            <Text style={styles.errorText}>{tasksError}</Text>
          ) : tasks.length === 0 ? (
            <Text style={styles.placeholderText}>
              Aucune tâche pour aujourd'hui. Ajoutez votre première tâche depuis l'onglet Tâches.
            </Text>
          ) : (
            <View>
              {tasks.map((task) => {
                const deadline = new Date(task.deadline);
                const formattedDeadline = deadline.toLocaleString('fr-FR', {
                  hour: '2-digit',
                  minute: '2-digit',
                  day: '2-digit',
                  month: '2-digit',
                });

                let statusColor = '#6E7A84';
                let isFilled = false;
                if (task.status === 'done') {
                  statusColor = '#4CAF50';
                  isFilled = true;
                } else if (task.status === 'in_progress') {
                  statusColor = '#F7A45A';
                }

                return (
                  <TouchableOpacity 
                    key={task.id} 
                    style={styles.taskRow}
                    onPress={() => toggleTaskStatus(task.id)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.taskCircle,
                        { borderColor: statusColor, backgroundColor: isFilled ? statusColor : 'transparent' },
                      ]}
                    >
                      {task.status === 'done' && (
                        <Feather name="check" size={14} color="#FFFFFF" />
                      )}
                    </View>
                    <View style={styles.taskContent}>
                      <Text style={[styles.taskTitle, task.status === 'done' && styles.taskTitleDone]}>
                        {task.title}
                      </Text>
                      <View style={styles.taskMeta}>
                        <Text style={styles.taskDeadline}>{formattedDeadline}</Text>
                        <View style={styles.taskBadge}>
                          <Text style={styles.taskBadgeText}>{task.category}</Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* News block */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Feather name="book-open" size={20} color="#2C3E50" />
            <Text style={styles.cardTitle}>News du jour</Text>
          </View>
          {newsError ? (
            <Text style={styles.errorText}>{newsError}</Text>
          ) : news.length === 0 ? (
            <Text style={styles.placeholderText}>Aucune news disponible pour le moment.</Text>
          ) : (
            <View>
              {news.map((item, index) => {
                const publishedDate = new Date(item.publishedAt);
                const formattedDate = publishedDate.toLocaleDateString('fr-FR', {
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <View key={index} style={styles.newsItem}>
                    <Text style={styles.newsTitle}>{item.title}</Text>
                    <Text style={styles.newsMeta}>{item.source} · {formattedDate}</Text>
                    <Text style={styles.newsSummary}>{item.summary || 'Résumé non disponible.'}</Text>
                    <TouchableOpacity
                      onPress={() => Linking.openURL(item.link).catch(() => {})}
                      style={styles.newsButton}
                    >
                      <Text style={styles.newsButtonText}>Lire l'article</Text>
                      <Feather name="external-link" size={16} color="#3A82F7" />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    padding: 20,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6E7A84',
    fontWeight: '400',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E9EEF2',
    marginBottom: 24,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 19,
    color: '#2C3E50',
    fontWeight: '600',
    marginLeft: 8,
  },
  errorText: {
    fontSize: 16,
    color: '#DC2626',
    fontWeight: '400',
  },
  placeholderText: {
    fontSize: 16,
    color: '#6E7A84',
    fontWeight: '400',
  },
  weatherRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  weatherLeft: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  temperature: {
    fontSize: 32,
    fontWeight: '600',
    color: '#2C3E50',
  },
  city: {
    fontSize: 16,
    color: '#6E7A84',
    fontWeight: '500',
    marginLeft: 8,
  },
  weatherEmoji: {
    fontSize: 32,
  },
  outfitSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E9EEF2',
  },
  outfitText: {
    fontSize: 15,
    color: '#6E7A84',
    fontWeight: '400',
    lineHeight: 22,
  },
  outfitLabel: {
    fontWeight: '500',
    color: '#2C3E50',
  },
  quoteCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E9EEF2',
  },
  quoteText: {
    fontSize: 17,
    lineHeight: 26,
    color: '#2C3E50',
    textAlign: 'center',
    fontWeight: '400',
    fontStyle: 'italic',
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  taskCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    marginTop: 2,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2C3E50',
    marginBottom: 4,
  },
  taskTitleDone: {
    textDecorationLine: 'line-through',
    color: '#9CA3AF',
  },
  taskMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  taskDeadline: {
    fontSize: 14,
    color: '#6E7A84',
    fontWeight: '400',
    marginRight: 8,
  },
  taskBadge: {
    backgroundColor: '#EBF5FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  taskBadgeText: {
    color: '#3A82F7',
    fontSize: 13,
    fontWeight: '500',
  },
  newsItem: {
    marginBottom: 16,
  },
  newsTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2C3E50',
    marginBottom: 6,
  },
  newsMeta: {
    fontSize: 13,
    color: '#6E7A84',
    fontWeight: '400',
    marginBottom: 6,
  },
  newsSummary: {
    fontSize: 16,
    color: '#6E7A84',
    fontWeight: '400',
    marginBottom: 8,
  },
  newsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF5FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  newsButtonText: {
    fontSize: 14,
    color: '#3A82F7',
    fontWeight: '500',
    marginRight: 6,
  },
});
