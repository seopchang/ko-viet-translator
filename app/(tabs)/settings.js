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
import { useLanguage } from '../../src/context/LanguageContext';
import { strings } from '../../src/utils/i18n';

const APP_VERSION = '1.0.0';

export default function SettingsScreen() {
  const { language, setLanguage } = useLanguage();
  const t = strings[language];

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
    await saveSettings({ aiProvider, apiKey: geminiKey.trim(), groqApiKey: groqKey.trim(), appLanguage: language });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTestGemini = async () => {
    if (!geminiKey.trim()) { Alert.alert(t.noApiKey, t.noGeminiKey); return; }
    setGeminiTesting(true);
    setGeminiResult(null);
    setGeminiError('');
    const result = await testApiKey({ aiProvider: 'gemini', apiKey: geminiKey.trim(), groqApiKey: '' });
    setGeminiResult(result.ok ? 'ok' : 'fail');
    if (!result.ok) setGeminiError(result.message || '');
    setGeminiTesting(false);
  };

  const handleTestGroq = async () => {
    if (!groqKey.trim()) { Alert.alert(t.noApiKey, t.noGroqKey); return; }
    setGroqTesting(true);
    setGroqResult(null);
    setGroqError('');
    const result = await testApiKey({ aiProvider: 'groq', apiKey: '', groqApiKey: groqKey.trim() });
    setGroqResult(result.ok ? 'ok' : 'fail');
    if (!result.ok) setGroqError(result.message || '');
    setGroqTesting(false);
  };

  const MENUS = [
    { icon: 'person-outline', title: t.myInfo, sub: t.myInfoSub },
    { icon: 'language-outline', title: t.defaultLang, sub: t.defaultLangSub },
    { icon: 'document-text-outline', title: t.openSource, sub: t.openSourceSub },
  ];

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={s.pageTitle}>{t.settingsTitle}</Text>

        {/* 앱 언어 */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>{t.appLanguageLabel}</Text>
          <Text style={s.sectionDesc}>{t.appLanguageDesc}</Text>
          <View style={s.toggleRow}>
            {[{ code: 'ko', label: t.langKo }, { code: 'vi', label: t.langVi }].map(({ code, label }) => (
              <TouchableOpacity
                key={code}
                style={[s.toggleBtn, language === code && s.toggleActive]}
                onPress={() => setLanguage(code)}
                activeOpacity={0.8}
              >
                {language === code && (
                  <View style={s.activeIndicator}>
                    <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                  </View>
                )}
                <Text style={[s.toggleText, language === code && s.toggleTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* AI 제공자 */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>{t.aiProvider}</Text>
          <Text style={s.sectionDesc}>{t.aiProviderDesc}</Text>
          <View style={s.toggleRow}>
            {[{ id: 'gemini', label: 'Gemini', sub: 'Google AI Studio' }, { id: 'groq', label: 'Groq', sub: 'console.groq.com' }].map(({ id, label, sub }) => (
              <TouchableOpacity
                key={id}
                style={[s.toggleBtn, aiProvider === id && s.toggleActive]}
                onPress={() => setAiProvider(id)}
                activeOpacity={0.8}
              >
                {aiProvider === id && (
                  <View style={s.activeIndicator}>
                    <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                  </View>
                )}
                <Text style={[s.toggleText, aiProvider === id && s.toggleTextActive]}>{label}</Text>
                <Text style={[s.toggleSub, aiProvider === id && s.toggleSubActive]}>{sub}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Gemini API 키 */}
        <View style={s.section}>
          <View style={s.sectionTitleRow}>
            <Text style={s.sectionTitle}>{t.geminiKey}</Text>
            {aiProvider === 'gemini' && (
              <View style={s.activeBadge}><Text style={s.activeBadgeText}>{t.currentlyUsing}</Text></View>
            )}
          </View>
          <View style={s.card}>
            <View style={s.cardRow}>
              <Ionicons name="key-outline" size={16} color="#7A6A5A" />
              <Text style={s.cardLabel}>{t.geminiKeyLabel}</Text>
            </View>
            <TextInput
              style={s.input}
              value={geminiKey}
              onChangeText={(v) => { setGeminiKey(v); setGeminiResult(null); }}
              placeholder={t.geminiPlaceholder}
              placeholderTextColor="#C5BAB0"
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry={false}
            />
            <Text style={s.apiHint}>{t.geminiHint}</Text>
            {geminiResult === 'ok' && (
              <View style={s.testOk}>
                <Ionicons name="checkmark-circle" size={15} color="#22C55E" />
                <Text style={s.testOkText}>{t.testOk}</Text>
              </View>
            )}
            {geminiResult === 'fail' && (
              <View style={s.testFail}>
                <Ionicons name="close-circle" size={15} color="#EF4444" />
                <Text style={s.testFailText}>{geminiError || t.testFail}</Text>
              </View>
            )}
            <TouchableOpacity style={s.testBtn} onPress={handleTestGemini} disabled={geminiTesting} activeOpacity={0.8}>
              {geminiTesting ? <ActivityIndicator size="small" color="#3D2314" /> : <Text style={s.testBtnText}>{t.testConnection}</Text>}
            </TouchableOpacity>
          </View>
        </View>

        {/* Groq API 키 */}
        <View style={s.section}>
          <View style={s.sectionTitleRow}>
            <Text style={s.sectionTitle}>{t.groqKey}</Text>
            {aiProvider === 'groq' && (
              <View style={s.activeBadge}><Text style={s.activeBadgeText}>{t.currentlyUsing}</Text></View>
            )}
          </View>
          <View style={s.card}>
            <View style={s.cardRow}>
              <Ionicons name="key-outline" size={16} color="#7A6A5A" />
              <Text style={s.cardLabel}>{t.groqKeyLabel}</Text>
            </View>
            <TextInput
              style={s.input}
              value={groqKey}
              onChangeText={(v) => { setGroqKey(v); setGroqResult(null); }}
              placeholder={t.groqPlaceholder}
              placeholderTextColor="#C5BAB0"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={s.apiHint}>{t.groqHint}</Text>
            {groqResult === 'ok' && (
              <View style={s.testOk}>
                <Ionicons name="checkmark-circle" size={15} color="#22C55E" />
                <Text style={s.testOkText}>{t.testOk}</Text>
              </View>
            )}
            {groqResult === 'fail' && (
              <View style={s.testFail}>
                <Ionicons name="close-circle" size={15} color="#EF4444" />
                <Text style={s.testFailText}>{groqError || t.testFail}</Text>
              </View>
            )}
            <TouchableOpacity style={s.testBtn} onPress={handleTestGroq} disabled={groqTesting} activeOpacity={0.8}>
              {groqTesting ? <ActivityIndicator size="small" color="#3D2314" /> : <Text style={s.testBtnText}>{t.testConnection}</Text>}
            </TouchableOpacity>
          </View>
        </View>

        {/* 저장 */}
        <View style={s.section}>
          <TouchableOpacity style={[s.saveBtn, saved && s.saveBtnDone]} onPress={handleSave} activeOpacity={0.85}>
            {saved ? (
              <>
                <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                <Text style={s.saveBtnText}>{t.saved}</Text>
              </>
            ) : (
              <Text style={s.saveBtnText}>{t.saveSettings}</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* 앱 정보 */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>{t.appInfo}</Text>
          <View style={s.card}>
            {MENUS.map((item, i) => (
              <TouchableOpacity key={i} style={[s.menuRow, i > 0 && s.menuBorder]} activeOpacity={0.7}>
                <View style={s.menuIcon}>
                  <Ionicons name={item.icon} size={18} color="#3D2314" />
                </View>
                <View style={s.menuTexts}>
                  <Text style={s.menuTitle}>{item.title}</Text>
                  <Text style={s.menuSub}>{item.sub}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#C5BAB0" />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={s.versionRow}>
          <Text style={s.versionText}>Simple Translator</Text>
          <Text style={s.versionNum}>v{APP_VERSION}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FAF8F5' },
  content: { padding: 16, paddingBottom: 100 },
  pageTitle: { fontSize: 26, fontWeight: '800', color: '#1A0F08', letterSpacing: -0.6, marginBottom: 20 },

  section: { marginBottom: 20 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#9C8B7A', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 10 },
  sectionDesc: { fontSize: 12, color: '#B8AA9A', marginBottom: 10, marginTop: -6 },

  activeBadge: { backgroundColor: '#3D2314', borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2 },
  activeBadgeText: { fontSize: 9, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.3 },

  toggleRow: { flexDirection: 'row', gap: 10 },
  toggleBtn: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#DDD5CA',
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    backgroundColor: '#FAF8F5',
  },
  toggleActive: { borderColor: '#3D2314', backgroundColor: '#3D2314' },
  activeIndicator: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  toggleText: { fontSize: 15, fontWeight: '700', color: '#9C8B7A' },
  toggleTextActive: { color: '#FFFFFF' },
  toggleSub: { fontSize: 11, color: '#C5BAB0', marginTop: 2 },
  toggleSubActive: { color: 'rgba(255,255,255,0.5)' },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EDE8E0',
    shadowColor: '#3D2314',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  cardLabel: { fontSize: 14, fontWeight: '600', color: '#4A3728' },

  input: {
    borderWidth: 1.5,
    borderColor: '#DDD5CA',
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    color: '#1A0F08',
    backgroundColor: '#FAF8F5',
    marginBottom: 8,
  },
  apiHint: { fontSize: 12, color: '#B8AA9A', lineHeight: 18, marginBottom: 10 },

  testOk: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F0FFF4', borderRadius: 8, padding: 10, marginBottom: 10 },
  testOkText: { fontSize: 13, color: '#16A34A', fontWeight: '500', flex: 1 },
  testFail: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: '#FFF5F5', borderRadius: 8, padding: 10, marginBottom: 10 },
  testFailText: { fontSize: 13, color: '#DC2626', fontWeight: '500', flex: 1 },

  testBtn: {
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 10, paddingVertical: 11,
    borderWidth: 1.5, borderColor: '#DDD5CA', minHeight: 42,
  },
  testBtnText: { fontSize: 14, fontWeight: '600', color: '#4A3728' },

  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#3D2314', borderRadius: 12, paddingVertical: 15, gap: 6,
  },
  saveBtnDone: { backgroundColor: '#22C55E' },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },

  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  menuBorder: { borderTopWidth: 1, borderTopColor: '#F5F1EC' },
  menuIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#FAF8F5', justifyContent: 'center', alignItems: 'center',
  },
  menuTexts: { flex: 1 },
  menuTitle: { fontSize: 14, fontWeight: '600', color: '#1A0F08' },
  menuSub: { fontSize: 12, color: '#B8AA9A', marginTop: 2 },

  versionRow: { alignItems: 'center', paddingVertical: 12, gap: 4 },
  versionText: { fontSize: 13, fontWeight: '600', color: '#B8AA9A' },
  versionNum: { fontSize: 12, color: '#C5BAB0' },
});
