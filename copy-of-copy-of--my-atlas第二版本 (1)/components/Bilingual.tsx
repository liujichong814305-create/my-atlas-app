
import React, { createContext, useContext } from 'react';

export type LanguageMode = 'en' | 'zh' | 'bilingual';
export const LanguageContext = createContext<LanguageMode>('zh');

interface Props {
  en: string;
  zh: string;
  reverse?: boolean; // If true, Chinese first
  className?: string;
}

export const Bilingual: React.FC<Props> = ({ en, zh, reverse = false, className = '' }) => {
  const mode = useContext(LanguageContext);

  if (mode === 'en') {
      return <span className={`font-medium ${className}`}>{en}</span>;
  }

  if (mode === 'zh') {
      return <span className={`font-medium ${className}`}>{zh}</span>;
  }

  return (
    <div className={`flex flex-col leading-tight ${className}`}>
      <span className={`${reverse ? 'text-xs uppercase tracking-wider opacity-60' : 'text-sm font-medium'}`}>
        {reverse ? en : en}
      </span>
      <span className={`${reverse ? 'text-sm font-medium' : 'text-xs opacity-60'}`}>
        {reverse ? zh : zh}
      </span>
    </div>
  );
};

export const BilingualInline: React.FC<Props> = ({ en, zh }) => {
  const mode = useContext(LanguageContext);

  if (mode === 'en') return <span>{en}</span>;
  if (mode === 'zh') return <span>{zh}</span>;

  return (
    <span>
      {en} <span className="opacity-60 text-[0.8em] ml-1">{zh}</span>
    </span>
  );
};
