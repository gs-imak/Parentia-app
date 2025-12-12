import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Linking,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

interface PDFViewerModalProps {
  visible: boolean;
  pdfUrl: string | null;
  title?: string;
  onClose: () => void;
}

export default function PDFViewerModal({
  visible,
  pdfUrl,
  title = 'Document PDF',
  onClose,
}: PDFViewerModalProps) {
  const isIOSWeb = () => {
    if (Platform.OS !== 'web') return false;
    try {
      const ua = navigator.userAgent || '';
      return /iPad|iPhone|iPod/i.test(ua);
    } catch {
      return false;
    }
  };

  const handleDownload = async () => {
    if (!pdfUrl) return;

    if (Platform.OS === 'web') {
      // iOS Safari often ignores `download` and may navigate the current tab to a blob/PDF viewer,
      // which breaks SPA back navigation. Open in a new tab instead.
      if (isIOSWeb()) {
        window.open(pdfUrl, '_blank', 'noopener,noreferrer');
        return;
      }

      // On web, fetch PDF and download as blob
      try {
        const response = await fetch(pdfUrl);
        if (!response.ok) throw new Error('Failed to fetch PDF');
        
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        
        // Extract filename from URL or use default
        const urlParts = pdfUrl.split('/');
        const filename = urlParts[urlParts.length - 1] || 'document.pdf';
        
        // Create download link
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        // Safety net: if the browser ignores `download`, open in a new tab (keeps current SPA tab intact)
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up
        setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
      } catch (error) {
        console.error('Failed to download PDF:', error);
      }
    } else {
      // On native, open URL directly
      Linking.openURL(pdfUrl);
    }
  };

  if (!pdfUrl) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      transparent={false}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Feather name="x" size={24} color="#2C3E50" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{title}</Text>
          <TouchableOpacity onPress={handleDownload} style={styles.downloadButton}>
            <Feather name="download" size={20} color="#3A82F7" />
          </TouchableOpacity>
        </View>

        {/* PDF Viewer */}
        {Platform.OS === 'web' ? (
          // iOS Safari is unreliable with <object>; use <iframe> for inline viewing.
          isIOSWeb() ? (
            // @ts-ignore - iframe is valid on web output
            <iframe
              src={`${pdfUrl}#view=FitH`}
              title={title}
              style={{
                flex: 1,
                width: '100%',
                height: '100%',
                border: 'none',
                backgroundColor: '#FFFFFF',
              }}
            />
          ) : (
            <object
              data={`${pdfUrl}#view=FitH`}
              type="application/pdf"
              style={{
                flex: 1,
                width: '100%',
                height: '100%',
              }}
            >
              <p>
                Impossible d'afficher le PDF.{' '}
                <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
                  Télécharger le PDF
                </a>
              </p>
            </object>
          )
        ) : (
          <View style={styles.nativeContainer}>
            <Text style={styles.nativeText}>
              Appuyez sur le bouton télécharger pour ouvrir le PDF
            </Text>
            <TouchableOpacity
              style={styles.openButton}
              onPress={handleDownload}
            >
              <Feather name="external-link" size={20} color="#FFFFFF" />
              <Text style={styles.openButtonText}>Ouvrir le PDF</Text>
            </TouchableOpacity>
          </View>
        )}
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
    paddingTop: 50,
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
  downloadButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nativeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  nativeText: {
    fontSize: 16,
    color: '#6E7A84',
    textAlign: 'center',
    marginBottom: 24,
  },
  openButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#3A82F7',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  openButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
