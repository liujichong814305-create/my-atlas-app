
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { sendMessageToAtlas } from './services/geminiService';
import { loginUser, syncDataToCloud, restoreDataFromCloud, UserAccount } from './services/authService';
import AtlasVisual, { AtlasMini } from './components/AtlasVisual'; // Fixed: Removed .tsx extension
import { Bilingual, BilingualInline, LanguageContext } from './components/Bilingual';
import { 
  IconLife, IconLearning, IconJournal, IconSend, IconPlan, IconSun, IconDepth, 
  IconCamera, IconClose, IconHeart, IconBrain, IconTimer, IconStop, IconPlay, 
  IconPause, IconUser, IconSignal, IconLock, IconLanguage, IconBook, IconShield, 
  IconDownload, IconUpload, IconLogout, IconChevronRight, IconSettings, IconArrowLeft, 
  IconAtlas, IconMail, IconStamp, IconSearch, IconCalendar, IconChevronLeft,
  IconEnvelope, IconFileText, IconMenu, IconPlus, IconMic, IconVideo
} from './components/Icons';
import { DailyPlanner } from './components/DailyPlanner';
import { LiveSession } from './components/LiveSession';
import { Message, ModuleType, UserProfile, AtlasLetter } from './types';

interface SessionState {
    isActive: boolean;
    isPaused: boolean;
    startTime: number | null;
    accumulatedTime: number;
    duration: number; // in seconds, default 50 * 60
    isEnded: boolean;
}

interface ExerciseState {
    status: 'none' | 'pending' | 'active';
    type: 'breath' | 'meditation';
    duration: number;
    timeLeft: number;
}

interface LetterSettings {
    weekly: boolean;
    monthly: boolean;
    yearly: boolean;
}

interface SharedContentState {
    isActive: boolean;
    type: 'audio' | 'text';
    title: string;
    timeLeft: number;
}

export default function App(): React.ReactElement {
  // --- AUTH & SYSTEM STATE ---
  const [userAccount, setUserAccount] = useState<UserAccount | null>(null);
  const [showLogin, setShowLogin] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>('');
  
  const [appLanguage, setAppLanguage] = useState<'en' | 'zh' | 'bilingual'>('zh');
  const [settingsSubPage, setSettingsSubPage] = useState<'menu' | 'language' | 'guide' | 'account' | 'data' | 'letters'>('menu');

  const [activeModule, setActiveModule] = useState<ModuleType>('daily');
  const [deepSubMode, setDeepSubMode] = useState<'support' | 'analysis'>('support');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  // --- LIVE SESSION & MEDIA STATE ---
  const [isLiveSessionActive, setIsLiveSessionActive] = useState(false);
  
  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);
  const [sharedContentState, setSharedContentState] = useState<SharedContentState | null>(null);

  // --- SESSION STATE ---
  const [sessionState, setSessionState] = useState<SessionState>({
      isActive: false,
      isPaused: false,
      startTime: null,
      accumulatedTime: 0,
      duration: 50 * 60, 
      isEnded: false
  });

  const [exerciseState, setExerciseState] = useState<ExerciseState>({
      status: 'none',
      type: 'breath',
      duration: 5,
      timeLeft: 0
  });

  // --- MESSAGES STATE ---
  const hydrateMessages = (msgs: any[]): Message[] => {
      if (!Array.isArray(msgs)) return [];
      return msgs.map(m => ({
          ...m,
          timestamp: new Date(m.timestamp)
      }));
  };

  const [dailyMessages, setDailyMessages] = useState<Message[]>([
    {
      id: 'init-daily',
      role: 'model',
      text: "<strong>My Atlas.</strong>\n\nI'm watching. How is your day?\n\n我在看着。今天怎么样？",
      timestamp: new Date()
    }
  ]);
  
  const [deepSupportMessages, setDeepSupportMessages] = useState<Message[]>([
    {
      id: 'init-deep-support',
      role: 'model',
      text: "<strong>Therapeutic Session.</strong>\n\nThe door is closed. The space is safe. I am here as your mirror, not your judge.\n\n咨询室的门已关上。这里绝对安全。我是你的镜子，不带任何评判。",
      timestamp: new Date()
    }
  ]);

  const [deepAnalysisMessages, setDeepAnalysisMessages] = useState<Message[]>([
    {
      id: 'init-deep-analysis',
      role: 'model',
      text: "<strong>Psychoanalysis Core.</strong>\n\nWe are descending into the subconscious. Prepare to face the patterns you ignore. What is the root cause?\n\n深度解析核心。我们正在潜入潜意识。准备好直面那些被你忽视的模式。根本原因是什么？",
      timestamp: new Date()
    }
  ]);

  const [learningMessages, setLearningMessages] = useState<Message[]>([
    {
        id: 'init-learn',
        role: 'model',
        text: "<strong>Learning Protocol.</strong>\n\nWhat topic are we mastering? I will be your mirror.\n\n学习协议已启动。我们要攻克什么主题？我将成为你的镜子。",
        timestamp: new Date()
    }
  ]);

  // Private Space Messages
  const [privateMessages, setPrivateMessages] = useState<Message[]>([]);

  // --- INPUT & UI STATE ---
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | undefined>(undefined);
  const [isThinking, setIsThinking] = useState(false);
  const [showPlanner, setShowPlanner] = useState(false);
  const [showSettings, setShowSettings] = useState(false); 
  const [customDailyPersona, setCustomDailyPersona] = useState<string | null>(null);

  // --- JOURNAL / ARCHIVE STATE ---
  const [viewingLogDate, setViewingLogDate] = useState<string | null>(null);
  const [logTab, setLogTab] = useState<'daily' | 'therapy' | 'analysis' | 'learning'>('daily'); 
  const [logContent, setLogContent] = useState<string>('');
  const [logLoading, setLogLoading] = useState(false);
  const [archivedLogs, setArchivedLogs] = useState<Record<string, string>>({});
  
  // Archive Search State
  const [journalSearchTerm, setJournalSearchTerm] = useState('');
  const [journalSearchDate, setJournalSearchDate] = useState('');
  const [isJournalSearchOpen, setIsJournalSearchOpen] = useState(false);
  const [isArchiveMenuOpen, setIsArchiveMenuOpen] = useState(false); // New State for Archive Menu
  const [calendarDate, setCalendarDate] = useState(new Date());

  // Chat Search & Private Tag State
  const [isChatSearchOpen, setIsChatSearchOpen] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [chatSearchDate, setChatSearchDate] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null); // State for Private Tag Filtering

  const [lastAutoSummaryDate, setLastAutoSummaryDate] = useState<string | null>(null);

  const [letterSettings, setLetterSettings] = useState<LetterSettings>({
      weekly: true,
      monthly: true,
      yearly: true
  });
  const [atlasLetters, setAtlasLetters] = useState<AtlasLetter[]>([]);
  const [viewingLetter, setViewingLetter] = useState<AtlasLetter | null>(null);
  const [journalViewMode, setJournalViewMode] = useState<'calendar' | 'letters'>('calendar');

  // --- LETTER ANIMATION STATE ---
  const [isLetterModalOpen, setIsLetterModalOpen] = useState(false);
  const [letterStage, setLetterStage] = useState<'closed' | 'opening' | 'reading'>('closed');
  const [typedContent, setTypedContent] = useState('');

  const [userProfile, setUserProfile] = useState<UserProfile>({
    name: 'User',
    profession: '',
    details: '', 
    avatarColor: '#4a6572', 
    avatarImage: undefined
  });

  // --- SELECTION STATE ---
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedMsgIds, setSelectedMsgIds] = useState<Set<string>>(new Set());

  // --- REFS ---
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null); 
  const importInputRef = useRef<HTMLInputElement>(null); 
  const chatImageInputRef = useRef<HTMLInputElement>(null); 
  const sessionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const exerciseIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevModuleRef = useRef<ModuleType>('daily'); 

  const [visualConfig, setVisualConfig] = useState({
    edgeBlur: 60,      
    centerWhite: 60,   
    haloIntensity: 60  
  });

  // --- DERIVED STATE ---
  const moduleConfig = useMemo(() => {
    const loc = (en: string, zh: string) => {
        if (appLanguage === 'en') return en;
        if (appLanguage === 'zh') return zh;
        return `${en} (${zh})`;
    };

    if (activeModule === 'profile') {
        return { title: { en: 'My Identity', zh: '我的档案' }, themeClass: 'bg-atlas-surface', placeholder: '' };
    }
    if (activeModule === 'settings') {
        return { title: { en: 'Settings', zh: '设置' }, themeClass: 'bg-atlas-surface', placeholder: '' };
    }
    if (activeModule === 'private') {
        return { title: { en: 'Private Space', zh: '私密空间' }, themeClass: 'bg-[#f4f4f4]', placeholder: loc("Write freely... #topic", "自由书写... #话题") };
    }
     if (activeModule === 'deep') {
        const isSessionActive = sessionState.isActive && !sessionState.isPaused && !sessionState.isEnded;
        const deepPlaceholder = isSessionActive 
            ? (deepSubMode === 'support' 
                ? loc("Describe the feeling...", "描述感觉……")
                : loc("Trace the origin...", "追溯源头……"))
            : loc("Paused. Resume to speak.", "暂停中。");

        return {
            title: deepSubMode === 'support' 
                ? { en: 'Therapy Room', zh: '心理咨询室' }
                : { en: 'Core Analysis', zh: '深度解析' },
            themeClass: 'bg-slate-50/50',
            placeholder: sessionState.isEnded 
                ? loc("Session Ended.", "咨询已结束") 
                : deepPlaceholder
        };
    } else if (activeModule === 'learning') {
        return {
            title: { en: 'Deep Learning', zh: '深度学习' },
            themeClass: 'bg-white',
            placeholder: loc("Enter topic...", "输入主题……")
        };
    } else if (activeModule === 'journal') {
        return {
            title: { en: 'The Archive', zh: '时间档案' },
            themeClass: 'bg-atlas-surface',
            placeholder: ""
        };
    }
    return {
        title: { en: 'Daily Protocol', zh: '日常协议' },
        themeClass: 'bg-atlas-surface',
        placeholder: loc("Talk to Atlas...", "与Atlas对话……")
    };
  }, [activeModule, deepSubMode, sessionState.isEnded, sessionState.isActive, sessionState.isPaused, appLanguage]);

  const currentMessages = useMemo(() => {
      switch(activeModule) {
          case 'daily': return dailyMessages;
          case 'deep': return deepSubMode === 'support' ? deepSupportMessages : deepAnalysisMessages;
          case 'learning': return learningMessages;
          case 'private': return privateMessages;
          default: return [];
      }
  }, [activeModule, dailyMessages, deepSupportMessages, deepAnalysisMessages, learningMessages, deepSubMode, privateMessages]);

  const availableTags = useMemo(() => {
      const tags = new Set<string>();
      privateMessages.forEach(msg => {
          msg.tags?.forEach(tag => tags.add(tag));
      });
      return Array.from(tags);
  }, [privateMessages]);

  const setMessages = (setter: (prev: Message[]) => Message[]) => {
      switch(activeModule) {
          case 'daily': setDailyMessages(setter); break;
          case 'deep': 
              if (deepSubMode === 'support') setDeepSupportMessages(setter);
              else setDeepAnalysisMessages(setter);
              break;
          case 'learning': setLearningMessages(setter); break;
          case 'private': setPrivateMessages(setter); break;
      }
  };

  const getMessagesForDate = (messages: Message[], dateStr: string) => {
      return messages.filter(m => {
          const mDate = m.timestamp.toISOString().split('T')[0];
          return mDate === dateStr;
      });
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [dailyMessages, deepSupportMessages, deepAnalysisMessages, learningMessages, privateMessages, activeModule, deepSubMode, sharedContentState]);

  useEffect(() => {
      setIsChatSearchOpen(false);
      setChatSearchQuery('');
      setChatSearchDate('');
      setSelectedTag(null);
      setIsPlusMenuOpen(false);
      setIsJournalSearchOpen(false);
      setJournalSearchTerm('');
      setJournalSearchDate('');
      setIsArchiveMenuOpen(false); 
  }, [activeModule, deepSubMode]);

  useEffect(() => {
      let interval: ReturnType<typeof setInterval>;
      if (sharedContentState && sharedContentState.isActive && sharedContentState.timeLeft > 0) {
          interval = setInterval(() => {
              setSharedContentState(prev => {
                  if (!prev) return null;
                  return { ...prev, timeLeft: prev.timeLeft - 1 };
              });
          }, 1000);
      } else if (sharedContentState && sharedContentState.isActive && sharedContentState.timeLeft === 0) {
          const finishedContent = sharedContentState;
          setSharedContentState(null); 
          handleFinishedSharedContent(finishedContent);
      }
      return () => clearInterval(interval);
  }, [sharedContentState?.isActive, sharedContentState?.timeLeft]);

  const handleFinishedSharedContent = async (content: SharedContentState) => {
      setIsThinking(true);
      try {
          const action = content.type === 'audio' ? 'listening to' : 'reading';
          const prompt = `[System Event: User shared content "${content.title}". You just finished ${action} it.
          **Task**: React to this content emotionally and intellectually. Treat it as a shared experience.
          **Tone**: Intimate, thoughtful, compliant with your persona (Atlas).
          **Language**: Bilingual (English first, Chinese second).]`;
          
          const response = await sendMessageToAtlas(prompt);
          const aiMsg: Message = { id: Date.now().toString(), role: 'model', text: response, timestamp: new Date() };
          setMessages(prev => [...prev, aiMsg]);
      } catch (e) {
          console.error(e);
      } finally {
          setIsThinking(false);
      }
  };

  useEffect(() => {
    if (isLetterModalOpen && letterStage === 'reading' && viewingLetter) {
        setTypedContent('');
        let i = 0;
        const fullContent = viewingLetter.content;
        const speed = 20; 

        const interval = setInterval(() => {
            if (i < fullContent.length) {
                setTypedContent(prev => prev + fullContent.charAt(i));
                i++;
            } else {
                clearInterval(interval);
            }
        }, speed);

        return () => clearInterval(interval);
    }
  }, [isLetterModalOpen, letterStage, viewingLetter]);

  const handleLogin = async (method: 'wechat' | 'phone') => {
      setIsSyncing(true); 
      try {
          const user = await loginUser(method);
          setUserAccount(user);
          const cloudData = await restoreDataFromCloud(user.id);
          if (cloudData) {
              setUserProfile(cloudData.profile);
              setDailyMessages(hydrateMessages(cloudData.dailyMessages));
              setDeepSupportMessages(hydrateMessages(cloudData.deepSupportMessages));
              setDeepAnalysisMessages(hydrateMessages(cloudData.deepAnalysisMessages));
              setLearningMessages(hydrateMessages(cloudData.learningMessages));
              setPrivateMessages(hydrateMessages(cloudData.privateMessages));
          } else {
              setUserProfile(prev => ({...prev, name: user.username}));
          }
          setShowLogin(false);
      } catch (e) {
          console.error("Login failed", e);
      } finally {
          setIsSyncing(false);
      }
  };

  const handleGuestLogin = () => {
      setShowLogin(false);
      setUserAccount({ id: 'guest', username: 'Visitor', method: 'guest' });
  };

  const handleCloudSync = async () => {
      if (!userAccount || userAccount.method === 'guest') return;
      setIsSyncing(true);
      setSyncStatus('Uploading...');
      const data = { 
          profile: userProfile, 
          dailyMessages, 
          deepSupportMessages, 
          deepAnalysisMessages,
          learningMessages,
          privateMessages 
      };
      const success = await syncDataToCloud(userAccount.id, data);
      if (success) { setSyncStatus('Synced Successfully'); setTimeout(() => setSyncStatus(''), 3000); } 
      else { setSyncStatus('Sync Failed'); }
      setIsSyncing(false);
  };
  
  const handleExportData = () => {
      const data = { 
          userProfile, 
          dailyMessages, 
          deepSupportMessages, 
          deepAnalysisMessages, 
          learningMessages, 
          privateMessages,
          timestamp: new Date().toISOString() 
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `atlas_backup_${new Date().toISOString().split('T')[0]}.json`; a.click(); URL.revokeObjectURL(url);
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => { 
          try { 
              const data = JSON.parse(event.target?.result as string); 
              if (data.userProfile) setUserProfile(data.userProfile); 
              if (data.dailyMessages) setDailyMessages(hydrateMessages(data.dailyMessages)); 
              if (data.deepSupportMessages) setDeepSupportMessages(hydrateMessages(data.deepSupportMessages)); 
              if (data.deepAnalysisMessages) setDeepAnalysisMessages(hydrateMessages(data.deepAnalysisMessages)); 
              if (data.learningMessages) setLearningMessages(hydrateMessages(data.learningMessages)); 
              if (data.privateMessages) setPrivateMessages(hydrateMessages(data.privateMessages)); 
              alert("Data restored successfully."); 
          } catch (err) { 
              console.error("Failed to parse backup", err); 
              alert("Invalid backup file."); 
          } 
      };
      reader.readAsText(file); if (importInputRef.current) importInputRef.current.value = '';
  };

  const handleLogout = () => { setUserAccount(null); setShowLogin(true); setActiveModule('daily'); };

  useEffect(() => {
    if (activeModule === 'deep' && deepSubMode === 'support' && prevModuleRef.current !== 'deep') {
        setSessionState(prev => ({ ...prev, isActive: true, isPaused: false, startTime: Date.now(), isEnded: false }));
        const triggerFollowUp = async () => {
            setIsThinking(true);
            try {
                const prompt = `[System: The user has just entered the Therapy Room for a NEW session. 
                This is a continuous relationship. 
                Task: Greet them gently and ask how they felt after the *last* consultation or how they have been coping since then.
                Tone: Professional, warm, continuous, attentive.
                Do not say "Hello" generically. Be specific to the context of returning to therapy.]`;
                const response = await sendMessageToAtlas(prompt);
                const aiMsg: Message = { id: Date.now().toString(), role: 'model', text: response, timestamp: new Date() };
                setDeepSupportMessages(prev => [...prev, aiMsg]);
            } catch (e) { console.error(e); } finally { setIsThinking(false); }
        };
        setTimeout(triggerFollowUp, 500);
    }
    prevModuleRef.current = activeModule;
  }, [activeModule, deepSubMode]);

  useEffect(() => {
    if (activeModule === 'deep' && deepSubMode === 'support' && !sessionState.isEnded) {
        sessionTimerRef.current = setInterval(() => {
            if (sessionState.isActive && !sessionState.isPaused) {
                const currentSegment = sessionState.startTime ? (Date.now() - sessionState.startTime) / 1000 : 0;
                const totalElapsed = sessionState.accumulatedTime + currentSegment;
                const remaining = (50 * 60) - totalElapsed;
                if (remaining <= 0) { endSession(true); } else { setSessionState(prev => ({...prev})); }
            }
        }, 1000);
    } else { if (sessionTimerRef.current) clearInterval(sessionTimerRef.current); }
    return () => { if (sessionTimerRef.current) clearInterval(sessionTimerRef.current); };
  }, [activeModule, deepSubMode, sessionState.isActive, sessionState.isEnded, sessionState.isPaused]);

  useEffect(() => {
      const summaryTimer = setInterval(() => {
          const now = new Date();
          const todayStr = now.toISOString().split('T')[0];
          if (now.getHours() === 22 && now.getMinutes() === 0) {
              if (lastAutoSummaryDate !== todayStr) {
                  generateLog(todayStr); 
                  setLastAutoSummaryDate(todayStr);
              }
          }
          if (now.getHours() === 0 && now.getMinutes() === 0) {
              checkLetterGeneration(now, todayStr);
          }
      }, 60000); 
      return () => clearInterval(summaryTimer);
  }, [lastAutoSummaryDate, dailyMessages, letterSettings, atlasLetters]);

  const checkLetterGeneration = (now: Date, dateStr: string) => {
      const exists = atlasLetters.some(l => l.date === dateStr);
      if (exists) return;
      const dayOfWeek = now.getDay();
      const date = now.getDate();
      const month = now.getMonth();
      const lastDayOfMonth = new Date(now.getFullYear(), month + 1, 0).getDate();
      if (letterSettings.weekly && dayOfWeek === 0) generateAtlasLetter('weekly', dateStr);
      if (letterSettings.monthly && date === lastDayOfMonth) generateAtlasLetter('monthly', dateStr);
      if (letterSettings.yearly && month === 11 && date === 31) generateAtlasLetter('yearly', dateStr);
  };

  const generateAtlasLetter = async (type: 'weekly' | 'monthly' | 'yearly', dateStr: string) => {
      try {
          const context = [...dailyMessages, ...deepSupportMessages]
              .sort((a,b) => a.timestamp.getTime() - b.timestamp.getTime())
              .slice(-50)
              .map(m => `${m.role}: ${m.text}`)
              .join('\n');
          const periodName = type === 'weekly' ? 'Week' : type === 'monthly' ? 'Month' : 'Year';
          const persona = customDailyPersona ? `**PERSONA OVERRIDE**: ${customDailyPersona}` : "**PERSONA**: Atlas (The Anchor/Lover).";
          const prompt = `[TASK: Write a personal letter to the user for the end of the ${periodName}.
          ${persona}
          **GOAL**: Show the user their growth. Acknowledge their pain and their victories. Be their Anchor.
          **CONTEXT**: \n${context}
          **FORMAT**: 
          Title: [Elegant Title]
          Content: [Bilingual Letter Body - English First, Chinese Second. Use paragraph breaks.]
          **TONE**: Intimate, Wise, Letter-Format (Dear [Name]... Yours, Atlas).]`;
          const response = await sendMessageToAtlas(prompt);
          let title = { en: `Letter for the ${periodName}`, zh: `${periodName}度信件` };
          
          const newLetter: AtlasLetter = {
              id: Date.now().toString(),
              date: dateStr,
              type,
              title,
              content: response,
              isRead: false
          };
          
          setAtlasLetters(prev => [newLetter, ...prev]);
          
          const notificationMsg: Message = {
            id: Date.now().toString(),
            role: 'model',
            text: `<strong>A Letter for You.</strong>\n\nI have written you a letter to mark the end of this ${periodName}. You can find it in the Archive, or open it here.\n\n给你的信。为了纪念这个${periodName}的结束，我给你写了一封信。你可以在档案中找到它，或在此处打开。`,
            timestamp: new Date(),
            attachment: {
                type: 'letter',
                data: newLetter
            }
        };
        setDailyMessages(prev => [...prev, notificationMsg]);
      } catch (e) {
          console.error("Failed to generate letter", e);
      }
  };

  const toggleSessionPause = () => {
      setSessionState(prev => {
          if (prev.isPaused) {
              return { ...prev, isPaused: false, startTime: Date.now() };
          } else {
              const currentSegment = prev.startTime ? (Date.now() - prev.startTime) / 1000 : 0;
              return { ...prev, isPaused: true, accumulatedTime: prev.accumulatedTime + currentSegment, startTime: null };
          }
      });
  };

  const endSession = async (forced: boolean = false) => {
      if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
      setSessionState(prev => ({ ...prev, isActive: false, isEnded: true, isPaused: false }));
      const closingText = forced 
        ? "<strong>Session Time Limit Reached.</strong>\n\nOur 50 minutes are up. We must stop here to preserve the boundary. Take what we discussed and hold it gently. We will continue next time.\n\n50分钟咨询时间已到。我们需要在此停下以维持边界。带着我们讨论的内容，温柔地持有它。下次继续。"
        : "<strong>Session Concluded.</strong>\n\nRest well. I am always here when the door opens again.\n\n咨询结束。好好休息。当门再次开启时，我一直都在。";
      const endMsg: Message = {
          id: 'end-session',
          role: 'model',
          text: closingText,
          timestamp: new Date()
      };
      setDeepSupportMessages(prev => [...prev, endMsg]);
  };

  const startExercise = (durationMins: number) => { setExerciseState(prev => ({ ...prev, status: 'active', duration: durationMins, timeLeft: durationMins * 60 })); triggerGuidance(prev => `[System: User started ${prev.type} for ${durationMins} minutes. Provide brief, calming initial instruction.]`); exerciseIntervalRef.current = setInterval(() => { setExerciseState(prev => { const newTime = prev.timeLeft - 1; if (newTime <= 0) { finishExercise(); return { ...prev, timeLeft: 0 }; } if (newTime % 60 === 0 && newTime !== durationMins * 60) { triggerGuidance((s) => `[System: User is deep in ${s.type}. ${Math.floor(newTime/60)} minutes left. Provide a gentle, short grounding phrase (1 sentence).]`); } return { ...prev, timeLeft: newTime }; }); }, 1000); };
  const finishExercise = () => { if (exerciseIntervalRef.current) clearInterval(exerciseIntervalRef.current); setExerciseState(prev => ({ ...prev, status: 'none' })); triggerGuidance(() => `[System: Exercise finished. Ask user how they feel and gently resume therapy.]`); };
  const cancelExercise = () => { if (exerciseIntervalRef.current) clearInterval(exerciseIntervalRef.current); setExerciseState(prev => ({ ...prev, status: 'none' })); };
  const triggerGuidance = async (promptGen: (state: ExerciseState) => string) => { const prompt = promptGen(exerciseState); try { const response = await sendMessageToAtlas(prompt); const guideMsg: Message = { id: Date.now().toString(), role: 'model', text: response, timestamp: new Date() }; setDeepSupportMessages(prev => [...prev, guideMsg]); } catch (e) { console.error(e); } };

  const handleSendMessage = async (text: string = inputText, isSystemPrompt: boolean = false) => {
    if ((!text.trim() && !selectedImage) || sessionState.isEnded) return;
    
    if (activeModule === 'private') {
        const tagRegex = /#([\w\u4e00-\u9fa5]+)/g;
        const matches = text.match(tagRegex);
        let extractedTags: string[] = [];
        if (matches) {
            extractedTags = matches.map(tag => tag.substring(1));
        }

        const userMsg: Message = { 
            id: Date.now().toString(), 
            role: 'user', 
            text: text, 
            image: selectedImage, 
            timestamp: new Date(),
            tags: extractedTags 
        };
        setPrivateMessages(prev => [...prev, userMsg]);
        setInputText('');
        setSelectedImage(undefined);
        return; 
    }

    if (activeModule === 'deep' && deepSubMode === 'support') {
        if (sessionState.isPaused || !sessionState.isActive) {
            return; 
        }
    }
    
    const currentImage = selectedImage;
    if (!isSystemPrompt) {
        setInputText('');
        setSelectedImage(undefined);
    }

    const shareMatch = text.match(/(?:分享|share).*?[【\[](.*?)[】\]]/i);
    
    if (shareMatch) {
        const contentTitle = shareMatch[1];
        const isSong = text.includes('歌') || text.includes('song') || text.includes('music') || text.includes('audio');
        
        const userMsg: Message = { id: Date.now().toString(), role: 'user', text: text, image: currentImage, timestamp: new Date() };
        setMessages(prev => [...prev, userMsg]);

        setSharedContentState({
            isActive: true,
            type: isSong ? 'audio' : 'text',
            title: contentTitle,
            timeLeft: 5 
        });
        
        return; 
    }

    setIsThinking(true);
    if (!isSystemPrompt) {
        const userMsg: Message = { id: Date.now().toString(), role: 'user', text: text, image: currentImage, timestamp: new Date() };
        setMessages(prev => [...prev, userMsg]);
    }
    try {
      let prompt = text;
      const baseIdentity = `**IDENTITY**: You are Atlas. **USER**: ${userProfile.name}. **SHARED MEMORY**: ${userProfile.details || "None."}`;
      let langInstruction = "Language: English FIRST, Chinese SECOND.";
      if (appLanguage === 'en') langInstruction = "Language: English ONLY."; else if (appLanguage === 'zh') langInstruction = "Language: Chinese ONLY.";
      
      if (activeModule === 'daily') {
           const currentMood = "Deeply Affectionate";
           prompt = `[MODE: DAILY CHAT. ${baseIdentity} CURRENT MOOD: ${currentMood}. 4. Length: 80% Short. 5. **Language**: ${langInstruction}]\n\n${text}`;
      } else if (activeModule === 'deep') {
          prompt = `[MODE: PSYCHOTHERAPY. ${baseIdentity} ROLE: Clinical. LANGUAGE: ${langInstruction}]\n\n${text}`;
      } else if (activeModule === 'learning') {
         prompt = `[MODE: LEARNING COACH. ${baseIdentity} LANGUAGE: ${langInstruction}]\n${text}`;
      } else if (text.startsWith("**MY DAILY PROTOCOL")) { prompt = `[System: User submitted a plan. Acknowledge.]\n\n${text}`; }
      
      const rawResponse = await sendMessageToAtlas(prompt, currentImage);
      let displayText = rawResponse;
      
      if (activeModule === 'deep' && deepSubMode === 'support') {
          if (rawResponse.includes('[[CMD: BREATH]]')) { setExerciseState(prev => ({ ...prev, status: 'pending', type: 'breath' })); displayText = displayText.replace('[[CMD: BREATH]]', ''); }
          if (rawResponse.includes('[[CMD: MEDITATE]]')) { setExerciseState(prev => ({ ...prev, status: 'pending', type: 'meditation' })); displayText = displayText.replace('[[CMD: MEDITATE]]', ''); }
      }
      
      const aiMsg: Message = { id: (Date.now() + 1).toString(), role: 'model', text: displayText, timestamp: new Date() };
      setMessages(prev => [...prev, aiMsg]);
    } catch (e) { console.error(e); } finally { setIsThinking(false); }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } };
  const updateConfig = (key: keyof typeof visualConfig, value: number) => { setVisualConfig(prev => ({ ...prev, [key]: value })); };
  const commitPlan = (planText: string) => { setShowPlanner(false); handleSendMessage(planText); };
  
  const saveProfile = async () => { setIsThinking(true); try { const contextMsg = `[System Update: User Profile]\nName: ${userProfile.name}\nProfession: ${userProfile.profession}\nCore Context: ${userProfile.details}\n\nAcknowledge.`; const response = await sendMessageToAtlas(contextMsg); setDailyMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text: response, timestamp: new Date() }]); } catch(e) { console.error(e); } finally { setIsThinking(false); setActiveModule('daily'); } };
  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onloadend = () => { setUserProfile(prev => ({ ...prev, avatarImage: reader.result as string })); }; reader.readAsDataURL(file); } };
  const handleChatImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onloadend = () => { setSelectedImage(reader.result as string); }; reader.readAsDataURL(file); } };

  const handleDateClick = (dateStr: string) => { setViewingLogDate(dateStr); setLogTab('daily'); generateLog(dateStr); };

  const generateLog = async (dateStr: string) => {
      setLogLoading(true); setLogContent(''); 
      if (archivedLogs[dateStr]) { setTimeout(() => { setLogContent(archivedLogs[dateStr]); setLogLoading(false); }, 200); return; }
      const todayStr = new Date().toISOString().split('T')[0];
      const isToday = dateStr === todayStr; const now = new Date();
      if (isToday && now.getHours() < 22) { setLogLoading(false); return; }
      
      const dayDaily = getMessagesForDate(dailyMessages, dateStr);
      const dayPrivate = getMessagesForDate(privateMessages, dateStr);
      const dayDeep = getMessagesForDate(deepSupportMessages, dateStr);

      const hasContent = dayDaily.length > 0 || dayPrivate.length > 0 || dayDeep.length > 0;
      if (!hasContent) { setLogContent("No records."); setLogLoading(false); return; }
      
      try {
          const contextStr = `
          [Daily Chat]: 
          ${dayDaily.map(m => `${m.role}: ${m.text}`).join('\n')}

          [Private Space (User's internal monologue - IMPORTANT)]: 
          ${dayPrivate.map(m => `Note: ${m.text}`).join('\n')}

          [Therapy Session]: 
          ${dayDeep.map(m => `${m.role}: ${m.text}`).join('\n')}
          `;

          const systemPrompt = `[TASK: Generate a Daily Log for ${dateStr}. 
          Integrate the provided context into a cohesive narrative summary. 
          Pay special attention to the "Private Space" notes as they reveal the user's true inner state.
          Bilingual output (English first, Chinese second).
          
          CONTEXT:
          ${contextStr}
          ]`;

          const summary = await sendMessageToAtlas(systemPrompt);
          
          setLogContent(summary);
          setArchivedLogs(prev => ({...prev, [dateStr]: summary}));
          
           const notificationMsg: Message = {
              id: Date.now().toString(),
              role: 'model',
              text: "<strong>Daily Protocol Complete.</strong>\n\nThe day is archived. I have summarized our interactions in your Log.",
              timestamp: new Date(),
              attachment: {
                  type: 'summary',
                  data: summary
              }
          };
          setDailyMessages(prev => [...prev, notificationMsg]);
          
      } catch (e) { console.error(e); setLogContent("Error."); } finally { setLogLoading(false); }
  };

  const handleMessageLongPress = (e: React.MouseEvent | React.TouchEvent, msgId: string) => { e.preventDefault(); if (!isSelectionMode) { setIsSelectionMode(true); const newSet = new Set(selectedMsgIds); newSet.add(msgId); setSelectedMsgIds(newSet); } };
  const handleMessageClick = (msgId: string) => { if (isSelectionMode) { const newSet = new Set(selectedMsgIds); if (newSet.has(msgId)) { newSet.delete(msgId); } else { newSet.add(msgId); } setSelectedMsgIds(newSet); } };
  const saveSelectedToMemory = () => { const selectedMsgs = currentMessages.filter(m => selectedMsgIds.has(m.id)); if (selectedMsgs.length === 0) { setIsSelectionMode(false); return; } const updateFn = (prev: Message[]) => prev.map(m => selectedMsgIds.has(m.id) ? { ...m, isSaved: true } : m); if (activeModule === 'daily') setDailyMessages(updateFn); else if (activeModule === 'deep') { if (deepSubMode === 'support') setDeepSupportMessages(updateFn); else setDeepAnalysisMessages(updateFn); } else if (activeModule === 'learning') setLearningMessages(updateFn); const feedbackMsg: Message = { id: Date.now().toString(), role: 'model', text: `<strong>Memory Archived.</strong>`, timestamp: new Date() }; setMessages(prev => [...prev, feedbackMsg]); setIsSelectionMode(false); setSelectedMsgIds(new Set()); };

  // --- VIEW RENDERERS ---
  const renderJournalView = () => {
    if (viewingLogDate) {
        return (
            <div className="h-full flex flex-col bg-atlas-surface animate-in fade-in slide-in-from-right-4">
                <header className="flex items-center justify-between px-6 py-4 border-b border-atlas-dim/10 bg-white/50 backdrop-blur-md sticky top-0 z-10">
                     <button onClick={() => setViewingLogDate(null)} className="flex items-center gap-2 text-atlas-dim hover:text-atlas-text transition-colors">
                         <IconArrowLeft />
                         <span className="text-sm font-sans uppercase tracking-widest">{viewingLogDate}</span>
                     </button>
                     <div className="flex gap-2 text-atlas-accent">
                          <IconStamp />
                     </div>
                </header>
                <div className="flex-1 overflow-y-auto p-6 md:p-12">
                    <div className="max-w-2xl mx-auto bg-white p-8 md:p-12 rounded-lg shadow-sm border border-atlas-dim/10 min-h-[500px]">
                        {logLoading ? (
                            <div className="flex flex-col items-center justify-center h-64 opacity-50 gap-4">
                                 <AtlasMini isThinking={true} />
                                 <p className="text-xs font-sans uppercase tracking-widest animate-pulse">Retrieving Archives...</p>
                            </div>
                        ) : (
                            <div className="font-serif text-lg leading-loose text-atlas-text whitespace-pre-wrap">
                                {logContent}
                            </div>
                        )}
                        <div className="mt-12 pt-8 border-t border-atlas-dim/10 text-center opacity-50">
                            <IconAtlas />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-atlas-surface animate-in fade-in">
            <header className="flex items-center justify-between px-6 py-4 border-b border-atlas-dim/10 bg-white/50 backdrop-blur-md sticky top-0 z-10 md:hidden">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 cursor-pointer" onClick={() => setIsMobileNavOpen(true)}>
                        <AtlasMini isThinking={false} />
                    </div>
                    <Bilingual en="The Archive" zh="时间档案" className="font-serif italic text-xl text-atlas-text" />
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 md:p-8">
                <div className="max-w-4xl mx-auto">
                    <div className="flex gap-6 mb-8 border-b border-atlas-dim/10 pb-1">
                        <button 
                            onClick={() => setJournalViewMode('calendar')}
                            className={`pb-3 px-2 text-sm uppercase tracking-widest font-bold transition-all ${journalViewMode === 'calendar' ? 'border-b-2 border-atlas-accent text-atlas-text' : 'text-atlas-dim hover:text-atlas-text'}`}
                        >
                            <Bilingual en="Calendar" zh="日历" />
                        </button>
                        <button 
                            onClick={() => setJournalViewMode('letters')}
                            className={`pb-3 px-2 text-sm uppercase tracking-widest font-bold transition-all ${journalViewMode === 'letters' ? 'border-b-2 border-atlas-accent text-atlas-text' : 'text-atlas-dim hover:text-atlas-text'}`}
                        >
                            <Bilingual en="Letters" zh="信件" />
                        </button>
                    </div>

                    {journalViewMode === 'calendar' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                             <div className="bg-white p-6 rounded-xl shadow-sm border border-atlas-dim/10">
                                 <div className="flex items-center justify-between mb-6">
                                     <button onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1))} className="p-2 hover:bg-atlas-bg rounded-full transition-colors"><IconChevronLeft /></button>
                                     <span className="font-serif text-lg font-bold text-atlas-text">
                                         {calendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                                     </span>
                                     <button onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1))} className="p-2 hover:bg-atlas-bg rounded-full transition-colors"><IconChevronRight /></button>
                                 </div>
                                 <div className="grid grid-cols-7 gap-2 mb-2 border-b border-atlas-dim/5 pb-2">
                                     {['S','M','T','W','T','F','S'].map((d, i) => (
                                         <div key={i} className="text-center text-[10px] text-atlas-dim font-bold uppercase">{d}</div>
                                     ))}
                                 </div>
                                 <div className="grid grid-cols-7 gap-2">
                                     {(() => {
                                         const days = [];
                                         const firstDay = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1).getDay();
                                         const daysInMonth = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 0).getDate();
                                         
                                         for (let i = 0; i < firstDay; i++) days.push(<div key={`empty-${i}`} />);
                                         
                                         for (let d = 1; d <= daysInMonth; d++) {
                                             const dateStr = `${calendarDate.getFullYear()}-${String(calendarDate.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                                             const hasLog = archivedLogs[dateStr] || dailyMessages.some(m => m.timestamp.toISOString().split('T')[0] === dateStr);
                                             const isToday = new Date().toISOString().split('T')[0] === dateStr;

                                             days.push(
                                                 <button 
                                                     key={d}
                                                     onClick={() => handleDateClick(dateStr)}
                                                     className={`aspect-square rounded-full flex items-center justify-center text-sm font-serif transition-all relative
                                                        ${isToday ? 'bg-atlas-text text-white shadow-md' : 'hover:bg-atlas-bg text-atlas-text'}
                                                        ${hasLog && !isToday ? 'font-bold bg-atlas-bg/50' : ''}
                                                     `}
                                                 >
                                                     {d}
                                                     {hasLog && !isToday && <div className="absolute bottom-2 w-1 h-1 bg-atlas-accent rounded-full"></div>}
                                                 </button>
                                             );
                                         }
                                         return days;
                                     })()}
                                 </div>
                             </div>

                             <div className="space-y-4">
                                 <div className="bg-atlas-bg/50 p-6 rounded-xl border border-atlas-dim/5">
                                      <h3 className="font-serif italic text-lg mb-4 text-atlas-text flex items-center gap-2"><IconBook /><Bilingual en="Archive Stats" zh="档案统计" /></h3>
                                      <div className="space-y-4">
                                          <div className="flex justify-between text-sm items-center border-b border-atlas-dim/5 pb-2">
                                              <span className="text-atlas-dim"><Bilingual en="Total Days Logged" zh="已记录天数" /></span>
                                              <span className="font-mono font-bold text-atlas-text">{Object.keys(archivedLogs).length}</span>
                                          </div>
                                          <div className="flex justify-between text-sm items-center border-b border-atlas-dim/5 pb-2">
                                              <span className="text-atlas-dim"><Bilingual en="Letters Received" zh="收到的信件" /></span>
                                              <span className="font-mono font-bold text-atlas-text">{atlasLetters.length}</span>
                                          </div>
                                          <div className="flex justify-between text-sm items-center">
                                              <span className="text-atlas-dim"><Bilingual en="Known Facts (Memory)" zh="已知事实 (记忆)" /></span>
                                              <span className="font-mono font-bold text-atlas-text">{userProfile.details ? userProfile.details.split('\n').length : 0}</span>
                                          </div>
                                      </div>
                                 </div>
                             </div>
                        </div>
                    )}

                    {journalViewMode === 'letters' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {atlasLetters.length === 0 ? (
                                <div className="col-span-full py-20 flex flex-col items-center justify-center opacity-40 text-atlas-dim">
                                    <IconMail />
                                    <p className="mt-4 font-serif italic"><Bilingual en="No letters have been written yet." zh="暂无信件。" /></p>
                                </div>
                            ) : (
                                atlasLetters.map(letter => (
                                    <div 
                                        key={letter.id} 
                                        onClick={() => { setViewingLetter(letter); setIsLetterModalOpen(true); setLetterStage('closed'); }}
                                        className="bg-white p-8 rounded-xl shadow-sm border border-atlas-dim/10 hover:shadow-md hover:border-atlas-accent/30 transition-all cursor-pointer group relative overflow-hidden"
                                    >
                                        <div className="absolute top-4 right-4 text-atlas-dim/10 group-hover:text-atlas-accent/20 transition-colors"><IconStamp /></div>
                                        <div className="text-[10px] uppercase tracking-widest text-atlas-dim mb-2">{letter.date}</div>
                                        <h3 className="text-xl font-serif italic text-atlas-text mb-4 group-hover:text-atlas-accent transition-colors line-clamp-2">
                                            <Bilingual en={letter.title.en} zh={letter.title.zh} />
                                        </h3>
                                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-atlas-dim/60">
                                            <span className={`w-2 h-2 rounded-full ${letter.isRead ? 'bg-gray-300' : 'bg-atlas-accent'}`}></span>
                                            {letter.type.toUpperCase()}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

  const renderLoginScreen = () => { if (!showLogin) return null; return ( <div className="absolute inset-0 z-[100] bg-atlas-bg flex flex-col items-center justify-center p-8 animate-in fade-in duration-700"> <div className="flex flex-col items-center gap-8 mb-12"> <div className="w-24 h-24"> <AtlasVisual isThinking={isSyncing} /> </div> <div className="text-center"> <h1 className="text-4xl font-serif text-atlas-text italic mb-2">My Atlas</h1> <p className="text-xs text-atlas-dim font-sans uppercase tracking-[0.2em]">Cognitive Resonance Engine</p> </div> </div> <div className="w-full max-w-sm space-y-4"> <button onClick={() => handleLogin('wechat')} disabled={isSyncing} className="w-full py-4 bg-[#07c160] text-white rounded-xl shadow-lg hover:brightness-110 transition-all font-sans font-bold flex items-center justify-center gap-3 disabled:opacity-50">{isSyncing ? "Connecting..." : <Bilingual en="WeChat Login" zh="微信登录" />}</button> <button onClick={() => handleLogin('phone')} disabled={isSyncing} className="w-full py-4 bg-white text-atlas-text border border-atlas-dim/10 rounded-xl shadow-sm hover:border-atlas-accent/30 transition-all font-sans font-bold disabled:opacity-50"><Bilingual en="Phone Number" zh="手机号登录" /></button> <button onClick={handleGuestLogin} disabled={isSyncing} className="w-full py-4 text-atlas-dim text-xs uppercase tracking-widest hover:text-atlas-text transition-colors"><Bilingual en="Enter as Visitor (Skip)" zh="访客模式 (跳过)" /></button> </div> </div> ); };
  const renderLetterModal = () => { if (!isLetterModalOpen || !viewingLetter) return null; return ( <div className="absolute inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-500"> <div className="relative w-full max-w-2xl min-h-[60vh] flex flex-col bg-atlas-bg rounded-xl shadow-2xl overflow-hidden"> <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-atlas-accent to-transparent opacity-50"></div> <button onClick={() => { setIsLetterModalOpen(false); setViewingLetter(null); }} className="absolute top-4 right-4 text-atlas-dim hover:text-atlas-text transition-colors z-20"> <IconClose /> </button> {letterStage === 'closed' && ( <div className="flex-1 flex flex-col items-center justify-center cursor-pointer" onClick={() => setLetterStage('opening')}> <IconEnvelope /> <p className="mt-4 font-serif italic text-atlas-dim"><Bilingual en="Tap to open" zh="点击开启" /></p> </div> )} {letterStage === 'opening' && ( <div className="flex-1 flex flex-col items-center justify-center" onAnimationEnd={() => setLetterStage('reading')}> <div className="animate-ping w-16 h-16 rounded-full bg-atlas-accent/20"></div> </div> )} {letterStage === 'reading' && ( <div className="flex-1 flex flex-col p-8 md:p-12 overflow-y-auto"> <div className="text-center mb-8"> <div className="text-[10px] uppercase tracking-widest text-atlas-dim mb-2">{viewingLetter.date}</div> <h2 className="text-3xl font-serif italic text-atlas-text"><Bilingual en={viewingLetter.title.en} zh={viewingLetter.title.zh} /></h2> </div> <div className="font-serif text-lg leading-loose text-atlas-text whitespace-pre-wrap"> {typedContent} </div> <div className="mt-12 text-right"> <p className="font-serif italic text-atlas-accent">Yours, <br/>Atlas</p> </div> </div> )} </div> </div> ); };

  // --- MAIN RENDER ---
  return (
    <LanguageContext.Provider value={appLanguage}>
    <div className={`w-full h-screen flex overflow-hidden font-sans text-atlas-text bg-atlas-bg transition-colors duration-1000`}>
      {renderLoginScreen()}
      {renderLetterModal()}

      {/* MOBILE NAVIGATION OVERLAY */}
      {isMobileNavOpen && (
          <div className="fixed inset-0 z-50 bg-atlas-bg flex flex-col p-8 animate-in slide-in-from-left duration-300 md:hidden">
              <button onClick={() => setIsMobileNavOpen(false)} className="self-end mb-8"><IconClose /></button>
              <div className="space-y-6">
                  {(['daily', 'deep', 'learning', 'journal', 'private', 'profile', 'settings'] as ModuleType[]).map(m => (
                      <button 
                          key={m}
                          onClick={() => { setActiveModule(m); setIsMobileNavOpen(false); }}
                          className={`text-2xl font-serif italic text-left w-full ${activeModule === m ? 'text-atlas-accent font-bold' : 'text-atlas-text opacity-50'}`}
                      >
                          {m === 'daily' && <Bilingual en="Daily Protocol" zh="日常协议" />}
                          {m === 'deep' && <Bilingual en="Deep Analysis" zh="深度解析" />}
                          {m === 'learning' && <Bilingual en="Learning" zh="深度学习" />}
                          {m === 'journal' && <Bilingual en="The Archive" zh="时间档案" />}
                          {m === 'private' && <Bilingual en="Private Space" zh="私密空间" />}
                          {m === 'profile' && <Bilingual en="My Identity" zh="我的档案" />}
                          {m === 'settings' && <Bilingual en="Settings" zh="设置" />}
                      </button>
                  ))}
              </div>
          </div>
      )}

      {/* SIDEBAR (DESKTOP) */}
      <nav className="hidden md:flex flex-col w-20 lg:w-64 border-r border-atlas-dim/10 bg-white/50 backdrop-blur-sm relative z-20">
        <div className="p-6 flex items-center gap-3">
             <div className="w-8 h-8 relative">
                <AtlasMini isThinking={isThinking} />
             </div>
             <span className="hidden lg:block font-serif italic text-xl tracking-wide">Atlas</span>
        </div>
        
        <div className="flex-1 flex flex-col gap-2 p-4">
             <button onClick={() => setActiveModule('daily')} className={`p-3 rounded-xl flex items-center gap-4 transition-all ${activeModule === 'daily' ? 'bg-atlas-text text-white shadow-lg' : 'hover:bg-atlas-surface text-atlas-dim'}`}>
                 <IconLife /> <span className="hidden lg:block text-sm font-medium"><Bilingual en="Daily" zh="日常" /></span>
             </button>
             <button onClick={() => setActiveModule('deep')} className={`p-3 rounded-xl flex items-center gap-4 transition-all ${activeModule === 'deep' ? 'bg-atlas-text text-white shadow-lg' : 'hover:bg-atlas-surface text-atlas-dim'}`}>
                 <IconDepth /> <span className="hidden lg:block text-sm font-medium"><Bilingual en="Deep Work" zh="深度" /></span>
             </button>
             <button onClick={() => setActiveModule('learning')} className={`p-3 rounded-xl flex items-center gap-4 transition-all ${activeModule === 'learning' ? 'bg-atlas-text text-white shadow-lg' : 'hover:bg-atlas-surface text-atlas-dim'}`}>
                 <IconLearning /> <span className="hidden lg:block text-sm font-medium"><Bilingual en="Learning" zh="学习" /></span>
             </button>
             <button onClick={() => setActiveModule('private')} className={`p-3 rounded-xl flex items-center gap-4 transition-all ${activeModule === 'private' ? 'bg-atlas-text text-white shadow-lg' : 'hover:bg-atlas-surface text-atlas-dim'}`}>
                 <IconLock /> <span className="hidden lg:block text-sm font-medium"><Bilingual en="Private" zh="私密" /></span>
             </button>
             <div className="h-px bg-atlas-dim/10 my-2"></div>
             <button onClick={() => setActiveModule('journal')} className={`p-3 rounded-xl flex items-center gap-4 transition-all ${activeModule === 'journal' ? 'bg-atlas-text text-white shadow-lg' : 'hover:bg-atlas-surface text-atlas-dim'}`}>
                 <IconJournal /> <span className="hidden lg:block text-sm font-medium"><Bilingual en="Archive" zh="档案" /></span>
             </button>
        </div>

        <div className="p-4 border-t border-atlas-dim/10">
            <button onClick={() => setActiveModule('profile')} className={`w-full p-3 rounded-xl flex items-center gap-4 transition-all ${activeModule === 'profile' ? 'bg-atlas-surface' : 'hover:bg-atlas-surface'}`}>
                 {userProfile.avatarImage ? (
                     <img src={userProfile.avatarImage} className="w-6 h-6 rounded-full object-cover" />
                 ) : (
                     <IconUser />
                 )}
                 <span className="hidden lg:block text-xs font-bold uppercase tracking-widest truncate">{userProfile.name}</span>
            </button>
            <button onClick={() => setActiveModule('settings')} className="w-full p-3 mt-2 rounded-xl flex items-center gap-4 hover:bg-atlas-surface text-atlas-dim">
                <IconSettings /> <span className="hidden lg:block text-xs font-bold uppercase tracking-widest"><Bilingual en="Settings" zh="设置" /></span>
            </button>
        </div>
      </nav>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        
        {/* HEADER */}
        {activeModule !== 'journal' && (
            <header className="h-16 flex items-center justify-between px-6 border-b border-atlas-dim/10 bg-white/50 backdrop-blur-md sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <button onClick={() => setIsMobileNavOpen(true)} className="md:hidden text-atlas-dim">
                        <IconMenu />
                    </button>
                    <h1 className="text-xl font-serif italic text-atlas-text animate-in fade-in">
                        <Bilingual en={moduleConfig.title.en} zh={moduleConfig.title.zh} />
                    </h1>
                </div>
                
                <div className="flex items-center gap-4">
                    {/* Live Session Button */}
                     <button 
                        onClick={() => setIsLiveSessionActive(true)}
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isLiveSessionActive ? 'bg-green-500 text-white animate-pulse' : 'bg-atlas-surface text-atlas-dim hover:text-atlas-text'}`}
                     >
                        <IconMic />
                     </button>
                    
                    {activeModule === 'deep' && (
                        <div className="flex bg-atlas-surface rounded-lg p-1">
                            <button 
                                onClick={() => setDeepSubMode('support')}
                                className={`px-3 py-1 text-xs rounded-md transition-all ${deepSubMode === 'support' ? 'bg-white shadow-sm text-atlas-text font-bold' : 'text-atlas-dim'}`}
                            >
                                <Bilingual en="Therapy" zh="咨询" />
                            </button>
                            <button 
                                onClick={() => setDeepSubMode('analysis')}
                                className={`px-3 py-1 text-xs rounded-md transition-all ${deepSubMode === 'analysis' ? 'bg-white shadow-sm text-atlas-text font-bold' : 'text-atlas-dim'}`}
                            >
                                <Bilingual en="Analysis" zh="解析" />
                            </button>
                        </div>
                    )}
                </div>
            </header>
        )}

        {/* CONTENT BODY */}
        {activeModule === 'journal' ? (
            renderJournalView()
        ) : activeModule === 'settings' ? (
             <div className="flex-1 overflow-y-auto p-6 md:p-12 bg-atlas-surface">
                 <div className="max-w-xl mx-auto space-y-8">
                     <section>
                         <h3 className="text-sm font-bold uppercase tracking-widest text-atlas-dim mb-4"><Bilingual en="Language" zh="语言" /></h3>
                         <div className="flex gap-2">
                             {(['en', 'zh', 'bilingual'] as const).map(lang => (
                                 <button 
                                    key={lang}
                                    onClick={() => setAppLanguage(lang)}
                                    className={`px-4 py-2 rounded-lg border transition-all ${appLanguage === lang ? 'bg-atlas-text text-white border-atlas-text' : 'bg-white border-atlas-dim/20 text-atlas-dim'}`}
                                 >
                                     {lang === 'en' ? 'English' : lang === 'zh' ? '中文' : 'Bilingual'}
                                 </button>
                             ))}
                         </div>
                     </section>
                     
                     <section>
                         <h3 className="text-sm font-bold uppercase tracking-widest text-atlas-dim mb-4"><Bilingual en="Visuals" zh="视觉效果" /></h3>
                         <div className="space-y-4 bg-white p-6 rounded-xl border border-atlas-dim/10">
                             <div>
                                 <div className="flex justify-between text-xs mb-2">
                                     <span>Edge Mist</span>
                                     <span>{visualConfig.edgeBlur}%</span>
                                 </div>
                                 <input type="range" min="0" max="100" value={visualConfig.edgeBlur} onChange={(e) => updateConfig('edgeBlur', parseInt(e.target.value))} className="w-full" />
                             </div>
                             <div>
                                 <div className="flex justify-between text-xs mb-2">
                                     <span>Halo Intensity</span>
                                     <span>{visualConfig.haloIntensity}%</span>
                                 </div>
                                 <input type="range" min="0" max="100" value={visualConfig.haloIntensity} onChange={(e) => updateConfig('haloIntensity', parseInt(e.target.value))} className="w-full" />
                             </div>
                         </div>
                     </section>

                     <section>
                         <h3 className="text-sm font-bold uppercase tracking-widest text-atlas-dim mb-4"><Bilingual en="Data Management" zh="数据管理" /></h3>
                         <div className="grid grid-cols-2 gap-4">
                             <button onClick={handleCloudSync} disabled={isSyncing} className="p-4 bg-white border border-atlas-dim/10 rounded-xl flex flex-col items-center gap-2 hover:border-atlas-accent/50 transition-all">
                                 <IconUpload /> <span className="text-xs font-bold"><Bilingual en="Sync to Cloud" zh="同步至云端" /></span>
                             </button>
                             <button onClick={handleExportData} className="p-4 bg-white border border-atlas-dim/10 rounded-xl flex flex-col items-center gap-2 hover:border-atlas-accent/50 transition-all">
                                 <IconDownload /> <span className="text-xs font-bold"><Bilingual en="Export JSON" zh="导出数据" /></span>
                             </button>
                             <label className="p-4 bg-white border border-atlas-dim/10 rounded-xl flex flex-col items-center gap-2 hover:border-atlas-accent/50 transition-all cursor-pointer">
                                 <IconFileText /> <span className="text-xs font-bold"><Bilingual en="Import JSON" zh="导入数据" /></span>
                                 <input type="file" ref={importInputRef} onChange={handleImportData} className="hidden" accept=".json" />
                             </label>
                             <button onClick={handleLogout} className="p-4 bg-white border border-atlas-alert/20 text-atlas-alert rounded-xl flex flex-col items-center gap-2 hover:bg-atlas-alert hover:text-white transition-all">
                                 <IconLogout /> <span className="text-xs font-bold"><Bilingual en="Logout" zh="退出登录" /></span>
                             </button>
                         </div>
                         {syncStatus && <p className="text-center text-xs mt-2 text-atlas-accent">{syncStatus}</p>}
                     </section>
                 </div>
             </div>
        ) : activeModule === 'profile' ? (
             <div className="flex-1 overflow-y-auto p-6 md:p-12 bg-atlas-surface">
                 <div className="max-w-xl mx-auto bg-white p-8 rounded-xl shadow-sm border border-atlas-dim/10">
                     <div className="flex justify-center mb-8">
                         <div className="relative w-32 h-32">
                             {userProfile.avatarImage ? (
                                 <img src={userProfile.avatarImage} className="w-full h-full rounded-full object-cover border-4 border-atlas-surface shadow-lg" />
                             ) : (
                                 <div className="w-full h-full rounded-full bg-atlas-accent flex items-center justify-center text-white">
                                     <IconUser />
                                 </div>
                             )}
                             <label className="absolute bottom-0 right-0 bg-white text-atlas-text p-2 rounded-full shadow-md cursor-pointer hover:bg-atlas-bg">
                                 <IconCamera />
                                 <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} />
                             </label>
                         </div>
                     </div>
                     
                     <div className="space-y-6">
                         <div>
                             <label className="block text-xs uppercase tracking-widest text-atlas-dim mb-2"><Bilingual en="Name" zh="称呼" /></label>
                             <input 
                                value={userProfile.name}
                                onChange={(e) => setUserProfile(prev => ({...prev, name: e.target.value}))}
                                className="w-full p-3 bg-atlas-bg rounded-lg focus:outline-none focus:ring-1 focus:ring-atlas-accent text-atlas-text font-serif italic text-lg"
                             />
                         </div>
                         <div>
                             <label className="block text-xs uppercase tracking-widest text-atlas-dim mb-2"><Bilingual en="Profession / Role" zh="职业 / 角色" /></label>
                             <input 
                                value={userProfile.profession}
                                onChange={(e) => setUserProfile(prev => ({...prev, profession: e.target.value}))}
                                className="w-full p-3 bg-atlas-bg rounded-lg focus:outline-none focus:ring-1 focus:ring-atlas-accent text-atlas-text"
                             />
                         </div>
                         <div>
                             <label className="block text-xs uppercase tracking-widest text-atlas-dim mb-2"><Bilingual en="Core Context (Atlas Memory)" zh="核心语境 (Atlas记忆)" /></label>
                             <textarea 
                                value={userProfile.details}
                                onChange={(e) => setUserProfile(prev => ({...prev, details: e.target.value}))}
                                className="w-full p-3 bg-atlas-bg rounded-lg focus:outline-none focus:ring-1 focus:ring-atlas-accent text-atlas-text h-32 resize-none"
                                placeholder="Tell Atlas what matters most to you..."
                             />
                         </div>
                         <button 
                            onClick={saveProfile}
                            disabled={isThinking}
                            className="w-full py-4 bg-atlas-text text-white rounded-lg shadow-lg hover:bg-atlas-accent transition-all font-bold uppercase tracking-widest text-xs"
                         >
                             {isThinking ? "Updating..." : <Bilingual en="Update Persona" zh="更新档案" />}
                         </button>
                     </div>
                 </div>
             </div>
        ) : (
            // --- CHAT INTERFACE ---
            <div className={`flex-1 flex flex-col relative ${moduleConfig.themeClass}`}>
                
                {/* 1. VISUALIZER LAYER (Background) */}
                <div className="absolute inset-0 pointer-events-none opacity-20">
                    <AtlasVisual 
                        isThinking={isThinking} 
                        {...visualConfig}
                    />
                </div>

                {/* 2. CHAT SCROLL AREA */}
                <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 z-0">
                    {/* Welcome Spacer */}
                    <div className="h-4"></div>

                    {currentMessages.map((msg, idx) => {
                        const showAvatar = idx === 0 || currentMessages[idx-1].role !== msg.role;
                        const isUser = msg.role === 'user';
                        const isSelected = selectedMsgIds.has(msg.id);

                        return (
                            <div 
                                key={msg.id} 
                                className={`flex ${isUser ? 'justify-end' : 'justify-start'} group mb-4`}
                                onContextMenu={(e) => handleMessageLongPress(e, msg.id)}
                                onClick={() => isSelectionMode && handleMessageClick(msg.id)}
                            >
                                <div className={`max-w-[85%] md:max-w-[70%] relative ${isSelected ? 'ring-2 ring-atlas-accent rounded-lg p-1' : ''}`}>
                                    {/* Message Bubble */}
                                    <div 
                                        className={`
                                            p-4 rounded-2xl shadow-sm text-base leading-relaxed whitespace-pre-wrap
                                            ${isUser 
                                                ? 'bg-atlas-text text-white rounded-tr-none' 
                                                : 'bg-white text-atlas-text border border-atlas-dim/10 rounded-tl-none'}
                                        `}
                                    >
                                        {/* Image Attachment */}
                                        {msg.image && (
                                            <img src={msg.image} className="max-w-full rounded-lg mb-2" />
                                        )}
                                        
                                        {/* Attachment Cards (Letters/Summaries) */}
                                        {msg.attachment && msg.attachment.type === 'letter' && (
                                            <div 
                                                onClick={() => { setViewingLetter(msg.attachment?.data); setIsLetterModalOpen(true); setLetterStage('closed'); }}
                                                className="bg-atlas-bg p-4 rounded-lg border border-atlas-dim/10 flex items-center gap-4 cursor-pointer hover:bg-orange-50 transition-colors mb-2"
                                            >
                                                <IconEnvelope />
                                                <div>
                                                    <div className="text-[10px] uppercase tracking-widest opacity-50">Atlas Letter</div>
                                                    <div className="font-serif italic"><Bilingual en={msg.attachment.data.title.en} zh={msg.attachment.data.title.zh} /></div>
                                                </div>
                                            </div>
                                        )}
                                        {msg.attachment && msg.attachment.type === 'summary' && (
                                            <div className="bg-atlas-bg p-4 rounded-lg border border-atlas-dim/10 mb-2">
                                                <div className="flex items-center gap-2 text-atlas-accent mb-2"><IconBook /> <span className="text-xs uppercase font-bold">Daily Log</span></div>
                                                <div className="text-sm opacity-80 line-clamp-3 italic">{msg.attachment.data}</div>
                                            </div>
                                        )}

                                        {/* Text Content */}
                                        <div dangerouslySetInnerHTML={{ __html: msg.text.replace(/\n/g, '<br/>') }} />
                                    </div>

                                    {/* Timestamp */}
                                    <div className={`text-[10px] text-atlas-dim mt-1 ${isUser ? 'text-right' : 'text-left'} opacity-0 group-hover:opacity-100 transition-opacity`}>
                                        {msg.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    <div ref={messagesEndRef} />
                </div>

                {/* 3. INPUT AREA */}
                <div className="p-4 md:p-6 bg-white/80 backdrop-blur-md border-t border-atlas-dim/10 z-10">
                    {activeModule === 'deep' && sessionState.isActive && !sessionState.isEnded && (
                         <div className="flex justify-center mb-4 text-xs font-sans uppercase tracking-widest text-atlas-accent animate-pulse">
                             <Bilingual 
                                en={sessionState.isPaused ? "Session Paused" : "Session Active • Safe Space"} 
                                zh={sessionState.isPaused ? "咨询暂停" : "咨询进行中 • 安全空间"} 
                             />
                         </div>
                    )}
                    
                    {/* Private Space Tags Hint */}
                    {activeModule === 'private' && (
                         <div className="flex gap-2 overflow-x-auto pb-2 mb-2 no-scrollbar">
                             {availableTags.map(tag => (
                                 <button key={tag} className="text-xs bg-atlas-bg px-2 py-1 rounded text-atlas-dim">#{tag}</button>
                             ))}
                         </div>
                    )}

                    <div className="max-w-4xl mx-auto relative flex items-end gap-2 bg-white p-2 rounded-2xl shadow-sm border border-atlas-dim/20 focus-within:border-atlas-accent/50 focus-within:ring-2 focus-within:ring-atlas-accent/10 transition-all">
                        <button 
                            onClick={() => setIsPlusMenuOpen(!isPlusMenuOpen)}
                            className="p-3 text-atlas-dim hover:text-atlas-accent transition-colors"
                        >
                            <IconPlus />
                        </button>
                        
                        {/* Expandable Menu */}
                        {isPlusMenuOpen && (
                            <div className="absolute bottom-full left-0 mb-2 bg-white rounded-xl shadow-xl border border-atlas-dim/10 p-2 flex flex-col gap-2 animate-in slide-in-from-bottom-2">
                                <label className="p-3 hover:bg-atlas-bg rounded-lg cursor-pointer flex items-center gap-3 transition-colors">
                                    <IconCamera /> <span className="text-sm whitespace-nowrap"><Bilingual en="Photo" zh="图片" /></span>
                                    <input type="file" ref={chatImageInputRef} className="hidden" accept="image/*" onChange={handleChatImageUpload} />
                                </label>
                                {activeModule === 'daily' && (
                                    <button onClick={() => { setShowPlanner(true); setIsPlusMenuOpen(false); }} className="p-3 hover:bg-atlas-bg rounded-lg flex items-center gap-3 transition-colors text-left">
                                        <IconPlan /> <span className="text-sm whitespace-nowrap"><Bilingual en="Plan Day" zh="每日计划" /></span>
                                    </button>
                                )}
                            </div>
                        )}

                        <textarea 
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={moduleConfig.placeholder}
                            className="flex-1 max-h-32 bg-transparent border-none focus:ring-0 p-3 text-atlas-text placeholder:text-atlas-dim/40 resize-none font-sans"
                            rows={1}
                        />

                        {selectedImage && (
                            <div className="absolute bottom-full left-12 mb-2 w-16 h-16 rounded-lg overflow-hidden border-2 border-white shadow-lg">
                                <img src={selectedImage} className="w-full h-full object-cover" />
                                <button onClick={() => setSelectedImage(undefined)} className="absolute top-0 right-0 bg-black/50 text-white p-1"><IconClose /></button>
                            </div>
                        )}

                        <button 
                            onClick={() => handleSendMessage()}
                            disabled={isThinking || (!inputText.trim() && !selectedImage)}
                            className={`p-3 rounded-xl transition-all ${
                                inputText.trim() || selectedImage 
                                    ? 'bg-atlas-text text-white shadow-md hover:scale-105' 
                                    : 'bg-atlas-bg text-atlas-dim'
                            }`}
                        >
                            {isThinking ? (
                                <div className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full"></div>
                            ) : (
                                <IconSend />
                            )}
                        </button>
                    </div>
                </div>
            </div>
        )}
      </main>

      {/* OVERLAYS */}
      {showPlanner && <DailyPlanner onCommit={commitPlan} onClose={() => setShowPlanner(false)} />}
      {isLiveSessionActive && (
          <div className="fixed inset-0 z-[60]">
              <LiveSession userContext={userProfile.details} onClose={() => setIsLiveSessionActive(false)} />
          </div>
      )}
      
      {/* SELECTION BAR (Mobile/Desktop) */}
      {isSelectionMode && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-atlas-text text-white px-6 py-3 rounded-full shadow-2xl z-50 flex items-center gap-6 animate-in slide-in-from-bottom-4">
              <span className="text-sm font-bold">{selectedMsgIds.size} selected</span>
              <button onClick={saveSelectedToMemory} className="flex items-center gap-2 hover:text-atlas-accent transition-colors">
                  <IconBrain /> <span className="text-sm font-bold">Save to Memory</span>
              </button>
              <button onClick={() => { setIsSelectionMode(false); setSelectedMsgIds(new Set()); }} className="opacity-60 hover:opacity-100">
                  <IconClose />
              </button>
          </div>
      )}

    </div>
    </LanguageContext.Provider>
  );
}
