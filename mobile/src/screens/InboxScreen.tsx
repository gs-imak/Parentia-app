import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Linking
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { fetchInbox, type InboxEntry } from '../api/client';

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
  
  return (
    <TouchableOpacity 
      style={styles.entryCard} 
      onPress={() => onPress(entry)}
      activeOpacity={0.7}
    >
      <View style={styles.entryHeader}>
        <View style={styles.entryIconContainer}>
          <Feather 
            name={isSuccess ? 'check-circle' : 'alert-circle'} 
            size={18} 
            color={isSuccess ? '#27AE60' : '#E74C3C'} 
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
        <View style={styles.taskBadge}>
          <Feather name="check-square" size={12} color="#3498DB" />
          <Text style={styles.taskBadgeText} numberOfLines={1}>
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

export default function InboxScreen() {
  const [entries, setEntries] = useState<InboxEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    // For now, just log the entry
    // In future: navigate to task details or show modal
    console.log('Entry pressed:', entry.id);
  }, []);

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
});
