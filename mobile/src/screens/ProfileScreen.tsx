import React, { useState, useEffect } from 'react';
import { Alert, Platform, View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, ActivityIndicator, StyleSheet } from 'react-native';
import * as Location from 'expo-location';
import { Feather } from '@expo/vector-icons';
import { getStoredCity, setStoredCity, getStoredWeatherCity, setStoredWeatherCity, getStoredCoordinates, setStoredCoordinates, getCachedLocation, setCachedLocation } from '../utils/storage';
import { reverseGeocode, geolocateByIP, getProfile, addChild, updateChild, deleteChild, updateSpouse, deleteSpouse, updateMarriageDate, deleteMarriageDate, type Child, type Profile } from '../api/client';
import { AppEvents, EVENTS } from '../utils/events';

// Cross-platform confirm dialog
const confirmDialog = (message: string): boolean => {
  if (Platform.OS === 'web') {
    return window.confirm(message);
  }
  // For native, we'll use Alert.alert with Promise (handled inline in handlers)
  return false;
};

// Conditionally import DateTimePicker only for mobile
let DateTimePicker: any = null;
if (Platform.OS !== 'web') {
  DateTimePicker = require('@react-native-community/datetimepicker').default;
}

export default function ProfileScreen() {
  // City state
  const [city, setCity] = useState('');
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [locationPermissionAsked, setLocationPermissionAsked] = useState(false);
  const [locationSuccess, setLocationSuccess] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Profile state
  const [profile, setProfile] = useState<Profile>({ children: [] });
  const [loadingProfile, setLoadingProfile] = useState(false);

  // Section collapse state
  const [cityExpanded, setCityExpanded] = useState(true);
  const [childrenExpanded, setChildrenExpanded] = useState(false);
  const [spouseExpanded, setSpouseExpanded] = useState(false);
  const [marriageExpanded, setMarriageExpanded] = useState(false);

  // Child form state
  const [childFirstName, setChildFirstName] = useState('');
  const [childBirthDate, setChildBirthDate] = useState(new Date());
  const [childHeight, setChildHeight] = useState('');
  const [childWeight, setChildWeight] = useState('');
  const [childNotes, setChildNotes] = useState('');
  const [showChildDatePicker, setShowChildDatePicker] = useState(false);
  const [addingChild, setAddingChild] = useState(false);
  const [expandedChildId, setExpandedChildId] = useState<string | null>(null);
  const [editingChildId, setEditingChildId] = useState<string | null>(null);
  const [editChildFirstName, setEditChildFirstName] = useState('');
  const [editChildBirthDate, setEditChildBirthDate] = useState(new Date());
  const [editChildHeight, setEditChildHeight] = useState('');
  const [editChildWeight, setEditChildWeight] = useState('');
  const [editChildNotes, setEditChildNotes] = useState('');
  const [showEditChildDatePicker, setShowEditChildDatePicker] = useState(false);
  const [updatingChild, setUpdatingChild] = useState(false);
  const [childFormError, setChildFormError] = useState<string | null>(null);

  // Spouse form state
  const [spouseFirstName, setSpouseFirstName] = useState('');
  const [spouseBirthDate, setSpouseBirthDate] = useState(new Date());
  const [showSpouseDatePicker, setShowSpouseDatePicker] = useState(false);
  const [savingSpouse, setSavingSpouse] = useState(false);
  const [editingSpouse, setEditingSpouse] = useState(false);

  // Marriage date state
  const [marriageDate, setMarriageDate] = useState(new Date());
  const [showMarriageDatePicker, setShowMarriageDatePicker] = useState(false);
  const [savingMarriageDate, setSavingMarriageDate] = useState(false);
  const [editingMarriageDate, setEditingMarriageDate] = useState(false);

  useEffect(() => {
    getStoredCity().then((storedCity) => {
      if (storedCity) setCity(storedCity);
    });
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoadingProfile(true);
    try {
      const data = await getProfile();
      console.log('[ProfileScreen] Loaded profile data:', JSON.stringify(data, null, 2));
      setProfile(data);
      if (data.spouse) {
        console.log('[ProfileScreen] Spouse found:', data.spouse);
        console.log('[ProfileScreen] Spouse birthDate:', data.spouse.birthDate);
        setSpouseFirstName(data.spouse.firstName);
        if (data.spouse.birthDate) {
          const parsedDate = new Date(data.spouse.birthDate);
          console.log('[ProfileScreen] Setting spouse birthdate to:', parsedDate.toISOString());
          setSpouseBirthDate(parsedDate);
        } else {
          console.log('[ProfileScreen] No spouse birthDate in data');
        }
      }
      if (data.marriageDate) setMarriageDate(new Date(data.marriageDate));
    } catch (error) {
      console.error('Failed to load profile:', error);
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleUseLocation = async () => {
    console.log('[Geolocation] Button clicked');
    setLoadingLocation(true);
    setLocationSuccess(null);
    setLocationError(null);

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

        // If Permissions API is available, proactively check state
        try {
          // @ts-ignore Safari may not support permissions API
          const perm = (navigator as any).permissions?.query ? await (navigator as any).permissions.query({ name: 'geolocation' }) : null;
          console.log('[Geolocation] Permission state:', perm?.state);
        } catch {}

        navigator.geolocation.getCurrentPosition(
          async (position) => {
            console.log('[Geolocation] Position obtained:', position.coords.latitude, position.coords.longitude);
            const { latitude, longitude } = position.coords;
            
            // Check cache first to avoid redundant API calls
            const cached = await getCachedLocation(latitude, longitude);
            if (cached) {
              console.log('[Geolocation] Using cached location:', cached.city);
              setCity(cached.city);
              await setStoredCity(cached.city);
              await setStoredWeatherCity(cached.weatherCity);
              await setStoredCoordinates(latitude, longitude);
              console.log('[Profile] Dispatching CITY_UPDATED event');
              AppEvents.dispatchEvent(new Event(EVENTS.CITY_UPDATED));
              setLocationSuccess(`Position enregistrée : ${cached.city}`);
              setTimeout(() => setLocationSuccess(null), 4000);
              setLoadingLocation(false);
              return;
            }
            
            // Use backend proxy for reverse geocoding to avoid CORS
            try {
              console.log('[Geolocation] Fetching address from backend...');
              const data = await reverseGeocode(latitude, longitude);
              console.log('[Geolocation] Backend response:', data);
              
              if (data.city) {
                console.log('[Geolocation] City found:', data.city);
                setCity(data.city);
                // Auto-save both display city, weather city, and coordinates
                await setStoredCity(data.city);
                await setStoredWeatherCity(data.weatherCity);
                await setStoredCoordinates(latitude, longitude);
                // Cache the location
                await setCachedLocation(data.city, data.weatherCity, latitude, longitude);
                console.log('[Profile] Dispatching CITY_UPDATED event');
                AppEvents.dispatchEvent(new Event(EVENTS.CITY_UPDATED));
                setLocationSuccess(`Position enregistrée : ${data.city}`);
                // Clear success message after 4 seconds
                setTimeout(() => setLocationSuccess(null), 4000);
              } else {
                console.warn('[Geolocation] No city name in response');
                setLocationError('Impossible de déterminer votre ville.');
              }
            } catch (error) {
              console.error('[Geolocation] Reverse geocoding error:', error);
              setLocationError('Erreur lors de la récupération de l\'adresse. Vérifiez votre connexion.');
            }
            setLoadingLocation(false);
          },
          async (error) => {
            console.error('[Geolocation] Browser error:', error.code, error.message);
            setLocationPermissionAsked(true);
            
            let message = 'Impossible d\'obtenir votre position.';
            if (error.code === error.PERMISSION_DENIED) {
              message = 'La géolocalisation a été refusée. Vous pouvez saisir votre ville manuellement.';
            } else if (error.code === error.POSITION_UNAVAILABLE) {
              message = 'Position non disponible. Vérifiez vos paramètres de localisation.';
            } else if (error.code === error.TIMEOUT) {
              message = 'La demande de localisation a expiré. Réessayez.';
            }
            setLocationError(message);
            setLoadingLocation(false);
          },
          {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 30000, // Safari requires non-zero value (30s cache acceptable)
          }
        );
      } else {
        // Use expo-location for mobile GPS
        console.log('[Geolocation] Running on mobile platform');
        const { status } = await Location.requestForegroundPermissionsAsync();
        console.log('[Geolocation] Permission status:', status);
        setLocationPermissionAsked(true);

        if (status !== 'granted') {
          console.error('[Geolocation] Permission denied');
          setLocationError('La géolocalisation a été refusée. Vous pouvez saisir votre ville manuellement.');
          setLoadingLocation(false);
          return;
        }

        console.log('[Geolocation] Getting current position...');
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        const { latitude, longitude } = location.coords;
        console.log('[Geolocation] Position obtained:', latitude, longitude);

        // Check cache first to avoid redundant API calls
        const cached = await getCachedLocation(latitude, longitude);
        if (cached) {
          console.log('[Geolocation] Using cached location:', cached.city);
          setCity(cached.city);
          await setStoredCity(cached.city);
          await setStoredWeatherCity(cached.weatherCity);
          await setStoredCoordinates(latitude, longitude);
          console.log('[Profile] Dispatching CITY_UPDATED event');
          AppEvents.dispatchEvent(new Event(EVENTS.CITY_UPDATED));
          setLocationSuccess(`Position enregistrée : ${cached.city}`);
          setTimeout(() => setLocationSuccess(null), 4000);
          setLoadingLocation(false);
          return;
        }

        // Use backend proxy for reverse geocoding (same as web)
        try {
          console.log('[Geolocation] Fetching address from backend...');
          const data = await reverseGeocode(latitude, longitude);
          console.log('[Geolocation] Backend response:', data);
          
          if (data.city) {
            console.log('[Geolocation] City found:', data.city);
            setCity(data.city);
            await setStoredCity(data.city);
            await setStoredWeatherCity(data.weatherCity);
            await setStoredCoordinates(latitude, longitude);
            await setCachedLocation(data.city, data.weatherCity, latitude, longitude);
            console.log('[Profile] Dispatching CITY_UPDATED event');
            AppEvents.dispatchEvent(new Event(EVENTS.CITY_UPDATED));
            setLocationSuccess(`Position enregistrée : ${data.city}`);
            setTimeout(() => setLocationSuccess(null), 4000);
          } else {
            console.warn('[Geolocation] No city in backend response');
            setLocationError('Impossible de déterminer votre ville.');
          }
        } catch (error) {
          console.error('[Geolocation] Backend geocoding error:', error);
          setLocationError('Impossible de récupérer l\'adresse.');
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

  // Child handlers
  const handleAddChild = async () => {
    setChildFormError(null);
    
    // Validation
    if (!childFirstName.trim()) {
      setChildFormError('Le prénom de l\'enfant est requis.');
      return;
    }
    
    if (profile.children.length >= 5) {
      setChildFormError('Vous ne pouvez ajouter que 5 enfants maximum.');
      return;
    }
    
    // Validate height if provided
    if (childHeight && (isNaN(parseFloat(childHeight)) || parseFloat(childHeight) <= 0)) {
      setChildFormError('La taille doit être un nombre valide.');
      return;
    }
    
    // Validate weight if provided
    if (childWeight && (isNaN(parseFloat(childWeight)) || parseFloat(childWeight) <= 0)) {
      setChildFormError('Le poids doit être un nombre valide.');
      return;
    }

    setAddingChild(true);
    try {
      const childData: any = {
        firstName: childFirstName.trim(),
        birthDate: childBirthDate.toISOString(),
      };
      if (childHeight) childData.height = parseFloat(childHeight);
      if (childWeight) childData.weight = parseFloat(childWeight);
      if (childNotes.trim()) childData.notes = childNotes.trim();
      
      await addChild(childData);
      setChildFirstName('');
      setChildBirthDate(new Date());
      setChildHeight('');
      setChildWeight('');
      setChildNotes('');
      setChildFormError(null);
      await loadProfile();
    } catch (error) {
      setChildFormError('Impossible d\'ajouter l\'enfant. Veuillez réessayer.');
    } finally {
      setAddingChild(false);
    }
  };

  const handleEditChild = (child: Child) => {
    setEditingChildId(child.id);
    setEditChildFirstName(child.firstName);
    setEditChildBirthDate(new Date(child.birthDate));
    setEditChildHeight(child.height?.toString() || '');
    setEditChildWeight(child.weight?.toString() || '');
    setEditChildNotes(child.notes || '');
    setExpandedChildId(null); // Close expand view
  };

  const handleCancelEditChild = () => {
    setEditingChildId(null);
    setEditChildFirstName('');
    setEditChildBirthDate(new Date());
    setEditChildHeight('');
    setEditChildWeight('');
    setEditChildNotes('');
    setChildFormError(null);
  };

  const handleUpdateChild = async (childId: string) => {
    setChildFormError(null);
    
    // Validation
    if (!editChildFirstName.trim()) {
      setChildFormError('Le prénom de l\'enfant est requis.');
      return;
    }
    
    if (editChildHeight && (isNaN(parseFloat(editChildHeight)) || parseFloat(editChildHeight) <= 0)) {
      setChildFormError('La taille doit être un nombre valide.');
      return;
    }
    
    if (editChildWeight && (isNaN(parseFloat(editChildWeight)) || parseFloat(editChildWeight) <= 0)) {
      setChildFormError('Le poids doit être un nombre valide.');
      return;
    }

    setUpdatingChild(true);
    try {
      const updates: any = {
        firstName: editChildFirstName.trim(),
        birthDate: editChildBirthDate.toISOString(),
      };
      if (editChildHeight) updates.height = parseFloat(editChildHeight);
      if (editChildWeight) updates.weight = parseFloat(editChildWeight);
      updates.notes = editChildNotes.trim() || undefined;
      
      await updateChild(childId, updates);
      handleCancelEditChild();
      await loadProfile();
    } catch (error) {
      setChildFormError('Impossible de mettre à jour l\'enfant. Veuillez réessayer.');
    } finally {
      setUpdatingChild(false);
    }
  };

  const handleDeleteChild = async (childId: string) => {
    if (Platform.OS === 'web') {
      if (confirmDialog('Êtes-vous sûr de vouloir supprimer cet enfant ?')) {
        try {
          await deleteChild(childId);
          await loadProfile();
        } catch (error) {
          alert('Impossible de supprimer l\'enfant.');
        }
      }
    } else {
      Alert.alert('Supprimer', 'Êtes-vous sûr de vouloir supprimer cet enfant ?', [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteChild(childId);
              await loadProfile();
            } catch (error) {
              Alert.alert('Erreur', 'Impossible de supprimer l\'enfant.');
            }
          },
        },
      ]);
    }
  };

  // Spouse handlers
  const handleSaveSpouse = async () => {
    if (!spouseFirstName.trim()) {
      if (Platform.OS === 'web') {
        alert('Le prénom est requis.');
      } else {
        Alert.alert('Erreur', 'Le prénom est requis.');
      }
      return;
    }

    setSavingSpouse(true);
    try {
      const spouseData: any = { firstName: spouseFirstName.trim() };
      if (spouseBirthDate) spouseData.birthDate = spouseBirthDate.toISOString();
      await updateSpouse(spouseData);
      setEditingSpouse(false);
      await loadProfile();
    } catch (error) {
      if (Platform.OS === 'web') {
        alert('Impossible de mettre à jour le conjoint.');
      } else {
        Alert.alert('Erreur', 'Impossible de mettre à jour le conjoint.');
      }
    } finally {
      setSavingSpouse(false);
    }
  };

  const handleEditSpouse = () => {
    if (profile.spouse) {
      console.log('[ProfileScreen] handleEditSpouse - profile.spouse:', profile.spouse);
      console.log('[ProfileScreen] handleEditSpouse - birthDate:', profile.spouse.birthDate);
      setEditingSpouse(true);
      setSpouseFirstName(profile.spouse.firstName);
      const dateToSet = profile.spouse.birthDate ? new Date(profile.spouse.birthDate) : new Date();
      console.log('[ProfileScreen] handleEditSpouse - setting birthdate to:', dateToSet.toISOString());
      setSpouseBirthDate(dateToSet);
    }
  };

  const handleCancelEditSpouse = () => {
    setEditingSpouse(false);
    if (profile.spouse) {
      setSpouseFirstName(profile.spouse.firstName);
      setSpouseBirthDate(profile.spouse.birthDate ? new Date(profile.spouse.birthDate) : new Date());
    }
  };

  const handleDeleteSpouse = async () => {
    if (Platform.OS === 'web') {
      if (confirmDialog('Êtes-vous sûr de vouloir supprimer le conjoint ?')) {
        try {
          await deleteSpouse();
          setSpouseFirstName('');
          setSpouseBirthDate(new Date());
          setEditingSpouse(false);
          await loadProfile();
        } catch (error) {
          alert('Impossible de supprimer le conjoint.');
        }
      }
    } else {
      Alert.alert('Supprimer', 'Êtes-vous sûr de vouloir supprimer le conjoint ?', [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
            await deleteSpouse();
            setSpouseFirstName('');
            setSpouseBirthDate(new Date());
            setEditingSpouse(false);
            await loadProfile();
            } catch (error) {
              Alert.alert('Erreur', 'Impossible de supprimer le conjoint.');
            }
          },
        },
      ]);
    }
  };

  // Marriage date handlers
  const handleSaveMarriageDate = async () => {
    setSavingMarriageDate(true);
    try {
      await updateMarriageDate(marriageDate.toISOString());
      setEditingMarriageDate(false);
      await loadProfile();
    } catch (error) {
      if (Platform.OS === 'web') {
        alert('Impossible de mettre à jour la date de mariage.');
      } else {
        Alert.alert('Erreur', 'Impossible de mettre à jour la date de mariage.');
      }
    } finally {
      setSavingMarriageDate(false);
    }
  };

  const handleEditMarriageDate = () => {
    if (profile.marriageDate) {
      setEditingMarriageDate(true);
      setMarriageDate(new Date(profile.marriageDate));
    }
  };

  const handleCancelEditMarriageDate = () => {
    setEditingMarriageDate(false);
    if (profile.marriageDate) {
      setMarriageDate(new Date(profile.marriageDate));
    }
  };

  const handleDeleteMarriageDate = async () => {
    if (Platform.OS === 'web') {
      if (confirmDialog('Êtes-vous sûr de vouloir supprimer la date de mariage ?')) {
        try {
          await deleteMarriageDate();
          setMarriageDate(new Date());
          setEditingMarriageDate(false);
          await loadProfile();
        } catch (error) {
          alert('Impossible de supprimer la date de mariage.');
        }
      }
    } else {
      Alert.alert('Supprimer', 'Êtes-vous sûr de vouloir supprimer la date de mariage ?', [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMarriageDate();
              setMarriageDate(new Date());
              setEditingMarriageDate(false);
              await loadProfile();
            } catch (error) {
              Alert.alert('Erreur', 'Impossible de supprimer la date de mariage.');
            }
          },
        },
      ]);
    }
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

            {locationSuccess && (
              <View style={styles.locationSuccessBox}>
                <Feather name="check-circle" size={16} color="#4CAF50" />
                <Text style={styles.locationSuccessText}>{locationSuccess}</Text>
              </View>
            )}

            {locationError && (
              <View style={styles.locationErrorBox}>
                <Feather name="alert-circle" size={16} color="#DC2626" />
                <Text style={styles.locationErrorText}>{locationError}</Text>
              </View>
            )}

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

          {/* Children Section */}
          <View style={styles.card}>
            <TouchableOpacity style={styles.sectionHeader} onPress={() => setChildrenExpanded(!childrenExpanded)}>
              <View style={styles.sectionHeaderLeft}>
                <Feather name="users" size={20} color="#2C3E50" />
                <Text style={styles.sectionTitle}>Enfants ({profile.children.length}/5)</Text>
              </View>
              <Feather name={childrenExpanded ? 'chevron-up' : 'chevron-down'} size={20} color="#6E7A84" />
            </TouchableOpacity>

            {childrenExpanded && (
              <View>
                {profile.children.map((child) => {
                  const age = Math.floor((Date.now() - new Date(child.birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
                  const isExpanded = expandedChildId === child.id;
                  const isEditing = editingChildId === child.id;
                  
                  if (isEditing) {
                    // Show edit form for this child
                    return (
                      <View key={child.id} style={styles.addChildForm}>
                        <Text style={styles.formLabel}>Éditer {child.firstName}</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="Prénom *"
                          value={editChildFirstName}
                          onChangeText={setEditChildFirstName}
                          placeholderTextColor="#9CA3AF"
                        />
                        {Platform.OS === 'web' ? (
                          <input
                            type="date"
                            style={{
                              borderWidth: 1,
                              borderColor: '#E9EEF2',
                              borderRadius: 10,
                              paddingLeft: 14,
                              paddingRight: 14,
                              paddingTop: 12,
                              paddingBottom: 12,
                              fontSize: 16,
                              color: '#2C3E50',
                              backgroundColor: '#F5F7FA',
                              width: '100%',
                              fontFamily: 'system-ui',
                            }}
                            value={editChildBirthDate.toISOString().split('T')[0]}
                            onChange={(e: any) => {
                              const value = e.target.value;
                              if (value) {
                                const d = new Date(value);
                                if (!isNaN(d.getTime())) setEditChildBirthDate(d);
                              }
                            }}
                          />
                        ) : (
                          <>
                            <TouchableOpacity
                              style={styles.dateButton}
                              onPress={() => setShowEditChildDatePicker(true)}
                            >
                              <Feather name="calendar" size={18} color="#2C3E50" />
                              <Text style={styles.dateButtonText}>
                                {editChildBirthDate.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                              </Text>
                            </TouchableOpacity>
                            {showEditChildDatePicker && DateTimePicker && (
                              <DateTimePicker
                                value={editChildBirthDate}
                                mode="date"
                                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                onChange={(event: any, selectedDate?: Date) => {
                                  setShowEditChildDatePicker(Platform.OS === 'ios');
                                  if (selectedDate) setEditChildBirthDate(selectedDate);
                                }}
                              />
                            )}
                          </>
                        )}
                        <View style={{ marginTop: 12 }}>
                          <Text style={styles.optionalLabel}>Informations optionnelles</Text>
                          <TextInput
                            style={styles.input}
                            placeholder="Taille (cm)"
                            value={editChildHeight}
                            onChangeText={setEditChildHeight}
                            keyboardType="numeric"
                            placeholderTextColor="#9CA3AF"
                          />
                          <TextInput
                            style={[styles.input, { marginTop: 8 }]}
                            placeholder="Poids (kg)"
                            value={editChildWeight}
                            onChangeText={setEditChildWeight}
                            keyboardType="numeric"
                            placeholderTextColor="#9CA3AF"
                          />
                          <TextInput
                            style={[styles.input, styles.textArea, { marginTop: 8 }]}
                            placeholder="Notes"
                            value={editChildNotes}
                            onChangeText={setEditChildNotes}
                            multiline
                            numberOfLines={3}
                            placeholderTextColor="#9CA3AF"
                          />
                        </View>
                        
                        {childFormError && (
                          <View style={styles.errorBox}>
                            <Feather name="alert-circle" size={16} color="#DC2626" />
                            <Text style={styles.errorText}>{childFormError}</Text>
                          </View>
                        )}
                        
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                          <TouchableOpacity
                            style={[styles.button, updatingChild && styles.buttonDisabled, { flex: 1 }]}
                            onPress={() => handleUpdateChild(child.id)}
                            disabled={updatingChild}
                          >
                            {updatingChild ? (
                              <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                              <Text style={styles.buttonText}>Enregistrer</Text>
                            )}
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.button, { flex: 1, backgroundColor: '#6E7A84' }]}
                            onPress={handleCancelEditChild}
                          >
                            <Text style={styles.buttonText}>Annuler</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  }
                  
                  return (
                    <View key={child.id}>
                      <TouchableOpacity 
                        style={styles.childItem}
                        onPress={() => setExpandedChildId(isExpanded ? null : child.id)}
                      >
                        <View style={styles.childInfo}>
                          <Text style={styles.childName}>{child.firstName}</Text>
                          <Text style={styles.childAge}>
                            {age} ans · Né(e) le {new Date(child.birthDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                          <Feather name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color="#6E7A84" />
                          <TouchableOpacity onPress={(e) => { e.stopPropagation(); handleEditChild(child); }}>
                            <Feather name="edit-2" size={18} color="#3A82F7" />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={(e) => { e.stopPropagation(); handleDeleteChild(child.id); }}>
                            <Feather name="trash-2" size={18} color="#DC2626" />
                          </TouchableOpacity>
                        </View>
                      </TouchableOpacity>
                      {isExpanded && (
                        <View style={styles.childDetails}>
                          {child.height && (
                            <Text style={styles.childDetailText}>Taille : {child.height} cm</Text>
                          )}
                          {child.weight && (
                            <Text style={styles.childDetailText}>Poids : {child.weight} kg</Text>
                          )}
                          {child.notes && (
                            <Text style={styles.childDetailText}>Notes : {child.notes}</Text>
                          )}
                          {!child.height && !child.weight && !child.notes && (
                            <Text style={styles.childDetailText}>Aucun détail supplémentaire</Text>
                          )}
                        </View>
                      )}
                    </View>
                  );
                })}

                {profile.children.length < 5 && (
                  <View style={styles.addChildForm}>
                    <Text style={styles.formLabel}>Ajouter un enfant</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Prénom *"
                      value={childFirstName}
                      onChangeText={setChildFirstName}
                      placeholderTextColor="#9CA3AF"
                    />
{Platform.OS === 'web' ? (
                      <input
                        type="date"
                        style={{
                          borderWidth: 1,
                          borderColor: '#E9EEF2',
                          borderRadius: 10,
                          paddingLeft: 14,
                          paddingRight: 14,
                          paddingTop: 12,
                          paddingBottom: 12,
                          fontSize: 16,
                          color: '#2C3E50',
                          backgroundColor: '#F5F7FA',
                          width: '100%',
                          fontFamily: 'system-ui',
                        }}
                        value={childBirthDate.toISOString().split('T')[0]}
                        onChange={(e: any) => {
                          const value = e.target.value;
                          if (value) {
                            const d = new Date(value);
                            if (!isNaN(d.getTime())) setChildBirthDate(d);
                          }
                        }}
                      />
                    ) : (
                      <>
                        <TouchableOpacity
                          style={styles.dateButton}
                          onPress={() => setShowChildDatePicker(true)}
                        >
                          <Feather name="calendar" size={18} color="#2C3E50" />
                          <Text style={styles.dateButtonText}>
                            {childBirthDate.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                          </Text>
                        </TouchableOpacity>
                        {showChildDatePicker && DateTimePicker && (
                          <DateTimePicker
                            value={childBirthDate}
                            mode="date"
                            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
onChange={(event: any, selectedDate?: Date) => {
                              setShowChildDatePicker(Platform.OS === 'ios');
                              if (selectedDate) setChildBirthDate(selectedDate);
                            }}
                          />
                        )}
                      </>
                    )}
                    <View style={{ marginTop: 12 }}>
                      <Text style={styles.optionalLabel}>Informations optionnelles</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Taille (cm)"
                        value={childHeight}
                        onChangeText={setChildHeight}
                        keyboardType="numeric"
                        placeholderTextColor="#9CA3AF"
                      />
                      <TextInput
                        style={[styles.input, { marginTop: 8 }]}
                        placeholder="Poids (kg)"
                        value={childWeight}
                        onChangeText={setChildWeight}
                        keyboardType="numeric"
                        placeholderTextColor="#9CA3AF"
                      />
                      <TextInput
                        style={[styles.input, styles.textArea, { marginTop: 8 }]}
                        placeholder="Notes"
                        value={childNotes}
                        onChangeText={setChildNotes}
                        multiline
                        numberOfLines={3}
                        placeholderTextColor="#9CA3AF"
                      />
                    </View>
                    
                    {childFormError && (
                      <View style={styles.errorBox}>
                        <Feather name="alert-circle" size={16} color="#DC2626" />
                        <Text style={styles.errorText}>{childFormError}</Text>
                      </View>
                    )}
                    
                    <TouchableOpacity
                      style={[styles.button, addingChild && styles.buttonDisabled, { marginTop: 12 }]}
                      onPress={handleAddChild}
                      disabled={addingChild}
                    >
                      {addingChild ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.buttonText}>Ajouter</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Spouse Section */}
          <View style={styles.card}>
            <TouchableOpacity style={styles.sectionHeader} onPress={() => setSpouseExpanded(!spouseExpanded)}>
              <View style={styles.sectionHeaderLeft}>
                <Feather name="heart" size={20} color="#2C3E50" />
                <Text style={styles.sectionTitle}>Conjoint(e)</Text>
              </View>
              <Feather name={spouseExpanded ? 'chevron-up' : 'chevron-down'} size={20} color="#6E7A84" />
            </TouchableOpacity>

            {spouseExpanded && (
              <View>
                {profile.spouse && !editingSpouse ? (
                  <View>
                    <View style={styles.spouseInfo}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.spouseName}>{profile.spouse.firstName}</Text>
                        {profile.spouse.birthDate && (
                          <Text style={styles.spouseBirthDate}>
                            Né(e) le {new Date(profile.spouse.birthDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                          </Text>
                        )}
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <TouchableOpacity onPress={handleEditSpouse}>
                          <Feather name="edit-2" size={18} color="#3A82F7" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleDeleteSpouse}>
                          <Feather name="trash-2" size={18} color="#DC2626" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ) : (
                  <View>
                    <Text style={styles.formLabel}>{editingSpouse ? 'Éditer le conjoint' : 'Informations du conjoint'}</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Prénom *"
                      value={spouseFirstName}
                      onChangeText={setSpouseFirstName}
                      placeholderTextColor="#9CA3AF"
                    />
{Platform.OS === 'web' ? (
                      <input
                        type="date"
                        style={{
                          borderWidth: 1,
                          borderColor: '#E9EEF2',
                          borderRadius: 10,
                          paddingLeft: 14,
                          paddingRight: 14,
                          paddingTop: 12,
                          paddingBottom: 12,
                          fontSize: 16,
                          color: '#2C3E50',
                          backgroundColor: '#F5F7FA',
                          width: '100%',
                          fontFamily: 'system-ui',
                          marginTop: 8,
                        }}
                        value={spouseBirthDate.toISOString().split('T')[0]}
                        onChange={(e: any) => {
                          console.log('[ProfileScreen] Spouse date input onChange fired');
                          const value = e.target.value;
                          console.log('[ProfileScreen] Input value:', value);
                          if (value) {
                            const d = new Date(value);
                            console.log('[ProfileScreen] Parsed date:', d.toISOString());
                            console.log('[ProfileScreen] Is valid?', !isNaN(d.getTime()));
                            if (!isNaN(d.getTime())) {
                              console.log('[ProfileScreen] Calling setSpouseBirthDate with:', d.toISOString());
                              setSpouseBirthDate(d);
                            }
                          }
                        }}
                      />
                    ) : (
                      <>
                        <TouchableOpacity
                          style={[styles.dateButton, { marginTop: 8 }]}
                          onPress={() => setShowSpouseDatePicker(true)}
                        >
                          <Feather name="calendar" size={18} color="#2C3E50" />
                          <Text style={styles.dateButtonText}>
                            {spouseBirthDate.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                          </Text>
                        </TouchableOpacity>
                        {showSpouseDatePicker && DateTimePicker && (
                          <DateTimePicker
                            value={spouseBirthDate}
                            mode="date"
                            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                            onChange={(event: any, selectedDate?: Date) => {
                              setShowSpouseDatePicker(Platform.OS === 'ios');
                              if (selectedDate) setSpouseBirthDate(selectedDate);
                            }}
                          />
                        )}
                      </>
                    )}
                    {editingSpouse ? (
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                        <TouchableOpacity
                          style={[styles.button, savingSpouse && styles.buttonDisabled, { flex: 1 }]}
                          onPress={handleSaveSpouse}
                          disabled={savingSpouse}
                        >
                          {savingSpouse ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <Text style={styles.buttonText}>Enregistrer</Text>
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.button, { flex: 1, backgroundColor: '#6E7A84' }]}
                          onPress={handleCancelEditSpouse}
                        >
                          <Text style={styles.buttonText}>Annuler</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={[styles.button, savingSpouse && styles.buttonDisabled, { marginTop: 12 }]}
                        onPress={handleSaveSpouse}
                        disabled={savingSpouse}
                      >
                        {savingSpouse ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Text style={styles.buttonText}>Enregistrer</Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Marriage Date Section */}
          <View style={styles.card}>
            <TouchableOpacity style={styles.sectionHeader} onPress={() => setMarriageExpanded(!marriageExpanded)}>
              <View style={styles.sectionHeaderLeft}>
                <Feather name="calendar" size={20} color="#2C3E50" />
                <Text style={styles.sectionTitle}>Date de mariage</Text>
              </View>
              <Feather name={marriageExpanded ? 'chevron-up' : 'chevron-down'} size={20} color="#6E7A84" />
            </TouchableOpacity>

            {marriageExpanded && (
              <View>
                {profile.marriageDate && !editingMarriageDate ? (
                  <View style={styles.marriageInfo}>
                    <Text style={styles.marriageDate}>
                      {new Date(profile.marriageDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <TouchableOpacity onPress={handleEditMarriageDate}>
                        <Feather name="edit-2" size={18} color="#3A82F7" />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={handleDeleteMarriageDate}>
                        <Feather name="trash-2" size={18} color="#DC2626" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View>
{Platform.OS === 'web' ? (
                      <input
                        type="date"
                        style={{
                          borderWidth: 1,
                          borderColor: '#E9EEF2',
                          borderRadius: 10,
                          paddingLeft: 14,
                          paddingRight: 14,
                          paddingTop: 12,
                          paddingBottom: 12,
                          fontSize: 16,
                          color: '#2C3E50',
                          backgroundColor: '#F5F7FA',
                          width: '100%',
                          fontFamily: 'system-ui',
                        }}
                        value={marriageDate.toISOString().split('T')[0]}
                        onChange={(e: any) => {
                          const value = e.target.value;
                          if (value) {
                            const d = new Date(value);
                            if (!isNaN(d.getTime())) setMarriageDate(d);
                          }
                        }}
                      />
                    ) : (
                      <>
                        <TouchableOpacity
                          style={styles.dateButton}
                          onPress={() => setShowMarriageDatePicker(true)}
                        >
                          <Feather name="calendar" size={18} color="#2C3E50" />
                          <Text style={styles.dateButtonText}>
                            {marriageDate.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                          </Text>
                        </TouchableOpacity>
                        {showMarriageDatePicker && DateTimePicker && (
                          <DateTimePicker
                            value={marriageDate}
                            mode="date"
                            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
onChange={(event: any, selectedDate?: Date) => {
                              setShowMarriageDatePicker(Platform.OS === 'ios');
                              if (selectedDate) setMarriageDate(selectedDate);
                            }}
                          />
                        )}
                      </>
                    )}
                    {editingMarriageDate ? (
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                        <TouchableOpacity
                          style={[styles.button, savingMarriageDate && styles.buttonDisabled, { flex: 1 }]}
                          onPress={handleSaveMarriageDate}
                          disabled={savingMarriageDate}
                        >
                          {savingMarriageDate ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <Text style={styles.buttonText}>Enregistrer</Text>
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.button, { flex: 1, backgroundColor: '#6E7A84' }]}
                          onPress={handleCancelEditMarriageDate}
                        >
                          <Text style={styles.buttonText}>Annuler</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={[styles.button, savingMarriageDate && styles.buttonDisabled, { marginTop: 12 }]}
                        onPress={handleSaveMarriageDate}
                        disabled={savingMarriageDate}
                      >
                        {savingMarriageDate ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Text style={styles.buttonText}>Enregistrer</Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            )}
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
  locationSuccessBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  locationSuccessText: {
    fontSize: 14,
    color: '#2E7D32',
    fontWeight: '500',
    flex: 1,
  },
  locationErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  locationErrorText: {
    fontSize: 14,
    color: '#DC2626',
    fontWeight: '500',
    flex: 1,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#DC2626',
    fontWeight: '500',
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 19,
    color: '#2C3E50',
    fontWeight: '600',
    marginLeft: 8,
  },
  childItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E9EEF2',
  },
  childInfo: {
    flex: 1,
  },
  childName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2C3E50',
    marginBottom: 4,
  },
  childAge: {
    fontSize: 14,
    color: '#6E7A84',
  },
  addChildForm: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E9EEF2',
  },
  formLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#2C3E50',
    marginBottom: 12,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E9EEF2',
    borderRadius: 9,
    padding: 12,
    backgroundColor: '#F5F7FA',
    marginTop: 12,
    marginBottom: 12,
  },
  dateButtonText: {
    fontSize: 16,
    color: '#2C3E50',
    marginLeft: 8,
  },
  spouseInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  spouseName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2C3E50',
  },
  marriageInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  marriageDate: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2C3E50',
  },
  childDetails: {
    padding: 12,
    backgroundColor: '#F5F7FA',
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  childDetailText: {
    fontSize: 14,
    color: '#6E7A84',
    marginBottom: 4,
  },
  optionalLabel: {
    fontSize: 14,
    color: '#6E7A84',
    fontWeight: '500',
    marginBottom: 8,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  spouseBirthDate: {
    fontSize: 14,
    color: '#6E7A84',
    marginTop: 4,
  },
});
