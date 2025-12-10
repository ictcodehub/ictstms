import { Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

export default function LanguageToggle() {
  const { i18n } = useTranslation();

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'id' : 'en';
    i18n.changeLanguage(newLang);
    localStorage.setItem('language', newLang);
  };

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={toggleLanguage}
      className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-2"
      aria-label="Toggle language"
    >
      <Globe className="h-5 w-5 text-slate-700 dark:text-slate-300" />
      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
        {i18n.language === 'en' ? 'EN' : 'ID'}
      </span>
    </motion.button>
  );
}
