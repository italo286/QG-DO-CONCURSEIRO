import React, { useState, useRef, useEffect } from 'react';
import { User, StudentProgress } from '../../types';
import { calculateLevel, getLevelTitle, LEVEL_XP_REQUIREMENT } from '../../gamification';
import { LogoutIcon, PencilIcon, UserCircleIcon, ChevronDownIcon } from '../Icons';

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

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (navRef.current && !navRef.current.contains(event.target as Node)) {
                setIsNavOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const getHeaderText = () => {
        switch (view) {
            case 'dashboard': return 'Painel do Aluno';
            case 'topic': return selectedTopicName || 'Tópico';
            case 'subject': return 'Disciplina';
            case 'course': return selectedCourseName || 'Curso';
            case 'reviews': return 'Minhas Revisões';
            case 'schedule': return 'Meu Cronograma';
            case 'games': return 'Meus Jogos';
            case 'performance': return 'Meu Desempenho';
            case 'review_quiz': return 'Sessão de Revisão';
            case 'daily_challenge_quiz': return 'Desafio Diário';
            case 'daily_challenge_results': return 'Resultados do Desafio';
            case 'practice_area': return 'Área de Prática';
            case 'custom_quiz_player': return 'Quiz Personalizado';
            case 'simulado_player': return 'Simulado';
            default: return 'QG do Concurseiro';
        }
    };

    return (
        <header className="flex justify-between items-center mb-6 md:mb-8 gap-4">
            <div className="flex items-center gap-4 flex-grow min-w-0">
                <button onClick={onGoHome} aria-label="Voltar para o painel inicial">
                    <img src="https://i.ibb.co/FbmLfsBw/Google-AI-Studio-2025-08-10-T15-45-10.png" alt="Logo QG do concurseiro" className="h-12 w-17 rounded-md flex-shrink-0" />
                </button>
                <div className="flex-grow min-w-0">
                    <h1 className="text-2xl md:text-3xl font-bold text-white truncate">{getHeaderText()}</h1>
                    <div className="w-full mt-2">
                        <div className="flex justify-between text-xs text-gray-400 mb-1">
                            <span>Nível {level} - {levelTitle}</span>
                            <span>{studentProgress.xp % LEVEL_XP_REQUIREMENT} / {LEVEL_XP_REQUIREMENT} XP</span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2.5">
                            <div className="bg-gradient-to-r from-cyan-500 to-blue-500 h-2.5 rounded-full" style={{ width: `${levelProgress}%` }}></div>
                        </div>
                    </div>
                </div>
            </div>
            <div className="flex items-center space-x-4">
                <div ref={navRef} className="relative">
                    <button onClick={() => setIsNavOpen(prev => !prev)} className="flex items-center space-x-2 px-4 py-2 text-sm font-medium rounded-lg bg-gray-700 hover:bg-gray-600">
                        <span>Navegação</span>
                        <ChevronDownIcon className={`h-4 w-4 transition-transform ${isNavOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isNavOpen && (
                        <div className="absolute right-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-10">
                            {navigationItems.map(item => (
                                <button
                                    key={item.view}
                                    onClick={() => { onSetView(item.view); setIsNavOpen(false); }}
                                    className={`w-full text-left px-4 py-2 text-sm ${view === item.view ? 'bg-cyan-600' : 'hover:bg-gray-700'}`}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <div className="w-px h-6 bg-gray-600" aria-hidden="true"></div>
                <button onClick={onOpenProfile} className="flex items-center space-x-2 p-1 rounded-full hover:bg-gray-700">
                    {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt={`Avatar de ${user.name}`} className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                        <UserCircleIcon className="h-10 w-10 text-gray-500" aria-hidden="true" />
                    )}
                    <span className="hidden lg:inline text-gray-300">Olá, {user.name || user.username}</span>
                    <PencilIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                </button>
                <button onClick={onLogout} className="flex items-center text-sm text-cyan-400 hover:text-cyan-300">
                    <LogoutIcon className="h-5 w-5 mr-1" aria-hidden="true" />
                    Sair
                </button>
            </div>
        </header>
    );
};
