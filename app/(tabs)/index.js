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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect } from 'expo-router';
import { getSettings } from '../../src/utils/storage';
import { translateText, translateImage, askFollowUp } from '../../src/services/translationService';

let msgId = 0;
const nextId = () => String(++msgId);

export default function TranslateScreen() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({ apiKey: '', groqApiKey: '', aiProvider: 'gemini' });
  const [toast, setToast] = useState('');
  const listRef = useRef(null);

  useFocusEffect(
    useCallback(() => {
      getSettings().then(setSettings);
    }, [])
  );

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2000);
  };

  const scrollToBottom = () => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const hasKey = () => {
    const key = settings.aiProvider === 'groq' ? settings.groqApiKey : settings.apiKey;
    if (!key) {
      Alert.alert('API 키 없음', '설정 탭에서 API 키를 먼저 입력해주세요.');
      return false;
    }
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
        if (next[i].type === 'ai') {
          next[i] = { ...next[i], ...patch };
          break;
        }
      }
      return next;
    });
  };

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
      if (e.message === 'RATE_LIMIT') {
        Alert.alert('요청 초과', '잠시 후 다시 시도해 주세요.');
      } else {
        Alert.alert('오류', '번역에 실패했습니다. API 키를 확인해주세요.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleImage = async () => {
    if (!hasKey()) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '사진 접근 권한이 필요합니다.');
      return;
    }
    Alert.alert('사진 선택', '이미지를 가져올 방법을 선택하세요.', [
      {
        text: '카메라',
        onPress: async () => {
          const cam = await ImagePicker.requestCameraPermissionsAsync();
          if (cam.status !== 'granted') return;
          const res = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.7 });
          if (!res.canceled) processImage(res.assets[0]);
        },
      },
      {
        text: '갤러리',
        onPress: async () => {
          const res = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.7 });
          if (!res.canceled) processImage(res.assets[0]);
        },
      },
      { text: '취소', style: 'cancel' },
    ]);
  };

  const processImage = async (asset) => {
    setLoading(true);
    addMessage({ id: nextId(), type: 'user', content: '[사진]', imageUri: asset.uri });
    try {
      const mime = asset.mimeType || 'image/jpeg';
      const result = await translateImage(asset.base64, mime, settings);
      addMessage({ id: nextId(), type: 'ai', content: result.translation, showTriggers: true, originalText: '[사진]' });
    } catch (e) {
      if (e.message === 'RATE_LIMIT') {
        Alert.alert('요청 초과', '잠시 후 다시 시도해 주세요.');
      } else {
        Alert.alert('오류', '이미지 번역에 실패했습니다.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTrigger = async (triggerType, msgItem) => {
    if (!hasKey()) return;
    updateLastAI({ showTriggers: false });
    setLoading(true);
    try {
      const result = await askFollowUp(msgItem.originalText, msgItem.content, triggerType, settings);
      addMessage({ id: nextId(), type: 'ai', content: result.translation, showTriggers: false });
    } catch (e) {
      if (e.message === 'RATE_LIMIT') {
        Alert.alert('요청 초과', '잠시 후 다시 시도해 주세요.');
      } else {
        Alert.alert('오류', '추가 정보를 가져오지 못했습니다.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (text) => {
    await Clipboard.setStringAsync(text);
    showToast('복사되었습니다!');
  };

  const renderItem = ({ item }) => {
    if (item.type === 'user') {
      return (
        <View style={s.userRow}>
          {item.imageUri ? (
            <Image source={{ uri: item.imageUri }} style={s.userImage} />
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
            <Text style={s.aiBadgeText}>번역</Text>
          </View>
          <TouchableOpacity style={s.copyBtn} onPress={() => handleCopy(item.content)}>
            <Ionicons name="copy-outline" size={16} color="#888888" />
          </TouchableOpacity>
        </View>
        <View style={s.aiBubble}>
          <Text style={s.aiText}>{item.content}</Text>
        </View>
        {item.showTriggers && (
          <View style={s.triggers}>
            <TouchableOpacity
              style={s.triggerBtn}
              onPress={() => handleTrigger('context', item)}
              disabled={loading}
            >
              <Text style={s.triggerText}>추가 정보 요청</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.triggerBtn}
              onPress={() => handleTrigger('simple', item)}
              disabled={loading}
            >
              <Text style={s.triggerText}>더 쉽게 설명</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.triggerBtn, s.triggerSatisfied]}
              onPress={() => updateLastAI({ showTriggers: false })}
            >
              <Text style={[s.triggerText, s.triggerSatisfiedText]}>답변에 만족</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* Header */}
        <View style={s.header}>
          <Text style={s.headerTitle}>한베번역기</Text>
          <Text style={s.headerSub}>한국어 ↔ 베트남어</Text>
        </View>

        {/* Message list */}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={s.listContent}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="language-outline" size={48} color="#DDDDDD" />
              <Text style={s.emptyText}>번역할 텍스트를 입력하거나{'\n'}사진을 보내보세요</Text>
            </View>
          }
          onContentSizeChange={() => messages.length > 0 && scrollToBottom()}
        />

        {/* Loading indicator */}
        {loading && (
          <View style={s.loadingRow}>
            <ActivityIndicator size="small" color="#000000" />
            <Text style={s.loadingText}>번역 중...</Text>
          </View>
        )}

        {/* Input bar */}
        <View style={s.inputBar}>
          <TouchableOpacity style={s.iconBtn} onPress={handleImage} disabled={loading}>
            <Ionicons name="add" size={24} color="#333333" />
          </TouchableOpacity>
          <TextInput
            style={s.textInput}
            value={input}
            onChangeText={setInput}
            placeholder="번역할 내용을 입력하세요..."
            placeholderTextColor="#BBBBBB"
            multiline
            maxHeight={100}
            returnKeyType="default"
          />
          <TouchableOpacity
            style={[s.sendBtn, (!input.trim() || loading) && s.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!input.trim() || loading}
          >
            <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Toast */}
        {!!toast && (
          <View style={s.toast}>
            <Text style={s.toastText}>{toast}</Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  flex: { flex: 1 },

  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EAEAEA',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#1A1A1A', letterSpacing: -0.5 },
  headerSub: { fontSize: 12, color: '#666666', marginTop: 2 },

  listContent: { padding: 16, paddingBottom: 8, flexGrow: 1 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 14, color: '#CCCCCC', textAlign: 'center', lineHeight: 22 },

  userRow: { alignItems: 'flex-end', marginBottom: 12 },
  userBubble: {
    backgroundColor: '#1A1A1A',
    borderRadius: 18,
    borderBottomRightRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '80%',
  },
  userText: { fontSize: 15, color: '#FFFFFF', lineHeight: 22 },
  userImage: { width: 200, height: 150, borderRadius: 12 },

  aiRow: { marginBottom: 16 },
  aiHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  aiBadge: {
    backgroundColor: '#F0F0F0',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  aiBadgeText: { fontSize: 11, fontWeight: '700', color: '#555555' },
  copyBtn: { padding: 4 },
  aiBubble: {
    backgroundColor: '#F9F9F9',
    borderRadius: 18,
    borderTopLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#EAEAEA',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  aiText: { fontSize: 15, color: '#1A1A1A', lineHeight: 24 },

  triggers: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  triggerBtn: {
    borderWidth: 1,
    borderColor: '#EAEAEA',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#FFFFFF',
  },
  triggerText: { fontSize: 12, color: '#333333', fontWeight: '600' },
  triggerSatisfied: { borderColor: '#EAEAEA', backgroundColor: '#F9F9F9' },
  triggerSatisfiedText: { color: '#AAAAAA' },

  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  loadingText: { fontSize: 13, color: '#888888' },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingBottom: Platform.OS === 'android' ? 24 : 10,
    borderTopWidth: 1,
    borderTopColor: '#EAEAEA',
    backgroundColor: '#FFFFFF',
    gap: 8,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EAEAEA',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9F9F9',
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#EAEAEA',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1A1A1A',
    backgroundColor: '#F9F9F9',
    minHeight: 40,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#CCCCCC' },

  toast: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  toastText: { fontSize: 13, color: '#FFFFFF', fontWeight: '600' },
});
