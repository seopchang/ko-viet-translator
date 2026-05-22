import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
  Modal,
  Animated,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system';
import { useAudioRecorder, AudioModule, RecordingPresets } from 'expo-audio';
import { useFocusEffect } from 'expo-router';
import { getSettings } from '../../src/utils/storage';
import { translateText, translateImage, translateAudio, askFollowUp } from '../../src/services/translationService';
import { useLanguage } from '../../src/context/LanguageContext';
import { strings } from '../../src/utils/i18n';

let msgId = 0;
const nextId = () => String(++msgId);

export default function TranslateScreen() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({ apiKey: '', groqApiKey: '', aiProvider: 'gemini' });
  const [toast, setToast] = useState('');

  const [showPanel, setShowPanel] = useState(false);
  const panelAnim = useRef(new Animated.Value(260)).current;

  const [isRecording, setIsRecording] = useState(false);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recordingPulse = useRef(new Animated.Value(1)).current;

  const listRef = useRef(null);
  const { language } = useLanguage();
  const t = strings[language];

  useFocusEffect(
    useCallback(() => {
      getSettings().then(setSettings);
    }, [])
  );

  // ── 패널 애니메이션 ──────────────────────────────
  const openPanel = () => {
    setShowPanel(true);
    Animated.spring(panelAnim, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
  };

  const closePanel = (cb) => {
    Animated.timing(panelAnim, { toValue: 260, duration: 220, useNativeDriver: true }).start(() => {
      setShowPanel(false);
      cb && cb();
    });
  };

  // ── 녹음 펄스 애니메이션 ──────────────────────────
  const startPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(recordingPulse, { toValue: 1.3, duration: 600, useNativeDriver: true }),
        Animated.timing(recordingPulse, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    ).start();
  };

  const stopPulse = () => {
    recordingPulse.stopAnimation();
    recordingPulse.setValue(1);
  };

  // ── 공통 유틸 ──────────────────────────────────
  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2000);
  };

  const scrollToBottom = () => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const hasKey = () => {
    const key = settings.aiProvider === 'groq' ? settings.groqApiKey : settings.apiKey;
    if (!key) { Alert.alert(t.noApiKey, t.noApiKeyMsg); return false; }
    return true;
  };

  const addMessage = (msg) => {
    setMessages((prev) => [...prev, msg]);
    scrollToBottom();
  };

  const updateLastAI = (patch) => {
    setMessages((prev) => {
      const next = [...prev];
      for (let i = next.length - 1; i >= 0; i--) {
        if (next[i].type === 'ai') { next[i] = { ...next[i], ...patch }; break; }
      }
      return next;
    });
  };

  // ── 텍스트 전송 ────────────────────────────────
  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;
    if (!hasKey()) return;
    setInput('');
    addMessage({ id: nextId(), type: 'user', content: text });
    setLoading(true);
    try {
      const result = await translateText(text, settings);
      addMessage({ id: nextId(), type: 'ai', content: result.translation, showTriggers: true, originalText: text });
    } catch (e) {
      Alert.alert(e.message === 'RATE_LIMIT' ? t.rateLimit : t.error,
        e.message === 'RATE_LIMIT' ? t.rateLimitMsg : (e.message || t.translateError));
    } finally {
      setLoading(false);
    }
  };

  // ── 카메라 ────────────────────────────────────
  const handleCamera = () => {
    closePanel(async () => {
      if (!hasKey()) return;
      const cam = await ImagePicker.requestCameraPermissionsAsync();
      if (cam.status !== 'granted') { Alert.alert(t.permissionNeeded, t.photoPermission); return; }
      const res = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.7 });
      if (!res.canceled) processImage(res.assets[0]);
    });
  };

  // ── 갤러리 ────────────────────────────────────
  const handleGallery = () => {
    closePanel(async () => {
      if (!hasKey()) return;
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { Alert.alert(t.permissionNeeded, t.photoPermission); return; }
      const res = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.7 });
      if (!res.canceled) processImage(res.assets[0]);
    });
  };

  const processImage = async (asset) => {
    setLoading(true);
    addMessage({ id: nextId(), type: 'user', content: t.imageLabel, imageUri: asset.uri });
    try {
      const result = await translateImage(asset.base64, asset.mimeType || 'image/jpeg', settings);
      addMessage({ id: nextId(), type: 'ai', content: result.translation, showTriggers: true, originalText: t.imageLabel });
    } catch (e) {
      Alert.alert(e.message === 'RATE_LIMIT' ? t.rateLimit : t.error,
        e.message === 'RATE_LIMIT' ? t.rateLimitMsg : t.imageTranslateError);
    } finally {
      setLoading(false);
    }
  };

  // ── 음성 녹음 ──────────────────────────────────
  const handleVoice = () => {
    if (Platform.OS === 'web') {
      closePanel(() => Alert.alert(
        language === 'ko' ? '앱 전용 기능' : 'Tính năng chỉ dành cho ứng dụng',
        language === 'ko' ? '음성 번역은 앱에서만 지원됩니다.' : 'Dịch giọng nói chỉ hỗ trợ trên ứng dụng.'
      ));
      return;
    }
    closePanel(() => startRecording());
  };

  const startRecording = async () => {
    if (!hasKey()) return;
    if (settings.aiProvider === 'groq') {
      Alert.alert(t.error, language === 'ko'
        ? '음성 번역은 Gemini에서만 지원됩니다. 설정에서 Gemini로 변경해주세요.'
        : 'Dịch giọng nói chỉ hỗ trợ Gemini. Vui lòng đổi sang Gemini trong Cài đặt.');
      return;
    }
    try {
      const { granted } = await AudioModule.requestRecordingPermissionsAsync();
      if (!granted) {
        Alert.alert(t.permissionNeeded, language === 'ko' ? '마이크 권한이 필요합니다.' : 'Cần quyền truy cập microphone.');
        return;
      }
      await AudioModule.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      audioRecorder.record();
      setIsRecording(true);
      startPulse();
    } catch (e) {
      Alert.alert(t.error, language === 'ko' ? '녹음을 시작할 수 없습니다.' : 'Không thể bắt đầu ghi âm.');
    }
  };

  const stopRecording = async () => {
    if (!isRecording) return;
    setIsRecording(false);
    stopPulse();
    setLoading(true);
    try {
      await audioRecorder.stop();
      await AudioModule.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = audioRecorder.uri;
      if (!uri) throw new Error('No recording URI');

      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      addMessage({ id: nextId(), type: 'user', content: language === 'ko' ? '[음성]' : '[Giọng nói]', isVoice: true });

      const result = await translateAudio(base64, 'audio/m4a', settings);
      const content = result.transcription
        ? `${result.transcription}\n\n${result.translation}`
        : result.translation;
      addMessage({ id: nextId(), type: 'ai', content, showTriggers: true, originalText: result.transcription || '' });
    } catch (e) {
      Alert.alert(t.error, language === 'ko' ? '음성 번역에 실패했습니다.' : 'Dịch giọng nói thất bại.');
    } finally {
      setLoading(false);
    }
  };

  // ── 팔로우업 ──────────────────────────────────
  const handleTrigger = async (triggerType, msgItem) => {
    if (!hasKey()) return;
    updateLastAI({ showTriggers: false });
    setLoading(true);
    try {
      const result = await askFollowUp(msgItem.originalText, msgItem.content, triggerType, settings);
      addMessage({ id: nextId(), type: 'ai', content: result.translation, showTriggers: false });
    } catch (e) {
      Alert.alert(e.message === 'RATE_LIMIT' ? t.rateLimit : t.error,
        e.message === 'RATE_LIMIT' ? t.rateLimitMsg : t.followUpError);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (text) => {
    await Clipboard.setStringAsync(text);
    showToast(t.copied);
  };

  // ── 렌더 아이템 ──────────────────────────────
  const renderItem = ({ item }) => {
    if (item.type === 'user') {
      return (
        <View style={s.userRow}>
          {item.imageUri ? (
            <Image source={{ uri: item.imageUri }} style={s.userImage} />
          ) : item.isVoice ? (
            <View style={s.userBubble}>
              <Ionicons name="mic" size={14} color="rgba(255,255,255,0.7)" style={{ marginRight: 6 }} />
              <Text style={s.userText}>{item.content}</Text>
            </View>
          ) : (
            <View style={s.userBubble}>
              <Text style={s.userText}>{item.content}</Text>
            </View>
          )}
        </View>
      );
    }
    return (
      <View style={s.aiRow}>
        <View style={s.aiHeader}>
          <View style={s.aiBadge}>
            <Text style={s.aiBadgeText}>{t.translateBadge}</Text>
          </View>
          <TouchableOpacity style={s.copyBtn} onPress={() => handleCopy(item.content)}>
            <Ionicons name="copy-outline" size={15} color="#B8AA9A" />
          </TouchableOpacity>
        </View>
        <View style={s.aiBubble}>
          <Text style={s.aiText}>{item.content}</Text>
        </View>
        {item.showTriggers && (
          <View style={s.triggers}>
            <TouchableOpacity style={s.triggerBtn} onPress={() => handleTrigger('context', item)} disabled={loading}>
              <Text style={s.triggerText}>{t.triggerContext}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.triggerBtn} onPress={() => handleTrigger('simple', item)} disabled={loading}>
              <Text style={s.triggerText}>{t.triggerSimple}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.triggerBtn, s.triggerSatisfied]} onPress={() => updateLastAI({ showTriggers: false })}>
              <Text style={[s.triggerText, s.triggerSatisfiedText]}>{t.triggerSatisfied}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* 헤더 */}
        <View style={s.header}>
          <Text style={s.headerTitle}>{t.appName}</Text>
          <Text style={s.headerSub}>{t.appSubtitle}</Text>
        </View>

        {/* 메시지 리스트 */}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={s.listContent}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="language-outline" size={44} color="#D5CCC2" />
              <Text style={s.emptyText}>{t.emptyText}</Text>
            </View>
          }
          onContentSizeChange={() => messages.length > 0 && scrollToBottom()}
        />

        {/* 로딩 */}
        {loading && (
          <View style={s.loadingRow}>
            <ActivityIndicator size="small" color="#3D2314" />
            <Text style={s.loadingText}>{t.translating}</Text>
          </View>
        )}

        {/* 녹음 중 UI */}
        {isRecording && (
          <View style={s.recordingBar}>
            <Animated.View style={[s.recordingDot, { transform: [{ scale: recordingPulse }] }]} />
            <Text style={s.recordingText}>
              {language === 'ko' ? '녹음 중... 탭하여 완료' : 'Đang ghi âm... Nhấn để hoàn thành'}
            </Text>
            <TouchableOpacity style={s.recordingStopBtn} onPress={stopRecording}>
              <Ionicons name="stop" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        )}

        {/* 입력창 */}
        {!isRecording && (
          <View style={s.inputBar}>
            <TouchableOpacity style={s.iconBtn} onPress={openPanel} disabled={loading}>
              <Ionicons name="add" size={22} color="#3D2314" />
            </TouchableOpacity>
            <TextInput
              style={s.textInput}
              value={input}
              onChangeText={setInput}
              placeholder={t.inputPlaceholder}
              placeholderTextColor="#C5BAB0"
              multiline
              maxHeight={100}
              returnKeyType="default"
            />
            <TouchableOpacity
              style={[s.sendBtn, (!input.trim() || loading) && s.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!input.trim() || loading}
            >
              <Ionicons name="arrow-up" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        )}

        {/* 토스트 */}
        {!!toast && (
          <View style={s.toast}>
            <Text style={s.toastText}>{toast}</Text>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* 카카오톡 스타일 하단 패널 */}
      <Modal visible={showPanel} transparent animationType="none" onRequestClose={() => closePanel()}>
        <TouchableWithoutFeedback onPress={() => closePanel()}>
          <View style={s.overlay} />
        </TouchableWithoutFeedback>
        <Animated.View style={[s.panel, { transform: [{ translateY: panelAnim }] }]}>
          <View style={s.panelHandle} />
          <View style={s.panelGrid}>
            {/* 카메라 */}
            <TouchableOpacity style={s.panelItem} onPress={handleCamera} activeOpacity={0.7}>
              <View style={s.panelIconBox}>
                <Ionicons name="camera" size={28} color="#3D2314" />
              </View>
              <Text style={s.panelLabel}>{t.camera}</Text>
            </TouchableOpacity>
            {/* 갤러리 */}
            <TouchableOpacity style={s.panelItem} onPress={handleGallery} activeOpacity={0.7}>
              <View style={s.panelIconBox}>
                <Ionicons name="image" size={28} color="#3D2314" />
              </View>
              <Text style={s.panelLabel}>{t.gallery}</Text>
            </TouchableOpacity>
            {/* 음성 */}
            <TouchableOpacity style={s.panelItem} onPress={handleVoice} activeOpacity={0.7}>
              <View style={s.panelIconBox}>
                <Ionicons name="mic" size={28} color="#3D2314" />
              </View>
              <Text style={s.panelLabel}>{language === 'ko' ? '음성' : 'Giọng nói'}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FAF8F5' },
  flex: { flex: 1 },

  header: {
    paddingHorizontal: 18, paddingTop: 14, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: '#EDE8E0', backgroundColor: '#FAF8F5',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#1A0F08', letterSpacing: -0.5 },
  headerSub: { fontSize: 12, color: '#9C8B7A', marginTop: 2 },

  listContent: { padding: 16, paddingBottom: 8, flexGrow: 1 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 14, color: '#C5BAB0', textAlign: 'center', lineHeight: 22 },

  userRow: { alignItems: 'flex-end', marginBottom: 14 },
  userBubble: {
    backgroundColor: '#3D2314', borderRadius: 18, borderBottomRightRadius: 4,
    paddingHorizontal: 14, paddingVertical: 10, maxWidth: '80%',
    flexDirection: 'row', alignItems: 'center',
  },
  userText: { fontSize: 15, color: '#FFFFFF', lineHeight: 22 },
  userImage: { width: 200, height: 150, borderRadius: 12 },

  aiRow: { marginBottom: 18 },
  aiHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  aiBadge: { backgroundColor: '#EDE8E0', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  aiBadgeText: { fontSize: 11, fontWeight: '700', color: '#7A6A5A' },
  copyBtn: { padding: 4 },
  aiBubble: {
    backgroundColor: '#FFFFFF', borderRadius: 18, borderTopLeftRadius: 4,
    borderWidth: 1, borderColor: '#EDE8E0', paddingHorizontal: 14, paddingVertical: 12,
  },
  aiText: { fontSize: 15, color: '#1A0F08', lineHeight: 24 },

  triggers: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  triggerBtn: {
    borderWidth: 1, borderColor: '#DDD5CA', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#FFFFFF',
  },
  triggerText: { fontSize: 12, color: '#3D2314', fontWeight: '600' },
  triggerSatisfied: { backgroundColor: '#F5F1EC', borderColor: '#EDE8E0' },
  triggerSatisfiedText: { color: '#B8AA9A' },

  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8 },
  loadingText: { fontSize: 13, color: '#9C8B7A' },

  recordingBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 14,
    paddingBottom: Platform.OS === 'android' ? 28 : 14,
    borderTopWidth: 1, borderTopColor: '#EDE8E0', backgroundColor: '#FFF8F5',
  },
  recordingDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#E53E3E' },
  recordingText: { flex: 1, fontSize: 14, color: '#3D2314', fontWeight: '600' },
  recordingStopBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#E53E3E', alignItems: 'center', justifyContent: 'center',
  },

  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 12, paddingVertical: 10,
    paddingBottom: Platform.OS === 'android' ? 24 : 10,
    borderTopWidth: 1, borderTopColor: '#EDE8E0', backgroundColor: '#FFFFFF', gap: 8,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 1, borderColor: '#DDD5CA',
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#FAF8F5',
  },
  textInput: {
    flex: 1, borderWidth: 1, borderColor: '#DDD5CA', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 15,
    color: '#1A0F08', backgroundColor: '#FAF8F5', minHeight: 40,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#3D2314', alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#C5BAB0' },

  toast: {
    position: 'absolute', bottom: 100, alignSelf: 'center',
    backgroundColor: 'rgba(61,35,20,0.85)', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  toastText: { fontSize: 13, color: '#FFFFFF', fontWeight: '600' },

  // 하단 패널
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  panel: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingTop: 12, paddingBottom: Platform.OS === 'android' ? 36 : 28,
    paddingHorizontal: 20,
  },
  panelHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#DDD5CA', alignSelf: 'center', marginBottom: 20,
  },
  panelGrid: { flexDirection: 'row', gap: 16 },
  panelItem: { alignItems: 'center', gap: 8 },
  panelIconBox: {
    width: 64, height: 64, borderRadius: 16,
    backgroundColor: '#FAF8F5', borderWidth: 1, borderColor: '#EDE8E0',
    alignItems: 'center', justifyContent: 'center',
  },
  panelLabel: { fontSize: 12, color: '#4A3728', fontWeight: '600' },
});
