import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

interface PDFViewerModalProps {
  visible: boolean;
  pdfUrl: string | null;
  title?: string;
  onClose: () => void;
}

// Detect iOS Safari which doesn't render PDFs inline well
function isIOSSafari(): boolean {
  if (Platform.OS !== 'web') return false;
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isWebkit = /WebKit/.test(ua);
  const isChrome = /CriOS/.test(ua);
  return isIOS && isWebkit && !isChrome;
}

export default function PDFViewerModal({
  visible,
  pdfUrl,
  title = 'Document PDF',
  onClose,
}: PDFViewerModalProps) {
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeError, setIframeError] = useState(false);
  const isMobileSafari = Platform.OS === 'web' && isIOSSafari();

  useEffect(() => {
    // Reset states when URL changes
    setIframeLoaded(false);
    setIframeError(false);
  }, [pdfUrl]);

  const handleDownload = async () => {
    if (!pdfUrl) return;

    if (Platform.OS === 'web') {
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
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up
        setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
      } catch (error) {
        console.error('Failed to download PDF:', error);
        // Fallback: open in new tab
        window.open(pdfUrl, '_blank');
      }
    } else {
      // On native, open URL directly
      Linking.openURL(pdfUrl);
    }
  };

  const handleOpenInNewTab = () => {
    if (!pdfUrl) return;
    if (Platform.OS === 'web') {
      window.open(pdfUrl, '_blank');
    } else {
      Linking.openURL(pdfUrl);
    }
  };

  if (!pdfUrl) return null;

  // Render fallback UI for mobile Safari or native
  const renderFallbackUI = () => (
    <View style={styles.nativeContainer}>
      <View style={styles.iconContainer}>
        <Feather name="file-text" size={64} color="#3A82F7" />
      </View>
      <Text style={styles.nativeTitle}>Document PDF</Text>
      <Text style={styles.nativeText}>
        {isMobileSafari 
          ? 'Safari ne peut pas afficher ce PDF en ligne.'
          : 'Appuyez sur un bouton ci-dessous pour visualiser le document.'}
      </Text>
      <TouchableOpacity
        style={styles.openButton}
        onPress={handleOpenInNewTab}
      >
        <Feather name="external-link" size={20} color="#FFFFFF" />
        <Text style={styles.openButtonText}>Ouvrir dans un nouvel onglet</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.downloadButtonLarge}
        onPress={handleDownload}
      >
        <Feather name="download" size={20} color="#3A82F7" />
        <Text style={styles.downloadButtonText}>Télécharger le PDF</Text>
      </TouchableOpacity>
    </View>
  );

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
        {Platform.OS === 'web' && !isMobileSafari ? (
          <View style={{ flex: 1, position: 'relative' }}>
            {!iframeLoaded && !iframeError && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color="#3A82F7" />
                <Text style={styles.loadingText}>Chargement du PDF...</Text>
              </View>
            )}
            {iframeError ? (
              renderFallbackUI()
            ) : (
              <iframe
                src={pdfUrl}
                style={{
                  flex: 1,
                  width: '100%',
                  height: '100%',
                  border: 'none',
                }}
                title="PDF Viewer"
                onLoad={() => setIframeLoaded(true)}
                onError={() => setIframeError(true)}
              />
            )}
          </View>
        ) : (
          renderFallbackUI()
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
  downloadButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
    zIndex: 1,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6E7A84',
  },
  nativeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  iconContainer: {
    marginBottom: 24,
    padding: 24,
    backgroundColor: '#EBF5FF',
    borderRadius: 50,
  },
  nativeTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 12,
  },
  nativeText: {
    fontSize: 16,
    color: '#6E7A84',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  openButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#3A82F7',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginBottom: 12,
    width: '100%',
    maxWidth: 300,
    justifyContent: 'center',
  },
  openButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  downloadButtonLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3A82F7',
    width: '100%',
    maxWidth: 300,
    justifyContent: 'center',
  },
  downloadButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3A82F7',
  },
});
