import React, { useState, useEffect } from 'react';
import { Alert, Platform, View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, ActivityIndicator, StyleSheet } from 'react-native';
import * as Location from 'expo-location';
import { Feather } from '@expo/vector-icons';
import { getStoredCity, setStoredCity } from '../utils/storage';

export default function ProfileScreen() {
  const [city, setCity] = useState('');
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [locationPermissionAsked, setLocationPermissionAsked] = useState(false);

  useEffect(() => {
    getStoredCity().then((storedCity) => {
      if (storedCity) setCity(storedCity);
    });
    // Don't auto-request location on mount - user will click button
  }, []);

  const handleUseLocation = async () => {
    console.log('[Geolocation] Button clicked');
    setLoadingLocation(true);
    setLocationPermissionAsked(true);

    try {
      if (Platform.OS === 'web') {
        console.log('[Geolocation] Running on web platform');
        // Use browser Geolocation API for web
        if (!navigator.geolocation) {
          console.error('[Geolocation] navigator.geolocation not available');
          Alert.alert('Erreur', 'La géolocalisation n\'est pas supportée par votre navigateur.');
          setLoadingLocation(false);
          return;
        }
        console.log('[Geolocation] Requesting position from browser...');

        navigator.geolocation.getCurrentPosition(
          async (position) => {
            console.log('[Geolocation] Position obtained:', position.coords.latitude, position.coords.longitude);
            const { latitude, longitude } = position.coords;
            
            // Use Nominatim for reverse geocoding on web (free, no API key needed)
            try {
              console.log('[Geolocation] Fetching address from Nominatim...');
              const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`,
                {
                  headers: {
                    'User-Agent': 'ParentiaApp/1.0',
                  },
                }
              );
              const data = await response.json();
              console.log('[Geolocation] Nominatim response:', data);
              
              const cityName = data.address?.postcode || data.address?.city || data.address?.town || data.address?.village || '';
              if (cityName) {
                console.log('[Geolocation] City found:', cityName);
                setCity(cityName);
                Alert.alert('Localisation trouvée', `Votre position: ${cityName}`);
              } else {
                console.warn('[Geolocation] No city name in response');
                Alert.alert('Erreur', 'Impossible de déterminer votre ville.');
              }
            } catch (error) {
              console.error('[Geolocation] Reverse geocoding error:', error);
              Alert.alert('Erreur', 'Impossible de récupérer l\'adresse.');
            }
            setLoadingLocation(false);
          },
          (error) => {
            console.error('[Geolocation] Browser error:', error.code, error.message);
            let message = 'Impossible d\'obtenir votre position.';
            if (error.code === error.PERMISSION_DENIED) {
              message = 'La géolocalisation a été refusée. Vous pouvez saisir votre ville manuellement.';
            } else if (error.code === error.POSITION_UNAVAILABLE) {
              message = 'Position non disponible. Vérifiez vos paramètres de localisation.';
            } else if (error.code === error.TIMEOUT) {
              message = 'La demande de localisation a expiré. Réessayez.';
            }
            Alert.alert('Erreur de géolocalisation', message);
            setLoadingLocation(false);
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0,
          }
        );
      } else {
        // Use expo-location for mobile
        const { status } = await Location.requestForegroundPermissionsAsync();

        if (status !== 'granted') {
          Alert.alert(
            'Permission refusée',
            'La géolocalisation a été refusée. Vous pouvez saisir votre ville manuellement ci-dessous.'
          );
          setLoadingLocation(false);
          return;
        }

        const location = await Location.getCurrentPositionAsync({});
        const { latitude, longitude } = location.coords;

        const [address] = await Location.reverseGeocodeAsync({ latitude, longitude });
        
        if (address.city || address.postalCode) {
          const cityName = address.postalCode || address.city || '';
          setCity(cityName);
          Alert.alert('Localisation trouvée', `Votre position: ${cityName}`);
        } else {
          Alert.alert('Erreur', 'Impossible de déterminer votre ville.');
        }
        setLoadingLocation(false);
      }
    } catch (error) {
      Alert.alert('Erreur', 'Impossible d\'obtenir votre position.');
      setLoadingLocation(false);
    }
  };

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

    setTimeout(() => {
      setJustSaved(false);
    }, 1500);
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardView}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.scrollView}>
        <View style={styles.container}>
          <View style={styles.card}>
            <View style={styles.header}>
              <Feather name="map-pin" size={20} color="#2C3E50" />
              <Text style={styles.title}>Profil</Text>
            </View>
            {/* Geolocation button */}
            <TouchableOpacity
              style={styles.locationButton}
              onPress={handleUseLocation}
              disabled={loadingLocation}
            >
              {loadingLocation ? (
                <ActivityIndicator color="#3A82F7" />
              ) : (
                <>
                  <Feather name="navigation" size={20} color="#3A82F7" />
                  <Text style={styles.locationButtonText}>Utiliser ma position</Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={styles.orText}>ou</Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Saisir manuellement</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex : Paris ou 75001"
                value={city}
                onChangeText={setCity}
              />
            </View>
            <TouchableOpacity
              style={[styles.button, justSaved && styles.buttonSuccess, (saving || justSaved) && styles.buttonDisabled]}
              onPress={handleSave}
              disabled={saving || justSaved}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>{justSaved ? '✓ Enregistré !' : 'Enregistrer'}</Text>
              )}
            </TouchableOpacity>
            {justSaved ? (
              <View style={styles.successBox}>
                <Feather name="check-circle" size={20} color="#4CAF50" />
                <View style={styles.successTextContainer}>
                  <Text style={styles.successTitle}>Ville enregistrée !</Text>
              <Text style={styles.successSubtitle}>Retour à l'accueil pour voir la météo...</Text>
                </View>
              </View>
            ) : (
              <Text style={styles.hint}>
                Cette information est utilisée pour les appels météo dans l'écran d'accueil.
              </Text>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.title}>Profil</Text>
            <Text style={styles.text}>
              Autres paramètres du profil seront ajoutés dans les prochains milestones.
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  container: {
    padding: 20,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E9EEF2',
    marginBottom: 24,
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
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EBF5FF',
    borderRadius: 9,
    height: 44,
    marginBottom: 16,
    gap: 8,
  },
  locationButtonText: {
    color: '#3A82F7',
    fontSize: 16,
    fontWeight: '600',
  },
  webNote: {
    fontSize: 12,
    color: '#F7A45A',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  orText: {
    textAlign: 'center',
    color: '#6E7A84',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 16,
  },
  formGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 16,
    color: '#2C3E50',
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F5F7FA',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E9EEF2',
    padding: 12,
    fontSize: 16,
    height: 44,
  },
  button: {
    backgroundColor: '#3A82F7',
    borderRadius: 9,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonSuccess: {
    backgroundColor: '#4CAF50',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  successTextContainer: {
    marginLeft: 8,
    flex: 1,
  },
  successTitle: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
  },
  successSubtitle: {
    fontSize: 13,
    color: '#2E7D32',
    fontWeight: '400',
  },
  hint: {
    fontSize: 13,
    color: '#6E7A84',
    fontWeight: '400',
    marginTop: 8,
  },
  text: {
    fontSize: 16,
    color: '#6E7A84',
    fontWeight: '400',
  },
});
