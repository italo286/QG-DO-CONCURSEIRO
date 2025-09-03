import React from 'react';
import { StarIcon } from '../Icons';

type XpToast = {
    id: number;
    amount: number;
    message?: string;
};

export const XpToastDisplay: React.FC<{ toasts: XpToast[] }> = ({ toasts }) => {
    return (
        <div
            aria-live="polite"
            aria-atomic="true"
            className="fixed top-20 right-8 z-[100] space-y-2 pointer-events-none"
        >
            {toasts.map(toast => {
                const isPositive = toast.amount >= 0;
                return (
                    <div
                        key={toast.id}
                        className={`flex items-center justify-center p-3 text-white rounded-full shadow-lg animate-fade-in
                            ${isPositive 
                                ? 'bg-gradient-to-br from-yellow-400 to-orange-500' 
                                : 'bg-gradient-to-br from-red-500 to-rose-600'
                            }`
                        }
                        role="alert"
                    >
                        {isPositive && !toast.message && <StarIcon className="h-5 w-5 mr-2 text-white" />}
                        <span className="font-bold">
                             {toast.message ? toast.message : (isPositive ? `+${toast.amount}` : toast.amount) + ' XP'}
                        </span>
                    </div>
                );
            })}
        </div>
    );
};