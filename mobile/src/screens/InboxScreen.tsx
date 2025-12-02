import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Linking,
  Modal,
  TextInput,
  ScrollView,
  Alert
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { fetchInbox, deleteInboxEntry, createTask, type InboxEntry, type TaskCategory } from '../api/client';

// Format date for display
function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  
  if (isToday) {
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }
  
  return date.toLocaleDateString('fr-FR', { 
    day: '2-digit', 
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Truncate string with ellipsis
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

interface InboxItemProps {
  entry: InboxEntry;
  onPress: (entry: InboxEntry) => void;
}

function InboxItem({ entry, onPress }: InboxItemProps) {
  const isSuccess = entry.status === 'success';
  const isIgnored = entry.taskTitle === '(Newsletter/Promo - ignoré)';
  
  return (
    <TouchableOpacity 
      style={styles.entryCard} 
      onPress={() => onPress(entry)}
      activeOpacity={0.7}
    >
      <View style={styles.entryHeader}>
        <View style={styles.entryIconContainer}>
          <Feather 
            name={isSuccess ? (isIgnored ? 'slash' : 'check-circle') : 'alert-circle'} 
            size={18} 
            color={isSuccess ? (isIgnored ? '#95A5A6' : '#27AE60') : '#E74C3C'} 
          />
        </View>
        <View style={styles.entryContent}>
          <Text style={styles.entrySubject} numberOfLines={1}>
            {entry.subject || 'Sans sujet'}
          </Text>
          <Text style={styles.entrySender} numberOfLines={1}>
            {truncate(entry.from, 35)}
          </Text>
        </View>
        <Text style={styles.entryDate}>
          {formatDate(entry.receivedAt)}
        </Text>
      </View>
      
      {isSuccess && entry.taskTitle && (
        <View style={[styles.taskBadge, isIgnored && styles.taskBadgeIgnored]}>
          <Feather name={isIgnored ? 'slash' : 'check-square'} size={12} color={isIgnored ? '#95A5A6' : '#3498DB'} />
          <Text style={[styles.taskBadgeText, isIgnored && styles.taskBadgeTextIgnored]} numberOfLines={1}>
            {truncate(entry.taskTitle, 40)}
          </Text>
        </View>
      )}
      
      {!isSuccess && entry.errorMessage && (
        <View style={styles.errorBadge}>
          <Text style={styles.errorBadgeText} numberOfLines={1}>
            {entry.errorMessage}
          </Text>
        </View>
      )}
      
      {entry.attachmentUrl && (
        <TouchableOpacity 
          style={styles.attachmentBadge}
          onPress={() => Linking.openURL(entry.attachmentUrl!)}
        >
          <Feather name="paperclip" size={12} color="#6E7A84" />
          <Text style={styles.attachmentText}>Pièce jointe</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const CATEGORIES: { value: TaskCategory; label: string }[] = [
  { value: 'administratif', label: 'Administratif' },
  { value: 'enfants-école', label: 'Enfants & École' },
  { value: 'santé', label: 'Santé' },
  { value: 'finances', label: 'Finances' },
  { value: 'logement', label: 'Logement' },
  { value: 'personnel', label: 'Personnel' },
];

export default function InboxScreen() {
  const [entries, setEntries] = useState<InboxEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Modal state for ignored entries
  const [selectedEntry, setSelectedEntry] = useState<InboxEntry | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskCategory, setTaskCategory] = useState<TaskCategory>('personnel');
  const [taskDeadline, setTaskDeadline] = useState(new Date());
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadInbox = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      
      const data = await fetchInbox();
      setEntries(data.entries);
    } catch (err) {
      setError('Impossible de charger la boîte de réception');
      console.error('Inbox load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadInbox();
  }, [loadInbox]);

  const handleEntryPress = useCallback((entry: InboxEntry) => {
    const isIgnored = entry.taskTitle === '(Newsletter/Promo - ignoré)';
    
    if (isIgnored) {
      // Show modal for ignored entries
      setSelectedEntry(entry);
      setTaskTitle(entry.subject || '');
      setTaskCategory('personnel');
      setTaskDeadline(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)); // 7 days from now
      setShowModal(true);
    }
  }, []);
  
  const handleCreateTask = async () => {
    if (!taskTitle.trim()) return;
    
    setSubmitting(true);
    try {
      await createTask({
        title: taskTitle.trim(),
        category: taskCategory,
        deadline: taskDeadline.toISOString(),
      });
      setShowModal(false);
      Alert.alert('Succès', 'Tâche créée avec succès');
      await loadInbox();
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de créer la tâche');
    } finally {
      setSubmitting(false);
    }
  };
  
  const handleDeleteEntry = async () => {
    if (!selectedEntry) return;
    
    setSubmitting(true);
    try {
      await deleteInboxEntry(selectedEntry.id);
      setShowModal(false);
      await loadInbox();
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de supprimer l\'entrée');
    } finally {
      setSubmitting(false);
    }
  };

  const renderItem = useCallback(({ item }: { item: InboxEntry }) => (
    <InboxItem entry={item} onPress={handleEntryPress} />
  ), [handleEntryPress]);

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Feather name="inbox" size={48} color="#BDC3C7" />
      <Text style={styles.emptyTitle}>Aucun email traité</Text>
      <Text style={styles.emptyText}>
        Les emails envoyés à votre adresse dédiée apparaîtront ici.
      </Text>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3498DB" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <View style={styles.headerRow}>
          <Feather name="mail" size={22} color="#2C3E50" />
          <Text style={styles.headerTitle}>Boîte de réception</Text>
        </View>
        <Text style={styles.headerSubtitle}>
          {entries.length} email{entries.length !== 1 ? 's' : ''} traité{entries.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => loadInbox()}>
            <Text style={styles.retryText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={entries}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={entries.length === 0 ? styles.emptyList : styles.list}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadInbox(true)}
            colors={['#3498DB']}
            tintColor="#3498DB"
          />
        }
        showsVerticalScrollIndicator={false}
      />
      
      {/* Modal for ignored emails */}
      {showModal && selectedEntry && (
        <Modal
          transparent={true}
          visible={true}
          animationType="fade"
          onRequestClose={() => setShowModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Email ignoré</Text>
                <TouchableOpacity onPress={() => setShowModal(false)}>
                  <Feather name="x" size={24} color="#6E7A84" />
                </TouchableOpacity>
              </View>
              
              <Text style={styles.modalSubtitle}>Cet email a été classé comme newsletter/promo. Vous pouvez :</Text>
              
              <View style={styles.modalSection}>
                <Text style={styles.sectionTitle}>Créer une tâche manuellement</Text>
                
                <TextInput
                  style={styles.input}
                  placeholder="Titre de la tâche"
                  value={taskTitle}
                  onChangeText={setTaskTitle}
                />
                
                <TouchableOpacity
                  style={styles.pickerButton}
                  onPress={() => setShowCategoryPicker(!showCategoryPicker)}
                >
                  <Text style={styles.pickerButtonText}>
                    {CATEGORIES.find(c => c.value === taskCategory)?.label || 'Catégorie'}
                  </Text>
                  <Feather name="chevron-down" size={18} color="#6E7A84" />
                </TouchableOpacity>
                
                {showCategoryPicker && (
                  <View style={styles.categoryPicker}>
                    {CATEGORIES.map((cat) => (
                      <TouchableOpacity
                        key={cat.value}
                        style={styles.categoryOption}
                        onPress={() => {
                          setTaskCategory(cat.value);
                          setShowCategoryPicker(false);
                        }}
                      >
                        <Text style={styles.categoryOptionText}>{cat.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonPrimary, submitting && styles.modalButtonDisabled]}
                  onPress={handleCreateTask}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.modalButtonTextPrimary}>Créer la tâche</Text>
                  )}
                </TouchableOpacity>
              </View>
              
              <View style={styles.modalDivider} />
              
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonDelete]}
                onPress={handleDeleteEntry}
                disabled={submitting}
              >
                <Text style={styles.modalButtonTextDelete}>Supprimer cet email</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  headerContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E9EEF2',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#2C3E50',
    marginLeft: 10,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6E7A84',
    marginTop: 4,
    marginLeft: 32,
  },
  list: {
    padding: 16,
  },
  emptyList: {
    flex: 1,
  },
  entryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E9EEF2',
  },
  entryHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  entryIconContainer: {
    marginRight: 10,
    marginTop: 2,
  },
  entryContent: {
    flex: 1,
  },
  entrySubject: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 2,
  },
  entrySender: {
    fontSize: 13,
    color: '#6E7A84',
  },
  entryDate: {
    fontSize: 12,
    color: '#95A5A6',
    marginLeft: 8,
  },
  taskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF5FB',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginTop: 10,
  },
  taskBadgeText: {
    fontSize: 13,
    color: '#2980B9',
    marginLeft: 6,
    flex: 1,
  },
  errorBadge: {
    backgroundColor: '#FDEDEC',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginTop: 10,
  },
  errorBadgeText: {
    fontSize: 13,
    color: '#C0392B',
  },
  attachmentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  attachmentText: {
    fontSize: 12,
    color: '#6E7A84',
    marginLeft: 4,
    textDecorationLine: 'underline',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C3E50',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#6E7A84',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  errorContainer: {
    backgroundColor: '#FDEDEC',
    padding: 12,
    margin: 16,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#C0392B',
    flex: 1,
  },
  retryText: {
    fontSize: 14,
    color: '#3498DB',
    fontWeight: '600',
    marginLeft: 12,
  },
  taskBadgeIgnored: {
    backgroundColor: '#F5F5F5',
  },
  taskBadgeTextIgnored: {
    color: '#95A5A6',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    maxWidth: 500,
    width: '100%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2C3E50',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6E7A84',
    marginBottom: 20,
    lineHeight: 20,
  },
  modalSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E9EEF2',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#2C3E50',
    marginBottom: 12,
  },
  pickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E9EEF2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  pickerButtonText: {
    fontSize: 15,
    color: '#2C3E50',
  },
  categoryPicker: {
    borderWidth: 1,
    borderColor: '#E9EEF2',
    borderRadius: 8,
    marginBottom: 12,
  },
  categoryOption: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E9EEF2',
  },
  categoryOptionText: {
    fontSize: 15,
    color: '#2C3E50',
  },
  modalButton: {
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  modalButtonPrimary: {
    backgroundColor: '#3498DB',
  },
  modalButtonDelete: {
    backgroundColor: '#F5F5F5',
  },
  modalButtonDisabled: {
    opacity: 0.5,
  },
  modalButtonTextPrimary: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalButtonTextDelete: {
    fontSize: 15,
    fontWeight: '600',
    color: '#DC2626',
  },
  modalDivider: {
    height: 1,
    backgroundColor: '#E9EEF2',
    marginVertical: 16,
  },
});
