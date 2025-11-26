import React, { useState, useEffect } from 'react';
import { Alert, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  Box,
  Text,
  Input,
  Button,
  VStack,
  HStack,
  ScrollView,
  Heading,
  FormControl,
  KeyboardAvoidingView,
  Icon,
} from 'native-base';
import { Feather } from '@expo/vector-icons';
import { getStoredCity, setStoredCity } from '../utils/storage';

export default function ProfileScreen() {
  const navigation = useNavigation();
  const [city, setCity] = useState('');
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

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
    setJustSaved(true);

    // Auto-navigate to Home after 1.5 seconds
    setTimeout(() => {
      setJustSaved(false);
      navigation.navigate('Home' as never);
    }, 1500);
  };

  return (
    <KeyboardAvoidingView
      flex={1}
      bg="white"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView flex={1}>
        <VStack space={6} px={5} py={5} pb={8}>
          <Box
            bg="white"
            borderRadius={12}
            p={4}
            borderWidth={1}
            borderColor="brand.lightGray"
            shadow={0}
          >
            <HStack alignItems="center" space={2} mb={3}>
              <Icon as={Feather} name="map-pin" size={5} color="brand.blueGray" />
              <Heading fontSize="h2" color="brand.blueGray" fontWeight="600">
                Profil
              </Heading>
            </HStack>
            <FormControl>
              <FormControl.Label
                _text={{ fontSize: 'body', color: 'brand.blueGray', fontWeight: '500' }}
              >
                Ville ou code postal
              </FormControl.Label>
              <Input
                placeholder="Ex : Paris ou 75001"
                value={city}
                onChangeText={setCity}
                autoCapitalize="none"
                autoCorrect={false}
                mb={3}
              />
            </FormControl>
            <Button
              onPress={handleSave}
              isLoading={saving}
              isDisabled={saving || justSaved}
              bg={justSaved ? 'brand.green' : 'brand.blue'}
            >
              {justSaved ? '✓ Enregistré !' : 'Enregistrer'}
            </Button>
            {justSaved ? (
              <HStack alignItems="center" space={2} mt={3} bg="#E8F5E9" p={3} borderRadius={8}>
                <Icon as={Feather} name="check-circle" size={5} color="brand.green" />
                <VStack flex={1}>
                  <Text fontSize={14} color="brand.green" fontWeight="600">
                    Ville enregistrée !
                  </Text>
                  <Text fontSize={13} color="#2E7D32" fontWeight="400">
                    Retour à l'accueil pour voir la météo...
                  </Text>
                </VStack>
              </HStack>
            ) : (
              <Text fontSize={13} color="brand.mediumGray" fontWeight="400" mt={2}>
                Cette information est utilisée pour les appels météo dans l'écran d'accueil.
              </Text>
            )}
          </Box>

          <Box
            bg="white"
            borderRadius={12}
            p={4}
            borderWidth={1}
            borderColor="brand.lightGray"
            shadow={0}
          >
            <Heading fontSize="h2" mb={3} color="brand.blueGray" fontWeight="600">
              Profil
            </Heading>
            <Text fontSize="body" color="brand.mediumGray" fontWeight="400">
              Autres paramètres du profil seront ajoutés dans les prochains milestones.
            </Text>
          </Box>
        </VStack>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
