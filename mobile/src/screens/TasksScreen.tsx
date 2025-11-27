import React, { useState, useEffect } from 'react';
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
import { Picker } from '@react-native-picker/picker';
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
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksError, setTasksError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
    if (!title.trim()) {
      Alert.alert('Erreur', 'Le titre est requis.');
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
      Alert.alert('Erreur', 'Impossible de créer la tâche.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (taskId: string) => {
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
            Alert.alert('Erreur', 'Impossible de supprimer la tâche.');
          }
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container}>
      {/* Success Message */}
      {successMessage && (
        <View style={styles.successBanner}>
          <Feather name="check-circle" size={20} color="#4CAF50" />
          <Text style={styles.successText}>{successMessage}</Text>
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
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={category}
              onValueChange={(value) => setCategory(value as TaskCategory)}
              style={styles.picker}
            >
              {CATEGORIES.map((cat) => (
                <Picker.Item key={cat.value} label={cat.label} value={cat.value} />
              ))}
            </Picker>
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Échéance *</Text>
{Platform.OS === 'web' ? (
            <TextInput
              style={styles.input}
              placeholder="AAAA-MM-JJ HH:MM"
              value={new Date(deadline.getTime() - deadline.getTimezoneOffset() * 60000)
                .toISOString()
                .slice(0, 16)
                .replace('T', ' ')}
              onChangeText={(text) => {
                // Expect format YYYY-MM-DD HH:mm
                const normalized = text.replace('T', ' ').trim();
                const [datePart, timePart] = normalized.split(' ');
                if (!datePart) return;
                const iso = `${datePart}${timePart ? 'T' + timePart : 'T00:00'}`;
                const d = new Date(iso);
                if (!isNaN(d.getTime())) setDeadline(d);
              }}
            />
          ) : (
            <>
              <TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
                <Feather name="calendar" size={18} color="#2C3E50" />
                <Text style={styles.dateButtonText}>
                  {deadline.toLocaleDateString('fr-FR', {
                    day: '2-digit',
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
                        month: 'short',
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
    backgroundColor: '#FFFFFF',
    padding: 20,
  },
  successBanner: {
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  successText: {
    fontSize: 15,
    color: '#4CAF50',
    fontWeight: '500',
    marginLeft: 8,
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
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 19,
    color: '#2C3E50',
    fontWeight: '600',
    marginLeft: 8,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 15,
    fontWeight: '500',
    color: '#2C3E50',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E9EEF2',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#2C3E50',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#E9EEF2',
    borderRadius: 8,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E9EEF2',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  dateButtonText: {
    fontSize: 16,
    color: '#2C3E50',
    marginLeft: 8,
  },
  submitButton: {
    backgroundColor: '#3A82F7',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
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
    borderBottomWidth: 1,
    borderBottomColor: '#E9EEF2',
    paddingVertical: 12,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2C3E50',
    flex: 1,
  },
  taskMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginRight: 8,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '500',
  },
  categoryBadge: {
    backgroundColor: '#EBF5FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
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
