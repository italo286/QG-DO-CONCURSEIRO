
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
        glow: 'shadow-[0_0_30px_rgba(34,211,238,0.3)]'
    },
    announcement: {
        icon: <BellIcon className="h-6 w-6 text-orange-400" />,
        borderColor: 'border-orange-500/50',
        glow: 'shadow-[0_0_30px_rgba(251,146,60,0.3)]'
    },
    message: {
        icon: <ChatBubbleLeftRightIcon className="h-6 w-6 text-blue-400" />,
        borderColor: 'border-blue-500/50',
        glow: 'shadow-[0_0_30px_rgba(59,130,246,0.3)]'
    }
};

export const NotificationToast: React.FC<{
    notification: NotificationItem;
    onClose: (id: string) => void;
}> = ({ notification, onClose }) => {
    const config = themeConfigs[notification.type];

    return (
        <div className={`relative w-full max-w-sm bg-gray-900/90 backdrop-blur-xl border-2 ${config.borderColor} ${config.glow} rounded-2xl p-4 animate-fade-in pointer-events-auto shadow-2xl`}>
            <button 
                onClick={() => onClose(notification.id)}
                className="absolute top-2 right-2 text-gray-500 hover:text-white transition-colors"
                title="Fechar"
            >
                <XCircleIcon className="h-5 w-5" />
            </button>
            <div className="flex gap-4 items-center">
                <div className="flex-shrink-0 bg-gray-800 p-2 rounded-xl border border-white/5">
                    {config.icon}
                </div>
                <div className="flex-grow min-w-0">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">
                        {notification.title}
                    </h4>
                    <p className="text-sm font-bold text-white leading-tight truncate">
                        {notification.message}
                    </p>
                </div>
            </div>
        </div>
    );
};
