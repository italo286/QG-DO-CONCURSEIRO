
import React from 'react';
import { XCircleIcon, BellIcon, ChatBubbleLeftRightIcon, CalendarIcon } from '../Icons';

export type NotificationType = 'schedule' | 'announcement' | 'message';

export interface NotificationItem {
    id: string;
    type: NotificationType;
    title: string;
    message: string;
}

const themeConfigs = {
    schedule: {
        icon: <CalendarIcon className="h-6 w-6 text-cyan-400" />,
        borderColor: 'border-cyan-500/50',
        glow: 'shadow-[0_0_40px_rgba(34,211,238,0.3)]',
        bgAccent: 'bg-cyan-500/5'
    },
    announcement: {
        icon: <BellIcon className="h-6 w-6 text-orange-400" />,
        borderColor: 'border-orange-500/50',
        glow: 'shadow-[0_0_40px_rgba(251,146,60,0.3)]',
        bgAccent: 'bg-orange-500/5'
    },
    message: {
        icon: <ChatBubbleLeftRightIcon className="h-6 w-6 text-blue-400" />,
        borderColor: 'border-blue-500/50',
        glow: 'shadow-[0_0_40px_rgba(59,130,246,0.3)]',
        bgAccent: 'bg-blue-500/5'
    }
};

export const NotificationToast: React.FC<{
    notification: NotificationItem;
    onClose: (id: string) => void;
}> = ({ notification, onClose }) => {
    const config = themeConfigs[notification.type];

    return (
        <div className={`group relative w-full max-w-md bg-gray-950/95 backdrop-blur-2xl border-l-4 ${config.borderColor} ${config.glow} rounded-2xl p-5 animate-fade-in pointer-events-auto ring-1 ring-white/10`}>
            <button 
                onClick={() => onClose(notification.id)}
                className="absolute top-3 right-3 p-1 text-gray-500 hover:text-rose-400 hover:bg-rose-400/10 rounded-full transition-all"
                title="Fechar"
            >
                <XCircleIcon className="h-5 w-5" />
            </button>
            
            <div className="flex gap-5">
                <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${config.bgAccent} border border-white/5`}>
                    {config.icon}
                </div>
                <div className="flex-grow min-w-0 pr-4">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">
                        {notification.title}
                    </h4>
                    <p className="text-base font-bold text-white leading-snug line-clamp-3">
                        {notification.message}
                    </p>
                </div>
            </div>
            
            {/* Barra de progresso visual decorativa (timer visual de 10s) */}
            <div className="absolute bottom-0 left-0 h-1 w-full bg-gray-800 rounded-b-2xl overflow-hidden">
                <div 
                    className={`h-full bg-gradient-to-r from-transparent ${config.borderColor.replace('border', 'via')} to-transparent animate-pulse`}
                    style={{ width: '100%' }}
                ></div>
            </div>
        </div>
    );
};
