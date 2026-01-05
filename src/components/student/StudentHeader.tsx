
import React, { useState, useRef, useEffect } from 'react';
import { User, StudentProgress } from '../../types';
import { calculateLevel, getLevelTitle, LEVEL_XP_REQUIREMENT } from '../../gamification';
import { UserCircleIcon, ChevronDownIcon } from '../Icons';
import { getBrasiliaDate, getLocalDateISOString } from '../../utils';

type ViewType = 'dashboard' | 'course' | 'subject' | 'topic' | 'schedule' | 'performance' | 'reviews' | 'review_quiz' | 'games' | 'daily_challenge_quiz' | 'daily_challenge_results' | 'practice_area' | 'custom_quiz_player' | 'simulado_player';

interface StudentHeaderProps {
    user: User;
    studentProgress: StudentProgress;
    view: ViewType;
    selectedTopicName?: string;
    selectedSubjectName?: string;
    selectedCourseName?: string;
    activeChallengeType?: 'review' | 'glossary' | 'portuguese' | null;
    onSetView: (view: ViewType) => void;
    onOpenProfile: () => void;
    onLogout: () => void;
    onGoHome: () => void;
}

export const StudentHeader: React.FC<StudentHeaderProps> = ({
    user,
    studentProgress,
    view,
    selectedTopicName,
    selectedSubjectName,
    selectedCourseName,
    activeChallengeType,
    onSetView,
    onOpenProfile,
    onLogout,
    onGoHome,
}) => {
    const [isNavOpen, setIsNavOpen] = useState(false);
    const navRef = useRef<HTMLDivElement>(null);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [studySeconds, setStudySeconds] = useState(0);

    // Cálculos de Gamificação para o Cabeçalho
    const level = calculateLevel(studentProgress.xp);
    const levelTitle = getLevelTitle(level);
    const xpCurrentLevel = studentProgress.xp % LEVEL_XP_REQUIREMENT;
    const progressPercent = (xpCurrentLevel / LEVEL_XP_REQUIREMENT) * 100;

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (navRef.current && !navRef.current.contains(event.target as Node)) {
                setIsNavOpen(false);
            }
        };
        if (isNavOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isNavOpen]);

    useEffect(() => {
        const todayStr = getLocalDateISOString(getBrasiliaDate());
        const savedDate = localStorage.getItem('study_timer_date');
        const savedSeconds = localStorage.getItem('study_timer_seconds');

        if (savedDate === todayStr && savedSeconds) {
            setStudySeconds(parseInt(savedSeconds, 10));
        } else {
            localStorage.setItem('study_timer_date', todayStr);
            localStorage.setItem('study_timer_seconds', '0');
            setStudySeconds(0);
        }

        const interval = setInterval(() => {
            setCurrentTime(new Date());
            setStudySeconds(prev => {
                const next = prev + 1;
                localStorage.setItem('study_timer_seconds', next.toString());
                return next;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    const formatTime = (totalSeconds: number) => {
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const getViewTitle = () => {
        switch (view) {
            case 'dashboard': return 'Início';
            case 'schedule': return 'Cronograma';
            case 'performance': return 'Meu Desempenho';
            case 'reviews': return 'Revisões';
            case 'games': return 'Jogos';
            case 'practice_area': return 'Área de Prática';
            case 'review_quiz': return 'Quiz de Revisão';
            case 'custom_quiz_player': return 'Quiz IA';
            case 'simulado_player': return 'Simulado';
            case 'daily_challenge_results': return 'Desempenho do Desafio';
            case 'daily_challenge_quiz':
                if (activeChallengeType === 'portuguese') return 'Português';
                if (activeChallengeType === 'glossary') return 'Glossário';
                if (activeChallengeType === 'review') return 'Revisão Diária';
                return 'Desafio Diário';
            case 'topic': return selectedTopicName || 'Tópico';
            case 'subject': return selectedSubjectName || 'Disciplina';
            case 'course': return selectedCourseName || 'Curso';
            default: return 'Painel';
        }
    };

    const navigationItems = [
        { label: 'Início', view: 'dashboard' as const },
        { label: 'Revisões', view: 'reviews' as const },
        { label: 'Prática', view: 'practice_area' as const },
        { label: 'Cronograma', view: 'schedule' as const },
        { label: 'Jogos', view: 'games' as const },
        { label: 'Desempenho', view: 'performance' as const },
    ];

    return (
        <header className="sticky top-0 z-50 w-full bg-[#020617] border-b border-white/10 shadow-2xl">
            <div className="max-w-[1920px] mx-auto h-20 px-4 md:px-6 flex items-center justify-between gap-2 md:gap-4">
                
                {/* 1. LOGO E TÍTULO DINÂMICO */}
                <div className="flex items-center gap-3 flex-shrink-0">
                    <button onClick={onGoHome} className="hover:scale-105 transition-transform flex-shrink-0">
                        <img src="https://i.ibb.co/FbmLfsBw/Google-AI-Studio-2025-08-10-T15-45-10.png" alt="Logo" className="h-8 md:h-10 w-auto rounded-md" />
                    </button>
                    <div className="hidden lg:block min-w-0">
                        <h1 className="text-lg font-black text-white uppercase tracking-tighter leading-none truncate max-w-[200px] xl:max-w-md">
                            {getViewTitle()}
                        </h1>
                        <p className="text-[8px] text-gray-500 font-bold uppercase tracking-[0.2em] mt-1">High Performance Ed.</p>
                    </div>
                </div>

                {/* 2. WIDGET DE NÍVEL (COMPACTADO PARA TABLETS) */}
                <div className="flex-grow max-w-[160px] md:max-w-xs lg:max-w-md flex items-center gap-3 md:gap-4">
                    <div className="relative flex-shrink-0">
                        <div className="absolute inset-0 bg-cyan-500/20 blur-lg rounded-full"></div>
                        <div className="relative h-10 w-10 md:h-12 md:w-12 rounded-full border-2 border-cyan-500/40 flex items-center justify-center bg-gray-950 shadow-[0_0_10px_rgba(6,182,212,0.4)]">
                            <span className="text-lg md:text-xl font-black text-white">{level}</span>
                        </div>
                    </div>
                    <div className="flex-grow min-w-0">
                        <div className="flex flex-col mb-1">
                            <span className="text-[7px] md:text-[8px] font-black text-cyan-500 uppercase tracking-[0.2em] md:tracking-[0.3em] leading-none mb-0.5">Nível</span>
                            <span className="text-xs md:text-lg font-black text-white uppercase tracking-tighter italic leading-none truncate">{levelTitle}</span>
                        </div>
                        <div className="space-y-1">
                            {/* Barra de progresso curta e funcional */}
                            <div className="h-[2px] bg-gray-900 rounded-full overflow-hidden border border-white/5">
                                <div className="h-full bg-cyan-500 rounded-full shadow-[0_0_8px_cyan] transition-all duration-1000 ease-out" style={{ width: `${progressPercent}%` }}></div>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[6px] md:text-[8px] font-black text-gray-600 uppercase tracking-widest">{studentProgress.xp} XP</span>
                                <span className="text-[6px] md:text-[8px] font-black text-cyan-400 uppercase tracking-widest">{xpCurrentLevel}/{LEVEL_XP_REQUIREMENT}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. RELÓGIO E STATUS DE SESSÃO (VISÍVEL EM TABLETS) */}
                <div className="hidden md:flex items-center h-10 md:h-12 bg-black/40 rounded-xl border border-white/5 divide-x divide-white/5 flex-shrink-0">
                    <div className="px-3 md:px-5 flex flex-col items-center justify-center">
                        <span className="text-[7px] md:text-[8px] font-black text-gray-500 uppercase tracking-widest mb-0.5">Relógio</span>
                        <span className="text-xs md:text-sm font-mono font-black text-white leading-none">
                            {currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                    <div className="px-3 md:px-5 flex flex-col items-center justify-center">
                        <span className="text-[7px] md:text-[8px] font-black text-cyan-500 uppercase tracking-widest mb-0.5 flex items-center gap-1">
                            <div className="w-1 h-1 bg-cyan-400 rounded-full animate-pulse"></div>
                            Sessão
                        </span>
                        <span className="text-xs md:text-sm font-mono font-black text-cyan-400 leading-none drop-shadow-[0_0_8px_rgba(34,211,238,0.4)]">
                            {formatTime(studySeconds)}
                        </span>
                    </div>
                </div>

                {/* 4. MENU E PERFIL */}
                <div className="flex items-center space-x-2 md:space-x-4 flex-shrink-0">
                    <div ref={navRef} className="relative">
                        <button onClick={() => setIsNavOpen(prev => !prev)} className="flex items-center space-x-1 md:space-x-2 px-3 md:px-5 py-2 md:py-2.5 text-[9px] md:text-[10px] font-black uppercase tracking-widest rounded-xl bg-gray-800 border border-white/5 hover:bg-gray-700 transition-all text-gray-300">
                            <span className="hidden sm:inline">Menu</span>
                            <ChevronDownIcon className={`h-3 w-3 transition-transform ${isNavOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isNavOpen && (
                            <div className="absolute right-0 mt-3 w-56 bg-gray-950 border border-gray-800 rounded-2xl shadow-2xl z-50 overflow-hidden animate-fade-in ring-1 ring-white/10">
                                {navigationItems.map(item => (
                                    <button key={item.view} onClick={() => { onSetView(item.view); setIsNavOpen(false); }} className={`w-full text-left px-6 py-4 text-[10px] font-black uppercase tracking-widest transition-colors ${view === item.view ? 'bg-cyan-600 text-white' : 'text-gray-500 hover:bg-gray-900 hover:text-white'}`}>
                                        {item.label}
                                    </button>
                                ))}
                                <div className="border-t border-white/5 my-1"></div>
                                <button onClick={onLogout} className="w-full text-left px-6 py-4 text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-500/10 transition-colors">Encerrar Conexão</button>
                            </div>
                        )}
                    </div>

                    <button onClick={onOpenProfile} className="h-10 w-10 md:h-12 md:w-12 rounded-2xl bg-gray-900 border border-white/10 flex items-center justify-center hover:border-cyan-500/50 transition-all shadow-xl overflow-hidden group">
                        {user.avatarUrl ? <img src={user.avatarUrl} alt="" className="h-full w-full object-cover group-hover:scale-110 transition-transform" /> : <UserCircleIcon className="h-6 md:h-8 w-6 md:w-8 text-gray-700" />}
                    </button>
                </div>
            </div>
        </header>
    );
};
