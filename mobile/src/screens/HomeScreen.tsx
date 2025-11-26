import React, { useEffect, useState } from 'react';
import { RefreshControl, Linking } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  Box,
  Text,
  ScrollView,
  VStack,
  HStack,
  Spinner,
  Badge,
  Heading,
  Pressable,
  Icon,
} from 'native-base';
import { Feather } from '@expo/vector-icons';
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
      setWeatherError('Aucune ville configuree. Ajoutez votre ville dans l\'onglet Profil.');
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

  // Reload data when screen comes into focus (e.g., after saving city in Profile)
  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <Box w="100%" h="100%" justifyContent="center" alignItems="center" bg="white">
        <Spinner size="lg" color="brand.blue" />
        <Text mt={3} fontSize="body" color="brand.mediumGray" fontWeight="400">
          Chargement de votre accueil...
        </Text>
      </Box>
    );
  }

  return (
    <ScrollView
      w="100%"
      h="100%"
      bg="white"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <VStack space={6} px={5} py={5} pb={8}>
        {/* Weather block */}
        <Box
          bg="white"
          borderRadius={12}
          p={4}
          borderWidth={1}
          borderColor="brand.lightGray"
        >
          <HStack alignItems="center" space={2} mb={3}>
            <Icon as={Feather} name="cloud" size={5} color="brand.blueGray" />
            <Heading fontSize="h2" color="brand.blueGray" fontWeight="600">
              Météo & habits
            </Heading>
          </HStack>
          {weatherError ? (
            <Text fontSize="body" color="red.600" fontWeight="400">
              {weatherError}
            </Text>
          ) : weather ? (
            <VStack space={2}>
              <HStack justifyContent="space-between" alignItems="center">
                <HStack alignItems="baseline" space={2}>
                  <Text fontSize={32} fontWeight="600" color="brand.blueGray">
                    {Math.round(weather.temperatureC)}°C
                  </Text>
                  <Text fontSize="body" color="brand.mediumGray" fontWeight="500">
                    {weather.city}
                  </Text>
                </HStack>
                <Text fontSize={32}>
                  {weather.isSnowing ? '❄️' : weather.isRaining ? '🌧️' : '☀️'}
                </Text>
              </HStack>
              <Box mt={3}>
                <HStack alignItems="center" space={2} mb={2.5}>
                  <Icon as={Feather} name="shopping-bag" size={4} color="brand.blue" />
                  <Text fontSize={15} color="brand.blueGray" fontWeight="600">
                    À prévoir
                  </Text>
                </HStack>
                <HStack flexWrap="wrap" space={2}>
                  {weather.outfit.split(/[.,;]+/).filter(s => s.trim()).map((item, idx) => (
                    <Box
                      key={idx}
                      bg="brand.blue"
                      px={3}
                      py={2}
                      borderRadius={20}
                      mb={2}
                    >
                      <Text fontSize={14} color="white" fontWeight="500">
                        {item.trim()}
                      </Text>
                    </Box>
                  ))}
                </HStack>
              </Box>
            </VStack>
          ) : null}
        </Box>

        {/* Quote block */}
        <Box
          bg="white"
          borderRadius={12}
          p={4}
          borderWidth={1}
          borderColor="brand.lightGray"
        >
          <HStack alignItems="center" space={2} mb={3}>
            <Icon as={Feather} name="message-circle" size={5} color="brand.blueGray" />
            <Heading fontSize="h2" color="brand.blueGray" fontWeight="600">
              Pour aujourd'hui
            </Heading>
          </HStack>
          {quoteError ? (
            <Text fontSize="body" color="red.600" fontWeight="400">
              {quoteError}
            </Text>
          ) : quote ? (
            <Box bg="#F9FAFB" borderRadius={12} p={4}>
              <Text fontSize="body" lineHeight={24} color="brand.blueGray" textAlign="center" mb={2} fontWeight="400">
                {quote.text}
              </Text>
              <Text fontSize={13} color="brand.mediumGray" textAlign="center" fontWeight="400">
                {quote.type === 'morning' ? 'Citation du matin' : 'Citation du soir'}
              </Text>
            </Box>
          ) : null}
        </Box>

        {/* Tasks block */}
        <Box
          bg="white"
          borderRadius={12}
          p={4}
          borderWidth={1}
          borderColor="brand.lightGray"
        >
          <HStack alignItems="center" space={2} mb={3}>
            <Icon as={Feather} name="check-square" size={5} color="brand.blueGray" />
            <Heading fontSize="h2" color="brand.blueGray" fontWeight="600">
              Tâches du jour
            </Heading>
          </HStack>
          {tasksError ? (
            <Text fontSize="body" color="red.600" fontWeight="400">
              {tasksError}
            </Text>
          ) : tasks.length === 0 ? (
            <Text fontSize="body" color="brand.mediumGray" fontWeight="400">
              Aucune tâche pour aujourd'hui. Ajoutez votre première tâche depuis l'onglet Tâches.
            </Text>
          ) : (
            <VStack space={3}>
              {tasks.map((task) => {
                const deadline = new Date(task.deadline);
                const formattedDeadline = deadline.toLocaleString('fr-FR', {
                  hour: '2-digit',
                  minute: '2-digit',
                  day: '2-digit',
                  month: '2-digit',
                });

                let statusColor = '#6E7A84'; // brand.mediumGray
                let isFilled = false;
                if (task.status === 'done') {
                  statusColor = '#4CAF50'; // brand.green
                  isFilled = true;
                } else if (task.status === 'in_progress') {
                  statusColor = '#F7A45A'; // brand.orange
                }

                return (
                  <HStack key={task.id} alignItems="flex-start" space={3}>
                    <Box
                      w={5}
                      h={5}
                      borderRadius="full"
                      borderWidth={2}
                      borderColor={statusColor}
                      bg={isFilled ? statusColor : 'transparent'}
                      mt={0.5}
                    />
                    <VStack w="100%">
                      <Text fontSize="body" fontWeight="500" color="brand.blueGray" mb={1}>
                        {task.title}
                      </Text>
                      <HStack alignItems="center" space={2}>
                        <Text fontSize={14} color="brand.mediumGray" fontWeight="400">
                          {formattedDeadline}
                        </Text>
                        <Badge
                          bg="#EBF5FF"
                          _text={{ color: 'brand.blue', fontSize: 13, fontWeight: '500' }}
                          borderRadius="full"
                          px={2}
                          py={0.5}
                        >
                          {task.category}
                        </Badge>
                      </HStack>
                    </VStack>
                  </HStack>
                );
              })}
            </VStack>
          )}
        </Box>

        {/* News block */}
        <Box
          bg="white"
          borderRadius={12}
          p={4}
          borderWidth={1}
          borderColor="brand.lightGray"
        >
          <HStack alignItems="center" space={2} mb={3}>
            <Icon as={Feather} name="book-open" size={5} color="brand.blueGray" />
            <Heading fontSize="h2" color="brand.blueGray" fontWeight="600">
              News du jour
            </Heading>
          </HStack>
          {newsError ? (
            <Text fontSize="body" color="red.600" fontWeight="400">
              {newsError}
            </Text>
          ) : news.length === 0 ? (
            <Text fontSize="body" color="brand.mediumGray" fontWeight="400">
              Aucune news disponible pour le moment.
            </Text>
          ) : (
            <VStack space={4}>
              {news.map((item, index) => {
                const publishedDate = new Date(item.publishedAt);
                const formattedDate = publishedDate.toLocaleDateString('fr-FR', {
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <VStack key={index} space={1.5}>
                    <Text fontSize="body" fontWeight="500" color="brand.blueGray">
                      {item.title}
                    </Text>
                    <Text fontSize={13} color="brand.mediumGray" fontWeight="400">
                      {item.source} · {formattedDate}
                    </Text>
                    <Text fontSize="body" color="brand.mediumGray" fontWeight="400">
                      {item.summary || 'Résumé non disponible.'}
                    </Text>
                    <Pressable onPress={() => Linking.openURL(item.link).catch(() => {})}>
                      <HStack
                        alignItems="center"
                        space={1.5}
                        bg="#EBF5FF"
                        px={3}
                        py={2}
                        borderRadius={8}
                        alignSelf="flex-start"
                        mt={1}
                      >
                        <Text fontSize={14} color="brand.blue" fontWeight="500">
                          Lire l'article
                        </Text>
                        <Icon as={Feather} name="external-link" size={4} color="brand.blue" />
                      </HStack>
                    </Pressable>
                  </VStack>
                );
              })}
            </VStack>
          )}
        </Box>
      </VStack>
    </ScrollView>
  );
}
