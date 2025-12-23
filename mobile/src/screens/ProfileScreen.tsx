import React, { useState, useEffect } from 'react';
import { Alert, Platform, View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, ActivityIndicator, StyleSheet, Switch } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import { Feather } from '@expo/vector-icons';
import {
  getStoredCity,
  setStoredCity,
  getStoredWeatherCity,
  setStoredWeatherCity,
  getStoredCoordinates,
  setStoredCoordinates,
  getCachedLocation,
  setCachedLocation,
  getMorningNotificationEnabled,
  getJ1NotificationEnabled,
  getEveningNotificationEnabled,
  getOverdueNotificationEnabled,
  getSmartNotificationsEnabled,
  setMorningNotificationEnabled,
  setJ1NotificationEnabled,
  setEveningNotificationEnabled,
  setOverdueNotificationEnabled,
  setSmartNotificationsEnabled,
  setNotificationPermissionStatus,
  getNotificationPermissionStatus,
} from '../utils/storage';
import { reverseGeocode, geolocateByIP, getProfile, addChild, updateChild, deleteChild, updateSpouse, deleteSpouse, updateMarriageDate, deleteMarriageDate, updateProfileAddress, type Child, type Profile } from '../api/client';
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

  // Section collapse state - 5 main sections
  const [familleExpanded, setFamilleExpanded] = useState(true);
  const [situationExpanded, setSituationExpanded] = useState(false);
  const [assistantExpanded, setAssistantExpanded] = useState(false);
  const [notificationsExpanded, setNotificationsExpanded] = useState(false);
  const [donneesExpanded, setDonneesExpanded] = useState(false);
  
  // Legacy sub-section states (for forms within sections)
  const [childrenExpanded, setChildrenExpanded] = useState(true);
  const [spouseExpanded, setSpouseExpanded] = useState(true);
  const [marriageExpanded, setMarriageExpanded] = useState(true);
  const [addressExpanded, setAddressExpanded] = useState(true);
  const [locationExpanded, setLocationExpanded] = useState(true);

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

  // Address state (Milestone 5)
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [address, setAddress] = useState('');
  const [addressPostalCode, setAddressPostalCode] = useState('');
  const [addressCity, setAddressCity] = useState('');
  const [savingAddress, setSavingAddress] = useState(false);
  const [addressJustSaved, setAddressJustSaved] = useState(false);

  // Notification toggles
  const [notifMorning, setNotifMorning] = useState(true);
  const [notifJ1, setNotifJ1] = useState(true);
  const [notifEvening, setNotifEvening] = useState(true);
  const [notifOverdue, setNotifOverdue] = useState(true);
  const [notifSmart, setNotifSmart] = useState(true);
  const [notifPermission, setNotifPermission] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');

  useEffect(() => {
    getStoredCity().then((storedCity) => {
      if (storedCity) setCity(storedCity);
    });
    loadProfile();
    loadNotificationPrefs();
  }, []);

  const loadNotificationPrefs = async () => {
    const [m, j1, ev, od, smart, perm] = await Promise.all([
      getMorningNotificationEnabled(),
      getJ1NotificationEnabled(),
      getEveningNotificationEnabled(),
      getOverdueNotificationEnabled(),
      getSmartNotificationsEnabled(),
      getNotificationPermissionStatus(),
    ]);
    setNotifMorning(m);
    setNotifJ1(j1);
    setNotifEvening(ev);
    setNotifOverdue(od);
    setNotifSmart(smart);
    setNotifPermission(perm?.status ?? 'undetermined');
  };

  const loadProfile = async () => {
    setLoadingProfile(true);
    try {
      const data = await getProfile();
      setProfile(data);
      if (data.spouse) {
        setSpouseFirstName(data.spouse.firstName);
        if (data.spouse.birthDate) setSpouseBirthDate(new Date(data.spouse.birthDate));
      }
      if (data.marriageDate) setMarriageDate(new Date(data.marriageDate));
      // Load address fields
      if (data.firstName) setFirstName(data.firstName);
      if (data.lastName) setLastName(data.lastName);
      if (data.address) setAddress(data.address);
      if (data.postalCode) setAddressPostalCode(data.postalCode);
      if (data.city) setAddressCity(data.city);
    } catch (error) {
      console.error('Failed to load profile:', error);
    } finally {
      setLoadingProfile(false);
      AppEvents.dispatchEvent({ type: EVENTS.PROFILE_LOADED });
    }
  };

  const toggleNotif = async (key: 'morning' | 'j1' | 'evening' | 'overdue' | 'smart', value: boolean) => {
    switch (key) {
      case 'morning':
        setNotifMorning(value);
        await setMorningNotificationEnabled(value);
        break;
      case 'j1':
        setNotifJ1(value);
        await setJ1NotificationEnabled(value);
        break;
      case 'evening':
        setNotifEvening(value);
        await setEveningNotificationEnabled(value);
        break;
      case 'overdue':
        setNotifOverdue(value);
        await setOverdueNotificationEnabled(value);
        break;
      case 'smart':
        setNotifSmart(value);
        await setSmartNotificationsEnabled(value);
        break;
    }
    AppEvents.dispatchEvent({ type: EVENTS.NOTIFICATION_TOGGLES_UPDATED });
  };

  const requestNotificationPermission = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    setNotifPermission(status === 'granted' ? 'granted' : 'denied');
    await setNotificationPermissionStatus(status === 'granted' ? 'granted' : 'denied');
    AppEvents.dispatchEvent({ type: EVENTS.NOTIFICATION_TOGGLES_UPDATED });
  };

  const handleUseLocation = async () => {
    console.log('[Geolocation] Button clicked');
    setLoadingLocation(true);
    setLocationSuccess(null);
    setLocationError(null);

    try {
      if (Platform.OS === 'web') {
        console.log('[Geolocation] Running on web platform');
        if (!navigator.geolocation) {
          console.error('[Geolocation] navigator.geolocation not available');
          Alert.alert('Erreur', 'La géolocalisation n\'est pas supportée par votre navigateur.');
          setLoadingLocation(false);
          return;
        }
        console.log('[Geolocation] Requesting position from browser...');

        try {
          // @ts-ignore Safari may not support permissions API
          const perm = (navigator as any).permissions?.query ? await (navigator as any).permissions.query({ name: 'geolocation' }) : null;
          console.log('[Geolocation] Permission state:', perm?.state);
        } catch {}

        navigator.geolocation.getCurrentPosition(
          async (position) => {
            console.log('[Geolocation] Position obtained:', position.coords.latitude, position.coords.longitude);
            const { latitude, longitude } = position.coords;
            
            const cached = await getCachedLocation(latitude, longitude);
            if (cached) {
              console.log('[Geolocation] Using cached location:', cached.city);
              setCity(cached.city);
              await setStoredCity(cached.city);
              await setStoredWeatherCity(cached.weatherCity);
              await setStoredCoordinates(latitude, longitude);
              console.log('[Profile] Dispatching CITY_UPDATED event');
              AppEvents.dispatchEvent({ type: EVENTS.CITY_UPDATED });
              setLocationSuccess(`Position enregistrée : ${cached.city}`);
              setTimeout(() => setLocationSuccess(null), 4000);
              setLoadingLocation(false);
              return;
            }
            
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
                AppEvents.dispatchEvent({ type: EVENTS.CITY_UPDATED });
                setLocationSuccess(`Position enregistrée : ${data.city}`);
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
            maximumAge: 30000,
          }
        );
      } else {
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
    
    if (!childFirstName.trim()) {
      setChildFormError('Le prénom de l\'enfant est requis.');
      return;
    }
    
    if (profile.children.length >= 5) {
      setChildFormError('Vous ne pouvez ajouter que 5 enfants maximum.');
      return;
    }
    
    if (childHeight && (isNaN(parseFloat(childHeight)) || parseFloat(childHeight) <= 0)) {
      setChildFormError('La taille doit être un nombre valide.');
      return;
    }
    
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
    setExpandedChildId(null);
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
      setEditingSpouse(true);
      setSpouseFirstName(profile.spouse.firstName);
      setSpouseBirthDate(profile.spouse.birthDate ? new Date(profile.spouse.birthDate) : new Date());
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

  // Address handlers (Milestone 5)
  const handleSaveAddress = async () => {
    setSavingAddress(true);
    try {
      await updateProfileAddress({
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        address: address.trim() || undefined,
        postalCode: addressPostalCode.trim() || undefined,
        city: addressCity.trim() || undefined,
      });
      await loadProfile();
      setAddressJustSaved(true);
      setTimeout(() => setAddressJustSaved(false), 3000);
      if (Platform.OS !== 'web') {
        Alert.alert('Succès', 'Adresse enregistrée.');
      }
    } catch (error) {
      if (Platform.OS === 'web') {
        alert('Impossible de mettre à jour l\'adresse.');
      } else {
        Alert.alert('Erreur', 'Impossible de mettre à jour l\'adresse.');
      }
    } finally {
      setSavingAddress(false);
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================
  return (
    <KeyboardAvoidingView
      style={styles.keyboardView}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.scrollView}>
        <View style={styles.container}>
          
          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* SECTION 1 — Ma famille                                          */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          <View style={styles.sectionCard}>
            <TouchableOpacity 
              style={styles.sectionCardHeader} 
              onPress={() => setFamilleExpanded(!familleExpanded)}
              activeOpacity={0.7}
            >
              <View style={styles.sectionCardHeaderLeft}>
                <View style={[styles.sectionCardIcon, { backgroundColor: '#FEF3E2' }]}>
                  <Feather name="users" size={20} color="#F7A45A" />
                </View>
                <Text style={styles.sectionCardTitle}>Ma famille</Text>
              </View>
              <Feather name={familleExpanded ? 'chevron-up' : 'chevron-down'} size={24} color="#6E7A84" />
            </TouchableOpacity>
            
            <Text style={styles.sectionCardSubtitle}>
              Ces informations permettent à l'app d'anticiper les démarches scolaires, médicales et administratives.
            </Text>

            {familleExpanded && (
              <View style={styles.sectionContent}>
                
                {/* --- Enfants Subsection --- */}
                <TouchableOpacity 
                  style={styles.subsectionHeader} 
                  onPress={() => setChildrenExpanded(!childrenExpanded)}
                  activeOpacity={0.7}
                >
                  <View style={styles.subsectionHeaderLeft}>
                    <Feather name="smile" size={18} color="#2C3E50" />
                    <Text style={styles.subsectionTitle}>Enfants ({profile.children.length}/5)</Text>
                  </View>
                  <Feather name={childrenExpanded ? 'chevron-up' : 'chevron-down'} size={20} color="#6E7A84" />
                </TouchableOpacity>

                {childrenExpanded && (
                  <View style={styles.subsectionContent}>
                    {profile.children.map((child) => {
                      const age = Math.floor((Date.now() - new Date(child.birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
                      const isExpanded = expandedChildId === child.id;
                      const isEditing = editingChildId === child.id;
                      
                      if (isEditing) {
                        return (
                          <View key={child.id} style={styles.formBox}>
                            <Text style={styles.formLabel}>Éditer {child.firstName}</Text>
                            <TextInput
                              style={styles.input}
                              placeholder="Prénom *"
                              value={editChildFirstName}
                              onChangeText={setEditChildFirstName}
                              placeholderTextColor="#9CA3AF"
                            />
                            <Text style={styles.formLabel}>Date de naissance *</Text>
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
                            <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.formLabel}>Taille (cm)</Text>
                                <TextInput
                                  style={styles.input}
                                  placeholder="Ex: 120"
                                  value={editChildHeight}
                                  onChangeText={setEditChildHeight}
                                  keyboardType="numeric"
                                  placeholderTextColor="#9CA3AF"
                                />
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.formLabel}>Poids (kg)</Text>
                                <TextInput
                                  style={styles.input}
                                  placeholder="Ex: 25"
                                  value={editChildWeight}
                                  onChangeText={setEditChildWeight}
                                  keyboardType="numeric"
                                  placeholderTextColor="#9CA3AF"
                                />
                              </View>
                            </View>
                            <Text style={styles.formLabel}>Notes</Text>
                            <TextInput
                              style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                              placeholder="Allergies, informations importantes..."
                              value={editChildNotes}
                              onChangeText={setEditChildNotes}
                              multiline
                              numberOfLines={3}
                              placeholderTextColor="#9CA3AF"
                            />
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
                            activeOpacity={0.7}
                          >
                            <View style={styles.childInfo}>
                              <Text style={styles.childName}>{child.firstName}</Text>
                              <Text style={styles.childAge}>{age} an{age > 1 ? 's' : ''}</Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                              <TouchableOpacity onPress={() => handleEditChild(child)}>
                                <Feather name="edit-2" size={18} color="#3A82F7" />
                              </TouchableOpacity>
                              <TouchableOpacity onPress={() => handleDeleteChild(child.id)}>
                                <Feather name="trash-2" size={18} color="#DC2626" />
                              </TouchableOpacity>
                              <Feather name={isExpanded ? 'chevron-up' : 'chevron-down'} size={20} color="#6E7A84" />
                            </View>
                          </TouchableOpacity>
                          {isExpanded && (
                            <View style={styles.childDetails}>
                              <Text style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Né(e) le : </Text>
                                {new Date(child.birthDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                              </Text>
                              {child.height && (
                                <Text style={styles.detailRow}>
                                  <Text style={styles.detailLabel}>Taille : </Text>{child.height} cm
                                </Text>
                              )}
                              {child.weight && (
                                <Text style={styles.detailRow}>
                                  <Text style={styles.detailLabel}>Poids : </Text>{child.weight} kg
                                </Text>
                              )}
                              {child.notes && (
                                <Text style={styles.detailRow}>
                                  <Text style={styles.detailLabel}>Notes : </Text>{child.notes}
                                </Text>
                              )}
                            </View>
                          )}
                        </View>
                      );
                    })}

                    {/* Add child form */}
                    {profile.children.length < 5 && (
                      <View style={styles.formBox}>
                        <Text style={styles.formLabel}>Ajouter un enfant</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="Prénom *"
                          value={childFirstName}
                          onChangeText={setChildFirstName}
                          placeholderTextColor="#9CA3AF"
                        />
                        <Text style={[styles.formLabel, { marginTop: 12 }]}>Date de naissance *</Text>
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
                        <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.formLabel}>Taille (cm)</Text>
                            <TextInput
                              style={styles.input}
                              placeholder="Ex: 120"
                              value={childHeight}
                              onChangeText={setChildHeight}
                              keyboardType="numeric"
                              placeholderTextColor="#9CA3AF"
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.formLabel}>Poids (kg)</Text>
                            <TextInput
                              style={styles.input}
                              placeholder="Ex: 25"
                              value={childWeight}
                              onChangeText={setChildWeight}
                              keyboardType="numeric"
                              placeholderTextColor="#9CA3AF"
                            />
                          </View>
                        </View>
                        <Text style={[styles.formLabel, { marginTop: 12 }]}>Notes</Text>
                        <TextInput
                          style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                          placeholder="Allergies, informations importantes..."
                          value={childNotes}
                          onChangeText={setChildNotes}
                          multiline
                          numberOfLines={3}
                          placeholderTextColor="#9CA3AF"
                        />
                        {childFormError && (
                          <View style={styles.errorBox}>
                            <Feather name="alert-circle" size={16} color="#DC2626" />
                            <Text style={styles.errorText}>{childFormError}</Text>
                          </View>
                        )}
                        <TouchableOpacity
                          style={[styles.button, addingChild && styles.buttonDisabled, { marginTop: 16 }]}
                          onPress={handleAddChild}
                          disabled={addingChild}
                        >
                          {addingChild ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <Text style={styles.buttonText}>Ajouter l'enfant</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}

                {/* --- Conjoint(e) Subsection --- */}
                <TouchableOpacity 
                  style={styles.subsectionHeader} 
                  onPress={() => setSpouseExpanded(!spouseExpanded)}
                  activeOpacity={0.7}
                >
                  <View style={styles.subsectionHeaderLeft}>
                    <Feather name="heart" size={18} color="#2C3E50" />
                    <Text style={styles.subsectionTitle}>Conjoint(e)</Text>
                  </View>
                  <Feather name={spouseExpanded ? 'chevron-up' : 'chevron-down'} size={20} color="#6E7A84" />
                </TouchableOpacity>

                {spouseExpanded && (
                  <View style={styles.subsectionContent}>
                    {profile.spouse && !editingSpouse ? (
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
                    ) : (
                      <View style={styles.formBox}>
                        <Text style={styles.formLabel}>{editingSpouse ? 'Éditer le conjoint' : 'Informations du conjoint'}</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="Prénom *"
                          value={spouseFirstName}
                          onChangeText={setSpouseFirstName}
                          placeholderTextColor="#9CA3AF"
                        />
                        <Text style={[styles.formLabel, { marginTop: 12 }]}>Date de naissance</Text>
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
                            value={spouseBirthDate.toISOString().split('T')[0]}
                            onChange={(e: any) => {
                              const value = e.target.value;
                              if (value) {
                                const d = new Date(value);
                                if (!isNaN(d.getTime())) setSpouseBirthDate(d);
                              }
                            }}
                          />
                        ) : (
                          <>
                            <TouchableOpacity
                              style={styles.dateButton}
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
                          <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
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
                            style={[styles.button, savingSpouse && styles.buttonDisabled, { marginTop: 16 }]}
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

                {/* --- Date de mariage Subsection --- */}
                <TouchableOpacity 
                  style={styles.subsectionHeader} 
                  onPress={() => setMarriageExpanded(!marriageExpanded)}
                  activeOpacity={0.7}
                >
                  <View style={styles.subsectionHeaderLeft}>
                    <Feather name="calendar" size={18} color="#2C3E50" />
                    <Text style={styles.subsectionTitle}>Date de mariage</Text>
                  </View>
                  <Feather name={marriageExpanded ? 'chevron-up' : 'chevron-down'} size={20} color="#6E7A84" />
                </TouchableOpacity>

                {marriageExpanded && (
                  <View style={styles.subsectionContent}>
                    {profile.marriageDate && !editingMarriageDate ? (
                      <View style={styles.marriageInfo}>
                        <Text style={styles.marriageDate}>
                          {new Date(profile.marriageDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
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
                      <View style={styles.formBox}>
                        <Text style={styles.formLabel}>{editingMarriageDate ? 'Éditer la date' : 'Date de mariage'}</Text>
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
                          <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
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
                            style={[styles.button, savingMarriageDate && styles.buttonDisabled, { marginTop: 16 }]}
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
            )}
          </View>

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* SECTION 2 — Ma situation                                        */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          <View style={styles.sectionCard}>
            <TouchableOpacity 
              style={styles.sectionCardHeader} 
              onPress={() => setSituationExpanded(!situationExpanded)}
              activeOpacity={0.7}
            >
              <View style={styles.sectionCardHeaderLeft}>
                <View style={[styles.sectionCardIcon, { backgroundColor: '#E8F5E9' }]}>
                  <Feather name="home" size={20} color="#4CAF50" />
                </View>
                <Text style={styles.sectionCardTitle}>Ma situation</Text>
              </View>
              <Feather name={situationExpanded ? 'chevron-up' : 'chevron-down'} size={24} color="#6E7A84" />
            </TouchableOpacity>
            
            <Text style={styles.sectionCardSubtitle}>
              Ces éléments permettent d'adapter automatiquement les démarches, documents et rappels à votre situation réelle.
            </Text>

            {situationExpanded && (
              <View style={styles.sectionContent}>
                
                {/* --- Adresse & Identité Subsection --- */}
                <TouchableOpacity 
                  style={styles.subsectionHeader} 
                  onPress={() => setAddressExpanded(!addressExpanded)}
                  activeOpacity={0.7}
                >
                  <View style={styles.subsectionHeaderLeft}>
                    <Feather name="user" size={18} color="#2C3E50" />
                    <Text style={styles.subsectionTitle}>Adresse & identité</Text>
                  </View>
                  <Feather name={addressExpanded ? 'chevron-up' : 'chevron-down'} size={20} color="#6E7A84" />
                </TouchableOpacity>

                {addressExpanded && (
                  <View style={styles.subsectionContent}>
                    {/* Show summary when data exists */}
                    {!savingAddress && (profile.firstName || profile.lastName || profile.address || profile.postalCode || profile.city) && (
                      <View style={styles.summaryBox}>
                        {(profile.firstName || profile.lastName) && (
                          <Text style={styles.summaryText}>
                            <Text style={styles.summaryLabel}>Nom : </Text>
                            {profile.firstName ? `${profile.firstName} ` : ''}{profile.lastName || ''}
                          </Text>
                        )}
                        {profile.address && (
                          <Text style={styles.summaryText}>
                            <Text style={styles.summaryLabel}>Adresse : </Text>{profile.address}
                          </Text>
                        )}
                        {(profile.postalCode || profile.city) && (
                          <Text style={styles.summaryText}>
                            <Text style={styles.summaryLabel}>Ville : </Text>
                            {profile.postalCode ? `${profile.postalCode} ` : ''}{profile.city || ''}
                          </Text>
                        )}
                      </View>
                    )}

                    <View style={styles.formBox}>
                      <Text style={styles.hint}>Ces informations seront utilisées pour pré-remplir vos documents PDF.</Text>
                      
                      <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.formLabel}>Prénom</Text>
                          <TextInput
                            style={styles.input}
                            placeholder="Ex: Jean"
                            value={firstName}
                            onChangeText={setFirstName}
                            placeholderTextColor="#9CA3AF"
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.formLabel}>Nom</Text>
                          <TextInput
                            style={styles.input}
                            placeholder="Ex: Dupont"
                            value={lastName}
                            onChangeText={setLastName}
                            placeholderTextColor="#9CA3AF"
                          />
                        </View>
                      </View>

                      <View style={{ marginTop: 12 }}>
                        <Text style={styles.formLabel}>Adresse</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="Ex: 15 rue de la Paix"
                          value={address}
                          onChangeText={setAddress}
                          placeholderTextColor="#9CA3AF"
                        />
                      </View>

                      <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.formLabel}>Code postal</Text>
                          <TextInput
                            style={styles.input}
                            placeholder="Ex: 75001"
                            value={addressPostalCode}
                            onChangeText={setAddressPostalCode}
                            keyboardType="numeric"
                            placeholderTextColor="#9CA3AF"
                          />
                        </View>
                        <View style={{ flex: 2 }}>
                          <Text style={styles.formLabel}>Ville</Text>
                          <TextInput
                            style={styles.input}
                            placeholder="Ex: Paris"
                            value={addressCity}
                            onChangeText={setAddressCity}
                            placeholderTextColor="#9CA3AF"
                          />
                        </View>
                      </View>

                      <TouchableOpacity
                        style={[styles.button, addressJustSaved && styles.buttonSuccess, (savingAddress || addressJustSaved) && styles.buttonDisabled, { marginTop: 16 }]}
                        onPress={handleSaveAddress}
                        disabled={savingAddress || addressJustSaved}
                      >
                        {savingAddress ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Text style={styles.buttonText}>{addressJustSaved ? '✓ Enregistré !' : 'Enregistrer l\'adresse'}</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* --- Localisation Subsection --- */}
                <TouchableOpacity 
                  style={styles.subsectionHeader} 
                  onPress={() => setLocationExpanded(!locationExpanded)}
                  activeOpacity={0.7}
                >
                  <View style={styles.subsectionHeaderLeft}>
                    <Feather name="map-pin" size={18} color="#2C3E50" />
                    <Text style={styles.subsectionTitle}>Localisation</Text>
                  </View>
                  <Feather name={locationExpanded ? 'chevron-up' : 'chevron-down'} size={20} color="#6E7A84" />
                </TouchableOpacity>

                {locationExpanded && (
                  <View style={styles.subsectionContent}>
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
                      <View style={styles.helperText}>
                        <Text style={styles.helperTextIcon}>📍</Text>
                        <Text style={styles.helperTextContent}>
                          Localisation utilisée pour la météo et les démarches locales
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}
          </View>

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* SECTION 3 — Votre assistant administratif                       */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          <View style={styles.sectionCard}>
            <TouchableOpacity 
              style={styles.sectionCardHeader} 
              onPress={() => setAssistantExpanded(!assistantExpanded)}
              activeOpacity={0.7}
            >
              <View style={styles.sectionCardHeaderLeft}>
                <View style={[styles.sectionCardIcon, { backgroundColor: '#E3F2FD' }]}>
                  <Feather name="briefcase" size={20} color="#3A82F7" />
                </View>
                <Text style={styles.sectionCardTitle}>Votre assistant administratif</Text>
              </View>
              <Feather name={assistantExpanded ? 'chevron-up' : 'chevron-down'} size={24} color="#6E7A84" />
            </TouchableOpacity>
            
            <Text style={styles.sectionCardSubtitle}>
              L'app anticipe, prépare et vous rappelle les démarches importantes, sans que vous ayez à y penser.
            </Text>

            {assistantExpanded && (
              <View style={styles.sectionContent}>
                <View style={styles.valueItem}>
                  <Text style={styles.valueItemIcon}>✅</Text>
                  <Text style={styles.valueItemText}>Anticipation des échéances administratives</Text>
                </View>
                <View style={styles.valueItem}>
                  <Text style={styles.valueItemIcon}>✅</Text>
                  <Text style={styles.valueItemText}>Notifications utiles et non intrusives</Text>
                </View>
                <View style={styles.valueItem}>
                  <Text style={styles.valueItemIcon}>✅</Text>
                  <Text style={styles.valueItemText}>Aide à la rédaction de messages et documents</Text>
                </View>
                <View style={styles.valueItem}>
                  <Text style={styles.valueItemIcon}>✅</Text>
                  <Text style={styles.valueItemText}>Centralisation des informations familiales</Text>
                </View>
              </View>
            )}
          </View>

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* SECTION 4 — Notifications & rythme                              */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          <View style={styles.sectionCard}>
            <TouchableOpacity 
              style={styles.sectionCardHeader} 
              onPress={() => setNotificationsExpanded(!notificationsExpanded)}
              activeOpacity={0.7}
            >
              <View style={styles.sectionCardHeaderLeft}>
                <View style={[styles.sectionCardIcon, { backgroundColor: '#FFF3E0' }]}>
                  <Feather name="bell" size={20} color="#FF9800" />
                </View>
                <Text style={styles.sectionCardTitle}>Notifications</Text>
              </View>
              <Feather name={notificationsExpanded ? 'chevron-up' : 'chevron-down'} size={24} color="#6E7A84" />
            </TouchableOpacity>
            
            <Text style={styles.sectionCardSubtitle}>
              Ces notifications sont conçues pour vous accompagner au quotidien, au bon moment, sans jamais vous surcharger.
            </Text>

            {notificationsExpanded && (
              <View style={styles.sectionContent}>
                {/* Morning notification */}
                <View style={styles.notificationRow}>
                  <View style={styles.notificationRowHeader}>
                    <Text style={styles.notificationTitle}>Matin 07:30</Text>
                    <Switch value={notifMorning} onValueChange={(v) => toggleNotif('morning', v)} />
                  </View>
                  <Text style={styles.notificationDescription}>
                    Un point clair pour bien commencer la journée : météo, tenue des enfants et priorités essentielles.
                  </Text>
                </View>

                {/* J-1 notification */}
                <View style={styles.notificationRow}>
                  <View style={styles.notificationRowHeader}>
                    <Text style={styles.notificationTitle}>J-1 18:00</Text>
                    <Switch value={notifJ1} onValueChange={(v) => toggleNotif('j1', v)} />
                  </View>
                  <Text style={styles.notificationDescription}>
                    Un rappel discret pour anticiper les échéances importantes du lendemain.
                  </Text>
                </View>

                {/* Evening notification */}
                <View style={styles.notificationRow}>
                  <View style={styles.notificationRowHeader}>
                    <Text style={styles.notificationTitle}>Soir 19:00</Text>
                    <Switch value={notifEvening} onValueChange={(v) => toggleNotif('evening', v)} />
                  </View>
                  <Text style={styles.notificationDescription}>
                    Un message léger pour clôturer la journée, sans aucune démarche à gérer.
                  </Text>
                </View>

                {/* Overdue notification */}
                <View style={styles.notificationRow}>
                  <View style={styles.notificationRowHeader}>
                    <Text style={styles.notificationTitle}>Retards 09:00</Text>
                    <Switch value={notifOverdue} onValueChange={(v) => toggleNotif('overdue', v)} />
                  </View>
                  <Text style={styles.notificationDescription}>
                    Une alerte utile uniquement si nécessaire, pour éviter que des démarches ne s'accumulent.
                  </Text>
                </View>

                {/* Smart notifications */}
                <View style={styles.notificationRow}>
                  <View style={styles.notificationRowHeader}>
                    <Text style={styles.notificationTitle}>Notifications intelligentes</Text>
                    <Switch value={notifSmart} onValueChange={(v) => toggleNotif('smart', v)} />
                  </View>
                  <Text style={styles.notificationDescription}>
                    Alertes automatiques adaptées à votre situation familiale : enfants, météo, documents prêts, urgences.
                  </Text>
                </View>

                {/* Permission button */}
                <TouchableOpacity 
                  style={[styles.button, { marginTop: 20 }]} 
                  onPress={requestNotificationPermission}
                >
                  <Text style={styles.buttonText}>
                    {notifPermission === 'granted' ? '✓ Notifications autorisées' : 'Autoriser les notifications'}
                  </Text>
                </TouchableOpacity>
                <Text style={styles.permissionHint}>
                  Recommandé pour profiter pleinement de l'assistant et éviter les oublis importants.{'\n'}
                  Vous pouvez modifier ces réglages à tout moment.
                </Text>
              </View>
            )}
          </View>

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* SECTION 5 — Données & confidentialité                           */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          <View style={styles.sectionCard}>
            <TouchableOpacity 
              style={styles.sectionCardHeader} 
              onPress={() => setDonneesExpanded(!donneesExpanded)}
              activeOpacity={0.7}
            >
              <View style={styles.sectionCardHeaderLeft}>
                <View style={[styles.sectionCardIcon, { backgroundColor: '#F3E5F5' }]}>
                  <Feather name="shield" size={20} color="#9C27B0" />
                </View>
                <Text style={styles.sectionCardTitle}>Données & confidentialité</Text>
              </View>
              <Feather name={donneesExpanded ? 'chevron-up' : 'chevron-down'} size={24} color="#6E7A84" />
            </TouchableOpacity>
            
            <Text style={styles.sectionCardSubtitle}>
              Vos données familiales restent privées. Elles ne sont jamais revendues ni utilisées à des fins publicitaires.
            </Text>

            {donneesExpanded && (
              <View style={styles.sectionContent}>
                <View style={styles.valueItem}>
                  <Text style={styles.valueItemIcon}>🔒</Text>
                  <Text style={styles.valueItemText}>Données stockées de manière sécurisée</Text>
                </View>
                <View style={styles.valueItem}>
                  <Text style={styles.valueItemIcon}>🛑</Text>
                  <Text style={styles.valueItemText}>Aucune revente de données</Text>
                </View>
                <View style={styles.valueItem}>
                  <Text style={styles.valueItemIcon}>🇫🇷</Text>
                  <Text style={styles.valueItemText}>Conformité RGPD</Text>
                </View>
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
    backgroundColor: '#F5F7FA',
  },
  scrollView: {
    flex: 1,
  },
  container: {
    padding: 16,
    paddingBottom: 32,
  },
  // Section card styles
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sectionCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sectionCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2C3E50',
    flex: 1,
  },
  sectionCardSubtitle: {
    fontSize: 14,
    color: '#6E7A84',
    marginTop: 12,
    lineHeight: 20,
  },
  sectionContent: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F2F5',
  },
  // Subsection styles
  subsectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2F5',
  },
  subsectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
  },
  subsectionContent: {
    paddingTop: 12,
    paddingBottom: 8,
  },
  // Value item styles
  valueItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
  },
  valueItemIcon: {
    fontSize: 16,
    marginRight: 12,
    marginTop: 2,
  },
  valueItemText: {
    fontSize: 15,
    color: '#2C3E50',
    flex: 1,
    lineHeight: 22,
  },
  // Notification row styles
  notificationRow: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2F5',
  },
  notificationRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
  },
  notificationDescription: {
    fontSize: 14,
    color: '#6E7A84',
    marginTop: 8,
    lineHeight: 20,
  },
  // Form styles
  formBox: {
    marginTop: 12,
    padding: 16,
    backgroundColor: '#FAFBFC',
    borderRadius: 12,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2C3E50',
    marginBottom: 8,
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
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E9EEF2',
    padding: 12,
    fontSize: 16,
    height: 48,
    color: '#2C3E50',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E9EEF2',
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#FFFFFF',
    gap: 8,
  },
  dateButtonText: {
    fontSize: 16,
    color: '#2C3E50',
  },
  // Button styles
  button: {
    backgroundColor: '#3A82F7',
    borderRadius: 10,
    height: 48,
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
  // Location button
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EBF5FF',
    borderRadius: 10,
    height: 48,
    marginBottom: 16,
    gap: 8,
  },
  locationButtonText: {
    color: '#3A82F7',
    fontSize: 16,
    fontWeight: '600',
  },
  orText: {
    textAlign: 'center',
    color: '#6E7A84',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 16,
  },
  // Status boxes
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 10,
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
  locationSuccessBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
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
    borderRadius: 10,
    marginBottom: 12,
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
    borderRadius: 10,
    marginTop: 12,
    gap: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#DC2626',
    fontWeight: '500',
    flex: 1,
  },
  // Helper text
  hint: {
    fontSize: 13,
    color: '#6E7A84',
    fontWeight: '400',
    lineHeight: 18,
  },
  helperText: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
    padding: 12,
    borderRadius: 10,
    marginTop: 12,
  },
  helperTextIcon: {
    fontSize: 16,
  },
  helperTextContent: {
    fontSize: 13,
    color: '#6E7A84',
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
  },
  permissionHint: {
    fontSize: 13,
    color: '#6E7A84',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 20,
  },
  // Summary box
  summaryBox: {
    padding: 12,
    backgroundColor: '#F5F7FA',
    borderRadius: 10,
    marginBottom: 12,
  },
  summaryText: {
    fontSize: 14,
    color: '#2C3E50',
    marginBottom: 4,
    lineHeight: 20,
  },
  summaryLabel: {
    fontWeight: '600',
  },
  // Child item styles
  childItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2F5',
  },
  childInfo: {
    flex: 1,
  },
  childName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 2,
  },
  childAge: {
    fontSize: 14,
    color: '#6E7A84',
  },
  childDetails: {
    padding: 14,
    backgroundColor: '#FAFBFC',
    borderRadius: 10,
    marginTop: 8,
    marginBottom: 8,
  },
  detailRow: {
    fontSize: 14,
    color: '#2C3E50',
    marginBottom: 6,
    lineHeight: 20,
  },
  detailLabel: {
    fontWeight: '600',
  },
  // Spouse styles
  spouseInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  spouseName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
  },
  spouseBirthDate: {
    fontSize: 14,
    color: '#6E7A84',
    marginTop: 4,
  },
  // Marriage styles
  marriageInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  marriageDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
  },
});
