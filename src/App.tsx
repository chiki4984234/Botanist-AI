/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  Upload, 
  History, 
  Home,
  Leaf, 
  LogOut, 
  User, 
  ChevronLeft, 
  Loader2,
  Droplets,
  Sun,
  Sprout,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Settings,
  Globe,
  ChevronRight,
  ArrowLeft,
  X,
  Bell,
  Calendar,
  Plus,
  Check,
  Trash2,
  Clock,
  Mic,
  Volume2,
  StopCircle,
  Play,
  Pause
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, signInWithGoogle, logOut, db } from './firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { collection, query, where, orderBy, onSnapshot, addDoc, deleteDoc, doc, getDocFromServer, updateDoc, arrayUnion, setDoc } from 'firebase/firestore';
import { identifyPlant, getChatResponse, transcribeAudio, generateSpeech } from './services/gemini';
import { PlantScan, AIResponse, ChatMessage, Reminder } from './types';
import { Language, translations, languageNames } from './translations';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const ReminderModal = ({ 
  isOpen, 
  onClose, 
  onSave, 
  editingReminder, 
  scans, 
  t 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onSave: (data: Omit<Reminder, 'id' | 'userId'>) => void; 
  editingReminder: Reminder | null;
  scans: PlantScan[];
  t: any;
}) => {
  const [plantId, setPlantId] = useState(editingReminder?.plantId || '');
  const [task, setTask] = useState(editingReminder?.task || 'Watering');
  const [frequency, setFrequency] = useState<Reminder['frequency']>(editingReminder?.frequency || 'Daily');
  const [time, setTime] = useState(editingReminder?.time || '09:00');

  useEffect(() => {
    if (editingReminder) {
      setPlantId(editingReminder.plantId);
      setTask(editingReminder.task);
      setFrequency(editingReminder.frequency);
      setTime(editingReminder.time);
    } else {
      setPlantId(scans[0]?.id || '');
      setTask('Watering');
      setFrequency('Daily');
      setTime('09:00');
    }
  }, [editingReminder, scans]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedPlant = scans.find(s => s.id === plantId);
    if (!selectedPlant) return;

    // Calculate initial nextDue
    const [hours, minutes] = time.split(':').map(Number);
    const nextDueDate = new Date();
    nextDueDate.setHours(hours, minutes, 0, 0);
    
    if (nextDueDate.getTime() <= Date.now()) {
      nextDueDate.setDate(nextDueDate.getDate() + 1);
    }

    onSave({
      plantId,
      plantName: selectedPlant.plantName,
      task,
      frequency,
      time,
      nextDue: nextDueDate.getTime(),
      active: true
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-emerald-950/40 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white w-full max-w-md rounded-[3rem] overflow-hidden shadow-2xl border border-emerald-50"
      >
        <div className="p-8 border-b border-emerald-50 flex items-center justify-between bg-emerald-50/30">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-100">
              <Bell className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-2xl font-black text-emerald-950 tracking-tight">
              {editingReminder ? t.editReminder : t.addReminder}
            </h3>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-white rounded-2xl transition-all text-emerald-300 hover:text-emerald-600 shadow-sm hover:shadow-md">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] ml-1">{t.plant}</label>
            <div className="relative group">
              <select 
                value={plantId} 
                onChange={(e) => setPlantId(e.target.value)}
                className="w-full p-4 pl-12 rounded-2xl bg-emerald-50/50 border-2 border-transparent focus:border-emerald-600 focus:bg-white outline-none transition-all appearance-none font-bold text-emerald-900"
                required
              >
                {scans.map(scan => (
                  <option key={scan.id} value={scan.id}>{scan.plantName}</option>
                ))}
              </select>
              <Leaf className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-400 group-focus-within:text-emerald-600 transition-colors" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] ml-1">{t.task}</label>
            <div className="grid grid-cols-2 gap-3">
              {['Watering', 'Fertilizing', 'Pruning', 'Repotting'].map((taskName) => (
                <button
                  key={taskName}
                  type="button"
                  onClick={() => setTask(taskName)}
                  className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${task === taskName ? 'border-emerald-600 bg-emerald-50 text-emerald-950 shadow-inner' : 'border-emerald-50 hover:border-emerald-200 text-emerald-600'}`}
                >
                  {taskName === 'Watering' ? <Droplets className="w-6 h-6" /> :
                   taskName === 'Fertilizing' ? <Zap className="w-6 h-6" /> :
                   taskName === 'Pruning' ? <Sprout className="w-6 h-6" /> :
                   <Sprout className="w-6 h-6" />}
                  <span className="text-xs font-bold">{t[taskName.toLowerCase() as keyof typeof t] || taskName}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] ml-1">{t.frequency}</label>
              <select 
                value={frequency} 
                onChange={(e) => setFrequency(e.target.value as any)}
                className="w-full p-4 rounded-2xl bg-emerald-50/50 border-2 border-transparent focus:border-emerald-600 focus:bg-white outline-none transition-all font-bold text-emerald-900"
                required
              >
                <option value="Daily">{t.daily}</option>
                <option value="Weekly">{t.weekly}</option>
                <option value="Bi-weekly">{t.biweekly}</option>
                <option value="Monthly">{t.monthly}</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] ml-1">{t.time}</label>
              <input 
                type="time" 
                value={time} 
                onChange={(e) => setTime(e.target.value)}
                className="w-full p-4 rounded-2xl bg-emerald-50/50 border-2 border-transparent focus:border-emerald-600 focus:bg-white outline-none transition-all font-bold text-emerald-900"
                required
              />
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-4 rounded-2xl font-black text-emerald-600 hover:bg-emerald-50 transition-all border-2 border-transparent hover:border-emerald-100"
            >
              {t.cancel}
            </button>
            <button 
              type="submit"
              className="flex-[2] bg-emerald-600 text-white px-6 py-4 rounded-2xl font-black hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-200"
            >
              {editingReminder ? t.saveReminder : t.addReminder}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState<Language>('en');
  const [scanning, setScanning] = useState(false);
  const [view, setView] = useState<'home' | 'history' | 'result' | 'settings' | 'reminders'>('home');
  const [scans, setScans] = useState<PlantScan[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [currentResult, setCurrentResult] = useState<PlantScan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [answering, setAnswering] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [generalChatHistory, setGeneralChatHistory] = useState<ChatMessage[]>([]);
  const [chatImage, setChatImage] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const t = translations[language];
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatFileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showCamera, setShowCamera] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });

    // Test connection
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    };
    testConnection();

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setScans([]);
      return;
    }

    const q = query(
      collection(db, 'scans'),
      where('userId', '==', user.uid),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PlantScan[];
      setScans(docs);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'scans');
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) {
      setReminders([]);
      return;
    }

    const q = query(
      collection(db, 'reminders'),
      where('userId', '==', user.uid),
      orderBy('nextDue', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const rList: Reminder[] = [];
      snapshot.forEach((doc) => {
        rList.push({ id: doc.id, ...doc.data() } as Reminder);
      });
      setReminders(rList);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'reminders');
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (currentResult && scans.length > 0) {
      const updatedScan = scans.find(s => s.id === currentResult.id);
      if (updatedScan && JSON.stringify(updatedScan) !== JSON.stringify(currentResult)) {
        setCurrentResult(updatedScan);
      }
    }
  }, [scans, currentResult]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      await processImage(base64);
    };
    reader.readAsDataURL(file);
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setShowCamera(true);
      }
    } catch (err) {
      setError(t.cameraAccess);
    }
  };

  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const base64 = canvasRef.current.toDataURL('image/jpeg', 0.8);
        
        // Stop camera
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        setShowCamera(false);
        
        processImage(base64);
      }
    }
  };

  const calculateNextDue = (frequency: Reminder['frequency'], fromDate: number = Date.now()) => {
    const date = new Date(fromDate);
    switch (frequency) {
      case 'Daily':
        date.setDate(date.getDate() + 1);
        break;
      case 'Weekly':
        date.setDate(date.getDate() + 7);
        break;
      case 'Bi-weekly':
        date.setDate(date.getDate() + 14);
        break;
      case 'Monthly':
        date.setMonth(date.getMonth() + 1);
        break;
    }
    return date.getTime();
  };

  const handleSaveReminder = async (reminderData: Omit<Reminder, 'id' | 'userId'>) => {
    if (!user) return;
    try {
      if (editingReminder) {
        await updateDoc(doc(db, 'reminders', editingReminder.id), {
          ...reminderData,
          userId: user.uid
        });
      } else {
        await addDoc(collection(db, 'reminders'), {
          ...reminderData,
          userId: user.uid
        });
      }
      setShowReminderModal(false);
      setEditingReminder(null);
    } catch (err) {
      handleFirestoreError(err, editingReminder ? OperationType.UPDATE : OperationType.CREATE, 'reminders');
    }
  };

  const handleDeleteReminder = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'reminders', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'reminders');
    }
  };

  const handleToggleReminder = async (reminder: Reminder) => {
    try {
      await updateDoc(doc(db, 'reminders', reminder.id), {
        active: !reminder.active
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'reminders');
    }
  };

  const handleCompleteReminder = async (reminder: Reminder) => {
    try {
      const nextDue = calculateNextDue(reminder.frequency);
      await updateDoc(doc(db, 'reminders', reminder.id), {
        lastCompleted: Date.now(),
        nextDue
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'reminders');
    }
  };

  const processImage = async (base64: string) => {
    if (!user) {
      setError(language === 'en' ? "Please sign in to scan plants." : "ශාක ස්කෑන් කිරීමට කරුණාකර ඇතුළු වන්න.");
      return;
    }

    setScanning(true);
    setError(null);
    try {
      const result = await identifyPlant(base64, language);
      
      const scanData: Omit<PlantScan, 'id'> = {
        userId: user.uid,
        imageUrl: base64,
        plantName: result.plantName,
        scientificName: result.scientificName,
        confidence: result.confidence,
        healthStatus: result.healthStatus,
        care: result.care,
        disease: result.disease,
        timestamp: Date.now()
      };

      let docRef;
      try {
        docRef = await addDoc(collection(db, 'scans'), scanData);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'scans');
        return;
      }
      const newScan = { id: docRef.id, ...scanData };
      setCurrentResult(newScan);
      setView('result');
    } catch (err) {
      console.error(err);
      setError(t.failedIdentify);
    } finally {
      setScanning(false);
    }
  };

  const handleAskQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() && !chatImage) return;

    const userMessage: ChatMessage = {
      role: 'user',
      text: question,
      timestamp: Date.now()
    };
    if (chatImage) {
      userMessage.imageUrl = chatImage;
    }

    const currentChatImage = chatImage;
    setAnswering(true);
    setQuestion('');
    setChatImage(null);
    
    // Optimistically update local state
    if (currentResult) {
      setCurrentResult(prev => prev ? {
        ...prev,
        chatHistory: [...(prev.chatHistory || []), userMessage]
      } : null);
    } else {
      setGeneralChatHistory(prev => [...prev, userMessage]);
    }

    try {
      const history = currentResult 
        ? (currentResult.chatHistory || []) 
        : generalChatHistory;
        
      const answer = await getChatResponse(
        question, 
        [...history, userMessage], 
        currentResult?.plantName, 
        language,
        currentChatImage || undefined
      );
      
      const modelMessage: ChatMessage = {
        role: 'model',
        text: answer,
        timestamp: Date.now()
      };

      if (currentResult) {
        // Update Firestore
        try {
          await updateDoc(doc(db, 'scans', currentResult.id), {
            chatHistory: arrayUnion(userMessage, modelMessage)
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `scans/${currentResult.id}`);
        }
        
        setCurrentResult(prev => prev ? {
          ...prev,
          chatHistory: [...(prev.chatHistory || []), modelMessage]
        } : null);
      } else {
        setGeneralChatHistory(prev => [...prev, modelMessage]);
      }
    } catch (err) {
      console.error(err);
      setError(t.failedAnswer);
    } finally {
      setAnswering(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = (reader.result as string).split(',')[1];
          try {
            setAnswering(true);
            const transcribedText = await transcribeAudio(base64Audio, language);
            if (transcribedText) {
              setQuestion(transcribedText);
            }
          } catch (error) {
            console.error('Transcription error:', error);
          } finally {
            setAnswering(false);
          }
        };
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const handlePlayAudio = async (text: string, msgId: string) => {
    if (isPlaying === msgId) {
      audioRef.current?.pause();
      setIsPlaying(null);
      return;
    }

    try {
      setIsPlaying(msgId);
      const base64Audio = await generateSpeech(text);
      if (base64Audio) {
        const audioUrl = `data:audio/mp3;base64,${base64Audio}`;
        if (audioRef.current) {
          audioRef.current.src = audioUrl;
          audioRef.current.play();
          audioRef.current.onended = () => setIsPlaying(null);
        } else {
          const audio = new Audio(audioUrl);
          audioRef.current = audio;
          audio.play();
          audio.onended = () => setIsPlaying(null);
        }
      }
    } catch (error) {
      console.error('TTS error:', error);
      setIsPlaying(null);
    }
  };

  const handleChatImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setChatImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };
  const deleteScan = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'scans', id));
      if (currentResult?.id === id) {
        setView('home');
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `scans/${id}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-emerald-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-emerald-600 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-emerald-50 flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-emerald-200/30 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 animate-pulse" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-emerald-300/20 rounded-full blur-3xl translate-x-1/2 translate-y-1/2 animate-pulse" />
        <div className="absolute top-1/2 left-1/2 w-[800px] h-[800px] bg-white/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        
        {/* Floating leaves decoration */}
        <motion.div 
          animate={{ 
            y: [0, -20, 0],
            rotate: [0, 10, 0]
          }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-20 right-[20%] text-emerald-200/40 hidden lg:block"
        >
          <Leaf className="w-24 h-24" />
        </motion.div>
        <motion.div 
          animate={{ 
            y: [0, 20, 0],
            rotate: [0, -15, 0]
          }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="absolute bottom-40 left-[15%] text-emerald-200/30 hidden lg:block"
        >
          <Leaf className="w-32 h-32" />
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="max-w-md w-full bg-white/90 backdrop-blur-2xl rounded-[4rem] shadow-[0_32px_64px_-12px_rgba(6,78,59,0.15)] p-12 border border-white relative z-10"
        >
          <div className="w-28 h-28 bg-emerald-600 rounded-[3rem] flex items-center justify-center mx-auto mb-10 shadow-2xl shadow-emerald-200 relative">
            <Leaf className="w-14 h-14 text-white" />
            <div className="absolute -inset-4 bg-emerald-600/20 rounded-[3.5rem] animate-ping duration-[3000ms]" />
          </div>
          <h1 className="text-5xl font-black text-emerald-950 mb-4 tracking-tighter">{t.appName}</h1>
          <p className="text-emerald-600 font-medium mb-12 leading-relaxed text-lg">
            {t.loginDesc}
          </p>
          <button 
            onClick={signInWithGoogle}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-6 px-8 rounded-[2.5rem] transition-all flex items-center justify-center gap-4 shadow-2xl shadow-emerald-200 group active:scale-95"
          >
            <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <User className="w-6 h-6" />
            </div>
            <span className="text-xl">{t.signInGoogle}</span>
          </button>
          
          <div className="mt-14 pt-10 border-t border-emerald-50">
            <div className="flex items-center justify-center gap-2 mb-2">
              <div className="w-1 h-1 rounded-full bg-emerald-300" />
              <div className="w-1 h-1 rounded-full bg-emerald-400" />
              <div className="w-1 h-1 rounded-full bg-emerald-300" />
            </div>
            <p className="text-[10px] font-black text-emerald-300 uppercase tracking-[0.4em]">Powered by Gemini AI</p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-emerald-50 text-emerald-900 font-sans selection:bg-emerald-200 flex flex-col md:flex-row">
      {/* Desktop Sidebar */}
      <aside className={`hidden md:flex bg-white border-r border-emerald-100 flex-col sticky top-0 h-screen z-50 transition-all duration-300 ${sidebarCollapsed ? 'w-20' : 'w-72'}`}>
        <div className={`p-6 flex items-center gap-3 border-b border-emerald-50 ${sidebarCollapsed ? 'justify-center' : ''}`}>
          <div className="w-10 h-10 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200 flex-shrink-0">
            <Leaf className="w-6 h-6 text-white" />
          </div>
          {!sidebarCollapsed && <span className="font-black text-2xl tracking-tighter text-emerald-950">{t.appName}</span>}
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
          <button 
            onClick={() => setView('home')}
            className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all group ${view === 'home' ? 'bg-emerald-600 text-white shadow-xl shadow-emerald-200' : 'hover:bg-emerald-50 text-emerald-700'}`}
          >
            <Home className={`w-6 h-6 transition-transform group-hover:scale-110 ${view === 'home' ? 'text-white' : 'text-emerald-500'}`} />
            {!sidebarCollapsed && <span className="font-bold text-lg">{t.home}</span>}
          </button>
          
          <button 
            onClick={() => setView('history')}
            className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all group ${view === 'history' ? 'bg-emerald-600 text-white shadow-xl shadow-emerald-200' : 'hover:bg-emerald-50 text-emerald-700'}`}
          >
            <History className={`w-6 h-6 transition-transform group-hover:scale-110 ${view === 'history' ? 'text-white' : 'text-emerald-500'}`} />
            {!sidebarCollapsed && <span className="font-bold text-lg">{t.history}</span>}
          </button>
          
          <button 
            onClick={() => setView('reminders')}
            className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all group ${view === 'reminders' ? 'bg-emerald-600 text-white shadow-xl shadow-emerald-200' : 'hover:bg-emerald-50 text-emerald-700'}`}
          >
            <Bell className={`w-6 h-6 transition-transform group-hover:scale-110 ${view === 'reminders' ? 'text-white' : 'text-emerald-500'}`} />
            {!sidebarCollapsed && <span className="font-bold text-lg">{t.reminders}</span>}
          </button>
          
          <button 
            onClick={() => setView('settings')}
            className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all group ${view === 'settings' ? 'bg-emerald-600 text-white shadow-xl shadow-emerald-200' : 'hover:bg-emerald-50 text-emerald-700'}`}
          >
            <Settings className={`w-6 h-6 transition-transform group-hover:scale-110 ${view === 'settings' ? 'text-white' : 'text-emerald-500'}`} />
            {!sidebarCollapsed && <span className="font-bold text-lg">{t.settings}</span>}
          </button>
        </nav>

        <div className="p-4 space-y-4">
          <button 
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden lg:flex w-full items-center justify-center p-3 hover:bg-emerald-50 text-emerald-400 rounded-xl transition-colors"
          >
            {sidebarCollapsed ? <ChevronRight className="w-6 h-6" /> : <ChevronLeft className="w-6 h-6" />}
          </button>

          <div className={`flex items-center gap-3 p-3 bg-emerald-50 rounded-[2rem] border border-emerald-100 ${sidebarCollapsed ? 'justify-center' : ''}`}>
            <div className="w-10 h-10 rounded-2xl bg-white shadow-sm flex items-center justify-center overflow-hidden flex-shrink-0 border border-emerald-100">
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.displayName || ''} className="w-full h-full object-cover" />
              ) : (
                <User className="w-5 h-5 text-emerald-600" />
              )}
            </div>
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-emerald-950 truncate">{user.displayName}</p>
                <button onClick={() => auth.signOut()} className="text-[10px] font-bold text-emerald-600 hover:underline uppercase tracking-widest">{t.logout}</button>
              </div>
            )}
            {!sidebarCollapsed && <LogOut className="w-5 h-5 text-emerald-300 cursor-pointer hover:text-red-500 transition-colors" onClick={() => auth.signOut()} />}
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="md:hidden bg-white/70 backdrop-blur-xl sticky top-0 z-40 border-b border-emerald-50 px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('home')}>
            <div className="w-8 h-8 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-100">
              <Leaf className="w-4 h-4 text-white" />
            </div>
            <span className="font-black text-lg tracking-tighter text-emerald-950">{t.appName}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center border border-emerald-100">
              <Globe className="w-4 h-4 text-emerald-600" />
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-5xl mx-auto w-full p-4 md:p-6 lg:p-8 pb-28 md:pb-8">
        <AnimatePresence mode="wait">
          {view === 'home' && (
            <motion.div 
              key="home"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <div className="text-center space-y-2 max-w-xl mx-auto">
                <h2 className="text-2xl md:text-3xl lg:text-4xl font-black tracking-tight text-emerald-950">
                  {language === 'en' ? `Hi, ${user.displayName?.split(' ')[0]}!` : `ආයුබෝවන්, ${user.displayName?.split(' ')[0]}!`}
                </h2>
                <p className="text-emerald-600 text-base md:text-lg font-medium opacity-70">{t.scanPlant}</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                <button 
                  onClick={startCamera}
                  className="bg-white border border-emerald-100 p-5 md:p-8 rounded-3xl flex flex-col items-center gap-4 hover:border-emerald-500 hover:shadow-xl hover:-translate-y-1 transition-all group shadow-sm"
                >
                  <div className="w-14 h-14 md:w-20 md:h-20 bg-emerald-50 rounded-2xl md:rounded-3xl flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300">
                    <Camera className="w-7 h-7 md:w-10 md:h-10" />
                  </div>
                  <div className="text-center">
                    <span className="block font-bold text-base md:text-xl mb-0.5">{t.identifyPlant}</span>
                    <span className="text-[10px] md:text-sm text-emerald-500 font-medium opacity-60 hidden sm:block">{language === 'en' ? 'Use camera' : 'කැමරාව'}</span>
                  </div>
                </button>

                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-white border border-emerald-100 p-5 md:p-8 rounded-3xl flex flex-col items-center gap-4 hover:border-emerald-500 hover:shadow-xl hover:-translate-y-1 transition-all group shadow-sm"
                >
                  <div className="w-14 h-14 md:w-20 md:h-20 bg-emerald-50 rounded-2xl md:rounded-3xl flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300">
                    <Upload className="w-7 h-7 md:w-10 md:h-10" />
                  </div>
                  <div className="text-center">
                    <span className="block font-bold text-base md:text-xl mb-0.5">{t.uploadImage}</span>
                    <span className="text-[10px] md:text-sm text-emerald-500 font-medium opacity-60 hidden sm:block">{t.chooseGallery}</span>
                  </div>
                </button>

                <button 
                  onClick={() => { setCurrentResult(null); setView('result'); setAiAnswer(null); setQuestion(''); }}
                  className="bg-white border border-emerald-100 p-5 md:p-8 rounded-3xl flex flex-col items-center gap-4 hover:border-emerald-500 hover:shadow-xl hover:-translate-y-1 transition-all group col-span-2 lg:col-span-1 shadow-sm"
                >
                  <div className="w-14 h-14 md:w-20 md:h-20 bg-emerald-50 rounded-2xl md:rounded-3xl flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300">
                    <Zap className="w-7 h-7 md:w-10 md:h-10" />
                  </div>
                  <div className="text-center">
                    <span className="block font-bold text-base md:text-xl mb-0.5">{t.askQuestion}</span>
                    <span className="text-[10px] md:text-sm text-emerald-500 font-medium opacity-60 hidden sm:block">{t.getAdvice}</span>
                  </div>
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*" 
                  onChange={handleFileUpload}
                />
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between px-2">
                  <h3 className="font-bold text-2xl text-emerald-950">{t.recentScans}</h3>
                  <button 
                    onClick={() => setView('history')} 
                    className="text-emerald-600 text-sm font-bold hover:text-emerald-700 transition-colors flex items-center gap-1"
                  >
                    {language === 'en' ? 'View All' : 'සියල්ල බලන්න'}
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {scans.length === 0 ? (
                    <div className="col-span-full py-12 text-center bg-white/50 rounded-3xl border border-dashed border-emerald-200">
                      <p className="text-emerald-400 font-medium">{t.noScans}</p>
                    </div>
                  ) : (
                    scans.slice(0, 4).map(scan => (
                      <motion.div 
                        key={scan.id} 
                        whileHover={{ y: -4 }}
                        onClick={() => { setCurrentResult(scan); setView('result'); }}
                        className="bg-white rounded-3xl overflow-hidden shadow-sm border border-emerald-100 cursor-pointer hover:shadow-xl transition-all group"
                      >
                        <div className="relative aspect-[4/3] overflow-hidden">
                          <img 
                            src={scan.imageUrl} 
                            alt={scan.plantName} 
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                            referrerPolicy="no-referrer" 
                          />
                          <div className="absolute top-3 right-3">
                            <div className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider shadow-lg backdrop-blur-md ${
                              scan.healthStatus === 'Excellent' ? 'bg-emerald-500/90 text-white' :
                              scan.healthStatus === 'Good' ? 'bg-blue-500/90 text-white' :
                              scan.healthStatus === 'Fair' ? 'bg-orange-500/90 text-white' :
                              'bg-red-500/90 text-white'
                            }`}>
                              {scan.healthStatus}
                            </div>
                          </div>
                        </div>
                        <div className="p-5">
                          <p className="font-bold text-lg text-emerald-950 truncate mb-1">{scan.plantName}</p>
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-emerald-500 font-medium flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(scan.timestamp).toLocaleDateString()}
                            </p>
                            <ChevronRight className="w-4 h-4 text-emerald-300 group-hover:text-emerald-600 transition-colors" />
                          </div>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* Settings View */}
          {view === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8 max-w-2xl mx-auto"
            >
              <div className="flex items-center gap-4 mb-2">
                <button 
                  onClick={() => setView('home')}
                  className="p-2.5 bg-white rounded-2xl shadow-sm hover:shadow-md transition-all text-emerald-600"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h2 className="text-2xl font-black text-emerald-950 tracking-tight">{t.settings}</h2>
              </div>

              {/* Profile Section */}
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-emerald-100 space-y-6">
                <div>
                  <h3 className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] mb-5">{t.account}</h3>
                  <div className="flex flex-col sm:flex-row items-center gap-5">
                    <div className="w-20 h-20 rounded-2xl bg-emerald-50 flex items-center justify-center overflow-hidden border-4 border-white shadow-lg">
                      {user?.photoURL ? (
                        <img src={user.photoURL} alt={user.displayName || ''} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <User className="w-8 h-8 text-emerald-600" />
                      )}
                    </div>
                    <div className="text-center sm:text-left">
                      <p className="font-black text-xl text-emerald-950 mb-0.5">{user?.displayName}</p>
                      <p className="text-emerald-600 text-sm font-medium">{user?.email}</p>
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <button 
                    onClick={logOut}
                    className="w-full flex items-center justify-between p-4 bg-red-50 hover:bg-red-100 text-red-700 rounded-2xl transition-all font-bold group text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                        <LogOut className="w-4 h-4" />
                      </div>
                      <span>{t.logout}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 opacity-30 group-hover:opacity-100 transition-all" />
                  </button>
                </div>
              </div>

              {/* Language Section */}
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-emerald-100">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                    <Globe className="w-4 h-4" />
                  </div>
                  <h3 className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em]">{t.language}</h3>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {(Object.keys(languageNames) as Language[]).map((langCode) => (
                    <button 
                      key={langCode}
                      onClick={() => setLanguage(langCode)}
                      className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${language === langCode ? 'border-emerald-600 bg-emerald-50 text-emerald-950 shadow-inner' : 'border-emerald-50 hover:border-emerald-200 text-emerald-700'}`}
                    >
                      <span className="font-bold text-sm">{languageNames[langCode]}</span>
                      {language === langCode && (
                        <div className="w-5 h-5 bg-emerald-600 rounded-full flex items-center justify-center shadow-lg">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="text-center pt-8">
                <p className="text-emerald-300 text-[10px] font-black uppercase tracking-[0.3em]">FloraScan AI • Version 1.2.0</p>
              </div>
            </motion.div>
          )}

          {view === 'history' && (
            <motion.div 
              key="history"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8 pb-24"
            >
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-wider">
                    <History className="w-3 h-3" />
                    {t.history}
                  </div>
                  <h2 className="text-3xl sm:text-4xl font-black text-emerald-950 tracking-tight">
                    {t.recentScans}
                  </h2>
                  <p className="text-emerald-600/60 font-medium text-sm">
                    {scans.length} {scans.length === 1 ? t.scanFound : t.scansFound}
                  </p>
                </div>
                <button 
                  onClick={() => setView('home')} 
                  className="p-3 bg-white rounded-2xl shadow-sm hover:shadow-md transition-all text-emerald-600 flex items-center gap-2 font-bold group text-sm self-start sm:self-auto"
                >
                  <ChevronLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                  {t.backToHome}
                </button>
              </div>

              {scans.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-3xl p-10 text-center border-2 border-dashed border-emerald-50"
                >
                  <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <Leaf className="w-8 h-8 text-emerald-200" />
                  </div>
                  <h3 className="text-xl font-black text-emerald-900 mb-2">{t.noScans}</h3>
                  <button 
                    onClick={() => setView('home')}
                    className="bg-emerald-600 text-white px-8 py-3.5 rounded-2xl font-black hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 inline-flex items-center gap-2 text-sm"
                  >
                    <Camera className="w-4 h-4" />
                    {t.scanNow}
                  </button>
                </motion.div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                  {scans.map((scan, index) => (
                    <motion.div
                      key={scan.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => {
                        setCurrentResult(scan);
                        setView('result');
                      }}
                      className="group bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all cursor-pointer border border-emerald-50 flex flex-col h-full"
                    >
                      <div className="relative aspect-square overflow-hidden">
                        <img 
                          src={scan.imageUrl} 
                          alt={scan.plantName}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        
                        <div className="absolute top-3 right-3">
                          <div className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider shadow-lg backdrop-blur-md ${
                            scan.healthStatus === 'Excellent' || scan.healthStatus === 'Good'
                              ? 'bg-emerald-500/90 text-white' 
                              : 'bg-amber-500/90 text-white'
                          }`}>
                            {scan.healthStatus === 'Excellent' || scan.healthStatus === 'Good' ? t.healthy : t.actionRequired}
                          </div>
                        </div>
                      </div>

                      <div className="p-4 flex flex-col flex-grow">
                        <h3 className="text-base font-black text-emerald-950 group-hover:text-emerald-600 transition-colors line-clamp-1 mb-1">
                          {scan.plantName}
                        </h3>
                        <div className="flex items-center gap-1.5 text-emerald-400 mb-3">
                          <Calendar className="w-3 h-3" />
                          <span className="text-[10px] font-bold uppercase tracking-wider">
                            {new Date(scan.timestamp).toLocaleDateString()}
                          </span>
                        </div>
                        
                        <div className="mt-auto pt-3 border-t border-emerald-50 flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[9px] font-black text-emerald-400 uppercase tracking-[0.1em]">
                              {(scan.confidence * 100).toFixed(0)}%
                            </span>
                          </div>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteScan(scan.id);
                            }}
                            className="p-1.5 text-emerald-200 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {view === 'result' && (
            <motion.div 
              key="result"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8 pb-24 md:pb-8"
            >
              <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-start">
                {/* Left Column: Image and Basic Info */}
                <div className="w-full lg:w-[45%] lg:sticky lg:top-8 space-y-8">
                  {currentResult ? (
                    <div className="relative group">
                      {/* Header Overlay */}
                      <div className="absolute top-6 left-6 right-6 z-10 flex items-center justify-between">
                        <button 
                          onClick={() => setView('home')} 
                          className="p-3 bg-white/20 backdrop-blur-xl hover:bg-white/40 rounded-2xl transition-all text-white shadow-lg"
                        >
                          <ChevronLeft className="w-6 h-6" />
                        </button>
                        <div className="flex items-center gap-2 bg-emerald-500/90 backdrop-blur-xl px-4 py-2 rounded-2xl border border-emerald-400/50 shadow-2xl">
                          <Zap className="w-4 h-4 text-white" />
                          <span className="text-xs font-bold text-white uppercase tracking-widest">
                            {(currentResult.confidence * 100).toFixed(0)}% {t.confidence}
                          </span>
                        </div>
                      </div>

                      {/* Main Image */}
                      <div className="relative rounded-3xl overflow-hidden shadow-xl aspect-square bg-emerald-100 border-4 border-white group-hover:shadow-emerald-200/50 transition-all duration-500">
                        <img 
                          src={currentResult.imageUrl} 
                          alt={currentResult.plantName} 
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                          referrerPolicy="no-referrer" 
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />
                        <div className="absolute bottom-0 left-0 right-0 p-6 pt-16">
                          <motion.h2 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-3xl md:text-4xl font-black text-white leading-tight mb-1 drop-shadow-2xl"
                          >
                            {currentResult.plantName}
                          </motion.h2>
                          <p className="text-emerald-300 italic text-lg font-medium drop-shadow-lg">{currentResult.scientificName}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4">
                      <button onClick={() => setView('home')} className="p-3 bg-white rounded-2xl shadow-sm hover:shadow-md transition-all">
                        <ChevronLeft className="w-6 h-6" />
                      </button>
                      <h2 className="text-3xl font-bold text-emerald-950">{t.botanistAi}</h2>
                    </div>
                  )}

                  {currentResult && (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className={`p-6 rounded-3xl flex items-center gap-5 shadow-sm border ${
                        currentResult.healthStatus === 'Excellent' ? 'bg-emerald-50 border-emerald-100' :
                        currentResult.healthStatus === 'Good' ? 'bg-blue-50 border-blue-100' :
                        currentResult.healthStatus === 'Fair' ? 'bg-orange-50 border-orange-100' :
                        currentResult.healthStatus === 'Poor' ? 'bg-red-50 border-red-100' :
                        'bg-gray-50 border-gray-100'
                      }`}
                    >
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner ${
                        currentResult.healthStatus === 'Excellent' ? 'bg-emerald-100 text-emerald-600' :
                        currentResult.healthStatus === 'Good' ? 'bg-blue-100 text-blue-600' :
                        currentResult.healthStatus === 'Fair' ? 'bg-orange-100 text-orange-600' :
                        currentResult.healthStatus === 'Poor' ? 'bg-red-100 text-red-600' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {currentResult.healthStatus === 'Excellent' || currentResult.healthStatus === 'Good' ? <CheckCircle2 className="w-7 h-7" /> :
                         <AlertTriangle className="w-7 h-7" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <h3 className="font-bold text-lg text-emerald-950">{t.healthStatus}</h3>
                          <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-sm ${
                            currentResult.healthStatus === 'Excellent' ? 'bg-emerald-600 text-white' :
                            currentResult.healthStatus === 'Good' ? 'bg-blue-600 text-white' :
                            currentResult.healthStatus === 'Fair' ? 'bg-orange-600 text-white' :
                            currentResult.healthStatus === 'Poor' ? 'bg-red-600 text-white' :
                            'bg-gray-600 text-white'
                          }`}>
                            {currentResult.healthStatus 
                              ? t[currentResult.healthStatus.toLowerCase() as keyof typeof t] 
                              : (currentResult.disease.detected ? t.poor : t.excellent)}
                          </span>
                        </div>
                        <p className="text-emerald-800/80 font-medium text-sm">
                          {currentResult.disease.detected 
                            ? `${currentResult.disease.name}`
                            : t.noDiseases}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Right Column: Details and Chat */}
                <div className="w-full lg:flex-1 space-y-8">
                  {currentResult ? (
                    <>
                      {currentResult.disease.detected && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-6">
                          {/* Symptoms List */}
                          {currentResult.disease.symptomsList && currentResult.disease.symptomsList.length > 0 && (
                            <div className="bg-white p-6 rounded-3xl border border-orange-100 shadow-sm space-y-3">
                              <h4 className="font-bold text-base flex items-center gap-2 text-orange-700">
                                <AlertTriangle className="w-4 h-4" />
                                {t.symptoms}
                              </h4>
                              <ul className="space-y-2">
                                {currentResult.disease.symptomsList.map((s, i) => (
                                  <li key={i} className="flex items-start gap-2 text-emerald-900 font-medium text-sm">
                                    <div className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-1.5 flex-shrink-0" />
                                    {s}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Treatment Steps */}
                          <div className="bg-white p-6 rounded-3xl border border-emerald-100 shadow-sm space-y-3">
                            <h4 className="font-bold text-base flex items-center gap-2 text-emerald-700">
                              <Zap className="w-4 h-4" />
                              {t.treatmentPlan}
                            </h4>
                            <p className="text-emerald-800 leading-relaxed font-medium text-sm">{currentResult.disease.treatment}</p>
                            {currentResult.disease.treatmentSteps && currentResult.disease.treatmentSteps.length > 0 && (
                              <div className="space-y-3 mt-3">
                                {currentResult.disease.treatmentSteps.map((s, i) => (
                                  <div key={i} className="flex gap-3 items-start">
                                    <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs flex-shrink-0">
                                      {i + 1}
                                    </div>
                                    <p className="text-emerald-900 font-medium pt-1 text-sm">{s}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Care Guide */}
                      <div className="space-y-6">
                        <div className="flex items-center justify-between px-4">
                          <h3 className="text-2xl font-bold text-emerald-950">{t.careGuide}</h3>
                          <button 
                            onClick={() => {
                              setEditingReminder(null);
                              setShowReminderModal(true);
                            }}
                            className="flex items-center gap-2 text-emerald-600 font-bold text-sm bg-emerald-50 px-5 py-2.5 rounded-2xl hover:bg-emerald-100 transition-all shadow-sm"
                          >
                            <Bell className="w-4 h-4" />
                            {t.addReminder}
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                          <div className="bg-white p-6 rounded-[2.5rem] border border-emerald-50 shadow-sm hover:shadow-md transition-all flex items-center gap-5">
                            <div className="w-14 h-14 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center shadow-inner">
                              <Droplets className="w-7 h-7" />
                            </div>
                            <div>
                              <span className="block text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">{t.watering}</span>
                              <p className="text-emerald-950 font-bold">{currentResult.care.watering}</p>
                            </div>
                          </div>
                          <div className="bg-white p-6 rounded-[2.5rem] border border-emerald-50 shadow-sm hover:shadow-md transition-all flex items-center gap-5">
                            <div className="w-14 h-14 bg-yellow-50 text-yellow-500 rounded-2xl flex items-center justify-center shadow-inner">
                              <Sun className="w-7 h-7" />
                            </div>
                            <div>
                              <span className="block text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">{t.sunlight}</span>
                              <p className="text-emerald-950 font-bold">{currentResult.care.sunlight}</p>
                            </div>
                          </div>
                          <div className="bg-white p-6 rounded-[2.5rem] border border-emerald-50 shadow-sm hover:shadow-md transition-all flex items-center gap-5">
                            <div className="w-14 h-14 bg-amber-50 text-amber-700 rounded-2xl flex items-center justify-center shadow-inner">
                              <Sprout className="w-7 h-7" />
                            </div>
                            <div>
                              <span className="block text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">{t.soil}</span>
                              <p className="text-emerald-950 font-bold">{currentResult.care.soil}</p>
                            </div>
                          </div>
                          <div className="bg-white p-6 rounded-[2.5rem] border border-emerald-50 shadow-sm hover:shadow-md transition-all flex items-center gap-5">
                            <div className="w-14 h-14 bg-purple-50 text-purple-500 rounded-2xl flex items-center justify-center shadow-inner">
                              <Zap className="w-7 h-7" />
                            </div>
                            <div>
                              <span className="block text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">{t.fertilizer}</span>
                              <p className="text-emerald-950 font-bold">{currentResult.care.fertilizer}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-center space-y-6 py-12">
                      <div className="w-24 h-24 bg-emerald-100 rounded-[2.5rem] flex items-center justify-center mx-auto shadow-inner">
                        <Zap className="w-12 h-12 text-emerald-600" />
                      </div>
                      <h2 className="text-4xl font-bold text-emerald-950">{t.botanistAi}</h2>
                      <p className="text-emerald-600 text-lg font-medium">{t.askAnything}</p>
                    </div>
                  )}

                  {/* Chat Section */}
                  <div className="bg-white rounded-[3rem] border border-emerald-100 shadow-xl overflow-hidden flex flex-col min-h-[500px] lg:min-h-[600px]">
                    <div className="p-8 border-b border-emerald-50 bg-emerald-50/30">
                      <h3 className="text-2xl font-bold flex items-center gap-3 text-emerald-950">
                        <Zap className="w-6 h-6 text-emerald-600" />
                        {t.botanistAi}
                      </h3>
                      <p className="text-emerald-600 font-medium mt-1">
                        {currentResult 
                          ? `${t.haveQuestions} ${currentResult.plantName}?`
                          : t.askAnything}
                      </p>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 p-6 overflow-y-auto max-h-[400px] space-y-4 bg-white custom-scrollbar">
                      {(currentResult?.chatHistory || generalChatHistory).length === 0 ? (
                        <div className="text-center py-10 text-emerald-400">
                          <Zap className="w-12 h-12 mx-auto mb-3 opacity-20" />
                          <p>{t.whatToKnow}</p>
                        </div>
                      ) : (
                        (currentResult?.chatHistory || generalChatHistory).map((msg, idx) => (
                          <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                          >
                            <div className={`max-w-[85%] p-4 rounded-2xl text-sm ${
                              msg.role === 'user' 
                                ? 'bg-emerald-600 text-white rounded-tr-none' 
                                : 'bg-emerald-50 text-emerald-900 rounded-tl-none border border-emerald-100'
                            }`}>
                              {msg.imageUrl && (
                                <img 
                                  src={msg.imageUrl} 
                                  alt="Chat attachment" 
                                  className="w-full h-auto rounded-lg mb-2 border border-white/20"
                                  referrerPolicy="no-referrer"
                                />
                              )}
                              <p className="whitespace-pre-wrap">{msg.text}</p>
                              <div className="flex items-center justify-between mt-2">
                                <p className={`text-[10px] opacity-50 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                                {msg.role === 'model' && (
                                  <button 
                                    onClick={() => handlePlayAudio(msg.text, idx.toString())}
                                    className={`p-1.5 rounded-full transition-all ${
                                      isPlaying === idx.toString() 
                                        ? 'bg-emerald-500 text-white animate-pulse' 
                                        : 'bg-white/20 text-emerald-900 hover:bg-white/40'
                                    }`}
                                    title={t.listenToResponse}
                                  >
                                    {isPlaying === idx.toString() ? <Pause className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                                  </button>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        ))
                      )}
                      {answering && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="flex justify-start"
                        >
                          <div className="bg-emerald-50 text-emerald-900 p-4 rounded-2xl rounded-tl-none border border-emerald-100">
                            <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                          </div>
                        </motion.div>
                      )}
                    </div>
                    
                    {/* Input Area */}
                    <div className="p-4 bg-emerald-50/30 border-t border-emerald-50">
                      {chatImage && (
                        <div className="mb-3 relative inline-block">
                          <img 
                            src={chatImage} 
                            alt="Preview" 
                            className="w-20 h-20 object-cover rounded-xl border-2 border-emerald-500"
                            referrerPolicy="no-referrer"
                          />
                          <button 
                            onClick={() => setChatImage(null)}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                      <form onSubmit={handleAskQuestion} className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => chatFileInputRef.current?.click()}
                          className="bg-white border border-emerald-100 text-emerald-600 p-3 rounded-xl hover:bg-emerald-50 transition-all"
                        >
                          <Upload className="w-5 h-5" />
                        </button>
                        <input 
                          type="file"
                          ref={chatFileInputRef}
                          className="hidden"
                          accept="image/*"
                          onChange={handleChatImageUpload}
                        />
                        <button
                          type="button"
                          onMouseDown={startRecording}
                          onMouseUp={stopRecording}
                          onTouchStart={startRecording}
                          onTouchEnd={stopRecording}
                          className={`p-3 rounded-xl transition-all shadow-md ${
                            isRecording 
                              ? 'bg-red-500 text-white animate-pulse scale-110' 
                              : 'bg-white border border-emerald-100 text-emerald-600 hover:bg-emerald-50'
                          }`}
                          title={t.holdToRecord}
                        >
                          {isRecording ? <StopCircle className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                        </button>
                        <input
                          type="text"
                          value={question}
                          onChange={(e) => setQuestion(e.target.value)}
                          placeholder={t.placeholderQuestion}
                          className="flex-1 bg-white border border-emerald-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                        />
                        <button
                          type="submit"
                          disabled={answering || (!question.trim() && !chatImage)}
                          className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white p-3 rounded-xl transition-all shadow-md shadow-emerald-100"
                        >
                          <Zap className="w-5 h-5" />
                        </button>
                      </form>
                      {(currentResult?.chatHistory || generalChatHistory).length > 0 && (
                        <button 
                          onClick={() => {
                            if (currentResult) {
                              updateDoc(doc(db, 'scans', currentResult.id), { chatHistory: [] });
                              setCurrentResult(prev => prev ? { ...prev, chatHistory: [] } : null);
                            } else {
                              setGeneralChatHistory([]);
                            }
                          }}
                          className="mt-2 text-[10px] font-bold text-emerald-400 hover:text-emerald-600 uppercase tracking-wider"
                        >
                          {t.clearAnswer}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {view === 'reminders' && (
            <motion.div 
              key="reminders"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8 pb-24"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <button 
                    onClick={() => setView('home')} 
                    className="p-3 bg-white rounded-2xl shadow-sm hover:shadow-md transition-all text-emerald-600"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <h2 className="text-3xl font-bold text-emerald-950">{t.reminders}</h2>
                </div>
                <button 
                  onClick={() => { setEditingReminder(null); setShowReminderModal(true); }}
                  className="p-4 bg-emerald-600 text-white rounded-[1.5rem] hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-200 flex items-center gap-2 group"
                >
                  <Plus className="w-6 h-6 transition-transform group-hover:rotate-90" />
                  <span className="hidden sm:inline font-bold">{t.addReminder}</span>
                </button>
              </div>

              {reminders.length === 0 ? (
                <div className="text-center py-32 space-y-6 bg-white/50 rounded-[3rem] border-2 border-dashed border-emerald-100">
                  <div className="w-24 h-24 bg-emerald-100 rounded-[2.5rem] flex items-center justify-center mx-auto shadow-inner">
                    <Bell className="w-12 h-12 text-emerald-400" />
                  </div>
                  <p className="text-emerald-600 text-lg font-medium">{t.noReminders}</p>
                  <button 
                    onClick={() => { setEditingReminder(null); setShowReminderModal(true); }}
                    className="bg-emerald-600 text-white px-8 py-3 rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
                  >
                    {t.addReminder}
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {reminders.map(reminder => (
                    <motion.div 
                      key={reminder.id}
                      layout
                      className={`bg-white rounded-[2.5rem] p-6 border-2 transition-all relative overflow-hidden group ${reminder.active ? 'border-emerald-50 shadow-sm hover:shadow-xl' : 'border-gray-100 opacity-60 grayscale'}`}
                    >
                      <div className="flex items-start justify-between mb-6">
                        <div className="flex items-center gap-4">
                          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner ${
                            reminder.task === 'Watering' ? 'bg-blue-50 text-blue-500' :
                            reminder.task === 'Fertilizing' ? 'bg-purple-50 text-purple-500' :
                            reminder.task === 'Pruning' ? 'bg-amber-50 text-amber-600' :
                            'bg-emerald-50 text-emerald-600'
                          }`}>
                            {reminder.task === 'Watering' ? <Droplets className="w-7 h-7" /> :
                             reminder.task === 'Fertilizing' ? <Zap className="w-7 h-7" /> :
                             reminder.task === 'Pruning' ? <Sprout className="w-7 h-7" /> :
                             <Sprout className="w-7 h-7" />}
                          </div>
                          <div>
                            <h3 className="font-black text-xl text-emerald-950 leading-tight">{reminder.plantName}</h3>
                            <p className="text-sm font-bold text-emerald-500 uppercase tracking-widest mt-0.5">{t[reminder.task.toLowerCase() as keyof typeof t] || reminder.task}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => { setEditingReminder(reminder); setShowReminderModal(true); }}
                            className="p-2.5 hover:bg-emerald-50 rounded-xl text-emerald-300 hover:text-emerald-600 transition-all"
                          >
                            <Settings className="w-5 h-5" />
                          </button>
                          <button 
                            onClick={() => handleDeleteReminder(reminder.id)}
                            className="p-2.5 hover:bg-red-50 rounded-xl text-emerald-200 hover:text-red-500 transition-all"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mb-6">
                        <div className="bg-emerald-50/50 p-3 rounded-2xl flex items-center gap-3">
                          <Clock className="w-4 h-4 text-emerald-400" />
                          <span className="text-xs font-bold text-emerald-900">{reminder.time}</span>
                        </div>
                        <div className="bg-emerald-50/50 p-3 rounded-2xl flex items-center gap-3">
                          <Calendar className="w-4 h-4 text-emerald-400" />
                          <span className="text-xs font-bold text-emerald-900">{new Date(reminder.nextDue).toLocaleDateString()}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => handleCompleteReminder(reminder)}
                          className="flex-1 bg-emerald-600 text-white py-4 rounded-2xl font-black text-sm hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-100"
                        >
                          <Check className="w-5 h-5" />
                          {t.markCompleted}
                        </button>
                        <button 
                          onClick={() => handleToggleReminder(reminder)}
                          className={`p-4 rounded-2xl border-2 transition-all ${reminder.active ? 'border-emerald-100 text-emerald-600 bg-white hover:bg-emerald-50' : 'border-gray-200 text-gray-400 bg-gray-50'}`}
                        >
                          <Zap className="w-5 h-5" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Mobile Bottom Navigation */}
      {user && view !== 'result' && !scanning && !showCamera && (
        <div className="md:hidden fixed bottom-6 left-6 right-6 z-40">
          <div className="bg-white/80 backdrop-blur-2xl border border-emerald-100 p-1.5 rounded-[2rem] shadow-[0_20px_40px_-12px_rgba(6,78,59,0.2)] flex items-center justify-around">
            <button 
              onClick={() => setView('home')}
              className={`p-3.5 rounded-[1.5rem] transition-all relative ${view === 'home' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200 scale-105' : 'text-emerald-400 hover:text-emerald-600'}`}
            >
              <Home className="w-5 h-5" />
              {view === 'home' && <motion.div layoutId="nav-dot" className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-white rounded-full" />}
            </button>
            <button 
              onClick={() => setView('history')}
              className={`p-3.5 rounded-[1.5rem] transition-all relative ${view === 'history' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200 scale-105' : 'text-emerald-400 hover:text-emerald-600'}`}
            >
              <History className="w-5 h-5" />
              {view === 'history' && <motion.div layoutId="nav-dot" className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-white rounded-full" />}
            </button>
            <button 
              onClick={() => setView('reminders')}
              className={`p-3.5 rounded-[1.5rem] transition-all relative ${view === 'reminders' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200 scale-105' : 'text-emerald-400 hover:text-emerald-600'}`}
            >
              <Bell className="w-5 h-5" />
              {view === 'reminders' && <motion.div layoutId="nav-dot" className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-white rounded-full" />}
            </button>
            <button 
              onClick={() => setView('settings')}
              className={`p-3.5 rounded-[1.5rem] transition-all relative ${view === 'settings' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200 scale-105' : 'text-emerald-400 hover:text-emerald-600'}`}
            >
              <Settings className="w-5 h-5" />
              {view === 'settings' && <motion.div layoutId="nav-dot" className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-white rounded-full" />}
            </button>
          </div>
        </div>
      )}
      </div>

      {/* Camera Overlay */}
      <AnimatePresence>
        {showCamera && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black flex flex-col"
          >
            <div className="flex-1 relative overflow-hidden">
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                className="w-full h-full object-cover"
              />
              {/* Scanning Frame Overlay */}
              <div className="absolute inset-0 flex items-center justify-center p-12">
                <div className="w-full aspect-square border-2 border-white/50 rounded-3xl relative">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-emerald-500 -mt-1 -ml-1 rounded-tl-xl" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-emerald-500 -mt-1 -mr-1 rounded-tr-xl" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-emerald-500 -mb-1 -ml-1 rounded-bl-xl" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-emerald-500 -mb-1 -mr-1 rounded-br-xl" />
                </div>
              </div>
            </div>
            <div className="bg-black p-8 flex items-center justify-between">
              <button 
                onClick={() => {
                  const stream = videoRef.current?.srcObject as MediaStream;
                  stream?.getTracks().forEach(track => track.stop());
                  setShowCamera(false);
                }}
                className="text-white font-semibold"
              >
                {t.cancel}
              </button>
              <button 
                onClick={captureImage}
                className="w-20 h-20 bg-white rounded-full flex items-center justify-center p-1 shadow-lg"
              >
                <div className="w-full h-full border-4 border-black rounded-full" />
              </button>
              <div className="w-12" /> {/* Spacer */}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scanning Overlay */}
      <AnimatePresence>
        {scanning && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-emerald-900/90 backdrop-blur-lg flex flex-col items-center justify-center p-6 text-center"
          >
            <div className="relative">
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                className="w-32 h-32 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <Leaf className="w-12 h-12 text-emerald-500 animate-pulse" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-white mt-8">{t.scanning}</h2>
            <p className="text-emerald-300 mt-2">{language === 'en' ? 'Our AI is identifying species and checking health.' : 'අපගේ AI මගින් ශාක වර්ගය හඳුනාගෙන සෞඛ්‍යය පරීක්ෂා කරයි.'}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Toast */}
      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            className="fixed top-6 right-6 z-[100] bg-white border-l-4 border-red-500 text-red-900 p-4 rounded-xl shadow-2xl flex items-start gap-3 max-w-[320px]"
          >
            <div className="mt-0.5">
              <AlertTriangle className="w-5 h-5 text-red-500" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold mb-1">{language === 'en' ? 'Error' : 'දෝෂයකි'}</p>
              <p className="text-xs leading-relaxed opacity-80">{error}</p>
            </div>
            <button 
              onClick={() => setError(null)} 
              className="text-red-300 hover:text-red-500 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
