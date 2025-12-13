import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Linking,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

let WebView: any = null;
if (Platform.OS !== 'web') {
  try {
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

function isIOSSafari(): boolean {
  if (Platform.OS !== 'web') return false;
  try {
    const ua = navigator.userAgent || '';
    const isIOS = /iPad|iPhone|iPod/i.test(ua);
    const isWebKit = /AppleWebKit/i.test(ua);
    const isChrome = /CriOS/i.test(ua);
    const isFirefox = /FxiOS/i.test(ua);
    return isIOS && isWebKit && !isChrome && !isFirefox;
  } catch {
    return false;
  }
}

function PDFJSViewer({ pdfUrl, containerWidth, title }: { pdfUrl: string; containerWidth: number; title: string }) {
  const [pages, setPages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [useFallback, setUseFallback] = useState(false);

  useEffect(() => {
    if (!pdfUrl || containerWidth <= 0) return;

    let cancelled = false;

    const renderPDF = async () => {
      try {
        setLoading(true);
        setError(null);
        setUseFallback(false);

        // Fetch PDF as ArrayBuffer to avoid CORS issues
        const response = await fetch(pdfUrl, { mode: 'cors', credentials: 'omit' });
        if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
        const pdfData = await response.arrayBuffer();

        if (pdfData.byteLength === 0) throw new Error('Empty PDF response');

        const pdfjsLib = await import('pdfjs-dist');
        
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

        const loadingTask = pdfjsLib.getDocument({ data: pdfData });
        const pdf = await loadingTask.promise;

        if (cancelled) return;

        const pageDataUrls: string[] = [];
        const scale = 2;

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale: 1 });
          
          const desiredWidth = containerWidth * scale;
          const scaleFactor = desiredWidth / viewport.width;
          const scaledViewport = page.getViewport({ scale: scaleFactor });

          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          if (!context) continue;

          canvas.width = scaledViewport.width;
          canvas.height = scaledViewport.height;

          await page.render({
            canvasContext: context,
            viewport: scaledViewport,
          }).promise;

          if (cancelled) return;

          pageDataUrls.push(canvas.toDataURL('image/png'));
        }

        if (!cancelled) {
          setPages(pageDataUrls);
          setLoading(false);
        }
      } catch (err) {
        console.error('PDF.js render error:', err);
        if (!cancelled) {
          // Fall back to iframe instead of showing error
          setUseFallback(true);
          setLoading(false);
        }
      }
    };

    renderPDF();

    return () => {
      cancelled = true;
    };
  }, [pdfUrl, containerWidth]);

  if (loading) {
    return (
      <View style={pdfStyles.loadingContainer}>
        <ActivityIndicator size="large" color="#3A82F7" />
        <Text style={pdfStyles.loadingText}>Chargement du document...</Text>
      </View>
    );
  }

  // Fallback to iframe if PDF.js failed
  if (useFallback || error) {
    return (
      <View style={{ flex: 1 }}>
        {/* @ts-ignore */}
        <iframe
          src={pdfUrl}
          title={title}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
          }}
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={pdfStyles.scrollView}
      contentContainerStyle={pdfStyles.scrollContent}
      showsVerticalScrollIndicator={true}
    >
      {pages.map((dataUrl, index) => (
        <img
          key={index}
          src={dataUrl}
          alt={`Page ${index + 1}`}
          style={{
            width: '100%',
            height: 'auto',
            display: 'block',
            marginBottom: index < pages.length - 1 ? 8 : 0,
          }}
        />
      ))}
    </ScrollView>
  );
}

const pdfStyles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: '#E5E5E5',
  },
  scrollContent: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#6E7A84',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
    padding: 32,
  },
  errorText: {
    marginTop: 16,
    fontSize: 14,
    color: '#E74C3C',
    textAlign: 'center',
  },
});

export default function PDFViewerModal({
  visible,
  pdfUrl,
  title = 'Document PDF',
  onClose,
}: PDFViewerModalProps) {
  const containerRef = useRef<View>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const usesPDFJS = isIOSSafari();

  const handleDownload = async () => {
    if (!pdfUrl) return;

    if (Platform.OS === 'web') {
      if (usesPDFJS) {
        window.open(pdfUrl, '_blank', 'noopener,noreferrer');
        return;
      }

      try {
        const response = await fetch(pdfUrl);
        if (!response.ok) throw new Error('Failed to fetch PDF');
        
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        
        const urlParts = pdfUrl.split('/');
        const filename = urlParts[urlParts.length - 1] || 'document.pdf';
        
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
      } catch (error) {
        console.error('Failed to download PDF:', error);
      }
    } else {
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
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Feather name="x" size={24} color="#2C3E50" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{title}</Text>
          <TouchableOpacity onPress={handleDownload} style={styles.downloadButton}>
            <Feather name="download" size={20} color="#3A82F7" />
          </TouchableOpacity>
        </View>

        {Platform.OS === 'web' ? (
          usesPDFJS ? (
            <View
              ref={containerRef}
              style={styles.pdfJSContainer}
              onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
            >
              {containerWidth > 0 && (
                <PDFJSViewer pdfUrl={pdfUrl} containerWidth={containerWidth} title={title} />
              )}
            </View>
          ) : (
            <View style={styles.webViewerContainer}>
              {/* @ts-ignore */}
              <iframe
                src={pdfUrl}
                title={title}
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                }}
              />
            </View>
          )
        ) : (
          <View style={styles.nativeViewerContainer}>
            {WebView ? (
              <WebView
                source={{ uri: pdfUrl }}
                style={{ flex: 1 }}
                originWhitelist={['*']}
                startInLoadingState
                scalesPageToFit
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
    minHeight: 0 as any,
  },
  pdfJSContainer: {
    flex: 1,
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
