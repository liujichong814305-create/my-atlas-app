
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { sendMessageToAtlas } from './services/geminiService';
import { loginUser, syncDataToCloud, restoreDataFromCloud, UserAccount } from './services/authService';
import AtlasVisual, { AtlasMini } from './components/AtlasVisual';
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
  const renderLetterModal = () => { if (!isLetterModalOpen || !viewingLetter) return null; return ( <div className="absolute inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-500"> <div className="relative w-full max-w-2xl min-h-[60vh] flex flex-col items-center justify-center"> <button onClick={() => { setIsLetterModalOpen(false); setLetterStage('closed'); }} className="absolute top-0 right-0 z-50 p-4 text-white hover:text-atlas-accent transition-colors" > <IconClose /> </button> {letterStage === 'closed' && ( <div className="w-80 h-52 bg-[#f4f1ea] shadow-2xl relative cursor-pointer transform hover:scale-105 transition-all duration-500 flex items-center justify-center group" onClick={() => setLetterStage('opening')} style={{ clipPath: 'polygon(0 0, 50% 50%, 100% 0, 100% 100%, 0 100%)' }} > <div className="absolute inset-0 bg-[#e8e5de] shadow-inner"></div> <div className="absolute top-0 left-0 w-full h-1/2 bg-[#dcd6cc] origin-top transform group-hover:-rotate-x-12 transition-transform z-10" style={{ clipPath: 'polygon(0 0, 50% 100%, 100% 0)' }}></div> <div className="absolute z-20 w-16 h-16 bg-red-800 rounded-full shadow-lg flex items-center justify-center text-red-900 border-4 border-red-700/50 animate-pulse"> <span className="font-serif font-bold text-2xl italic">A</span> </div> <div className="absolute bottom-4 font-serif italic text-atlas-dim/50 text-sm">Tap to Open</div> </div> )} {letterStage === 'opening' && ( <div className="w-full flex items-center justify-center"> <div className="animate-ping absolute w-32 h-32 bg-white rounded-full opacity-20"></div> <div className="text-white font-serif italic text-xl animate-bounce" onAnimationIteration={() => setTimeout(() => setLetterStage('reading'), 1500)}> Opening... </div> </div> )} {letterStage === 'reading' && ( <div className="bg-[#faf9f6] w-full h-[70vh] max-h-[800px] overflow-y-auto rounded-lg shadow-2xl p-8 md:p-12 animate-in slide-in-from-bottom-10 duration-1000 relative"> <div className="border-b border-atlas-dim/10 pb-6 mb-8 flex justify-between items-end"> <div> <div className="text-xs uppercase tracking-widest text-atlas-dim">{viewingLetter.date}</div> <div className="text-2xl font-serif italic text-atlas-text mt-2"><Bilingual en={viewingLetter.title.en} zh={viewingLetter.title.zh} /></div> </div> <IconStamp /> </div> <div className="font-serif text-lg leading-loose text-atlas-text/90 whitespace-pre-wrap min-h-[300px]"> {typedContent} <span className="animate-pulse">|</span> </div> <div className="mt-12 pt-8 border-t border-atlas-dim/10 flex justify-end"> <div className="text-center"> <div className="font-serif italic text-lg text-atlas-text">Atlas</div> </div> </div> </div> )} </div> </div> ); };
  const renderSettingsOverlay = () => { if (!showSettings) return null; return ( <div className="absolute inset-0 z-[60] bg-white/95 backdrop-blur-md flex flex-col items-center animate-in fade-in duration-300"> <div className="w-full h-full flex flex-col"> <div className="flex-1 relative border-b border-atlas-dim/10"> <button onClick={() => setShowSettings(false)} className="absolute top-6 right-6 z-20 p-2 hover:bg-black/5 rounded-full"><IconClose /></button> <div className="absolute top-6 left-8 z-10 pointer-events-none"><Bilingual en="Visual Calibration" zh="形象校准" className="text-atlas-text italic text-2xl" /></div> <AtlasVisual isThinking={isThinking} edgeBlur={visualConfig.edgeBlur} centerWhite={visualConfig.centerWhite} haloIntensity={visualConfig.haloIntensity} /> </div> <div className="bg-white p-6 md:p-8 flex flex-col justify-center space-y-8 shadow-inner pb-12"> <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 max-w-5xl mx-auto w-full"> <div className="space-y-4"> <div className="flex justify-between text-xs text-atlas-dim font-sans uppercase tracking-widest"><Bilingual en="Diffusion" zh="扩散度" /><span>{visualConfig.edgeBlur}%</span></div> <input type="range" min="0" max="100" value={visualConfig.edgeBlur} onChange={(e) => updateConfig('edgeBlur', Number(e.target.value))} className="w-full h-1 bg-atlas-dim/20 rounded-full appearance-none cursor-pointer" /> </div> <div className="space-y-4"> <div className="flex justify-between text-xs text-atlas-dim font-sans uppercase tracking-widest"><Bilingual en="Hollow Radius" zh="空心半径" /><span>{visualConfig.centerWhite}%</span></div> <input type="range" min="0" max="100" value={visualConfig.centerWhite} onChange={(e) => updateConfig('centerWhite', Number(e.target.value))} className="w-full h-1 bg-atlas-dim/20 rounded-full appearance-none cursor-pointer" /> </div> <div className="space-y-4"> <div className="flex justify-between text-xs text-atlas-dim font-sans uppercase tracking-widest"><Bilingual en="Halo Opacity" zh="光环透明度" /><span>{visualConfig.haloIntensity}%</span></div> <input type="range" min="0" max="100" value={visualConfig.haloIntensity} onChange={(e) => updateConfig('haloIntensity', Number(e.target.value))} className="w-full h-1 bg-atlas-dim/20 rounded-full appearance-none cursor-pointer" /> </div> </div> <div className="text-center text-atlas-dim/40 text-sm italic mt-4 font-serif"><Bilingual en="Configure the projection to align with your cognitive state." zh="配置投影以配合您的认知状态。" /></div> </div> </div> </div> ); };
  const SidebarContent = () => ( <> <div className="mb-4 hidden md:block"><div className="w-12 h-12 rounded-full border border-atlas-accent flex items-center justify-center bg-white shadow-sm overflow-hidden text-atlas-accent font-serif font-bold text-lg">A</div></div> <div className="flex flex-col gap-2 w-full"> <button onClick={() => { setActiveModule('daily'); setIsMobileNavOpen(false); }} className={`p-3 rounded-xl transition-all flex items-center gap-3 ${activeModule === 'daily' ? 'bg-white text-atlas-accent shadow-md' : 'text-atlas-dim hover:text-atlas-text'}`}><IconSun /><Bilingual en="Daily Protocol" zh="日常协议" className="md:hidden text-sm font-bold uppercase tracking-widest" /><Bilingual en="Daily" zh="日常" className="hidden md:block text-[10px] opacity-80 font-sans tracking-widest uppercase font-medium mt-1" /></button> <button onClick={() => { setActiveModule('deep'); setIsMobileNavOpen(false); }} className={`p-3 rounded-xl transition-all flex items-center gap-3 ${activeModule === 'deep' ? 'bg-atlas-accent text-white shadow-md' : 'text-atlas-dim hover:text-atlas-text'}`}><IconDepth /><Bilingual en="Deep Work" zh="深度工作" className="md:hidden text-sm font-bold uppercase tracking-widest" /><Bilingual en="Deep" zh="深度" className="hidden md:block text-[10px] opacity-80 font-sans tracking-widest uppercase font-medium mt-1" /></button> <button onClick={() => { setActiveModule('learning'); setIsMobileNavOpen(false); }} className={`p-3 rounded-xl transition-all flex items-center gap-3 ${activeModule === 'learning' ? 'bg-white text-atlas-accent shadow-md' : 'text-atlas-dim hover:text-atlas-text'}`}><IconLearning /><Bilingual en="Deep Learning" zh="深度学习" className="md:hidden text-sm font-bold uppercase tracking-widest" /><Bilingual en="Study" zh="学习" className="hidden md:block text-[10px] opacity-80 font-sans tracking-widest uppercase font-medium mt-1" /></button> <button onClick={() => { setActiveModule('private'); setIsMobileNavOpen(false); }} className={`p-3 rounded-xl transition-all flex items-center gap-3 ${activeModule === 'private' ? 'bg-white text-atlas-accent shadow-md' : 'text-atlas-dim hover:text-atlas-text'}`}><IconLock /><Bilingual en="Private Space" zh="私密空间" className="md:hidden text-sm font-bold uppercase tracking-widest" /><Bilingual en="Private" zh="私密" className="hidden md:block text-[10px] opacity-80 font-sans tracking-widest uppercase font-medium mt-1" /></button> <button onClick={() => { setActiveModule('journal'); setIsMobileNavOpen(false); }} className={`p-3 rounded-xl transition-all flex items-center gap-3 ${activeModule === 'journal' ? 'bg-white text-atlas-accent shadow-md' : 'text-atlas-dim hover:text-atlas-text'}`}><IconJournal /><Bilingual en="Archive" zh="档案" className="md:hidden text-sm font-bold uppercase tracking-widest" /><Bilingual en="Log" zh="日志" className="hidden md:block text-[10px] opacity-80 font-sans tracking-widest uppercase font-medium mt-1" /></button> </div> <div className="flex-1"></div> <div className="flex flex-col gap-2 w-full border-t border-atlas-dim/10 pt-4 mt-4"> <button onClick={() => { setShowSettings(true); setIsMobileNavOpen(false); }} className={`p-3 rounded-xl transition-all flex items-center gap-3 text-atlas-dim hover:text-atlas-accent`}><IconAtlas /><Bilingual en="Calibration" zh="校准" className="md:hidden text-sm font-bold uppercase tracking-widest" /><Bilingual en="Atlas" zh="Atlas" className="hidden md:block text-[10px] opacity-80 font-sans tracking-widest uppercase font-medium mt-1" /></button> <button onClick={() => { setActiveModule('profile'); setIsMobileNavOpen(false); }} className={`p-3 rounded-xl transition-all flex items-center gap-3 ${activeModule === 'profile' ? 'bg-atlas-dim/10 text-atlas-text' : 'text-atlas-dim hover:text-atlas-text'}`}><IconUser /><Bilingual en="My Identity" zh="我的身份" className="md:hidden text-sm font-bold uppercase tracking-widest" /><Bilingual en="Me" zh="我" className="hidden md:block text-[10px] opacity-80 font-sans tracking-widest uppercase font-medium mt-1" /></button> <button onClick={() => { setActiveModule('settings'); setSettingsSubPage('menu'); setIsMobileNavOpen(false); }} className={`p-3 rounded-xl transition-all flex items-center gap-3 ${activeModule === 'settings' ? 'bg-atlas-dim/10 text-atlas-text' : 'text-atlas-dim hover:text-atlas-text'}`}><IconSettings /><Bilingual en="Settings" zh="设置" className="md:hidden text-sm font-bold uppercase tracking-widest" /><Bilingual en="Set" zh="设置" className="hidden md:block text-[10px] opacity-80 font-sans tracking-widest uppercase font-medium mt-1" /></button> </div> </> );
  const renderSidebar = () => (<aside className="hidden md:flex w-24 bg-atlas-bg border-r border-atlas-dim/10 flex-col items-center py-8 gap-2 z-20 shrink-0"><SidebarContent /></aside>);
  const renderMobileDrawer = () => (<>{isMobileNavOpen && (<div className="fixed inset-0 z-[60] bg-black/20 backdrop-blur-sm md:hidden animate-in fade-in duration-200" onClick={() => setIsMobileNavOpen(false)}><aside className="w-64 h-full bg-atlas-surface shadow-2xl p-6 flex flex-col items-start gap-4 animate-in slide-in-from-left duration-300" onClick={(e) => e.stopPropagation()}><Bilingual en="Navigation" zh="导航" className="text-2xl font-serif italic text-atlas-text mb-6" /><SidebarContent /></aside></div>)}</>);
  const renderProfileView = () => { return ( <div className="h-full w-full flex flex-col relative bg-atlas-surface animate-in fade-in slide-in-from-right-4 duration-300"> <header className="flex items-center justify-between px-6 py-4 border-b border-atlas-dim/10 bg-white/50 backdrop-blur-md sticky top-0 z-10 md:hidden"> <div className="flex items-center gap-4"> <div className="w-10 h-10 cursor-pointer" onClick={() => setIsMobileNavOpen(true)}> <AtlasMini isThinking={false} /> </div> <Bilingual en={moduleConfig.title.en} zh={moduleConfig.title.zh} className="font-serif italic text-xl text-atlas-text" /> </div> </header> <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-24 md:pb-8"> <div className="max-w-2xl w-full mx-auto bg-white p-6 md:p-10 rounded-xl shadow-lg border border-atlas-dim/10"> <Bilingual en="My Identity" zh="我的档案" className="text-2xl md:text-3xl text-atlas-text mb-8 border-b border-atlas-dim/10 pb-4 italic font-serif block" /> <div className="space-y-8"> <div className="flex flex-col md:flex-row items-center md:items-start gap-8"> <div className="flex flex-col items-center gap-3"> <div className="w-24 h-24 rounded-full border border-dashed border-atlas-dim/20 flex items-center justify-center overflow-hidden cursor-pointer hover:border-atlas-accent transition-colors relative group bg-atlas-bg" onClick={() => fileInputRef.current?.click()} > {userProfile.avatarImage ? ( <img src={userProfile.avatarImage} alt="Preview" className="w-full h-full object-cover" /> ) : ( <div className="w-full h-full flex items-center justify-center text-white font-serif font-bold text-2xl bg-atlas-accent"> {userProfile.name.charAt(0).toUpperCase()} </div> )} <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"> <span className="text-white text-[10px] font-sans uppercase font-bold tracking-widest">Edit</span> </div> </div> <input type="file" ref={fileInputRef} onChange={handleAvatarUpload} accept="image/*" className="hidden" /> <span className="text-[10px] text-atlas-dim font-sans uppercase tracking-widest"><Bilingual en="Avatar" zh="头像" /></span> </div> <div className="flex-1 w-full grid grid-cols-1 gap-6"> <div className="space-y-2"> <label className="text-xs uppercase tracking-widest text-atlas-dim font-bold font-sans"><Bilingual en="Call Me" zh="称呼" /></label> <input type="text" value={userProfile.name} onChange={(e) => setUserProfile({...userProfile, name: e.target.value})} className="w-full bg-atlas-bg p-3 rounded border border-atlas-dim/10 focus:outline-none focus:border-atlas-accent text-atlas-text font-serif text-lg" placeholder="Your Name" /> </div> <div className="space-y-2"> <label className="text-xs uppercase tracking-widest text-atlas-dim font-bold font-sans"><Bilingual en="Profession" zh="职业" /></label> <input type="text" value={userProfile.profession} onChange={(e) => setUserProfile({...userProfile, profession: e.target.value})} className="w-full bg-atlas-bg p-3 rounded border border-atlas-dim/10 focus:outline-none focus:border-atlas-accent text-atlas-text font-serif text-lg" placeholder="Architect, Student, etc." /> </div> </div> </div> <div className="space-y-2"> <label className="text-xs uppercase tracking-widest text-atlas-dim font-bold font-sans"><Bilingual en="Memory Archive" zh="记忆库" /></label> <p className="text-[10px] text-atlas-dim/60 mb-1 font-sans"><Bilingual en="Atlas accumulates this automatically. You can also edit it." zh="Atlas会自动积累这些信息。你也可以手动编辑。" /></p> <textarea value={userProfile.details} onChange={(e) => setUserProfile({...userProfile, details: e.target.value})} className="w-full h-48 bg-atlas-bg p-4 rounded border border-atlas-dim/10 focus:outline-none focus:border-atlas-accent text-atlas-text resize-none font-serif text-lg leading-relaxed" placeholder="Atlas has not learned anything yet..." /> </div> </div> <div className="mt-10 flex justify-end"> <button onClick={saveProfile} disabled={isThinking} className="w-full md:w-auto bg-atlas-text text-white px-8 py-3 rounded hover:bg-atlas-accent transition-colors text-sm uppercase tracking-wider font-bold shadow-lg font-sans disabled:opacity-50" > {isThinking ? "Syncing..." : <Bilingual en="Update & Sync with Atlas" zh="更新并同步" />} </button> </div> </div> </div> </div> ); };
  const renderSettingsView = () => { const loc = (en: string, zh: string) => appLanguage === 'en' ? en : appLanguage === 'zh' ? zh : `${en} (${zh})`; return ( <div className="h-full w-full flex flex-col bg-atlas-surface animate-in fade-in slide-in-from-right-4 duration-300 relative"> <header className="flex items-center justify-between px-6 py-4 border-b border-atlas-dim/10 bg-white/50 backdrop-blur-md sticky top-0 z-10 md:hidden"> <div className="flex items-center gap-4"> <div className="w-10 h-10 cursor-pointer" onClick={() => setIsMobileNavOpen(true)}> <AtlasMini isThinking={false} /> </div> <Bilingual en="Settings" zh="设置" className="font-serif italic text-xl text-atlas-text" /> </div> </header> <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-24 md:pb-8"> <div className="max-w-2xl w-full mx-auto bg-white rounded-xl shadow-lg border border-atlas-dim/10 overflow-hidden min-h-[500px] flex flex-col"> <div className="p-6 md:p-8 border-b border-atlas-dim/10 flex items-center gap-4 bg-atlas-bg/30"> {settingsSubPage !== 'menu' && ( <button onClick={() => setSettingsSubPage('menu')} className="p-2 hover:bg-atlas-dim/10 rounded-full transition-colors"> <IconArrowLeft /> </button> )} <h2 className="text-2xl font-serif italic text-atlas-text"> {settingsSubPage === 'menu' && <Bilingual en="System Configuration" zh="系统配置" />} {settingsSubPage === 'language' && <Bilingual en="Language Interface" zh="语言界面" />} {settingsSubPage === 'data' && <Bilingual en="Data Management" zh="数据管理" />} {settingsSubPage === 'account' && <Bilingual en="Account Status" zh="账户状态" />} {settingsSubPage === 'letters' && <Bilingual en="Letter Protocol" zh="信件协议" />} </h2> </div> <div className="p-6 md:p-8 flex-1"> {settingsSubPage === 'menu' && ( <div className="space-y-2"> {[ { id: 'account', icon: <IconUser />, label: { en: 'Account', zh: '账户' } }, { id: 'language', icon: <IconLanguage />, label: { en: 'Language', zh: '语言' } }, { id: 'letters', icon: <IconMail />, label: { en: 'Atlas Letters', zh: 'Atlas 信件' } }, { id: 'data', icon: <IconDownload />, label: { en: 'Backup & Restore', zh: '备份与恢复' } }, ].map(item => ( <button key={item.id} onClick={() => setSettingsSubPage(item.id as any)} className="w-full flex items-center justify-between p-4 hover:bg-atlas-bg/50 rounded-lg transition-colors group border border-transparent hover:border-atlas-dim/5" > <div className="flex items-center gap-4"> <div className="text-atlas-dim group-hover:text-atlas-accent transition-colors">{item.icon}</div> <span className="font-serif text-lg text-atlas-text"><Bilingual en={item.label.en} zh={item.label.zh} /></span> </div> <IconChevronRight /> </button> ))} </div> )} {settingsSubPage === 'language' && ( <div className="space-y-4"> {[ { code: 'en', label: 'English Only' }, { code: 'zh', label: '中文模式' }, { code: 'bilingual', label: 'Bilingual (双语)' } ].map((lang) => ( <button key={lang.code} onClick={() => setAppLanguage(lang.code as any)} className={`w-full p-4 rounded-lg border text-left flex items-center justify-between transition-all ${appLanguage === lang.code ? 'border-atlas-accent bg-atlas-accent/5' : 'border-atlas-dim/10 hover:border-atlas-accent/30'}`} > <span className="font-serif text-lg">{lang.label}</span> {appLanguage === lang.code && <div className="w-3 h-3 rounded-full bg-atlas-accent"></div>} </button> ))} </div> )} {settingsSubPage === 'data' && ( <div className="space-y-8"> <div className="p-4 bg-atlas-bg rounded-lg border border-atlas-dim/10"> <h3 className="font-bold text-xs uppercase tracking-widest text-atlas-dim mb-4"><Bilingual en="Cloud Synchronization" zh="云端同步" /></h3> <div className="flex items-center justify-between"> <div className="text-sm opacity-70 italic">{syncStatus || loc("Ready to sync", "准备同步")}</div> <button onClick={handleCloudSync} disabled={isSyncing} className="px-4 py-2 bg-atlas-text text-white text-xs font-bold uppercase rounded hover:bg-atlas-accent transition-colors disabled:opacity-50"> {isSyncing ? "Syncing..." : <Bilingual en="Sync Now" zh="立即同步" />} </button> </div> </div> <div className="grid grid-cols-1 md:grid-cols-2 gap-4"> <button onClick={handleExportData} className="p-6 border border-atlas-dim/10 rounded-lg hover:bg-atlas-bg/50 transition-colors flex flex-col items-center gap-3 text-center"> <IconDownload /> <span className="font-serif"><Bilingual en="Export Backup" zh="导出备份" /></span> </button> <div className="relative p-6 border border-atlas-dim/10 rounded-lg hover:bg-atlas-bg/50 transition-colors flex flex-col items-center gap-3 text-center cursor-pointer" onClick={() => importInputRef.current?.click()}> <IconUpload /> <span className="font-serif"><Bilingual en="Import Backup" zh="导入备份" /></span> <input type="file" ref={importInputRef} onChange={handleImportData} accept=".json" className="hidden" /> </div> </div> </div> )} {settingsSubPage === 'letters' && ( <div className="space-y-6"> <p className="text-sm text-atlas-dim italic font-serif leading-relaxed mb-6"> <Bilingual en="Atlas can write you a letter at the end of each cycle to summarize your growth. Select which letters you wish to receive." zh="Atlas可以在每个周期结束时为你写一封信，总结你的成长。选择你希望收到的信件类型。" /> </p> {[ { id: 'weekly', label: { en: 'Weekly Letter (Sundays)', zh: '周信 (周日)' } }, { id: 'monthly', label: { en: 'Monthly Letter', zh: '月信' } }, { id: 'yearly', label: { en: 'Yearly Review', zh: '年度回顾' } } ].map(opt => ( <div key={opt.id} className="flex items-center justify-between p-4 bg-atlas-bg/30 rounded-lg"> <span className="font-serif text-lg"><Bilingual en={opt.label.en} zh={opt.label.zh} /></span> <button onClick={() => setLetterSettings(prev => ({...prev, [opt.id]: !prev[opt.id as keyof LetterSettings]}))} className={`w-12 h-6 rounded-full transition-colors relative ${letterSettings[opt.id as keyof LetterSettings] ? 'bg-atlas-accent' : 'bg-atlas-dim/20'}`} > <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${letterSettings[opt.id as keyof LetterSettings] ? 'left-7' : 'left-1'}`}></div> </button> </div> ))} </div> )} {settingsSubPage === 'account' && ( <div className="flex flex-col items-center py-8 space-y-6"> <div className="w-20 h-20 rounded-full bg-atlas-accent flex items-center justify-center text-white text-3xl font-serif font-bold"> {userAccount?.username.charAt(0).toUpperCase()} </div> <div className="text-center"> <h3 className="text-xl font-serif text-atlas-text">{userAccount?.username}</h3> <p className="text-xs text-atlas-dim uppercase tracking-widest mt-1">ID: {userAccount?.id}</p> </div> <button onClick={handleLogout} className="mt-8 flex items-center gap-2 text-atlas-alert hover:text-red-700 transition-colors text-sm font-bold uppercase tracking-widest"> <IconLogout /> <Bilingual en="Disconnect Session" zh="断开连接" /> </button> </div> )} </div> </div> </div> </div> ); };
  
  const renderChatView = () => { 
      const isPrivate = activeModule === 'private';
      
      const filteredMessages = currentMessages.filter(msg => {
          const matchesText = chatSearchQuery ? msg.text.toLowerCase().includes(chatSearchQuery.toLowerCase()) : true;
          const matchesDate = chatSearchDate ? msg.timestamp.toISOString().split('T')[0] === chatSearchDate : true;
          // Private Mode Topic Filter
          const matchesTag = (isPrivate && selectedTag) ? msg.tags?.includes(selectedTag) : true;
          
          return matchesText && matchesDate && matchesTag;
      });

      return (
          <div className={`h-full flex flex-col ${moduleConfig.themeClass}`}>
              <header className="flex flex-col border-b border-atlas-dim/10 bg-white/50 backdrop-blur-md sticky top-0 z-10 transition-all">
                  <div className="flex items-center justify-between px-6 py-4">
                      {/* ... Header Content (Search/Nav) ... */}
                      <div className="flex items-center gap-4">
                          <div className="w-10 h-10 cursor-pointer" onClick={() => setIsMobileNavOpen(true)}>
                              <AtlasMini isThinking={false} />
                          </div>
                          <div>
                              <div className="flex items-center gap-2">
                                  <Bilingual en={moduleConfig.title.en} zh={moduleConfig.title.zh} className="font-serif italic text-xl text-atlas-text" />
                                  <button onClick={() => setIsChatSearchOpen(!isChatSearchOpen)} className={`p-1.5 rounded-full transition-colors ${isChatSearchOpen ? 'bg-atlas-text text-white' : 'text-atlas-dim hover:bg-atlas-dim/10'}`}>
                                    <IconSearch />
                                  </button>
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-atlas-dim uppercase tracking-widest font-sans">
                                  {activeModule === 'deep' && sessionState.isActive ? (
                                      <span className="text-atlas-accent animate-pulse flex items-center gap-1"> <div className="w-1.5 h-1.5 rounded-full bg-atlas-accent"></div> <Bilingual en="Session Active" zh="咨询进行中" /> {sessionState.isPaused && "(Paused)"} </span>
                                  ) : isPrivate ? (
                                      <span className="flex items-center gap-1 text-atlas-dim/60"><IconLock /> <Bilingual en="Encrypted & Local" zh="私密且本地化" /></span>
                                  ) : ( <span className="flex items-center gap-1"><IconSignal /> <Bilingual en="Online" zh="在线" /></span> )}
                              </div>
                          </div>
                      </div>
                      <div className="flex items-center gap-3">
                          {activeModule === 'daily' && ( <button onClick={() => setShowPlanner(!showPlanner)} className={`p-2 rounded-full transition-colors ${showPlanner ? 'bg-atlas-accent text-white' : 'text-atlas-dim hover:bg-atlas-dim/10'}`}> <IconPlan /> </button> )}
                          {activeModule === 'deep' && ( <div className="flex bg-atlas-dim/10 rounded-lg p-1"> <button onClick={() => setDeepSubMode('support')} className={`px-3 py-1 rounded-md text-[10px] uppercase font-bold transition-all ${deepSubMode === 'support' ? 'bg-white shadow text-atlas-accent' : 'text-atlas-dim'}`}><Bilingual en="Heal" zh="疗愈" /></button> <button onClick={() => setDeepSubMode('analysis')} className={`px-3 py-1 rounded-md text-[10px] uppercase font-bold transition-all ${deepSubMode === 'analysis' ? 'bg-white shadow text-atlas-accent' : 'text-atlas-dim'}`}><Bilingual en="Core" zh="核心" /></button> </div> )}
                      </div>
                  </div>
                  
                  {/* Search / Filter Area */}
                  {(isChatSearchOpen || (isPrivate && selectedTag)) && (
                      <div className="px-6 pb-4 animate-in slide-in-from-top-2 flex flex-col gap-3">
                          {isChatSearchOpen && (
                              <div className="flex gap-2">
                                  <div className="flex-1 bg-white rounded-lg border border-atlas-dim/10 flex items-center px-3 py-2">
                                      <IconSearch /> <input type="text" value={chatSearchQuery} onChange={(e) => setChatSearchQuery(e.target.value)} placeholder={appLanguage === 'en' ? "Search content..." : "搜索内容..."} className="flex-1 ml-2 bg-transparent focus:outline-none text-sm font-serif" /> {chatSearchQuery && <button onClick={() => setChatSearchQuery('')}><IconClose /></button>}
                                  </div>
                                  <div className="bg-white rounded-lg border border-atlas-dim/10 flex items-center px-3 py-2 w-40"> <IconCalendar /> <input type="date" value={chatSearchDate} onChange={(e) => setChatSearchDate(e.target.value)} className="flex-1 ml-2 bg-transparent focus:outline-none text-xs font-sans uppercase tracking-widest text-atlas-dim" /> </div>
                              </div>
                          )}

                          {/* PRIVATE MODE ONLY: Tag Cloud */}
                          {isPrivate && isChatSearchOpen && (
                              <div className="flex flex-wrap gap-2 pt-2 border-t border-atlas-dim/5">
                                  <span className="text-[10px] uppercase tracking-widest text-atlas-dim py-1 mr-2 flex items-center"><Bilingual en="Topics:" zh="话题:" /></span>
                                  <button onClick={() => setSelectedTag(null)} className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${!selectedTag ? 'bg-atlas-text text-white' : 'bg-atlas-dim/10 text-atlas-dim hover:bg-atlas-dim/20'}`}>ALL</button>
                                  {availableTags.map(tag => (
                                      <button key={tag} onClick={() => setSelectedTag(tag === selectedTag ? null : tag)} className={`px-3 py-1 rounded-full text-xs font-serif italic transition-colors ${selectedTag === tag ? 'bg-atlas-accent text-white shadow-md' : 'bg-white border border-atlas-dim/10 text-atlas-dim hover:border-atlas-accent/50 hover:text-atlas-text'}`}>#{tag}</button>
                                  ))}
                              </div>
                          )}

                          {/* PRIVATE MODE ONLY: Active Filter Indicator (if search closed but tag selected) */}
                          {isPrivate && selectedTag && !isChatSearchOpen && (
                              <div className="flex items-center gap-2">
                                  <span className="text-xs text-atlas-dim uppercase tracking-widest">Viewing:</span>
                                  <span className="px-3 py-1 bg-atlas-accent text-white text-xs font-serif italic rounded-full shadow-sm">#{selectedTag}</span>
                                  <button onClick={() => setSelectedTag(null)} className="text-atlas-dim hover:text-atlas-alert"><IconClose /></button>
                              </div>
                          )}
                      </div>
                  )}
              </header>

              {showPlanner && activeModule === 'daily' && (<DailyPlanner onCommit={commitPlan} onClose={() => setShowPlanner(false)} />)}
              
              <div className={`flex-1 overflow-y-auto p-4 md:p-6 scroll-smooth ${isPrivate ? '' : 'space-y-6'}`}>
                  {/* Empty State Logic */}
                  {filteredMessages.length === 0 && (chatSearchQuery || chatSearchDate || selectedTag) ? (
                      <div className="flex flex-col items-center justify-center h-full opacity-40"> <IconSearch /> <p className="mt-2 text-sm italic font-serif"><Bilingual en="No results found." zh="未找到相关结果。" /></p> </div>
                  ) : filteredMessages.length === 0 && isPrivate ? (
                      <div className="flex flex-col items-center justify-center h-full opacity-30 text-atlas-dim">
                          <div className="w-16 h-16 border-2 border-atlas-dim rounded-full flex items-center justify-center mb-4"><IconLock /></div>
                          <p className="font-serif italic text-lg"><Bilingual en="This space is yours alone." zh="此处仅属于你。" /></p>
                          <p className="text-xs uppercase tracking-widest mt-2"><Bilingual en="Thoughts are stored locally." zh="思绪仅本地存储。" /></p>
                      </div>
                  ) : isPrivate ? (
                      /* PRIVATE MODE: Grid Cards Layout */
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-12">
                          {filteredMessages.map((msg) => (
                              <div key={msg.id} className="bg-white p-6 rounded-xl shadow-sm border border-atlas-dim/5 hover:shadow-md transition-all flex flex-col group animate-in zoom-in-95 duration-300 break-inside-avoid relative overflow-hidden">
                                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-atlas-accent/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                  
                                  {msg.image && (
                                      <div className="mb-4 rounded-lg overflow-hidden border border-atlas-dim/10">
                                          <img src={msg.image} alt="Private Note" className="w-full h-auto object-cover opacity-95 hover:opacity-100 transition-opacity" />
                                      </div>
                                  )}
                                  
                                  <div className="flex-1 font-serif text-lg leading-relaxed text-atlas-text whitespace-pre-wrap">
                                      {/* Highlight Tags in text */}
                                      {msg.text.split(/(#[\w\u4e00-\u9fa5]+)/g).map((part, i) => 
                                          part.startsWith('#') ? <span key={i} className="text-atlas-accent font-bold cursor-pointer hover:underline" onClick={(e) => {e.stopPropagation(); setSelectedTag(part.substring(1));}}>{part}</span> : part
                                      )}
                                  </div>

                                  {/* Tags Chips at Bottom */}
                                  {msg.tags && msg.tags.length > 0 && (
                                      <div className="mt-4 flex flex-wrap gap-1">
                                          {msg.tags.map(tag => (
                                              <span key={tag} className="text-[10px] px-2 py-0.5 bg-atlas-bg rounded-full text-atlas-dim/60 font-serif italic">#{tag}</span>
                                          ))}
                                      </div>
                                  )}
                                  
                                  <div className="mt-4 pt-3 border-t border-atlas-dim/5 flex justify-between items-end">
                                      <span className="text-[10px] text-atlas-dim/40 uppercase tracking-widest font-sans font-bold">{msg.timestamp.toLocaleDateString()}</span>
                                      <div className="text-atlas-dim/10 group-hover:text-atlas-accent/20 transition-colors"><IconFileText /></div>
                                  </div>
                              </div>
                          ))}
                      </div>
                  ) : (
                      /* STANDARD LAYOUT: Chat Bubbles */
                      filteredMessages.map((msg, index) => { 
                          const isUser = msg.role === 'user'; 
                          const isSelected = selectedMsgIds.has(msg.id);
                          return (
                              <div 
                                  key={msg.id} 
                                  className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}
                                  onClick={() => handleMessageClick(msg.id)}
                                  onContextMenu={(e) => handleMessageLongPress(e, msg.id)}
                              >
                                  <div className={`max-w-[85%] md:max-w-[70%] flex flex-col ${isUser ? 'items-end' : 'items-start'} transition-all duration-200 ${isSelectionMode && !isSelected ? 'opacity-50 grayscale' : 'opacity-100'}`}>
                                      {msg.attachment ? (
                                           <div 
                                              className={`bg-[#f4f1ea] border border-[#e8e5de] shadow-lg p-6 rounded-lg cursor-pointer transform hover:scale-[1.02] transition-transform relative group w-64 md:w-80`}
                                              onClick={(e) => {
                                                  e.stopPropagation();
                                                  if (msg.attachment?.type === 'letter') {
                                                      setViewingLetter(msg.attachment.data);
                                                      setIsLetterModalOpen(true);
                                                      setLetterStage('closed');
                                                  } else if (msg.attachment?.type === 'summary') {
                                                      setViewingLogDate(msg.timestamp.toISOString().split('T')[0]);
                                                      setLogTab('daily'); 
                                                      generateLog(msg.timestamp.toISOString().split('T')[0]);
                                                  }
                                              }}
                                           >
                                               {msg.attachment.type === 'letter' ? (
                                                   <div className="flex flex-col items-center justify-center py-4">
                                                       <div className="w-16 h-12 bg-white shadow border border-atlas-dim/10 relative flex items-center justify-center mb-4">
                                                           <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-800 rounded-full flex items-center justify-center text-[10px] text-white font-serif italic border-2 border-white">A</div>
                                                           <IconEnvelope />
                                                       </div>
                                                       <div className="font-serif italic text-lg text-atlas-text">Letter from Atlas</div>
                                                       <div className="text-[10px] uppercase tracking-widest text-atlas-dim mt-1">Tap to Open</div>
                                                   </div>
                                               ) : (
                                                   <div className="flex items-center gap-4">
                                                       <div className="p-3 bg-white rounded-lg shadow-sm text-atlas-accent"><IconFileText /></div>
                                                       <div>
                                                            <div className="font-serif italic text-lg text-atlas-text">Daily Log</div>
                                                            <div className="text-[10px] uppercase tracking-widest text-atlas-dim">View Summary</div>
                                                       </div>
                                                   </div>
                                               )}
                                           </div>
                                      ) : (
                                          <div className={`py-3 px-5 rounded-2xl text-sm md:text-base leading-relaxed whitespace-pre-wrap shadow-sm transition-all duration-200 cursor-pointer ${isSelected ? 'bg-atlas-accent text-white ring-2 ring-offset-2 ring-atlas-accent scale-[1.02]' : isUser ? 'bg-atlas-text text-white rounded-br-none' : 'bg-white text-atlas-text border border-atlas-dim/10 rounded-bl-none'}`}>
                                              {msg.image && (<img src={msg.image} alt="Upload" className="max-w-full rounded-lg mb-2 border border-white/20" />)}
                                              <span dangerouslySetInnerHTML={{ __html: msg.text.replace(/\n/g, '<br/>') }} />
                                          </div>
                                      )}
                                      <span className="text-[9px] text-atlas-dim/40 mt-1 font-sans uppercase tracking-wider">{msg.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                  </div>
                              </div>
                          ); 
                      })
                  )}
                  {isThinking && !chatSearchQuery && !chatSearchDate && !isPrivate && ( <div className="flex justify-start w-full"> <div className="bg-white px-4 py-3 rounded-2xl rounded-bl-none border border-atlas-dim/10 flex items-center gap-2"> <div className="w-2 h-2 bg-atlas-dim/30 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} /> <div className="w-2 h-2 bg-atlas-dim/30 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} /> <div className="w-2 h-2 bg-atlas-dim/30 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} /> </div> </div> )}
                  <div ref={messagesEndRef} />
              </div>
              
              <div className="p-4 md:p-6 bg-white/80 backdrop-blur-md border-t border-atlas-dim/10 relative">
                  {/* Shared Content Status Bar (Simulating Reading/Listening) */}
                  {sharedContentState && sharedContentState.isActive && (
                      <div className="absolute -top-10 left-4 right-4 md:left-6 md:right-6 bg-atlas-accent text-white rounded-t-xl py-2 px-4 flex items-center justify-between shadow-lg animate-in slide-in-from-bottom-2">
                          <div className="flex items-center gap-3">
                              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                              <span className="text-xs font-serif italic">
                                  {sharedContentState.type === 'audio' 
                                      ? <BilingualInline en={`Listening to "${sharedContentState.title}"...`} zh={`正在聆听 "${sharedContentState.title}"...`} />
                                      : <BilingualInline en={`Reading "${sharedContentState.title}"...`} zh={`正在阅读 "${sharedContentState.title}"...`} />
                                  }
                              </span>
                          </div>
                          <span className="text-xs font-mono font-bold">{sharedContentState.timeLeft}s</span>
                      </div>
                  )}

                  {/* Plus Menu Popover */}
                  {isPlusMenuOpen && !isPrivate && (
                      <div className="absolute bottom-full left-4 mb-2 bg-white rounded-xl shadow-xl border border-atlas-dim/10 p-2 flex flex-col gap-1 z-30 animate-in slide-in-from-bottom-2 zoom-in-95">
                          <button 
                              onClick={() => { setIsPlusMenuOpen(false); setIsLiveSessionActive(true); }}
                              className="flex items-center gap-3 px-4 py-3 hover:bg-atlas-bg rounded-lg text-left transition-colors group w-40"
                          >
                              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-full group-hover:bg-indigo-100"><IconMic /></div>
                              <span className="text-xs font-bold uppercase tracking-widest text-atlas-text"><Bilingual en="Voice Call" zh="语音通话" /></span>
                          </button>
                          <button 
                              onClick={() => { setIsPlusMenuOpen(false); setIsLiveSessionActive(true); }} // LiveSession component handles mode selection internally usually, but here we just open it
                              className="flex items-center gap-3 px-4 py-3 hover:bg-atlas-bg rounded-lg text-left transition-colors group w-40"
                          >
                              <div className="p-2 bg-teal-50 text-teal-600 rounded-full group-hover:bg-teal-100"><IconVideo /></div>
                              <span className="text-xs font-bold uppercase tracking-widest text-atlas-text"><Bilingual en="Video Call" zh="视频通话" /></span>
                          </button>
                      </div>
                  )}

                  {isSelectionMode ? (
                       <div className="flex items-center gap-4 animate-in slide-in-from-bottom-4"> <button onClick={() => { setIsSelectionMode(false); setSelectedMsgIds(new Set()); }} className="flex-1 py-3 rounded-lg border border-atlas-dim/20 text-atlas-dim font-bold uppercase tracking-widest text-xs hover:bg-atlas-bg transition-colors" > <Bilingual en="Cancel" zh="取消" /> </button> <button onClick={saveSelectedToMemory} className="flex-[2] py-3 rounded-lg bg-atlas-accent text-white font-bold uppercase tracking-widest text-xs hover:bg-atlas-text transition-colors shadow-lg flex items-center justify-center gap-2" > <IconBrain /> <Bilingual en={`Save to Memory (${selectedMsgIds.size})`} zh={`保存到记忆 (${selectedMsgIds.size})`} /> </button> </div>
                  ) : (
                      <>
                          {activeModule === 'deep' && deepSubMode === 'support' && ( <div className="mb-4 flex items-center justify-between p-3 bg-indigo-50/50 rounded-xl border border-indigo-100"> <div className="flex items-center gap-3"> <div className="p-2 bg-indigo-100 text-indigo-600 rounded-full"><IconTimer /></div> <div> <div className="text-xs font-bold uppercase tracking-widest text-indigo-900"><Bilingual en="Therapy Session" zh="咨询时段" /></div> <div className="font-mono text-sm text-indigo-700">{sessionState.isEnded ? "00:00" : (() => { const currentSegment = sessionState.startTime && !sessionState.isPaused ? (Date.now() - sessionState.startTime) / 1000 : 0; const totalElapsed = sessionState.accumulatedTime + currentSegment; const remaining = Math.max(0, sessionState.duration - totalElapsed); const mins = Math.floor(remaining / 60); const secs = Math.floor(remaining % 60); return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`; })()}</div> </div> </div> <div className="flex items-center gap-2"> {!sessionState.isEnded && ( <> <button onClick={toggleSessionPause} className="p-2 rounded-full hover:bg-indigo-200 text-indigo-700 transition-colors">{sessionState.isPaused ? <IconPlay /> : <IconPause />}</button> <button onClick={() => endSession(false)} className="p-2 rounded-full hover:bg-red-100 text-red-500 transition-colors"><IconStop /></button> </> )} {sessionState.isEnded && ( <button onClick={() => { setSessionState({ isActive: true, isPaused: false, startTime: Date.now(), accumulatedTime: 0, duration: 50 * 60, isEnded: false }); setDeepSupportMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text: "<strong>New Session Started.</strong>\n\nThe door is open again.\n\n新的咨询已开始。门再次打开。", timestamp: new Date() }]); }} className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold uppercase rounded-lg hover:bg-indigo-700"><Bilingual en="New Session" zh="开始新咨询" /></button> )} </div> </div> )}
                          {exerciseState.status === 'active' && ( <div className="mb-4 p-3 bg-teal-50 border border-teal-100 rounded-xl flex items-center justify-between"> <div className="flex items-center gap-3"> <div className="p-2 bg-teal-100 text-teal-600 rounded-full animate-pulse"><IconBrain /></div> <div> <div className="text-xs font-bold uppercase tracking-widest text-teal-900">{exerciseState.type === 'breath' ? <Bilingual en="Breathing Exercise" zh="呼吸练习" /> : <Bilingual en="Meditation" zh="冥想" />}</div> <div className="text-teal-700 text-xs">{Math.floor(exerciseState.timeLeft / 60)}m {exerciseState.timeLeft % 60}s remaining</div> </div> </div> <button onClick={cancelExercise} className="text-teal-500 hover:text-teal-700 p-2"><IconClose /></button> </div> )}
                          
                          <div className="flex items-end gap-2 bg-atlas-bg p-2 rounded-xl border border-atlas-dim/10 focus-within:border-atlas-accent/50 transition-colors relative"> 
                              {selectedImage && (<div className="absolute bottom-full mb-2 left-0 p-2 bg-white rounded shadow-lg border border-atlas-dim/10"><img src={selectedImage} className="h-20 rounded" alt="Preview" /><button onClick={() => setSelectedImage(undefined)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow"><IconClose /></button></div>)} 
                              
                              {/* PLUS BUTTON & IMAGE UPLOAD */}
                              <div className="flex items-center gap-1">
                                  {!isPrivate && (
                                      <button 
                                          onClick={() => setIsPlusMenuOpen(!isPlusMenuOpen)} 
                                          className={`p-3 rounded-lg transition-colors ${isPlusMenuOpen ? 'bg-atlas-dim/10 text-atlas-text' : 'text-atlas-dim hover:text-atlas-text'}`}
                                      >
                                          <IconPlus />
                                      </button>
                                  )}
                                  <button onClick={() => chatImageInputRef.current?.click()} className="p-3 text-atlas-dim hover:text-atlas-text transition-colors"><IconCamera /></button> 
                                  <input type="file" ref={chatImageInputRef} onChange={handleChatImageUpload} accept="image/*" className="hidden" /> 
                              </div>

                              <textarea value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={handleKeyDown} placeholder={moduleConfig.placeholder} className="flex-1 bg-transparent max-h-32 min-h-[24px] py-3 text-atlas-text placeholder:text-atlas-dim/40 focus:outline-none resize-none font-serif leading-relaxed" rows={1} style={{ height: 'auto', minHeight: '44px' }} /> 
                              
                              <button onClick={() => handleSendMessage()} disabled={(!inputText.trim() && !selectedImage) || isThinking || (activeModule === 'deep' && deepSubMode === 'support' && (sessionState.isPaused || sessionState.isEnded)) || (sharedContentState?.isActive)} className={`p-3 rounded-lg transition-all ${(!inputText.trim() && !selectedImage) || isThinking || sharedContentState?.isActive ? 'bg-atlas-dim/10 text-atlas-dim cursor-not-allowed' : 'bg-atlas-text text-white shadow-md hover:bg-atlas-accent'}`}><IconSend /></button> 
                          </div>
                      </>
                  )}
              </div>
          </div>
      ); 
  };

  return (
    <LanguageContext.Provider value={appLanguage}>
        <div className="flex h-[100dvh] w-full bg-atlas-bg text-atlas-text font-sans overflow-hidden">
            
            {/* 1. Mobile Navigation Drawer */}
            {renderMobileDrawer()}

            {/* 2. Login Screen Overlay */}
            {renderLoginScreen()}

            {/* 3. Settings Overlay */}
            {renderSettingsOverlay()}

            {/* 4. Letter Reading Modal */}
            {renderLetterModal()}

            {/* 5. Live Session Overlay (Full Screen) */}
            {isLiveSessionActive && (
                <div className="absolute inset-0 z-[70] animate-in fade-in duration-300 bg-black">
                     <button 
                        onClick={() => setIsLiveSessionActive(false)}
                        className="absolute top-6 right-6 z-50 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-colors"
                     >
                         <IconClose />
                     </button>
                     <LiveSession 
                        userContext={userProfile.details || "User is anonymous."} 
                        onClose={() => setIsLiveSessionActive(false)}
                     />
                </div>
            )}

            {/* 6. Sidebar (Desktop) */}
            {renderSidebar()}

            {/* 7. Main Content Area */}
            <main className="flex-1 flex flex-col h-full relative overflow-hidden w-full transition-all duration-300">
                {activeModule === 'profile' ? renderProfileView() :
                 activeModule === 'settings' ? renderSettingsView() :
                 activeModule === 'journal' ? renderJournalView() :
                 renderChatView()}
            </main>

        </div>
    </LanguageContext.Provider>
  );
}
