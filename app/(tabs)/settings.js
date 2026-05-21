import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getSettings, saveSettings } from '../../src/utils/storage';
import { testApiKey } from '../../src/services/translationService';

const APP_VERSION = '1.0.0';

const MENUS = [
  { icon: 'person-outline', title: '내 정보 관리', sub: '계정 정보를 관리합니다' },
  { icon: 'language-outline', title: '번역 언어 기본값 설정', sub: '한국어 ↔ 베트남어' },
  { icon: 'document-text-outline', title: '오픈소스 라이선스', sub: '사용된 오픈소스 라이선스 정보' },
];

export default function SettingsScreen() {
  const [aiProvider, setAiProvider] = useState('gemini');
  const [geminiKey, setGeminiKey] = useState('');
  const [groqKey, setGroqKey] = useState('');
  const [saved, setSaved] = useState(false);

  const [geminiTesting, setGeminiTesting] = useState(false);
  const [geminiResult, setGeminiResult] = useState(null);
  const [geminiError, setGeminiError] = useState('');

  const [groqTesting, setGroqTesting] = useState(false);
  const [groqResult, setGroqResult] = useState(null);
  const [groqError, setGroqError] = useState('');

  useEffect(() => {
    getSettings().then((s) => {
      if (s.aiProvider) setAiProvider(s.aiProvider);
      if (s.apiKey) setGeminiKey(s.apiKey);
      if (s.groqApiKey) setGroqKey(s.groqApiKey);
    });
  }, []);

  const handleSave = async () => {
    await saveSettings({ aiProvider, apiKey: geminiKey.trim(), groqApiKey: groqKey.trim() });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTestGemini = async () => {
    if (!geminiKey.trim()) {
      Alert.alert('API 키 없음', 'Gemini API 키를 먼저 입력해주세요.');
      return;
    }
    setGeminiTesting(true);
    setGeminiResult(null);
    const result = await testApiKey({ aiProvider: 'gemini', apiKey: geminiKey.trim(), groqApiKey: '' });
    setGeminiResult(result.ok ? 'ok' : 'fail');
    if (!result.ok) setGeminiError(result.message || '');
    setGeminiTesting(false);
  };

  const handleTestGroq = async () => {
    if (!groqKey.trim()) {
      Alert.alert('API 키 없음', 'Groq API 키를 먼저 입력해주세요.');
      return;
    }
    setGroqTesting(true);
    setGroqResult(null);
    const result = await testApiKey({ aiProvider: 'groq', apiKey: '', groqApiKey: groqKey.trim() });
    setGroqResult(result.ok ? 'ok' : 'fail');
    if (!result.ok) setGroqError(result.message || '');
    setGroqTesting(false);
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={s.pageTitle}>설정</Text>

        {/* AI Provider */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>AI 제공자</Text>
          <Text style={s.sectionDesc}>번역 시 사용할 AI를 선택합니다.</Text>
          <View style={s.toggleRow}>
            {['gemini', 'groq'].map((p) => (
              <TouchableOpacity
                key={p}
                style={[s.toggleBtn, aiProvider === p && s.toggleActive]}
                onPress={() => setAiProvider(p)}
                activeOpacity={0.8}
              >
                {aiProvider === p && (
                  <View style={s.activeIndicator}>
                    <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                  </View>
                )}
                <Text style={[s.toggleText, aiProvider === p && s.toggleTextActive]}>
                  {p === 'gemini' ? 'Gemini' : 'Groq'}
                </Text>
                <Text style={[s.toggleSub, aiProvider === p && s.toggleSubActive]}>
                  {p === 'gemini' ? 'Google AI Studio' : 'console.groq.com'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Gemini API Key */}
        <View style={s.section}>
          <View style={s.sectionTitleRow}>
            <Text style={s.sectionTitle}>Gemini API 키</Text>
            {aiProvider === 'gemini' && (
              <View style={s.activeBadge}><Text style={s.activeBadgeText}>현재 사용 중</Text></View>
            )}
          </View>
          <View style={s.card}>
            <View style={s.cardRow}>
              <Ionicons name="key-outline" size={16} color="#555555" />
              <Text style={s.cardLabel}>Google AI Studio API 키</Text>
            </View>
            <TextInput
              style={s.input}
              value={geminiKey}
              onChangeText={(t) => { setGeminiKey(t); setGeminiResult(null); }}
              placeholder="Gemini API 키를 입력하세요"
              placeholderTextColor="#BBBBBB"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={s.apiHint}>aistudio.google.com 에서 무료로 발급받을 수 있습니다.</Text>
            {geminiResult === 'ok' && (
              <View style={s.testOk}>
                <Ionicons name="checkmark-circle" size={15} color="#22C55E" />
                <Text style={s.testOkText}>API 키가 정상 작동합니다.</Text>
              </View>
            )}
            {geminiResult === 'fail' && (
              <View style={s.testFail}>
                <Ionicons name="close-circle" size={15} color="#EF4444" />
                <Text style={s.testFailText}>{geminiError || 'API 키가 유효하지 않습니다.'}</Text>
              </View>
            )}
            <TouchableOpacity style={s.testBtn} onPress={handleTestGemini} disabled={geminiTesting}>
              {geminiTesting
                ? <ActivityIndicator size="small" color="#000000" />
                : <Text style={s.testBtnText}>연결 테스트</Text>
              }
            </TouchableOpacity>
          </View>
        </View>

        {/* Groq API Key */}
        <View style={s.section}>
          <View style={s.sectionTitleRow}>
            <Text style={s.sectionTitle}>Groq API 키</Text>
            {aiProvider === 'groq' && (
              <View style={s.activeBadge}><Text style={s.activeBadgeText}>현재 사용 중</Text></View>
            )}
          </View>
          <View style={s.card}>
            <View style={s.cardRow}>
              <Ionicons name="key-outline" size={16} color="#555555" />
              <Text style={s.cardLabel}>Groq API 키 (Llama 3.3 70B)</Text>
            </View>
            <TextInput
              style={s.input}
              value={groqKey}
              onChangeText={(t) => { setGroqKey(t); setGroqResult(null); }}
              placeholder="Groq API 키를 입력하세요"
              placeholderTextColor="#BBBBBB"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={s.apiHint}>console.groq.com 에서 무료로 발급받을 수 있습니다.</Text>
            {groqResult === 'ok' && (
              <View style={s.testOk}>
                <Ionicons name="checkmark-circle" size={15} color="#22C55E" />
                <Text style={s.testOkText}>API 키가 정상 작동합니다.</Text>
              </View>
            )}
            {groqResult === 'fail' && (
              <View style={s.testFail}>
                <Ionicons name="close-circle" size={15} color="#EF4444" />
                <Text style={s.testFailText}>{groqError || 'API 키가 유효하지 않습니다.'}</Text>
              </View>
            )}
            <TouchableOpacity style={s.testBtn} onPress={handleTestGroq} disabled={groqTesting}>
              {groqTesting
                ? <ActivityIndicator size="small" color="#000000" />
                : <Text style={s.testBtnText}>연결 테스트</Text>
              }
            </TouchableOpacity>
          </View>
        </View>

        {/* Save */}
        <View style={s.section}>
          <TouchableOpacity style={[s.saveBtn, saved && s.saveBtnDone]} onPress={handleSave}>
            {saved ? (
              <>
                <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                <Text style={s.saveBtnText}>저장됨</Text>
              </>
            ) : (
              <Text style={s.saveBtnText}>설정 저장</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Menu list */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>앱 정보</Text>
          <View style={s.card}>
            {MENUS.map((item, i) => (
              <TouchableOpacity
                key={i}
                style={[s.menuRow, i > 0 && s.menuBorder]}
                activeOpacity={0.7}
              >
                <View style={s.menuIcon}>
                  <Ionicons name={item.icon} size={18} color="#333333" />
                </View>
                <View style={s.menuTexts}>
                  <Text style={s.menuTitle}>{item.title}</Text>
                  <Text style={s.menuSub}>{item.sub}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#CCCCCC" />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={s.versionRow}>
          <Text style={s.versionText}>한베번역기</Text>
          <Text style={s.versionNum}>v{APP_VERSION}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { padding: 16, paddingBottom: 100 },
  pageTitle: { fontSize: 26, fontWeight: '800', color: '#000000', letterSpacing: -0.6, marginBottom: 20 },

  section: { marginBottom: 20 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#888888', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 10 },
  sectionDesc: { fontSize: 12, color: '#AAAAAA', marginBottom: 10, marginTop: -6 },

  activeBadge: { backgroundColor: '#000000', borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2 },
  activeBadgeText: { fontSize: 9, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.3 },

  toggleRow: { flexDirection: 'row', gap: 10 },
  toggleBtn: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },
  toggleActive: { borderColor: '#000000', backgroundColor: '#000000' },
  activeIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  toggleText: { fontSize: 15, fontWeight: '700', color: '#888888' },
  toggleTextActive: { color: '#FFFFFF' },
  toggleSub: { fontSize: 11, color: '#BBBBBB', marginTop: 2 },
  toggleSubActive: { color: 'rgba(255,255,255,0.5)' },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EEEEEE',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  cardLabel: { fontSize: 14, fontWeight: '600', color: '#333333' },

  input: {
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    color: '#000000',
    backgroundColor: '#FAFAFA',
    marginBottom: 8,
  },
  apiHint: { fontSize: 12, color: '#AAAAAA', lineHeight: 18, marginBottom: 10 },

  testOk: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F0FFF4', borderRadius: 8, padding: 10, marginBottom: 10 },
  testOkText: { fontSize: 13, color: '#16A34A', fontWeight: '500', flex: 1 },
  testFail: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: '#FFF5F5', borderRadius: 8, padding: 10, marginBottom: 10 },
  testFailText: { fontSize: 13, color: '#DC2626', fontWeight: '500', flex: 1 },

  testBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingVertical: 11,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    minHeight: 42,
  },
  testBtnText: { fontSize: 14, fontWeight: '600', color: '#333333' },

  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
    borderRadius: 12,
    paddingVertical: 15,
    gap: 6,
  },
  saveBtnDone: { backgroundColor: '#22C55E' },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },

  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  menuBorder: { borderTopWidth: 1, borderTopColor: '#F5F5F5' },
  menuIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center', alignItems: 'center',
  },
  menuTexts: { flex: 1 },
  menuTitle: { fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
  menuSub: { fontSize: 12, color: '#AAAAAA', marginTop: 2 },

  versionRow: { alignItems: 'center', paddingVertical: 12, gap: 4 },
  versionText: { fontSize: 13, fontWeight: '600', color: '#AAAAAA' },
  versionNum: { fontSize: 12, color: '#CCCCCC' },
});
