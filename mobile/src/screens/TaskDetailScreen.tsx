import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Modal,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Platform,
  Alert,
  TextInput,
  Image,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { formatDateFrench, formatTaskDeadlineFrench } from '../utils/dateFormat';
import {
  type Task,
  type PDFTemplate,
  type TaskCategory,
  updateTask,
  deleteTask,
  fetchPDFTemplates,
  generatePDF,
  downloadPDFBlob,
  getMessageDraft,
} from '../api/client';
import PDFViewerModal from '../components/PDFViewerModal';

// Conditionally import DateTimePicker only for mobile
let DateTimePicker: any = null;
if (Platform.OS !== 'web') {
  DateTimePicker = require('@react-native-community/datetimepicker').default;
}

interface TaskDetailScreenProps {
  task: Task;
  onClose: () => void;
  onTaskUpdated: (task: Task) => void;
  onTaskDeleted: (taskId: string) => void;
}

// Category labels in French
const CATEGORY_LABELS: Record<string, string> = {
  'administratif': 'Administratif',
  'enfants-école': 'Enfants & École',
  'santé': 'Santé',
  'finances': 'Finances',
  'logement': 'Logement',
  'personnel': 'Personnel',
};

// Source labels
const SOURCE_LABELS: Record<string, string> = {
  'email': '📧 Email',
  'photo': '📷 Photo',
  'manual': '✏️ Manuel',
  'profile': '👤 Profil',
};

// Template type labels
const TEMPLATE_TYPE_LABELS: Record<string, string> = {
  'lettre': 'Lettre',
  'attestation': 'Attestation',
  'formulaire': 'Formulaire',
  'note': 'Note',
};

// Template category labels
const TEMPLATE_CATEGORY_LABELS: Record<string, string> = {
  'ecole': 'École',
  'creche': 'Crèche',
  'sante_mutuelle': 'Santé & Mutuelle',
  'logement': 'Logement',
  'administratif': 'Administratif',
  'banque': 'Banque',
  'travail': 'Travail',
  'contrat_facture': 'Contrat & Facture',
  'attestation': 'Attestation',
  'documents': 'Documents',
};

const PAYMENT_KEYWORDS = [
  'payer',
  'paiement',
  'facture',
  'à régler',
  'regler',
  'règlement',
  'échéance',
  'montant',
  'prélèvement',
  'prelevement',
];

const DISPUTE_KEYWORDS = [
  'contestation',
  'contester',
  'réclamation',
  'reclamation',
  'litige',
  'erreur',
  'incorrect',
  'abusif',
  'double',
  'fraude',
];

const PAYMENT_OPTIONAL_TEMPLATE_IDS = new Set([
  'facture_contestation',
  'contrat_resiliation',
  'documents_reclamation',
]);

function detectPaymentContext(task: Task) {
  const haystack = `${task.title} ${task.description || ''}`.toLowerCase();
  const isPayment = PAYMENT_KEYWORDS.some((kw) => haystack.includes(kw));
  const isDispute = DISPUTE_KEYWORDS.some((kw) => haystack.includes(kw));
  return { isPayment, isDispute };
}

function filterTemplatesForTask(templates: PDFTemplate[], task: Task) {
  const { isPayment, isDispute } = detectPaymentContext(task);
  
  // Payment tasks: keep a strict, safe set of optional templates (no attestations/etc)
  if (isPayment && !isDispute) {
    return templates.filter((t) => PAYMENT_OPTIONAL_TEMPLATE_IDS.has(t.id));
  }

  // For contested invoices, only keep the contestation template
  if (isPayment && isDispute) {
    return templates.filter(t => t.id === 'facture_contestation');
  }

  return templates;
}

export default function TaskDetailScreen({
  task,
  onClose,
  onTaskUpdated,
  onTaskDeleted,
}: TaskDetailScreenProps) {
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<PDFTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);
  const [showAllTemplates, setShowAllTemplates] = useState(false);
  const [allTemplates, setAllTemplates] = useState<PDFTemplate[]>([]);
  const [loadingAllTemplates, setLoadingAllTemplates] = useState(false);
  
  // Message draft modal
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageChannel, setMessageChannel] = useState<'email' | 'sms' | 'whatsapp'>('email');
  const [messageDraft, setMessageDraft] = useState<{ subject?: string; body: string } | null>(null);
  const [loadingMessage, setLoadingMessage] = useState(false);
  const [quickContactLoading, setQuickContactLoading] = useState<'email' | 'sms' | 'whatsapp' | null>(null);
  
  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  // Image viewer
  const [showImageViewer, setShowImageViewer] = useState(false);
  
  // Edit title/category/deadline
  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editingCategory, setEditingCategory] = useState(false);
  const [editCategory, setEditCategory] = useState(task.category);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [editingDeadline, setEditingDeadline] = useState(false);
  const [editDeadline, setEditDeadline] = useState(new Date(task.deadline));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [editDescription, setEditDescription] = useState(task.description || '');
  
  // PDF viewer modal
  const [showPdfViewer, setShowPdfViewer] = useState(false);
  const [pdfViewerUrl, setPdfViewerUrl] = useState<string | null>(null);
  
  // Phone action sheet
  const [showPhoneActions, setShowPhoneActions] = useState(false);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);

  useEffect(() => {
    loadSuggestedTemplates();
    // Sync edit states when task updates
    setEditTitle(task.title);
    setEditCategory(task.category);
    setEditDeadline(new Date(task.deadline));
    setEditDescription(task.description || '');
  }, [task]);

  // Inject CSS keyframes for web action sheet animation
  useEffect(() => {
    if (Platform.OS === 'web') {
      const styleId = 'action-sheet-keyframes';
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
          @keyframes slideUp {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
          }
        `;
        document.head.appendChild(style);
      }
    }
  }, []);

  const loadSuggestedTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const paymentContext = detectPaymentContext(task);

      // First, check if task has AI-suggested templates
      if (task.suggestedTemplates && task.suggestedTemplates.length > 0) {
        // Load all templates and filter to AI-suggested ones
        const result = await fetchPDFTemplates();
        const aiSuggested = result.templates.filter(t => task.suggestedTemplates!.includes(t.id));
        const filteredAi = filterTemplatesForTask(aiSuggested, task);
        
        // If we have AI suggestions, use them first
        if (filteredAi.length > 0) {
          // Show up to 3 AI-suggested templates
          setTemplates(filteredAi.slice(0, 3));
          setLoadingTemplates(false);
          return;
        }
      }

      // For simple payment tasks, do not fallback to category templates
      if (paymentContext.isPayment && !paymentContext.isDispute) {
        // Safe fallback suggestions (invoice-related only)
        const result = await fetchPDFTemplates();
        const filtered = filterTemplatesForTask(result.templates, task);
        setTemplates(filtered.slice(0, 3));
        setLoadingTemplates(false);
        return;
      }
      
      // Fallback: load templates for task's category
      const result = await fetchPDFTemplates({ taskCategory: task.category });
      const filtered = filterTemplatesForTask(result.templates, task);
      setTemplates(filtered.slice(0, 3)); // Show max 3 suggestions
    } catch (error) {
      console.error('Failed to load templates:', error);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const loadAllTemplates = async () => {
    setLoadingAllTemplates(true);
    try {
      const result = await fetchPDFTemplates();
      setAllTemplates(result.templates);
      setShowAllTemplates(true);
    } catch (error) {
      console.error('Failed to load all templates:', error);
    } finally {
      setLoadingAllTemplates(false);
    }
  };

  const handleGeneratePdf = async (templateId: string) => {
    setGeneratingPdf(templateId);
    try {
      // Generate PDF and get URL
      const result = await generatePDF({
        templateId,
        taskId: task.id,
      });
      
      if (result.pdfUrl) {
        // Show PDF in viewer modal
        setPdfViewerUrl(result.pdfUrl);
        setShowPdfViewer(true);
      } else {
        Alert.alert('Erreur', 'Le PDF a été généré mais l\'URL n\'est pas disponible.');
      }
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      Alert.alert('Erreur', 'Impossible de générer le PDF.');
    } finally {
      setGeneratingPdf(null);
    }
  };

  const handleContactAction = async (channel: 'email' | 'sms' | 'whatsapp') => {
    setMessageChannel(channel);
    setLoadingMessage(true);
    setShowMessageModal(true);
    
    try {
      const draft = await getMessageDraft(task.id, channel);
      setMessageDraft({ subject: draft.subject, body: draft.body });
    } catch (error) {
      console.error('Failed to get message draft:', error);
      // Fallback to simple message
      setMessageDraft({
        subject: channel === 'email' ? `À propos de : ${task.title}` : undefined,
        body: `Bonjour,\n\nJe vous contacte concernant : ${task.title}.\n\nCordialement`,
      });
    } finally {
      setLoadingMessage(false);
    }
  };

  const openChannelWithDraft = async (channel: 'email' | 'sms' | 'whatsapp') => {
    const recipient = channel === 'email' ? task.contactEmail : task.contactPhone;
    if (!recipient) {
      Alert.alert('Erreur', 'Aucun contact disponible.');
      return;
    }

    setQuickContactLoading(channel);
    try {
      let draft: { subject?: string; body: string };
      try {
        const aiDraft = await getMessageDraft(task.id, channel);
        draft = { subject: aiDraft.subject, body: aiDraft.body };
      } catch {
        draft = {
          subject: channel === 'email' ? `À propos de : ${task.title}` : undefined,
          body: `Bonjour,\n\nJe vous contacte concernant : ${task.title}.\n\nCordialement`,
        };
      }

      let url = '';
      if (channel === 'email') {
        const subject = encodeURIComponent(draft.subject || '');
        const body = encodeURIComponent(draft.body);
        url = `mailto:${recipient}?subject=${subject}&body=${body}`;
      } else if (channel === 'sms') {
        const body = encodeURIComponent(draft.body);
        url = Platform.OS === 'ios'
          ? `sms:${recipient}&body=${body}`
          : `sms:${recipient}?body=${body}`;
      } else {
        const cleanPhone = recipient.replace(/[^0-9+]/g, '');
        const body = encodeURIComponent(draft.body);
        url = `https://wa.me/${cleanPhone}?text=${body}`;
      }

      if (Platform.OS === 'web') {
        if (channel === 'whatsapp') {
          window.open(url, '_blank', 'noopener,noreferrer');
        } else {
          const link = document.createElement('a');
          link.href = url;
          link.rel = 'noopener noreferrer';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      } else {
        await Linking.openURL(url);
      }
    } catch (error) {
      console.error('Failed to open contact channel:', error);
      Alert.alert('Erreur', 'Impossible d\'ouvrir l\'application.');
    } finally {
      setQuickContactLoading(null);
    }
  };

  const handleSendMessage = async () => {
    if (!messageDraft) return;
    
    const recipient = messageChannel === 'email' ? task.contactEmail : task.contactPhone;
    if (!recipient) {
      Alert.alert('Erreur', 'Aucun contact disponible.');
      return;
    }
    
    let url = '';
    
    if (messageChannel === 'email') {
      const subject = encodeURIComponent(messageDraft.subject || '');
      const body = encodeURIComponent(messageDraft.body);
      url = `mailto:${recipient}?subject=${subject}&body=${body}`;
    } else if (messageChannel === 'sms') {
      const body = encodeURIComponent(messageDraft.body);
      url = Platform.OS === 'ios' 
        ? `sms:${recipient}&body=${body}`
        : `sms:${recipient}?body=${body}`;
    } else if (messageChannel === 'whatsapp') {
      const cleanPhone = recipient.replace(/[^0-9+]/g, '');
      const body = encodeURIComponent(messageDraft.body);
      url = `https://wa.me/${cleanPhone}?text=${body}`;
    }
    
    try {
      // On web, directly open URLs without canOpenURL check (it's unreliable on web)
      if (Platform.OS === 'web') {
        // For web, use window.open for mailto/sms and direct navigation for WhatsApp
        if (messageChannel === 'whatsapp') {
          window.open(url, '_blank');
        } else {
          // For mailto/sms, create temporary link and click it
          window.location.href = url;
        }
        setShowMessageModal(false);
      } else {
        // Native platforms: check if URL can be opened first
        const canOpen = await Linking.canOpenURL(url);
        if (canOpen) {
          await Linking.openURL(url);
          setShowMessageModal(false);
        } else {
          Alert.alert('Erreur', 'Impossible d\'ouvrir l\'application de messagerie.');
        }
      }
    } catch (error) {
      console.error('Failed to open messaging app:', error);
      Alert.alert('Erreur', 'Impossible d\'ouvrir l\'application.');
    }
  };

  const handleStatusChange = async (newStatus: 'todo' | 'in_progress' | 'done') => {
    setLoading(true);
    try {
      const updated = await updateTask(task.id, { status: newStatus });
      onTaskUpdated(updated);
    } catch (error) {
      console.error('Failed to update status:', error);
      Alert.alert('Erreur', 'Impossible de mettre à jour le statut.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteTask(task.id);
      onTaskDeleted(task.id);
      onClose();
    } catch (error) {
      console.error('Failed to delete task:', error);
      Alert.alert('Erreur', 'Impossible de supprimer la tâche.');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleCategoryChange = async (newCategory: typeof task.category) => {
    setLoading(true);
    try {
      const updated = await updateTask(task.id, { category: newCategory });
      onTaskUpdated(updated);
      setEditingCategory(false);
    } catch (error) {
      console.error('Failed to update category:', error);
      Alert.alert('Erreur', 'Impossible de mettre à jour la catégorie.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeadlineChange = async () => {
    setLoading(true);
    try {
      const updated = await updateTask(task.id, { deadline: editDeadline.toISOString() });
      onTaskUpdated(updated);
      setEditingDeadline(false);
    } catch (error) {
      console.error('Failed to update deadline:', error);
      Alert.alert('Erreur', 'Impossible de mettre à jour l\'échéance.');
    } finally {
      setLoading(false);
    }
  };

  const handleTitleChange = async () => {
    if (!editTitle.trim()) {
      Alert.alert('Erreur', 'Le titre ne peut pas être vide.');
      return;
    }
    setLoading(true);
    try {
      const updated = await updateTask(task.id, { title: editTitle.trim() });
      onTaskUpdated(updated);
      setEditingTitle(false);
    } catch (error) {
      console.error('Failed to update title:', error);
      Alert.alert('Erreur', 'Impossible de mettre à jour le titre.');
    } finally {
      setLoading(false);
    }
  };

  const handleDescriptionChange = async () => {
    setLoading(true);
    try {
      const nextDescription = editDescription.trim();
      const updated = await updateTask(task.id, { description: nextDescription });
      onTaskUpdated(updated);
      setEditingDescription(false);
    } catch (error) {
      console.error('Failed to update description:', error);
      Alert.alert('Erreur', 'Impossible de modifier la description.');
    } finally {
      setLoading(false);
    }
  };

  const formattedDeadline = formatTaskDeadlineFrench(task.deadline);
  const hasContact = task.contactEmail || task.contactPhone;
  const hasAttachment = task.imageUrl;
  const paymentContext = detectPaymentContext(task);
  const noTemplateMessage = paymentContext.isPayment && !paymentContext.isDispute
    ? 'Aucun document obligatoire. Si besoin : contestation, résiliation ou réclamation.'
    : 'Aucun modèle suggéré pour cette catégorie.';

  // Phone/email detection in description
  const detectContactsInDescription = (text: string): Array<{ type: 'text' | 'phone' | 'email', value: string }> => {
    // Match French phone numbers with or without spaces/dots/dashes
    const phoneRegex = /(?:(?:\+|00)33|0)\s?[1-9](?:[\s.-]?[0-9]{2}){4}/g;
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    
    const parts: Array<{ type: 'text' | 'phone' | 'email', value: string, index: number }> = [];
    
    // Find phones
    let match;
    while ((match = phoneRegex.exec(text)) !== null) {
      parts.push({ type: 'phone', value: match[0], index: match.index });
    }
    
    // Find emails
    while ((match = emailRegex.exec(text)) !== null) {
      parts.push({ type: 'email', value: match[0], index: match.index });
    }
    
    // Sort by index
    parts.sort((a, b) => a.index - b.index);
    
    // Build result with text parts
    const result: Array<{ type: 'text' | 'phone' | 'email', value: string }> = [];
    let lastIndex = 0;
    
    for (const part of parts) {
      if (part.index > lastIndex) {
        result.push({ type: 'text', value: text.substring(lastIndex, part.index) });
      }
      result.push({ type: part.type, value: part.value });
      lastIndex = part.index + part.value.length;
    }
    
    if (lastIndex < text.length) {
      result.push({ type: 'text', value: text.substring(lastIndex) });
    }
    
    return result.length > 0 ? result : [{ type: 'text', value: text }];
  };

  const handleDescriptionContact = (type: 'phone' | 'email', value: string) => {
    if (type === 'phone') {
      Alert.alert(
        'Contacter',
        `Que souhaitez-vous faire avec ${value} ?`,
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Appeler', onPress: () => Linking.openURL(`tel:${value}`) },
          { text: 'SMS', onPress: () => Linking.openURL(`sms:${value}`) },
          { text: 'WhatsApp', onPress: () => Linking.openURL(`whatsapp://send?phone=${value}`) },
        ]
      );
    } else {
      Linking.openURL(`mailto:${value}`);
    }
  };

  return (
    <Modal
      visible={true}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Feather name="x" size={24} color="#2C3E50" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Détail de la tâche</Text>
          <TouchableOpacity 
            onPress={() => setShowDeleteConfirm(true)} 
            style={styles.deleteButton}
          >
            <Feather name="trash-2" size={20} color="#DC2626" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView}>
          {/* Task Info Card */}
          <View style={styles.card}>
            <TouchableOpacity 
              style={styles.titleContainer}
              onPress={() => setEditingTitle(true)}
            >
              <Text style={styles.taskTitle}>{task.title}</Text>
              <Feather name="edit-2" size={16} color="#6E7A84" style={{ marginLeft: 8 }} />
            </TouchableOpacity>
            
            <View style={styles.metaRow}>
              <TouchableOpacity
                style={styles.categoryBadge}
                onPress={() => setEditingCategory(true)}
              >
                <Text style={styles.categoryBadgeText}>
                  {CATEGORY_LABELS[task.category] || task.category}
                </Text>
                <Feather name="edit-2" size={12} color="#3A82F7" style={{ marginLeft: 6 }} />
              </TouchableOpacity>
              {task.source && (
                <View style={styles.sourceBadge}>
                  <Text style={styles.sourceBadgeText}>
                    {SOURCE_LABELS[task.source] || task.source}
                  </Text>
                </View>
              )}
            </View>

            <TouchableOpacity
              style={styles.deadlineRow}
              onPress={() => setEditingDeadline(true)}
            >
              <Feather name="calendar" size={16} color="#6E7A84" />
              <Text style={styles.deadlineText}>Échéance : {formattedDeadline}</Text>
              <Feather name="edit-2" size={14} color="#6E7A84" style={{ marginLeft: 6 }} />
            </TouchableOpacity>

            <View style={styles.descriptionSection}>
              <View style={styles.descriptionHeaderRow}>
                <Text style={styles.sectionLabel}>Description</Text>
                <TouchableOpacity
                  style={styles.descriptionEditButton}
                  onPress={() => setEditingDescription(true)}
                >
                  <Feather name="edit-2" size={14} color="#6E7A84" />
                  <Text style={styles.descriptionEditButtonText}>
                    {task.description ? 'Modifier' : 'Ajouter'}
                  </Text>
                </TouchableOpacity>
              </View>
              {task.description ? (
                Platform.OS === 'web' ? (
                  <div style={{ fontSize: 15, color: '#2C3E50', lineHeight: '22px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    {detectContactsInDescription(task.description).map((part, index) => {
                      if (part.type === 'text') {
                        return <span key={index}>{part.value}</span>;
                      }
                      if (part.type === 'phone') {
                        return (
                          <a
                            key={index}
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              setSelectedPhone(part.value);
                              setShowPhoneActions(true);
                            }}
                            style={{
                              color: '#3A82F7',
                              textDecoration: 'underline',
                              fontWeight: 500,
                              cursor: 'pointer',
                            }}
                          >
                            {part.value}
                          </a>
                        );
                      }
                      return (
                        <a
                          key={index}
                          href={`mailto:${part.value}`}
                          style={{
                            color: '#3A82F7',
                            textDecoration: 'underline',
                            fontWeight: 500,
                            cursor: 'pointer',
                          }}
                        >
                          {part.value}
                        </a>
                      );
                    })}
                  </div>
                ) : (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                    {detectContactsInDescription(task.description).map((part, index) => {
                      if (part.type === 'text') {
                        return <Text key={index} style={styles.descriptionText}>{part.value}</Text>;
                      }
                      return (
                        <Pressable
                          key={index}
                          onPress={() => handleDescriptionContact(part.type as 'phone' | 'email', part.value)}
                          style={{ alignSelf: 'flex-start' }}
                        >
                          <Text style={[styles.descriptionText, styles.contactLink]}>
                            {part.value}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )
              ) : (
                <Text style={styles.descriptionEmptyText}>
                  Aucune description. Vous pouvez en ajouter pour préciser la tâche.
                </Text>
              )}
            </View>

            {/* Status Buttons */}
            <View style={styles.statusSection}>
              <Text style={styles.sectionLabel}>Statut</Text>
              <View style={styles.statusButtons}>
                <TouchableOpacity
                  style={[
                    styles.statusButton,
                    task.status === 'todo' && styles.statusButtonActive,
                  ]}
                  onPress={() => handleStatusChange('todo')}
                  disabled={loading}
                >
                  <Text style={[
                    styles.statusButtonText,
                    task.status === 'todo' && styles.statusButtonTextActive,
                  ]}>À faire</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.statusButton,
                    task.status === 'in_progress' && styles.statusButtonActiveProgress,
                  ]}
                  onPress={() => handleStatusChange('in_progress')}
                  disabled={loading}
                >
                  <Text style={[
                    styles.statusButtonText,
                    task.status === 'in_progress' && styles.statusButtonTextActive,
                  ]}>En cours</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.statusButton,
                    task.status === 'done' && styles.statusButtonActiveDone,
                  ]}
                  onPress={() => handleStatusChange('done')}
                  disabled={loading}
                >
                  <Text style={[
                    styles.statusButtonText,
                    task.status === 'done' && styles.statusButtonTextActive,
                  ]}>Terminé</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Actions Card */}
          {(hasAttachment || hasContact) && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Actions</Text>
              
              {hasAttachment && (
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => {
                    // Prefer PDF viewer when link ends with .pdf or content is a PDF URL
                    if (task.imageUrl && task.imageUrl.toLowerCase().includes('.pdf')) {
                      setPdfViewerUrl(task.imageUrl);
                      setShowPdfViewer(true);
                    } else {
                      setShowImageViewer(true);
                    }
                  }}
                >
                  <Feather name="paperclip" size={20} color="#3A82F7" />
                  <Text style={styles.actionButtonText}>Voir la pièce jointe</Text>
                  <Feather name="external-link" size={16} color="#6E7A84" />
                </TouchableOpacity>
              )}

              {hasContact && (
                <View style={styles.contactSection}>
                  <View style={styles.contactHeaderRow}>
                    <Text style={styles.contactLabel}>
                      Contacter {task.contactName || 'le destinataire'}
                    </Text>
                    <TouchableOpacity
                      style={styles.contactDraftButton}
                      onPress={() => handleContactAction(task.contactEmail ? 'email' : 'sms')}
                    >
                      <Feather name="edit-2" size={14} color="#6E7A84" />
                      <Text style={styles.contactDraftButtonText}>Brouillon</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.contactButtons}>
                    {task.contactEmail && (
                      <TouchableOpacity
                        style={styles.contactButton}
                        onPress={() => openChannelWithDraft('email')}
                        disabled={quickContactLoading === 'email'}
                      >
                        {quickContactLoading === 'email' ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Feather name="mail" size={20} color="#FFFFFF" />
                        )}
                        <Text style={styles.contactButtonText}>Email</Text>
                      </TouchableOpacity>
                    )}
                    {task.contactPhone && (
                      <>
                        <TouchableOpacity
                          style={[styles.contactButton, styles.contactButtonSms]}
                          onPress={() => openChannelWithDraft('sms')}
                          disabled={quickContactLoading === 'sms'}
                        >
                          {quickContactLoading === 'sms' ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <Feather name="message-square" size={20} color="#FFFFFF" />
                          )}
                          <Text style={styles.contactButtonText}>SMS</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.contactButton, styles.contactButtonWhatsapp]}
                          onPress={() => openChannelWithDraft('whatsapp')}
                          disabled={quickContactLoading === 'whatsapp'}
                        >
                          {quickContactLoading === 'whatsapp' ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <Feather name="message-circle" size={20} color="#FFFFFF" />
                          )}
                          <Text style={styles.contactButtonText}>WhatsApp</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Documents Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Documents suggérés</Text>
            
            {loadingTemplates ? (
              <ActivityIndicator color="#3A82F7" style={{ marginVertical: 16 }} />
            ) : templates.length > 0 ? (
              <View>
                {templates.map((template) => (
                  <View key={template.id} style={styles.templateItem}>
                    <View style={styles.templateInfo}>
                      <Text style={styles.templateLabel}>{template.label}</Text>
                      <Text style={styles.templateType}>{TEMPLATE_TYPE_LABELS[template.type] || template.type}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.generateButton}
                      onPress={() => handleGeneratePdf(template.id)}
                      disabled={generatingPdf === template.id}
                    >
                      {generatingPdf === template.id ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Feather name="file-text" size={16} color="#FFFFFF" />
                          <Text style={styles.generateButtonText}>Générer</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.noTemplatesText}>
                {noTemplateMessage}
              </Text>
            )}

            <TouchableOpacity
              style={styles.showAllButton}
              onPress={loadAllTemplates}
              disabled={loadingAllTemplates}
            >
              {loadingAllTemplates ? (
                <ActivityIndicator size="small" color="#3A82F7" />
              ) : (
                <Text style={styles.showAllButtonText}>
                  Voir tous les modèles ({showAllTemplates ? allTemplates.length : '20'})
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* All Templates Modal */}
        <Modal
          visible={showAllTemplates}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowAllTemplates(false)}
        >
          <View style={styles.container}>
            <View style={styles.header}>
              <TouchableOpacity onPress={() => setShowAllTemplates(false)} style={styles.closeButton}>
                <Feather name="x" size={24} color="#2C3E50" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Tous les modèles</Text>
              <View style={{ width: 44 }} />
            </View>
            <ScrollView style={styles.scrollView}>
              {allTemplates.map((template) => (
                <View key={template.id} style={[styles.templateItem, { marginHorizontal: 16 }]}>
                  <View style={styles.templateInfo}>
                    <Text style={styles.templateLabel}>{template.label}</Text>
                    <Text style={styles.templateType}>{TEMPLATE_TYPE_LABELS[template.type] || template.type} • {TEMPLATE_CATEGORY_LABELS[template.category] || template.category}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.generateButton}
                    onPress={() => {
                      setShowAllTemplates(false);
                      handleGeneratePdf(template.id);
                    }}
                  >
                    <Feather name="file-text" size={16} color="#FFFFFF" />
                    <Text style={styles.generateButtonText}>Générer</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>
        </Modal>

        {/* Message Draft Modal */}
        <Modal
          visible={showMessageModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowMessageModal(false)}
        >
          <View style={styles.container}>
            <View style={styles.header}>
              <TouchableOpacity onPress={() => setShowMessageModal(false)} style={styles.closeButton}>
                <Feather name="x" size={24} color="#2C3E50" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>
                {messageChannel === 'email' ? 'Email' : messageChannel === 'sms' ? 'SMS' : 'WhatsApp'}
              </Text>
              <View style={{ width: 44 }} />
            </View>
            
            {loadingMessage ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#3A82F7" />
                <Text style={styles.loadingText}>Génération du message...</Text>
              </View>
            ) : (
              <ScrollView style={styles.scrollView}>
                <View style={styles.messageCard}>
                  {messageChannel === 'email' && (
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Objet</Text>
                      <TextInput
                        style={styles.input}
                        value={messageDraft?.subject || ''}
                        onChangeText={(text) => setMessageDraft(prev => prev ? { ...prev, subject: text } : null)}
                        placeholder="Objet du message"
                      />
                    </View>
                  )}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Message</Text>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      value={messageDraft?.body || ''}
                      onChangeText={(text) => setMessageDraft(prev => prev ? { ...prev, body: text } : null)}
                      placeholder="Contenu du message"
                      multiline
                      numberOfLines={8}
                    />
                  </View>
                  <TouchableOpacity
                    style={styles.sendButton}
                    onPress={handleSendMessage}
                  >
                    <Feather name="send" size={20} color="#FFFFFF" />
                    <Text style={styles.sendButtonText}>
                      Ouvrir {messageChannel === 'email' ? 'Mail' : messageChannel === 'sms' ? 'Messages' : 'WhatsApp'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </Modal>

        {/* Delete Confirmation Modal */}
        <Modal
          visible={showDeleteConfirm}
          transparent
          animationType="fade"
          onRequestClose={() => setShowDeleteConfirm(false)}
        >
          <View style={styles.deleteModalOverlay}>
            <View style={styles.deleteModalContent}>
              <Feather name="alert-triangle" size={48} color="#DC2626" />
              <Text style={styles.deleteModalTitle}>Supprimer la tâche ?</Text>
              <Text style={styles.deleteModalText}>
                Cette action est irréversible.
              </Text>
              <View style={styles.deleteModalButtons}>
                <TouchableOpacity
                  style={styles.deleteModalCancel}
                  onPress={() => setShowDeleteConfirm(false)}
                >
                  <Text style={styles.deleteModalCancelText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteModalConfirm}
                  onPress={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.deleteModalConfirmText}>Supprimer</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Image Viewer Modal */}
        {task.imageUrl && (
          <Modal
            visible={showImageViewer}
            animationType="fade"
            onRequestClose={() => setShowImageViewer(false)}
          >
            <View style={{ flex: 1, backgroundColor: '#F5F7FA' }}>
              <View style={styles.header}>
                <TouchableOpacity onPress={() => setShowImageViewer(false)} style={styles.closeButton}>
                  <Feather name="x" size={24} color="#2C3E50" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Pièce jointe</Text>
                <TouchableOpacity 
                  onPress={() => {
                    if (task.imageUrl) {
                      if (Platform.OS === 'web') {
                        // Download without navigating away (keeps browser back working)
                        try {
                          const urlParts = task.imageUrl.split('?')[0].split('/');
                          const rawName = urlParts[urlParts.length - 1] || 'piece-jointe';
                          const filename = decodeURIComponent(rawName);
                          const link = document.createElement('a');
                          link.href = task.imageUrl;
                          link.download = filename;
                          link.rel = 'noopener noreferrer';
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        } catch {
                          // Fallback: open in new tab if download attribute is not supported
                          window.open(task.imageUrl, '_blank', 'noopener,noreferrer');
                        }
                      } else {
                        Linking.openURL(task.imageUrl);
                      }
                    }
                  }} 
                  style={styles.closeButton}
                >
                  <Feather name="download" size={20} color="#3A82F7" />
                </TouchableOpacity>
              </View>
              <ScrollView
                style={{ flex: 1, backgroundColor: '#000000' }}
                contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}
                maximumZoomScale={3}
                minimumZoomScale={1}
              >
                <Image
                  source={{ uri: task.imageUrl }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="contain"
                />
              </ScrollView>
            </View>
          </Modal>
        )}

        {/* Category Picker Modal */}
        <Modal
          visible={editingCategory}
          transparent
          animationType="fade"
          onRequestClose={() => setEditingCategory(false)}
        >
          <TouchableOpacity
            style={styles.deleteModalOverlay}
            activeOpacity={1}
            onPress={() => setEditingCategory(false)}
          >
            <View style={[styles.deleteModalContent, { maxHeight: '70%' }]}>
              <Text style={styles.deleteModalTitle}>Changer la catégorie</Text>
              <ScrollView style={{ width: '100%', maxHeight: 400 }}>
                {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                  <TouchableOpacity
                    key={key}
                    style={[
                      styles.categoryOption,
                      task.category === key && styles.categoryOptionActive,
                    ]}
                    onPress={() => handleCategoryChange(key as TaskCategory)}
                  >
                    <Text
                      style={[
                        styles.categoryOptionText,
                        task.category === key && styles.categoryOptionTextActive,
                      ]}
                    >
                      {label}
                    </Text>
                    {task.category === key && <Feather name="check" size={20} color="#3A82F7" />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity
                style={[styles.deleteModalCancel, { marginTop: 12 }]}
                onPress={() => setEditingCategory(false)}
              >
                <Text style={styles.deleteModalCancelText}>Annuler</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Deadline Picker Modal */}
        <Modal
          visible={editingDeadline}
          transparent
          animationType="fade"
          onRequestClose={() => setEditingDeadline(false)}
        >
          <TouchableOpacity
            style={styles.deleteModalOverlay}
            activeOpacity={1}
            onPress={() => setEditingDeadline(false)}
          >
            <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
              <View style={styles.deleteModalContent}>
                <Text style={styles.deleteModalTitle}>Modifier l'échéance</Text>
                {Platform.OS === 'web' ? (
                <input
                  type="datetime-local"
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
                    marginTop: 16,
                    marginBottom: 16,
                  }}
                  value={editDeadline.toISOString().slice(0, 16)}
                  onChange={(e: any) => {
                    const value = e.target.value;
                    if (value) {
                      const d = new Date(value);
                      if (!isNaN(d.getTime())) setEditDeadline(d);
                    }
                  }}
                />
              ) : (
                DateTimePicker && (
                  <DateTimePicker
                    value={editDeadline}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event: any, selectedDate?: Date) => {
                      if (selectedDate) setEditDeadline(selectedDate);
                    }}
                  />
                )
              )}
              <View style={styles.deleteModalButtons}>
                <TouchableOpacity
                  style={styles.deleteModalCancel}
                  onPress={() => setEditingDeadline(false)}
                >
                  <Text style={styles.deleteModalCancelText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteModalConfirm}
                  onPress={handleDeadlineChange}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.deleteModalConfirmText}>Valider</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

        {/* Title Edit Modal */}
        <Modal
          visible={editingTitle}
          transparent
          animationType="fade"
          onRequestClose={() => setEditingTitle(false)}
        >
          <TouchableOpacity
            style={styles.deleteModalOverlay}
            activeOpacity={1}
            onPress={() => setEditingTitle(false)}
          >
            <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
              <View style={styles.deleteModalContent}>
                <Text style={styles.deleteModalTitle}>Modifier le titre</Text>
                <TextInput
                  style={styles.titleInput}
                  value={editTitle}
                  onChangeText={setEditTitle}
                  placeholder="Titre de la tâche"
                  placeholderTextColor="#A0AEC0"
                  autoFocus
                />
                <View style={styles.deleteModalButtons}>
                  <TouchableOpacity
                    style={styles.deleteModalCancel}
                    onPress={() => setEditingTitle(false)}
                  >
                    <Text style={styles.deleteModalCancelText}>Annuler</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteModalConfirm}
                    onPress={handleTitleChange}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.deleteModalConfirmText}>Valider</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

        {/* Description Edit Modal */}
        <Modal
          visible={editingDescription}
          transparent
          animationType="fade"
          onRequestClose={() => setEditingDescription(false)}
        >
          <TouchableOpacity
            style={styles.deleteModalOverlay}
            activeOpacity={1}
            onPress={() => setEditingDescription(false)}
          >
            <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
              <View style={[styles.deleteModalContent, { width: '90%', maxWidth: 420 }]}>
                <Text style={styles.deleteModalTitle}>
                  {task.description ? 'Modifier la description' : 'Ajouter une description'}
                </Text>
                <TextInput
                  style={[styles.titleInput, { height: 140, textAlignVertical: 'top' }]}
                  value={editDescription}
                  onChangeText={setEditDescription}
                  placeholder="Description de la tâche"
                  multiline
                  numberOfLines={6}
                />
                <View style={styles.deleteModalButtons}>
                  <TouchableOpacity
                    style={styles.deleteModalCancel}
                    onPress={() => setEditingDescription(false)}
                  >
                    <Text style={styles.deleteModalCancelText}>Annuler</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteModalConfirm}
                    onPress={handleDescriptionChange}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.deleteModalConfirmText}>Enregistrer</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

        {/* Phone Action Sheet */}
        <Modal
          visible={showPhoneActions}
          transparent
          animationType="fade"
          onRequestClose={() => setShowPhoneActions(false)}
        >
          <TouchableOpacity
            style={styles.actionSheetOverlay}
            activeOpacity={1}
            onPress={() => setShowPhoneActions(false)}
          >
            <View style={[styles.actionSheetContainer, Platform.OS === 'web' && styles.actionSheetSlideUp]}>
              <View style={styles.actionSheetHeader}>
                <Text style={styles.actionSheetTitle}>Contacter</Text>
                <Text style={styles.actionSheetPhone}>{selectedPhone}</Text>
              </View>
              
              <TouchableOpacity
                style={styles.actionSheetButton}
                onPress={() => {
                  const cleanPhone = selectedPhone?.replace(/\s/g, '') || '';
                  if (Platform.OS === 'web') {
                    window.location.href = `tel:${cleanPhone}`;
                  } else {
                    Linking.openURL(`tel:${cleanPhone}`);
                  }
                  setShowPhoneActions(false);
                }}
              >
                <View style={[styles.actionSheetIcon, { backgroundColor: '#3A82F7' }]}>
                  <Feather name="phone" size={20} color="#FFFFFF" />
                </View>
                <Text style={styles.actionSheetButtonText}>Appeler</Text>
                <Feather name="chevron-right" size={20} color="#6E7A84" />
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.actionSheetButton}
                onPress={() => {
                  const cleanPhone = selectedPhone?.replace(/\s/g, '') || '';
                  if (Platform.OS === 'web') {
                    window.location.href = `sms:${cleanPhone}`;
                  } else {
                    Linking.openURL(`sms:${cleanPhone}`);
                  }
                  setShowPhoneActions(false);
                }}
              >
                <View style={[styles.actionSheetIcon, { backgroundColor: '#4CAF50' }]}>
                  <Feather name="message-square" size={20} color="#FFFFFF" />
                </View>
                <Text style={styles.actionSheetButtonText}>SMS</Text>
                <Feather name="chevron-right" size={20} color="#6E7A84" />
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.actionSheetButton}
                onPress={() => {
                  // Clean phone and convert to international format for WhatsApp
                  let cleanPhone = selectedPhone?.replace(/[\s.\-()]/g, '') || '';
                  // French numbers: replace leading 0 with 33
                  if (cleanPhone.startsWith('0')) {
                    cleanPhone = '33' + cleanPhone.substring(1);
                  }
                  if (Platform.OS === 'web') {
                    window.location.href = `https://wa.me/${cleanPhone}`;
                  } else {
                    Linking.openURL(`https://wa.me/${cleanPhone}`);
                  }
                  setShowPhoneActions(false);
                }}
              >
                <View style={[styles.actionSheetIcon, { backgroundColor: '#25D366' }]}>
                  <Feather name="message-circle" size={20} color="#FFFFFF" />
                </View>
                <Text style={styles.actionSheetButtonText}>WhatsApp</Text>
                <Feather name="chevron-right" size={20} color="#6E7A84" />
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.actionSheetButton, styles.actionSheetCancelButton]}
                onPress={() => setShowPhoneActions(false)}
              >
                <Text style={styles.actionSheetCancelText}>Annuler</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* PDF Viewer Modal */}
        <PDFViewerModal
          visible={showPdfViewer}
          pdfUrl={pdfViewerUrl}
          title="Document généré"
          onClose={() => {
            setShowPdfViewer(false);
            setPdfViewerUrl(null);
          }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 15,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E9EEF2',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#2C3E50',
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#E9EEF2',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 12,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  taskTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
    color: '#2C3E50',
  },
  titleInput: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#E9EEF2',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: '#2C3E50',
    backgroundColor: '#F5F7FA',
    marginTop: 16,
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF5FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  categoryBadgeText: {
    color: '#3A82F7',
    fontSize: 14,
    fontWeight: '500',
  },
  sourceBadge: {
    backgroundColor: '#F5F7FA',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  sourceBadgeText: {
    color: '#6E7A84',
    fontSize: 14,
    fontWeight: '500',
  },
  deadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  deadlineText: {
    fontSize: 15,
    color: '#6E7A84',
  },
  descriptionSection: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E9EEF2',
  },
  descriptionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  descriptionEditButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
  },
  descriptionEditButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6E7A84',
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6E7A84',
    marginBottom: 8,
  },
  descriptionEmptyText: {
    fontSize: 15,
    color: '#6E7A84',
    lineHeight: 22,
  },
  descriptionText: {
    fontSize: 15,
    color: '#2C3E50',
    lineHeight: 22,
  },
  contactLink: {
    color: '#3A82F7',
    textDecorationLine: 'underline',
    fontWeight: '500',
    ...(Platform.OS === 'web' && { cursor: 'pointer' }),
  },
  statusSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E9EEF2',
  },
  statusButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  statusButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F5F7FA',
    alignItems: 'center',
  },
  statusButtonActive: {
    backgroundColor: '#6E7A84',
  },
  statusButtonActiveProgress: {
    backgroundColor: '#F7A45A',
  },
  statusButtonActiveDone: {
    backgroundColor: '#4CAF50',
  },
  statusButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6E7A84',
  },
  statusButtonTextActive: {
    color: '#FFFFFF',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F5F7FA',
    borderRadius: 8,
    gap: 12,
    marginBottom: 12,
  },
  actionButtonText: {
    flex: 1,
    fontSize: 15,
    color: '#3A82F7',
    fontWeight: '500',
  },
  contactSection: {
    marginTop: 4,
  },
  contactHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  contactLabel: {
    fontSize: 14,
    color: '#6E7A84',
    marginBottom: 8,
  },
  contactDraftButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
  },
  contactDraftButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6E7A84',
  },
  contactButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  contactButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: '#3A82F7',
    borderRadius: 8,
    gap: 6,
  },
  contactButtonSms: {
    backgroundColor: '#4CAF50',
  },
  contactButtonWhatsapp: {
    backgroundColor: '#25D366',
  },
  contactButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  templateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#F5F7FA',
    borderRadius: 8,
    marginBottom: 8,
  },
  templateInfo: {
    flex: 1,
    marginRight: 12,
  },
  templateLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#2C3E50',
    marginBottom: 4,
  },
  templateType: {
    fontSize: 13,
    color: '#6E7A84',
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    paddingHorizontal: 14,
    backgroundColor: '#3A82F7',
    borderRadius: 8,
    gap: 6,
  },
  generateButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  noTemplatesText: {
    fontSize: 14,
    color: '#6E7A84',
    textAlign: 'center',
    paddingVertical: 16,
  },
  showAllButton: {
    alignItems: 'center',
    padding: 12,
    marginTop: 8,
  },
  showAllButtonText: {
    fontSize: 15,
    color: '#3A82F7',
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6E7A84',
  },
  messageCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    borderWidth: 1,
    borderColor: '#E9EEF2',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6E7A84',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F5F7FA',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E9EEF2',
    padding: 12,
    fontSize: 15,
    color: '#2C3E50',
  },
  textArea: {
    height: 200,
    textAlignVertical: 'top',
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    backgroundColor: '#3A82F7',
    borderRadius: 8,
    gap: 8,
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  deleteModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
  },
  deleteModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C3E50',
    marginTop: 16,
    marginBottom: 8,
  },
  deleteModalText: {
    fontSize: 14,
    color: '#6E7A84',
    textAlign: 'center',
    marginBottom: 24,
  },
  deleteModalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  deleteModalCancel: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#F5F7FA',
    alignItems: 'center',
  },
  deleteModalCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6E7A84',
  },
  deleteModalConfirm: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#DC2626',
    alignItems: 'center',
  },
  deleteModalConfirmText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#F5F7FA',
  },
  categoryOptionActive: {
    backgroundColor: '#EBF5FF',
  },
  categoryOptionText: {
    fontSize: 15,
    color: '#2C3E50',
  },
  categoryOptionTextActive: {
    fontWeight: '600',
    color: '#3A82F7',
  },
  actionSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  actionSheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    paddingHorizontal: 16,
  },
  actionSheetSlideUp: {
    // @ts-ignore - web-only CSS animation
    animationName: 'slideUp',
    animationDuration: '0.25s',
    animationTimingFunction: 'ease-out',
  },
  actionSheetHeader: {
    alignItems: 'center',
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E9EEF2',
  },
  actionSheetTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 4,
  },
  actionSheetPhone: {
    fontSize: 18,
    fontWeight: '700',
    color: '#3A82F7',
  },
  actionSheetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F7FA',
  },
  actionSheetIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  actionSheetButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#2C3E50',
  },
  actionSheetCancelButton: {
    justifyContent: 'center',
    borderBottomWidth: 0,
    paddingVertical: 16,
    marginTop: 8,
  },
  actionSheetCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#DC2626',
    textAlign: 'center',
  },
});
