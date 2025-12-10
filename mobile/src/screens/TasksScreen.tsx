import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
  Alert,
  Modal,
  Linking,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { createTask, getAllTasks, deleteTask, updateTask, createTaskFromImage, type TaskCategory, type Task } from '../api/client';
import { formatDateFrench } from '../utils/dateFormat';
import PDFViewerModal from '../components/PDFViewerModal';

// Conditionally import DateTimePicker only for mobile
let DateTimePicker: any = null;
if (Platform.OS !== 'web') {
  DateTimePicker = require('@react-native-community/datetimepicker').default;
}

const CATEGORIES: { value: TaskCategory; label: string }[] = [
  { value: 'administratif', label: 'Administratif' },
  { value: 'enfants-école', label: 'Enfants & École' },
  { value: 'santé', label: 'Santé' },
  { value: 'finances', label: 'Finances' },
  { value: 'logement', label: 'Logement' },
  { value: 'personnel', label: 'Personnel' },
];

interface TasksScreenProps {
  onOpenTaskDetail?: (task: Task) => void;
  refreshTrigger?: number;
}

export default function TasksScreen({ onOpenTaskDetail, refreshTrigger }: TasksScreenProps) {
  const scrollViewRef = useRef<ScrollView>(null);
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksError, setTasksError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<TaskCategory>('personnel');
  const [deadline, setDeadline] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  // Filter state
  type FilterType = 'all' | 'today' | TaskCategory;
  const [filter, setFilter] = useState<FilterType>('all');
  
  // Edit state
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState<TaskCategory>('personnel');
  const [editDeadline, setEditDeadline] = useState(new Date());
  const [editDescription, setEditDescription] = useState('');
  const [editStatus, setEditStatus] = useState<'todo' | 'in_progress' | 'done'>('todo');
  const [showEditDatePicker, setShowEditDatePicker] = useState(false);
  const [updating, setUpdating] = useState(false);
  
  // Dropdown state
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showEditCategoryPicker, setShowEditCategoryPicker] = useState(false);
  const [showEditStatusPicker, setShowEditStatusPicker] = useState(false);
  const [showFilterPicker, setShowFilterPicker] = useState(false);
  
  // Delete confirmation state (for web)
  const [deleteConfirmTaskId, setDeleteConfirmTaskId] = useState<string | null>(null);
  
  // Image picker state (Milestone 4)
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  
  // PDF viewer modal
  const [showPdfViewer, setShowPdfViewer] = useState(false);
  const [pdfViewerUrl, setPdfViewerUrl] = useState<string | null>(null);

  const loadTasks = async () => {
    setLoading(true);
    setTasksError(null);
    try {
      const result = await getAllTasks();
      setTasks(result.tasks);
    } catch (error) {
      setTasksError('Impossible de charger les tâches.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  // Reload tasks when refreshTrigger changes (e.g., after task deletion from detail screen)
  useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger > 0) {
      loadTasks();
    }
  }, [refreshTrigger]);

  const handleSubmit = async () => {
    // Clear previous errors
    setFormError(null);
    
    if (!title.trim()) {
      setFormError('Le titre est requis.');
      // Scroll to top to show error
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }

    setSubmitting(true);
    try {
      await createTask({
        title: title.trim(),
        category,
        deadline: deadline.toISOString(),
        description: description.trim() || undefined,
      });

      // Show success message
      setSuccessMessage('Tâche créée avec succès !');
      setTimeout(() => setSuccessMessage(null), 3000);

      // Reset form
      setTitle('');
      setCategory('personnel');
      setDeadline(new Date());
      setDescription('');

      // Reload tasks
      await loadTasks();
    } catch (error) {
      setFormError('Impossible de créer la tâche. Veuillez réessayer.');
      // Scroll to top to show error
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (taskId: string) => {
    // On web, show confirmation dialog
    if (Platform.OS === 'web') {
      setDeleteConfirmTaskId(taskId);
      return;
    }
    
    // Native platforms: use Alert
    Alert.alert('Supprimer', 'Êtes-vous sûr de vouloir supprimer cette tâche ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteTask(taskId);
            await loadTasks();
          } catch (error) {
            setFormError('Impossible de supprimer la tâche.');
          }
        },
      },
    ]);
  };
  
  const confirmDeleteTask = async () => {
    if (!deleteConfirmTaskId) return;
    try {
      await deleteTask(deleteConfirmTaskId);
      await loadTasks();
      setSuccessMessage('Tâche supprimée avec succès.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      setFormError('Impossible de supprimer la tâche.');
    } finally {
      setDeleteConfirmTaskId(null);
    }
  };
  
  const handleEditTask = (task: Task) => {
    setEditingTaskId(task.id);
    setEditTitle(task.title);
    setEditCategory(task.category);
    setEditDeadline(new Date(task.deadline));
    setEditDescription(task.description || '');
    setEditStatus(task.status);
    // Edit form appears inline where the task is
  };
  
  const handleCancelEdit = () => {
    setEditingTaskId(null);
    setEditTitle('');
    setEditCategory('personnel');
    setEditDeadline(new Date());
    setEditDescription('');
    setEditStatus('todo');
  };
  
  
  // ============================================
  // Image Picker Functions (Milestone 4)
  // ============================================
  
  // Hidden file input ref for web gallery picker (to avoid "Take Photo" option)
  const webFileInputRef = useRef<HTMLInputElement | null>(null);
  
  const requestCameraPermission = async (): Promise<boolean> => {
    if (Platform.OS === 'web') return true;
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission requise',
        'Autorisez l\'accès à l\'appareil photo pour prendre une photo.',
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  };
  
  const requestMediaLibraryPermission = async (): Promise<boolean> => {
    if (Platform.OS === 'web') return true;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission requise',
        'Autorisez l\'accès à vos photos pour sélectionner une image.',
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  };
  
  const handlePickFromCamera = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) return;
    
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
      base64: true,
    });
    
    if (!result.canceled && result.assets[0]) {
      await processImage(result.assets[0]);
    }
  };
  
  // Web-specific: handle file input change for gallery
  const handleWebFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // Reset input so same file can be selected again
    event.target.value = '';
    
    // Read file as base64
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      // Extract base64 part (remove "data:image/...;base64," prefix)
      const base64Match = dataUrl.match(/^data:image\/\w+;base64,(.+)$/);
      if (!base64Match) {
        setFormError('Format d\'image non supporté.');
        return;
      }
      const base64 = base64Match[1];
      const mimeType = file.type || 'image/jpeg';
      
      // Create a fake asset object to reuse processImage
      await processImageFromWeb(base64, mimeType, file.name);
    };
    reader.onerror = () => {
      setFormError('Impossible de lire l\'image.');
    };
    reader.readAsDataURL(file);
  };
  
  // Process image from web file input
  const processImageFromWeb = async (base64: string, mimeType: string, filename: string) => {
    setIsProcessingImage(true);
    setFormError(null);
    
    try {
      const response = await createTaskFromImage(base64, mimeType, filename);
      
      setSuccessMessage(`Tâche créée : ${response.task.title}`);
      setTimeout(() => setSuccessMessage(null), 4000);
      
      await loadTasks();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      setFormError(message);
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    } finally {
      setIsProcessingImage(false);
    }
  };
  
  const handlePickFromGallery = async () => {
    // On web, use native file input to avoid "Take Photo" option
    if (Platform.OS === 'web') {
      webFileInputRef.current?.click();
      return;
    }
    
    const hasPermission = await requestMediaLibraryPermission();
    if (!hasPermission) return;
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
      base64: true,
    });
    
    if (!result.canceled && result.assets[0]) {
      await processImage(result.assets[0]);
    }
  };
  
  const processImage = async (asset: ImagePicker.ImagePickerAsset) => {
    if (!asset.base64) {
      setFormError('Impossible de lire l\'image.');
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    
    setIsProcessingImage(true);
    setFormError(null);
    
    try {
      // Determine MIME type from URI
      const uri = asset.uri.toLowerCase();
      const mimeType = uri.includes('.png') ? 'image/png' : 'image/jpeg';
      const filename = `photo_${Date.now()}.${mimeType === 'image/png' ? 'png' : 'jpg'}`;
      
      const response = await createTaskFromImage(asset.base64, mimeType, filename);
      
      setSuccessMessage(`Tâche créée : ${response.task.title}`);
      setTimeout(() => setSuccessMessage(null), 4000);
      
      // Reload tasks
      await loadTasks();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      setFormError(message);
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    } finally {
      setIsProcessingImage(false);
    }
  };
  
  const handleUpdateTask = async () => {
    if (!editTitle.trim()) {
      setFormError('Le titre est requis.');
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    
    setUpdating(true);
    try {
      await updateTask(editingTaskId!, {
        title: editTitle.trim(),
        category: editCategory,
        deadline: editDeadline.toISOString(),
        description: editDescription.trim() || undefined,
        status: editStatus,
      });
      
      setSuccessMessage('Tâche mise à jour avec succès !');
      setTimeout(() => setSuccessMessage(null), 3000);
      
      handleCancelEdit();
      await loadTasks();
    } catch (error) {
      setFormError('Impossible de mettre à jour la tâche.');
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    } finally {
      setUpdating(false);
    }
  };
  
  // Filter tasks based on selected filter
  const getFilteredTasks = () => {
    if (filter === 'all') return tasks;
    
    if (filter === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      return tasks.filter(task => {
        const deadline = new Date(task.deadline);
        return deadline >= today && deadline < tomorrow;
      });
    }
    
    // Filter by category
    return tasks.filter(task => task.category === filter);
  };
  
  const filteredTasks = getFilteredTasks();

  return (
    <View style={{ flex: 1 }}>
      {/* Hidden file input for web gallery picker - no "Take Photo" option */}
      {Platform.OS === 'web' && (
        <input
          ref={webFileInputRef as any}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleWebFileSelect as any}
        />
      )}
      <ScrollView ref={scrollViewRef} style={styles.container}>

      {/* Error Message */}
      {formError && (
        <View style={styles.errorBanner}>
          <Feather name="alert-circle" size={20} color="#DC2626" />
          <Text style={styles.errorText}>{formError}</Text>
          <TouchableOpacity onPress={() => setFormError(null)}>
            <Feather name="x" size={20} color="#DC2626" />
          </TouchableOpacity>
        </View>
      )}

      {/* Form Card */}
      <View style={styles.card}>
        <View style={styles.header}>
          <Feather name="plus-circle" size={20} color="#2C3E50" />
          <Text style={styles.cardTitle}>Nouvelle tâche</Text>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Titre *</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Ex: Inscription école"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Catégorie *</Text>
          {Platform.OS === 'web' ? (
            <select
              value={category}
              onChange={(e: any) => setCategory(e.target.value as TaskCategory)}
              style={{
                backgroundColor: '#F8F9FB',
                borderWidth: 1,
                borderColor: '#E9EEF2',
                borderRadius: 12,
                paddingLeft: 16,
                paddingRight: 16,
                paddingTop: 12,
                paddingBottom: 12,
                fontSize: 16,
                color: '#2C3E50',
                fontFamily: 'system-ui',
                width: '100%',
              }}
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          ) : (
            <View>
              <TouchableOpacity
                style={styles.dropdownButton}
                onPress={() => setShowCategoryPicker(!showCategoryPicker)}
              >
                <Text style={styles.dropdownButtonText}>
                  {CATEGORIES.find(c => c.value === category)?.label || 'Sélectionner'}
                </Text>
                <Feather name={showCategoryPicker ? 'chevron-up' : 'chevron-down'} size={20} color="#2C3E50" />
              </TouchableOpacity>
              {showCategoryPicker && (
                <View style={styles.dropdownList}>
                  {CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat.value}
                      style={[
                        styles.dropdownItem,
                        category === cat.value && styles.dropdownItemActive
                      ]}
                      onPress={() => {
                        setCategory(cat.value);
                        setShowCategoryPicker(false);
                      }}
                    >
                      <Text style={[
                        styles.dropdownItemText,
                        category === cat.value && styles.dropdownItemTextActive
                      ]}>
                        {cat.label}
                      </Text>
                      {category === cat.value && (
                        <Feather name="check" size={18} color="#3A82F7" />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Échéance *</Text>
          {Platform.OS === 'web' ? (
            <input
              type="datetime-local"
              style={{
                backgroundColor: '#F8F9FB',
                border: '1px solid #E9EEF2',
                borderRadius: '12px',
                padding: '12px 16px',
                fontSize: '16px',
                color: '#2C3E50',
                width: '100%',
                maxWidth: '100%',
                fontFamily: 'system-ui',
                boxSizing: 'border-box',
                outline: 'none',
                WebkitAppearance: 'none',
                MozAppearance: 'none',
                appearance: 'none',
              }}
              value={new Date(deadline.getTime() - deadline.getTimezoneOffset() * 60000)
                .toISOString()
                .slice(0, 16)}
              onChange={(e: any) => {
                const value = e.target.value;
                if (value) {
                  const d = new Date(value);
                  if (!isNaN(d.getTime())) setDeadline(d);
                }
              }}
            />
          ) : (
            <>
              <TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
                <Feather name="calendar" size={18} color="#2C3E50" />
                <Text style={styles.dateButtonText}>
                  {deadline.toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </TouchableOpacity>
              {showDatePicker && DateTimePicker && (
                <DateTimePicker
                  value={deadline}
                  mode="datetime"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event: any, selectedDate?: Date) => {
                    setShowDatePicker(Platform.OS === 'ios');
                    if (selectedDate) setDeadline(selectedDate);
                  }}
                />
              )}
            </>
          )}
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Description (optionnel)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Détails supplémentaires..."
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={3}
          />
        </View>

        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>Créer la tâche</Text>
          )}
        </TouchableOpacity>
        
        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>ou</Text>
          <View style={styles.dividerLine} />
        </View>
        
        {/* Single photo button - lets user choose camera or gallery */}
        {isProcessingImage ? (
          <View style={[styles.photoButton, styles.photoButtonDisabled]}>
            <ActivityIndicator size="small" color="#3A82F7" style={{ marginRight: 8 }} />
            <Text style={styles.photoButtonText}>Analyse en cours...</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.photoButton}
            onPress={handlePickFromGallery}
          >
            <Feather name="image" size={20} color="#3A82F7" />
            <Text style={styles.photoButtonText}>Ajouter une image</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.photoHint}>
          Créez une tâche depuis un courrier, une facture, ou une capture d'écran
        </Text>
      </View>

      {/* Task List Card */}
      <View style={styles.card}>
        <View style={styles.header}>
          <Feather name="list" size={20} color="#2C3E50" />
          <Text style={styles.cardTitle}>Toutes les tâches</Text>
        </View>
        
        {/* Filter Dropdown */}
        <View style={{ marginBottom: 16 }}>
          <Text style={styles.label}>Filtrer par</Text>
          {Platform.OS === 'web' ? (
            <select
              value={filter}
              onChange={(e: any) => setFilter(e.target.value as FilterType)}
              style={{
                backgroundColor: '#F8F9FB',
                borderWidth: 1,
                borderColor: '#E9EEF2',
                borderRadius: 12,
                paddingLeft: 16,
                paddingRight: 16,
                paddingTop: 12,
                paddingBottom: 12,
                fontSize: 16,
                color: '#2C3E50',
                fontFamily: 'system-ui',
                width: '100%',
              }}
            >
              <option value="all">Toutes les tâches</option>
              <option value="today">Tâches du jour</option>
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          ) : (
            <View>
              <TouchableOpacity
                style={styles.dropdownButton}
                onPress={() => setShowFilterPicker(!showFilterPicker)}
              >
                <Text style={styles.dropdownButtonText}>
                  {filter === 'all' ? 'Toutes les tâches' : filter === 'today' ? 'Tâches du jour' : CATEGORIES.find(c => c.value === filter)?.label}
                </Text>
                <Feather name={showFilterPicker ? 'chevron-up' : 'chevron-down'} size={20} color="#2C3E50" />
              </TouchableOpacity>
              {showFilterPicker && (
                <View style={styles.dropdownList}>
                  <TouchableOpacity
                    style={[styles.dropdownItem, filter === 'all' && styles.dropdownItemActive]}
                    onPress={() => {
                      setFilter('all');
                      setShowFilterPicker(false);
                    }}
                  >
                    <Text style={[styles.dropdownItemText, filter === 'all' && styles.dropdownItemTextActive]}>
                      Toutes les tâches
                    </Text>
                    {filter === 'all' && <Feather name="check" size={18} color="#3A82F7" />}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.dropdownItem, filter === 'today' && styles.dropdownItemActive]}
                    onPress={() => {
                      setFilter('today');
                      setShowFilterPicker(false);
                    }}
                  >
                    <Text style={[styles.dropdownItemText, filter === 'today' && styles.dropdownItemTextActive]}>
                      Tâches du jour
                    </Text>
                    {filter === 'today' && <Feather name="check" size={18} color="#3A82F7" />}
                  </TouchableOpacity>
                  {CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat.value}
                      style={[styles.dropdownItem, filter === cat.value && styles.dropdownItemActive]}
                      onPress={() => {
                        setFilter(cat.value);
                        setShowFilterPicker(false);
                      }}
                    >
                      <Text style={[styles.dropdownItemText, filter === cat.value && styles.dropdownItemTextActive]}>
                        {cat.label}
                      </Text>
                      {filter === cat.value && <Feather name="check" size={18} color="#3A82F7" />}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#3A82F7" />
        ) : tasksError ? (
          <Text style={styles.errorText}>{tasksError}</Text>
        ) : filteredTasks.length === 0 ? (
          <Text style={styles.placeholderText}>
            {tasks.length === 0 ? 'Aucune tâche pour le moment.' : 'Aucune tâche ne correspond à ce filtre.'}
          </Text>
        ) : (
          <View>
            {filteredTasks.map((task) => {
              const deadlineDate = new Date(task.deadline);
              const isOverdue = deadlineDate < new Date() && task.status !== 'done';
              const categoryLabel = CATEGORIES.find((c) => c.value === task.category)?.label || task.category;

              let statusColor = '#6E7A84';
              let statusLabel = 'À faire';
              if (task.status === 'done') {
                statusColor = '#4CAF50';
                statusLabel = 'Terminé';
              } else if (task.status === 'in_progress') {
                statusColor = '#F7A45A';
                statusLabel = 'En cours';
              }

              return (
                <TouchableOpacity
                  key={task.id}
                  style={styles.taskItem}
                  onLongPress={() => onOpenTaskDetail && onOpenTaskDetail(task)}
                  delayLongPress={400}
                  activeOpacity={0.7}
                  disabled={editingTaskId === task.id}
                >
                  {editingTaskId === task.id ? (
                    // Edit Form
                    <View>
                      <View style={styles.formGroup}>
                        <Text style={styles.label}>Titre</Text>
                        <TextInput
                          style={styles.input}
                          value={editTitle}
                          onChangeText={setEditTitle}
                          placeholder="Titre de la tâche"
                          placeholderTextColor="#9CA3AF"
                        />
                      </View>

                      <View style={styles.formGroup}>
                        <Text style={styles.label}>Catégorie</Text>
                        {Platform.OS === 'web' ? (
                          <select
                            value={editCategory}
                            onChange={(e: any) => setEditCategory(e.target.value as TaskCategory)}
                            style={{
                              width: '100%',
                              padding: 12,
                              fontSize: 16,
                              borderRadius: 12,
                              border: '1px solid #E5E7EB',
                              backgroundColor: '#FFFFFF',
                              color: '#2C3E50',
                            }}
                          >
                            {CATEGORIES.map((cat) => (
                              <option key={cat.value} value={cat.value}>
                                {cat.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <View>
                            <TouchableOpacity
                              style={styles.dropdownButton}
                              onPress={() => setShowEditCategoryPicker(!showEditCategoryPicker)}
                            >
                              <Text style={styles.dropdownButtonText}>
                                {CATEGORIES.find(c => c.value === editCategory)?.label || 'Sélectionner'}
                              </Text>
                              <Feather name={showEditCategoryPicker ? 'chevron-up' : 'chevron-down'} size={20} color="#2C3E50" />
                            </TouchableOpacity>
                            {showEditCategoryPicker && (
                              <View style={styles.dropdownList}>
                                {CATEGORIES.map((cat) => (
                                  <TouchableOpacity
                                    key={cat.value}
                                    style={[
                                      styles.dropdownItem,
                                      editCategory === cat.value && styles.dropdownItemActive
                                    ]}
                                    onPress={() => {
                                      setEditCategory(cat.value);
                                      setShowEditCategoryPicker(false);
                                    }}
                                  >
                                    <Text style={[
                                      styles.dropdownItemText,
                                      editCategory === cat.value && styles.dropdownItemTextActive
                                    ]}>
                                      {cat.label}
                                    </Text>
                                    {editCategory === cat.value && (
                                      <Feather name="check" size={18} color="#3A82F7" />
                                    )}
                                  </TouchableOpacity>
                                ))}
                              </View>
                            )}
                          </View>
                        )}
                      </View>

                      <View style={styles.formGroup}>
                        <Text style={styles.label}>Échéance</Text>
                        {Platform.OS === 'web' ? (
                          <input
                            type="datetime-local"
                            value={editDeadline.toISOString().slice(0, 16)}
                            onChange={(e: any) => setEditDeadline(new Date(e.target.value))}
                            style={{
                              width: '100%',
                              padding: 12,
                              fontSize: 16,
                              borderRadius: 12,
                              border: '1px solid #E5E7EB',
                              backgroundColor: '#FFFFFF',
                              color: '#2C3E50',
                            }}
                          />
                        ) : (
                          <>
                            <TouchableOpacity
                              onPress={() => setShowEditDatePicker(true)}
                              style={styles.input}
                            >
                              <Text style={{ color: '#2C3E50' }}>
                                {editDeadline.toLocaleDateString('fr-FR', {
                                  day: 'numeric',
                                  month: 'long',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </Text>
                            </TouchableOpacity>
                            {showEditDatePicker && DateTimePicker && (
                              <DateTimePicker
                                value={editDeadline}
                                mode="datetime"
                                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                onChange={(event: any, selectedDate?: Date) => {
                                  setShowEditDatePicker(Platform.OS === 'ios');
                                  if (selectedDate) setEditDeadline(selectedDate);
                                }}
                              />
                            )}
                          </>
                        )}
                      </View>

                      <View style={styles.formGroup}>
                        <Text style={styles.label}>Description (optionnel)</Text>
                        <TextInput
                          style={[styles.input, styles.textArea]}
                          value={editDescription}
                          onChangeText={setEditDescription}
                          placeholder="Détails supplémentaires..."
                          placeholderTextColor="#9CA3AF"
                          multiline
                          numberOfLines={3}
                        />
                      </View>

                      <View style={styles.formGroup}>
                        <Text style={styles.label}>Statut</Text>
                        {Platform.OS === 'web' ? (
                          <select
                            value={editStatus}
                            onChange={(e: any) => setEditStatus(e.target.value as 'todo' | 'in_progress' | 'done')}
                            style={{
                              width: '100%',
                              padding: 12,
                              fontSize: 16,
                              borderRadius: 12,
                              border: '1px solid #E5E7EB',
                              backgroundColor: '#FFFFFF',
                              color: '#2C3E50',
                            }}
                          >
                            <option value="todo">À faire</option>
                            <option value="in_progress">En cours</option>
                            <option value="done">Terminé</option>
                          </select>
                        ) : (
                          <View>
                            <TouchableOpacity
                              style={styles.dropdownButton}
                              onPress={() => setShowEditStatusPicker(!showEditStatusPicker)}
                            >
                              <Text style={styles.dropdownButtonText}>
                                {editStatus === 'todo' ? 'À faire' : editStatus === 'in_progress' ? 'En cours' : 'Terminé'}
                              </Text>
                              <Feather name={showEditStatusPicker ? 'chevron-up' : 'chevron-down'} size={20} color="#2C3E50" />
                            </TouchableOpacity>
                            {showEditStatusPicker && (
                              <View style={styles.dropdownList}>
                                <TouchableOpacity
                                  style={[
                                    styles.dropdownItem,
                                    editStatus === 'todo' && styles.dropdownItemActive
                                  ]}
                                  onPress={() => {
                                    setEditStatus('todo');
                                    setShowEditStatusPicker(false);
                                  }}
                                >
                                  <Text style={[
                                    styles.dropdownItemText,
                                    editStatus === 'todo' && styles.dropdownItemTextActive
                                  ]}>
                                    À faire
                                  </Text>
                                  {editStatus === 'todo' && (
                                    <Feather name="check" size={18} color="#3A82F7" />
                                  )}
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={[
                                    styles.dropdownItem,
                                    editStatus === 'in_progress' && styles.dropdownItemActive
                                  ]}
                                  onPress={() => {
                                    setEditStatus('in_progress');
                                    setShowEditStatusPicker(false);
                                  }}
                                >
                                  <Text style={[
                                    styles.dropdownItemText,
                                    editStatus === 'in_progress' && styles.dropdownItemTextActive
                                  ]}>
                                    En cours
                                  </Text>
                                  {editStatus === 'in_progress' && (
                                    <Feather name="check" size={18} color="#3A82F7" />
                                  )}
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={[
                                    styles.dropdownItem,
                                    editStatus === 'done' && styles.dropdownItemActive
                                  ]}
                                  onPress={() => {
                                    setEditStatus('done');
                                    setShowEditStatusPicker(false);
                                  }}
                                >
                                  <Text style={[
                                    styles.dropdownItemText,
                                    editStatus === 'done' && styles.dropdownItemTextActive
                                  ]}>
                                    Terminé
                                  </Text>
                                  {editStatus === 'done' && (
                                    <Feather name="check" size={18} color="#3A82F7" />
                                  )}
                                </TouchableOpacity>
                              </View>
                            )}
                          </View>
                        )}
                      </View>

                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                        <TouchableOpacity
                          style={[styles.submitButton, { flex: 1 }, updating && styles.submitButtonDisabled]}
                          onPress={handleUpdateTask}
                          disabled={updating}
                        >
                          {updating ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <Text style={styles.submitButtonText}>Enregistrer</Text>
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.submitButton, { flex: 1, backgroundColor: '#6E7A84' }]}
                          onPress={handleCancelEdit}
                        >
                          <Text style={styles.submitButtonText}>Annuler</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    // Normal Task Display
                    <>
                      <View style={styles.taskHeader}>
                        <Text style={styles.taskTitle}>{task.title}</Text>
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                          <TouchableOpacity onPress={() => handleEditTask(task)}>
                            <Feather name="edit" size={18} color="#3A82F7" />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => handleDelete(task.id)}>
                            <Feather name="trash-2" size={18} color="#DC2626" />
                          </TouchableOpacity>
                        </View>
                      </View>
                      <View style={styles.taskMeta}>
                        <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                          <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
                        </View>
                        <View style={styles.categoryBadge}>
                          <Text style={styles.categoryText}>{categoryLabel}</Text>
                        </View>
                      </View>
                      <View style={styles.taskDeadlineRow}>
                        <Feather name="clock" size={14} color={isOverdue ? '#DC2626' : '#6E7A84'} />
                        <Text style={[styles.taskDeadlineText, isOverdue && styles.overdueText]}>
                          {formatDateFrench(deadlineDate)}
                          {isOverdue && ' (en retard)'}
                        </Text>
                      </View>
                      {/* Source indicator - always show, default to manual */}
                        <View style={styles.sourceRow}>
                          <Feather 
                            name={task.source === 'email' ? 'mail' : task.source === 'photo' ? 'camera' : task.source === 'profile' ? 'user' : 'edit-3'} 
                            size={12} 
                            color="#9CA3AF" 
                          />
                          <Text style={styles.sourceText}>
                            {task.source === 'email' ? 'Créée depuis un email' : 
                             task.source === 'photo' ? 'Créée depuis une photo' : 
                             task.source === 'profile' ? 'Rappel automatique' : 'Créée manuellement'}
                          </Text>
                        </View>
                      {task.description && (
                        <Text style={styles.taskDescription}>{task.description}</Text>
                      )}
                      {task.imageUrl && (
                        <TouchableOpacity
                          style={styles.attachmentButton}
                          onPress={() => {
                            // If PDF, use PDF viewer modal, otherwise open directly
                            if (task.imageUrl!.toLowerCase().includes('.pdf')) {
                              setPdfViewerUrl(task.imageUrl!);
                              setShowPdfViewer(true);
                            } else if (Platform.OS === 'web') {
                              window.open(task.imageUrl!, '_blank');
                            } else {
                              Linking.openURL(task.imageUrl!);
                            }
                          }}
                        >
                          <Feather name="paperclip" size={14} color="#3A82F7" />
                          <Text style={styles.attachmentButtonText}>Voir la pièce jointe</Text>
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
      </ScrollView>
      
      {/* Delete Confirmation Modal (Web) */}
      {Platform.OS === 'web' && deleteConfirmTaskId && (
        <Modal
          transparent={true}
          visible={true}
          onRequestClose={() => setDeleteConfirmTaskId(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Feather name="alert-triangle" size={32} color="#DC2626" style={{ marginBottom: 12 }} />
              <Text style={styles.modalTitle}>Supprimer cette tâche ?</Text>
              <Text style={styles.modalText}>
                Cette action supprimera également l'entrée associée dans la boîte de réception.
              </Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={() => setDeleteConfirmTaskId(null)}
                >
                  <Text style={styles.modalButtonCancelText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonDelete]}
                  onPress={confirmDeleteTask}
                >
                  <Text style={styles.modalButtonDeleteText}>Supprimer</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
      
      {/* Floating success toast - always visible */}
      {successMessage && (
        <View style={styles.floatingToast}>
          <Feather name="check-circle" size={20} color="#FFFFFF" />
          <Text style={styles.floatingToastText}>{successMessage}</Text>
        </View>
      )}
      
      {/* PDF Viewer Modal */}
      <PDFViewerModal
        visible={showPdfViewer}
        pdfUrl={pdfViewerUrl}
        title="Pièce jointe"
        onClose={() => {
          setShowPdfViewer(false);
          setPdfViewerUrl(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
    padding: 20,
  },
  floatingToast: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 9999,
  },
  floatingToastText: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '600',
    marginLeft: 12,
    flex: 1,
  },
  errorBanner: {
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#DC2626',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  errorText: {
    fontSize: 15,
    color: '#DC2626',
    fontWeight: '500',
    marginLeft: 8,
    flex: 1,
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
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2F5',
  },
  cardTitle: {
    fontSize: 20,
    color: '#2C3E50',
    fontWeight: '600',
    marginLeft: 10,
    letterSpacing: -0.3,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 8,
    letterSpacing: 0.2,
    textTransform: 'uppercase' as any,
  },
  input: {
    backgroundColor: '#F8F9FB',
    borderWidth: 1,
    borderColor: '#E9EEF2',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#2C3E50',
  },
  textArea: {
    height: 90,
    textAlignVertical: 'top',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FB',
    borderWidth: 1,
    borderColor: '#E9EEF2',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dateButtonText: {
    fontSize: 16,
    color: '#2C3E50',
    marginLeft: 8,
  },
  submitButton: {
    backgroundColor: '#3A82F7',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
    shadowColor: '#3A82F7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E9EEF2',
  },
  dividerText: {
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EBF5FF',
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#3A82F7',
    borderStyle: 'dashed',
  },
  photoButtonDisabled: {
    opacity: 0.7,
  },
  photoButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3A82F7',
    marginLeft: 8,
  },
  photoButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  photoButtonSmall: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EBF5FF',
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#3A82F7',
    borderStyle: 'dashed',
    gap: 6,
  },
  photoButtonSmallText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3A82F7',
  },
  photoHint: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  imageSourceModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  imageSourceTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C3E50',
    textAlign: 'center',
    marginBottom: 20,
  },
  imageSourceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2F5',
  },
  imageSourceIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EBF5FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  imageSourceTextContainer: {
    flex: 1,
  },
  imageSourceOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 2,
  },
  imageSourceOptionSubtitle: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  imageSourceCancelButton: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  imageSourceCancelText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6E7A84',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  placeholderText: {
    fontSize: 16,
    color: '#6E7A84',
    fontWeight: '400',
  },
  taskItem: {
    backgroundColor: '#FAFBFC',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E9EEF2',
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
    flex: 1,
    letterSpacing: -0.2,
  },
  taskMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginRight: 8,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '500',
  },
  categoryBadge: {
    backgroundColor: '#EBF5FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#3A82F7',
  },
  taskDeadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  taskDeadlineText: {
    fontSize: 14,
    color: '#6E7A84',
    marginLeft: 6,
  },
  overdueText: {
    color: '#DC2626',
    fontWeight: '500',
  },
  taskDescription: {
    fontSize: 14,
    color: '#6E7A84',
    marginTop: 4,
  },
  attachmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#EBF5FF',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  attachmentButtonText: {
    fontSize: 13,
    color: '#3A82F7',
    marginLeft: 6,
    fontWeight: '500',
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  sourceText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginLeft: 4,
    fontStyle: 'italic',
  },
  filterScrollView: {
    marginBottom: 16,
    flexGrow: 0,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F7FA',
    borderWidth: 1,
    borderColor: '#E9EEF2',
    marginRight: 8,
  },
  filterButtonActive: {
    backgroundColor: '#3A82F7',
    borderColor: '#3A82F7',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6E7A84',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  dropdownButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8F9FB',
    borderWidth: 1,
    borderColor: '#E9EEF2',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dropdownButtonText: {
    fontSize: 16,
    color: '#2C3E50',
  },
  dropdownList: {
    marginTop: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E9EEF2',
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2F5',
  },
  dropdownItemActive: {
    backgroundColor: '#EBF5FF',
  },
  dropdownItemText: {
    fontSize: 16,
    color: '#2C3E50',
  },
  dropdownItemTextActive: {
    color: '#3A82F7',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 8,
  },
  modalText: {
    fontSize: 14,
    color: '#6E7A84',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#F5F7FA',
    borderWidth: 1,
    borderColor: '#E9EEF2',
  },
  modalButtonCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6E7A84',
  },
  modalButtonDelete: {
    backgroundColor: '#DC2626',
  },
  modalButtonDeleteText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
