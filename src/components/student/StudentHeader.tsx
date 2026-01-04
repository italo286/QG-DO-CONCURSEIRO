
import React, { useState, useRef, useEffect } from 'react';
import { User, StudentProgress } from '../../types';
import { calculateLevel, getLevelTitle, LEVEL_XP_REQUIREMENT } from '../../gamification';
import { LogoutIcon, PencilIcon, UserCircleIcon, ChevronDownIcon } from '../Icons';
import { getBrasiliaDate, getLocalDateISOString } from '../../utils';

type ViewType = 'dashboard' | 'course' | 'subject' | 'topic' | 'schedule' | 'performance' | 'reviews' | 'review_quiz' | 'games' | 'daily_challenge_quiz' | 'daily_challenge_results' | 'practice_area' | 'custom_quiz_player' | 'simulado_player';

interface StudentHeaderProps {
    user: User;
    studentProgress: StudentProgress;
    view: ViewType;
    selectedTopicName?: string;
    selectedCourseName?: string;
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
    selectedCourseName,
    onSetView,
    onOpenProfile,
    onLogout,
    onGoHome,
}) => {
    const [isNavOpen, setIsNavOpen] = useState(false);
    const navRef = useRef<HTMLDivElement>(null);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [studySeconds, setStudySeconds] = useState(0);

    // Fechar menu ao clicar fora
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (navRef.current && !navRef.current.contains(event.target as Node)) {
                setIsNavOpen(false);
            }
        };
        
        if (isNavOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
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

    const level = calculateLevel(studentProgress.xp);
    const levelTitle = getLevelTitle(level);
    const levelProgress = (studentProgress.xp % LEVEL_XP_REQUIREMENT) / LEVEL_XP_REQUIREMENT * 100;

    const navigationItems = [
        { label: 'Início', view: 'dashboard' as const },
        { label: 'Revisões', view: 'reviews' as const },
        { label: 'Prática', view: 'practice_area' as const },
        { label: 'Cronograma', view: 'schedule' as const },
        { label: 'Jogos', view: 'games' as const },
        { label: 'Desempenho', view: 'performance' as const },
    ];

    return (
        <header className="flex flex-col mb-8 gap-4">
            <div className="flex justify-between items-center gap-4">
                <div className="flex items-center gap-4 flex-grow min-w-0">
                    <button onClick={onGoHome} className="hover:scale-105 transition-transform">
                        <img src="https://i.ibb.co/FbmLfsBw/Google-AI-Studio-2025-08-10-T15-45-10.png" alt="Logo" className="h-10 w-15 rounded-md flex-shrink-0" />
                    </button>
                    <div className="flex-grow min-w-0">
                        <h1 className="text-xl md:text-2xl font-black text-white truncate uppercase tracking-tighter">
                            {view === 'dashboard' ? 'Painel do Aluno' : (selectedTopicName || selectedCourseName || 'QG')}
                        </h1>
                        <div className="w-full mt-1 max-w-[200px]">
                            <div className="w-full bg-gray-800 rounded-full h-1.5 border border-gray-700/50 overflow-hidden">
                                <div className="bg-cyan-500 h-full shadow-[0_0_8px_cyan]" style={{ width: `${levelProgress}%` }}></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* RELÓGIO ESTILIZADO */}
                <div className="hidden lg:flex items-center gap-0 px-1 bg-[#0f172a]/80 rounded-2xl border border-gray-800 shadow-2xl backdrop-blur-xl h-14 overflow-hidden">
                    <div className="flex flex-col items-center px-5 border-r border-gray-800">
                        <span className="text-[8px] font-black text-gray-500 uppercase tracking-[0.2em] mb-0.5">Hora Atual</span>
                        <span className="text-lg font-mono font-black text-white leading-none tracking-wider">
                            {currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                    </div>
                    <div className="flex flex-col items-center px-5">
                        <span className="text-[8px] font-black text-cyan-500/60 uppercase tracking-[0.2em] mb-0.5 flex items-center gap-1">
                            <div className="w-1 h-1 bg-cyan-400 rounded-full animate-pulse"></div>
                            Tempo Ativo
                        </span>
                        <span className="text-lg font-mono font-black text-cyan-400 leading-none tracking-wider drop-shadow-[0_0_8px_rgba(34,211,238,0.4)]">
                            {formatTime(studySeconds)}
                        </span>
                    </div>
                </div>

                <div className="flex items-center space-x-4">
                    <div ref={navRef} className="relative">
                        <button onClick={() => setIsNavOpen(prev => !prev)} className="flex items-center space-x-2 px-6 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl bg-gray-800 border border-gray-700 hover:bg-gray-700 transition-all text-gray-300">
                            <span>Menu</span>
                            <ChevronDownIcon className={`h-3 w-3 transition-transform ${isNavOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isNavOpen && (
                            <div className="absolute right-0 mt-2 w-48 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl z-50 overflow-hidden animate-fade-in">
                                {navigationItems.map(item => (
                                    <button key={item.view} onClick={() => { onSetView(item.view); setIsNavOpen(false); }} className={`w-full text-left px-5 py-3 text-[10px] font-black uppercase tracking-widest transition-colors ${view === item.view ? 'bg-cyan-600 text-white' : 'text-gray-500 hover:bg-gray-800 hover:text-white'}`}>
                                        {item.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <button onClick={onOpenProfile} className="h-10 w-10 rounded-xl bg-gray-800 border border-gray-700 flex items-center justify-center hover:bg-gray-700 transition-colors">
                        {user.avatarUrl ? <img src={user.avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover" /> : <UserCircleIcon className="h-6 w-6 text-gray-500" />}
                    </button>
                    <button onClick={onLogout} className="text-gray-600 hover:text-red-400 transition-colors">
                        <LogoutIcon className="h-6 w-6" />
                    </button>
                </div>
            </div>
        </header>
    );
};
