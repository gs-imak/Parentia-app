import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Linking,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

// Load PDF.js from CDN (more reliable than npm package with Expo bundler)
const PDFJS_VERSION = '3.11.174';
const PDFJS_CDN = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}`;

let pdfjsLibPromise: Promise<any> | null = null;

function loadPDFJS(): Promise<any> {
  if (pdfjsLibPromise) return pdfjsLibPromise;
  
  pdfjsLibPromise = new Promise((resolve, reject) => {
    // Check if already loaded
    if ((window as any).pdfjsLib) {
      resolve((window as any).pdfjsLib);
      return;
    }

    const script = document.createElement('script');
    script.src = `${PDFJS_CDN}/pdf.min.js`;
    script.onload = () => {
      const lib = (window as any).pdfjsLib;
      if (lib) {
        // Disable worker to avoid CORS issues with worker script
        lib.GlobalWorkerOptions.workerSrc = '';
        resolve(lib);
      } else {
        reject(new Error('PDF.js failed to load'));
      }
    };
    script.onerror = () => reject(new Error('Failed to load PDF.js script'));
    document.head.appendChild(script);
  });

  return pdfjsLibPromise;
}

function PDFJSViewer({ pdfUrl, containerWidth, title }: { pdfUrl: string; containerWidth: number; title: string }) {
  const [pages, setPages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [useFallback, setUseFallback] = useState(false);

  useEffect(() => {
    if (!pdfUrl || containerWidth <= 0) return;

    let cancelled = false;

    const renderPDF = async () => {
      try {
        setLoading(true);
        setUseFallback(false);

        // Load PDF.js from CDN
        const pdfjsLib = await loadPDFJS();

        // Fetch PDF as ArrayBuffer
        const response = await fetch(pdfUrl, { mode: 'cors', credentials: 'omit' });
        if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
        const pdfData = await response.arrayBuffer();

        if (pdfData.byteLength === 0) throw new Error('Empty PDF');

        const loadingTask = pdfjsLib.getDocument({ data: pdfData });
        const pdf = await loadingTask.promise;

        if (cancelled) return;

        const pageDataUrls: string[] = [];
        // Scale for crisp rendering on retina displays
        const pixelRatio = window.devicePixelRatio || 1;
        const renderScale = Math.min(pixelRatio, 2);

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale: 1 });
          
          // Scale to fit container width
          const scaleFactor = (containerWidth / viewport.width) * renderScale;
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
        console.error('PDF.js error:', err);
        if (!cancelled) {
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
  if (useFallback) {
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
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        WebkitOverflowScrolling: 'touch',
        backgroundColor: '#E5E5E5',
        padding: 8,
      }}
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
            backgroundColor: '#FFFFFF',
            boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
          }}
        />
      ))}
    </div>
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
  const insets = useSafeAreaInsets();
  
  // Debug log to verify insets are being read
  useEffect(() => {
    console.log('[PDFViewerModal] Safe area insets:', insets);
    console.log('[PDFViewerModal] Calculated paddingTop:', insets.top + 48);
  }, [insets]);

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
      statusBarTranslucent={false}
    >
      <View style={[styles.container, { paddingTop: 100, backgroundColor: '#FF0000' }]}>
        <View style={[styles.header, { paddingTop: 80, backgroundColor: '#00FF00' }]}>
          <TouchableOpacity 
            onPress={onClose} 
            style={styles.closeButton}
            activeOpacity={0.6}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
          >
            <Feather name="x" size={28} color="#374151" />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { backgroundColor: '#FFFF00', fontSize: 32, color: '#FF0000' }]} numberOfLines={1}>TEST VERSION 123 - {title}</Text>
          <TouchableOpacity 
            onPress={handleDownload} 
            style={styles.downloadButton}
            activeOpacity={0.6}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
          >
            <Feather name="download" size={24} color="#3A82F7" />
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
    zIndex: 1,
  },
  pdfJSContainer: {
    flex: 1,
    minHeight: 0 as any,
    zIndex: 1,
  },
  nativeViewerContainer: {
    flex: 1,
    minHeight: 0 as any,
    zIndex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingBottom: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E9EEF2',
    zIndex: 1000,
    elevation: 10,
    gap: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
    textAlign: 'center',
  },
  closeButton: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 28,
  },
  downloadButton: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EBF5FF',
    borderRadius: 28,
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
