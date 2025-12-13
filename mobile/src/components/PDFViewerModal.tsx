import React, { useMemo } from 'react';
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

// Conditionally import WebView only for native (Expo doesn't provide a built-in PDF viewer).
let WebView: any = null;
if (Platform.OS !== 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    WebView = require('react-native-webview').WebView;
  } catch {
    WebView = null;
  }
}

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
  // Milestone 5 (FINAL): PDF preview must be readable without mandatory download.
  // On web, prefer <iframe> which is generally more reliable and scrollable than <object>.

  const isIOSWeb = () => {
    if (Platform.OS !== 'web') return false;
    try {
      const ua = navigator.userAgent || '';
      return /iPad|iPhone|iPod/i.test(ua);
    } catch {
      return false;
    }
  };

  const webViewerUrl = useMemo(() => {
    if (!pdfUrl) return null;
    return `${pdfUrl}#view=FitH`;
  }, [pdfUrl]);

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
          <View style={styles.webViewerContainer}>
            {/* @ts-ignore - iframe is web-only */}
            <iframe
              // Use key to force a refresh when switching docs.
              key={webViewerUrl || pdfUrl}
              src={webViewerUrl || pdfUrl}
              title={title}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
              }}
            />

          </View>
        ) : (
          <View style={styles.nativeViewerContainer}>
            {WebView ? (
              <WebView
                source={{ uri: pdfUrl }}
                style={{ flex: 1 }}
                originWhitelist={['*']}
                startInLoadingState
                allowsBackForwardNavigationGestures
              />
            ) : (
              <View style={styles.nativeContainer}>
                <Text style={styles.nativeText}>
                  Impossible d'afficher le PDF. Appuyez sur télécharger pour l'ouvrir.
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
  webViewerContainer: {
    flex: 1,
    // Critical: allow the embedded viewer to size properly inside a flex column.
    minHeight: 0 as any,
  },
  nativeViewerContainer: {
    flex: 1,
    minHeight: 0 as any,
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
