import AsyncStorage from '@react-native-async-storage/async-storage';

const SETTINGS_KEY = '@koviet_settings';

const DEFAULT_SETTINGS = {
  apiKey: '',
  groqApiKey: '',
  aiProvider: 'gemini',
};

export const getSettings = async () => {
  try {
    const data = await AsyncStorage.getItem(SETTINGS_KEY);
    return data ? { ...DEFAULT_SETTINGS, ...JSON.parse(data) } : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
};

export const saveSettings = async (settings) => {
  try {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
};
