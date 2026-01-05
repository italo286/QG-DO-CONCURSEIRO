
import React from 'react';
import { XCircleIcon, BellIcon, ChatBubbleLeftRightIcon, CalendarIcon } from '../Icons';

export type NotificationType = 'schedule' | 'announcement' | 'message';

export interface NotificationItem {
    id: string;
    type: NotificationType;
    title: string;
    message: string;
}

const icons = {
    schedule: <CalendarIcon className="h-6 w-6 text-cyan-400" />,
    announcement: <BellIcon className="h-6 w-6 text-orange-400" />,
    message: <ChatBubbleLeftRightIcon className="h-6 w-6 text-blue-400" />
};

export const NotificationToast: React.FC<{
    notification: NotificationItem;
    onClose: (id: string) => void;
}> = ({ notification, onClose }) => {
    return (
        <div className="group relative w-80 bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-4 animate-fade-in pointer-events-auto">
            <button 
                onClick={() => onClose(notification.id)}
                className="absolute top-2 right-2 p-1 text-gray-500 hover:text-white transition-colors"
            >
                <XCircleIcon className="h-5 w-5" />
            </button>
            
            <div className="flex gap-4">
                <div className="flex-shrink-0 mt-1">
                    {icons[notification.type]}
                </div>
                <div className="flex-grow min-w-0">
                    <h4 className="text-xs font-black text-white uppercase tracking-widest mb-1 truncate">
                        {notification.title}
                    </h4>
                    <p className="text-sm text-gray-400 leading-tight line-clamp-3">
                        {notification.message}
                    </p>
                </div>
            </div>
            
            {/* Barra de progresso visual decorativa */}
            <div className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent w-full rounded-b-2xl"></div>
        </div>
    );
};
