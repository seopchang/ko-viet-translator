import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LanguageContext = createContext({ language: 'ko', setLanguage: () => {} });

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState('ko');

  useEffect(() => {
    AsyncStorage.getItem('@koviet_lang').then((val) => {
      if (val) setLanguageState(val);
    });
  }, []);

  const setLanguage = async (lang) => {
    setLanguageState(lang);
    await AsyncStorage.setItem('@koviet_lang', lang);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
