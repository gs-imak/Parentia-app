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
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { createTask, getAllTasks, deleteTask, type TaskCategory, type Task } from '../api/client';

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
  { value: 'personnel', label: 'Personnel' },
];

export default function TasksScreen() {
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
    // On web, skip confirmation and delete directly (or implement custom modal later)
    if (Platform.OS === 'web') {
      try {
        await deleteTask(taskId);
        await loadTasks();
      } catch (error) {
        setFormError('Impossible de supprimer la tâche.');
      }
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

  return (
    <ScrollView ref={scrollViewRef} style={styles.container}>
      {/* Success Message */}
      {successMessage && (
        <View style={styles.successBanner}>
          <Feather name="check-circle" size={20} color="#4CAF50" />
          <Text style={styles.successText}>{successMessage}</Text>
        </View>
      )}

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
          <View style={styles.categoryGrid}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.value}
                style={[
                  styles.categoryButton,
                  category === cat.value && styles.categoryButtonActive,
                ]}
                onPress={() => setCategory(cat.value)}
              >
                <Text
                  style={[
                    styles.categoryButtonText,
                    category === cat.value && styles.categoryButtonTextActive,
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Échéance *</Text>
{Platform.OS === 'web' ? (
            <input
              type="datetime-local"
              style={{
                borderWidth: 1,
                borderColor: '#E9EEF2',
                borderRadius: 12,
                paddingLeft: 16,
                paddingRight: 16,
                paddingTop: 12,
                paddingBottom: 12,
                fontSize: 16,
                color: '#2C3E50',
                backgroundColor: '#F8F9FB',
                width: '100%',
                fontFamily: 'system-ui',
                textAlign: 'left' as any,
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
                    day: '2-digit',
                    month: '2-digit',
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
      </View>

      {/* Task List Card */}
      <View style={styles.card}>
        <View style={styles.header}>
          <Feather name="list" size={20} color="#2C3E50" />
          <Text style={styles.cardTitle}>Toutes les tâches</Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#3A82F7" />
        ) : tasksError ? (
          <Text style={styles.errorText}>{tasksError}</Text>
        ) : tasks.length === 0 ? (
          <Text style={styles.placeholderText}>Aucune tâche pour le moment.</Text>
        ) : (
          <View>
            {tasks.map((task) => {
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
                <View key={task.id} style={styles.taskItem}>
                  <View style={styles.taskHeader}>
                    <Text style={styles.taskTitle}>{task.title}</Text>
                    <TouchableOpacity onPress={() => handleDelete(task.id)}>
                      <Feather name="trash-2" size={18} color="#DC2626" />
                    </TouchableOpacity>
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
                      {deadlineDate.toLocaleString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {isOverdue && ' (en retard)'}
                    </Text>
                  </View>
                  {task.description && (
                    <Text style={styles.taskDescription}>{task.description}</Text>
                  )}
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
    backgroundColor: '#F5F7FA',
    padding: 20,
  },
  successBanner: {
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  successText: {
    fontSize: 15,
    color: '#4CAF50',
    fontWeight: '500',
    marginLeft: 8,
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
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E9EEF2',
    backgroundColor: '#FFFFFF',
  },
  categoryButtonActive: {
    backgroundColor: '#3A82F7',
    borderColor: '#3A82F7',
  },
  categoryButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6E7A84',
  },
  categoryButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
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
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.5,
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
});
