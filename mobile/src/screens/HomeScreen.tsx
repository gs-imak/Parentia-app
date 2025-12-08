import React, { useEffect, useState } from 'react';
import { RefreshControl, Linking, View, Text, ScrollView, ActivityIndicator, TouchableOpacity, Modal, StyleSheet, Dimensions, type GestureResponderEvent } from 'react-native';
import { formatDateFrench } from '../utils/dateFormat';
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
import { getStoredCity, getStoredWeatherCity, getStoredCoordinates, getStoredQuote, setStoredQuote } from '../utils/storage';
import { AppEvents, EVENTS } from '../utils/events';

interface HomeScreenProps {
  onOpenTaskDetail?: (task: Task) => void;
  refreshTrigger?: number;
}

export default function HomeScreen({ onOpenTaskDetail, refreshTrigger }: HomeScreenProps) {
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
  
  // Legacy description modal state (only used if onOpenTaskDetail not provided)
  const [longPressedTask, setLongPressedTask] = useState<Task | null>(null);
  const [pressPosition, setPressPosition] = useState<'top' | 'bottom'>('bottom');

  const loadData = async () => {
    setQuoteError(null);
    setWeatherError(null);
    setTasksError(null);
    setNewsError(null);

    // Check for cached quote first
    const cachedQuote = await getStoredQuote();
    if (cachedQuote) {
      // Cache is valid for current day+period, use it
      setQuote(cachedQuote);
    } else {
      // No valid cache, fetch fresh quote
      try {
        const q = await fetchQuote();
        setQuote(q);
        await setStoredQuote(q);
      } catch {
        setQuoteError('Impossible de charger la citation pour le moment.');
      }
    }

    // Get display city and coordinates for accurate weather
    const displayCity = await getStoredCity();
    const coords = await getStoredCoordinates();
    
    console.log('[Home] Stored data - city:', displayCity, 'coords:', coords);
    
    if (displayCity && displayCity.trim()) {
      try {
        console.log('[Home] Fetching weather for:', displayCity, coords);
        // Pass coordinates to avoid geocoding issues with postal codes
        const url = coords 
          ? `/weather?city=${encodeURIComponent(displayCity)}&lat=${coords.lat}&lon=${coords.lon}`
          : `/weather?city=${encodeURIComponent(displayCity)}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Weather API error');
        const json = await response.json();
        if (!json.success) throw new Error(json.error);
        setWeather(json.data);
        console.log('[Home] Weather response:', json.data);
      } catch (error) {
        console.error('[Home] Weather error:', error);
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

  // Reload tasks when refreshTrigger changes (e.g., after task deletion)
  useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger > 0) {
      loadData();
    }
  }, [refreshTrigger]);

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
    <View style={{ flex: 1 }}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.container}>
        {/* Weather block */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Feather name="cloud" size={20} color="#2C3E50" />
            <Text style={styles.cardTitle}>
              {weather && weather.outfit && weather.outfit.trim() ? 'Météo & habits' : 'Météo'}
            </Text>
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
                  {weather.isSnowing ? '❄️' : weather.isRaining ? '🌧️' : (() => {
                    const hour = new Date().getHours();
                    const isNight = hour < 6 || hour >= 20;
                    return isNight ? '🌙' : '☀️';
                  })()}
                </Text>
              </View>
              {weather.outfit && weather.outfit.trim() && (
                <View style={styles.outfitSection}>
                  <Text style={styles.outfitText}>
                    <Text style={styles.outfitLabel}>À prévoir : </Text>
                    {weather.outfit}
                  </Text>
                </View>
              )}
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
            <Text style={styles.cardTitle}>
              {(() => {
                // Check if any task is actually due today (date-only comparison)
                const now = new Date();
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);
                
                const hasTodayTask = tasks.some(task => {
                  const taskDeadline = new Date(task.deadline);
                  const taskDate = new Date(taskDeadline.getFullYear(), taskDeadline.getMonth(), taskDeadline.getDate());
                  return taskDate.getTime() === today.getTime();
                });
                
                return hasTodayTask ? 'Tâches du jour' : 'Tâches à venir';
              })()}
            </Text>
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
                const formattedDeadline = formatDateFrench(deadline);

                let statusColor = '#6E7A84';
                let isFilled = false;
                if (task.status === 'done') {
                  statusColor = '#4CAF50';
                  isFilled = true;
                } else if (task.status === 'in_progress') {
                  statusColor = '#F7A45A';
                }

                return (
                  <View key={task.id}>
                    <TouchableOpacity 
                      style={styles.taskRow}
                      onPress={() => toggleTaskStatus(task.id)}
                      onLongPress={(e: GestureResponderEvent) => {
                        // Open task detail screen if handler is provided
                        if (onOpenTaskDetail) {
                          onOpenTaskDetail(task);
                        } else if (task.description) {
                          // Fallback: show description modal
                          const screenHeight = Dimensions.get('window').height;
                          const pressY = e.nativeEvent.pageY;
                          setPressPosition(pressY > screenHeight / 2 ? 'top' : 'bottom');
                          setLongPressedTask(task);
                        }
                      }}
                      delayLongPress={400}
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
                  </View>
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
                const formattedDate = formatDateFrench(publishedDate);

                return (
                  <View key={index} style={styles.newsItem}>
                    <Text style={styles.newsTitle}>{item.title}</Text>
                    <Text style={styles.newsMeta}>{item.source} · {formattedDate}</Text>
                    <Text style={styles.newsSummary}>{item.summary || 'Résumé non disponible.'}</Text>
                    <TouchableOpacity
                      onPress={() => Linking.openURL(item.link).catch(() => {})}
                      style={styles.newsLink}
                    >
                      <Text style={styles.newsLinkText}>Lire l'article</Text>
                      <Feather name="external-link" size={12} color="#6E7A84" />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </View>
      </ScrollView>
      
      {/* Description Modal - positioned dynamically */}
      {longPressedTask && (
        <Modal
          transparent={true}
          visible={true}
          animationType="fade"
          onRequestClose={() => setLongPressedTask(null)}
        >
          <TouchableOpacity
            style={[
              styles.modalOverlay,
              pressPosition === 'top' 
                ? { justifyContent: 'flex-start', paddingTop: 80 }
                : { justifyContent: 'flex-end', paddingBottom: 80 }
            ]}
            activeOpacity={1}
            onPress={() => setLongPressedTask(null)}
          >
            <View style={styles.descriptionModal}>
              <Text style={styles.descriptionModalTitle}>{longPressedTask.title}</Text>
              <Text style={styles.descriptionModalText}>{longPressedTask.description}</Text>
              <Text style={styles.descriptionModalHint}>Appuyez n'importe où pour fermer</Text>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
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
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E9EEF2',
  },
  newsTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 8,
    lineHeight: 24,
  },
  newsMeta: {
    fontSize: 13,
    color: '#6E7A84',
    fontWeight: '400',
    marginBottom: 10,
  },
  newsSummary: {
    fontSize: 15,
    color: '#6E7A84',
    fontWeight: '400',
    marginBottom: 12,
    lineHeight: 22,
  },
  newsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  newsLinkText: {
    fontSize: 13,
    color: '#6E7A84',
    fontWeight: '400',
    marginRight: 4,
    textDecorationLine: 'underline',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  descriptionModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    maxWidth: 400,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  descriptionModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 12,
  },
  descriptionModalText: {
    fontSize: 15,
    color: '#6E7A84',
    lineHeight: 22,
    marginBottom: 16,
  },
  descriptionModalHint: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
    textAlign: 'center',
  },
});
