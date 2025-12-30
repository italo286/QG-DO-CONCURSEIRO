
import React, { useEffect, useRef, useId, useState } from 'react';
/* Added CheckCircleIcon to fix missing import error on line 228 */
import { XCircleIcon, ExclamationTriangleIcon, CheckCircleIcon } from './Icons';

export const Spinner: React.FC = () => (
    <div role="status" className="inline-flex justify-center items-center">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
        <span className="sr-only">Carregando...</span>
    </div>
);

export const Button: React.FC<{
    onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
    children: React.ReactNode;
    className?: string;
    type?: 'button' | 'submit';
    disabled?: boolean;
    title?: string;
    style?: React.CSSProperties;
}> = ({ onClick, children, className = '', type = 'button', disabled = false, title, style }) => (
    <button
        type={type}
        onClick={onClick}
        disabled={disabled}
        title={title}
        style={style}
        className={`inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-lg shadow-sm text-white ${!style?.backgroundColor ? 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600' : 'hover:brightness-110'} focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
        {children}
    </button>
);

export const Card: React.FC<{ children: React.ReactNode; className?: string; onClick?: () => void; }> = ({ children, className = '', onClick }) => {
    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onClick();
        }
    };
    
    return (
        <div 
            onClick={onClick} 
            className={`bg-gray-800 border border-gray-700/50 shadow-2xl shadow-black/20 rounded-xl ${className} ${onClick ? 'cursor-pointer' : ''}`}
            role={onClick ? 'button' : undefined}
            tabIndex={onClick ? 0 : undefined}
            onKeyDown={onClick ? handleKeyDown : undefined}
        >
            {children}
        </div>
    );
};

export const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode; size?: 'lg' | 'xl' | '2xl' | '3xl' | '4xl' }> = 
({ isOpen, onClose, title, children, size = 'lg' }) => {
    const modalRef = useRef<HTMLDivElement>(null);
    const firstFocusableElementRef = useRef<HTMLElement | null>(null);
    const lastFocusableElementRef = useRef<HTMLElement | null>(null);
    const modalTitleId = useId();

    useEffect(() => {
        if (isOpen) {
            const focusableElements = modalRef.current?.querySelectorAll<HTMLElement>(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            if (focusableElements && focusableElements.length > 0) {
                firstFocusableElementRef.current = focusableElements[0];
                lastFocusableElementRef.current = focusableElements[focusableElements.length - 1];
                
                if (!modalRef.current?.contains(document.activeElement)) {
                    firstFocusableElementRef.current.focus();
                }
            }

            const handleKeyDown = (e: KeyboardEvent) => {
                if (e.key === 'Escape') {
                    onClose();
                }
                if (e.key === 'Tab' && modalRef.current) {
                    if (e.shiftKey) { // Shift+Tab
                        if (document.activeElement === firstFocusableElementRef.current) {
                            lastFocusableElementRef.current?.focus();
                            e.preventDefault();
                        }
                    } else { // Tab
                        if (document.activeElement === lastFocusableElementRef.current) {
                            firstFocusableElementRef.current?.focus();
                            e.preventDefault();
                        }
                    }
                }
            };

            document.addEventListener('keydown', handleKeyDown);
            return () => {
                document.removeEventListener('keydown', handleKeyDown);
            };
        }
    }, [isOpen]);


    if (!isOpen) return null;

    const sizeClasses: {[key: string]: string} = {
        lg: 'max-w-lg',
        xl: 'max-w-xl',
        '2xl': 'max-w-2xl',
        '3xl': 'max-w-3xl',
        '4xl': 'max-w-4xl'
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4 overflow-y-auto" onClick={onClose}>
            <div ref={modalRef} className={`bg-gray-800 rounded-xl shadow-2xl w-full ${sizeClasses[size]} border border-gray-700 my-auto`} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby={modalTitleId}>
                <div className="p-6 border-b border-gray-700 flex justify-between items-center">
                    <h2 id={modalTitleId} className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500">{title}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none" aria-label="Fechar modal">&times;</button>
                </div>
                <div className="p-6 max-h-[80vh] overflow-y-auto">
                    {children}
                </div>
            </div>
        </div>
    );
};

export const ConfirmModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'primary';
}> = ({ isOpen, onClose, onConfirm, title, message, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', variant = 'primary' }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[200] p-4" onClick={onClose}>
            <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-md border border-gray-700 animate-fade-in" onClick={e => e.stopPropagation()}>
                <div className="p-6">
                    <div className="flex items-center gap-4 mb-4">
                        <div className={`p-2 rounded-full ${variant === 'danger' ? 'bg-red-900/30 text-red-400' : 'bg-cyan-900/30 text-cyan-400'}`}>
                            <ExclamationTriangleIcon className="h-6 w-6" />
                        </div>
                        <h2 className="text-xl font-bold text-white">{title}</h2>
                    </div>
                    <p className="text-gray-300 mb-6">{message}</p>
                    <div className="flex justify-end gap-3">
                        <button 
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
                        >
                            {cancelLabel}
                        </button>
                        <button 
                            onClick={() => { onConfirm(); onClose(); }}
                            className={`px-4 py-2 rounded-lg font-semibold text-white shadow-lg transition-all active:scale-95 ${
                                variant === 'danger' 
                                ? 'bg-red-600 hover:bg-red-500 shadow-red-900/20' 
                                : 'bg-cyan-600 hover:bg-cyan-500 shadow-cyan-900/20'
                            }`}
                        >
                            {confirmLabel}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const EmbedHtml: React.FC<{ html: string; className?: string }> = ({ html, className }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = '';

    if (html) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      
      const nodes = Array.from(tempDiv.childNodes);

      nodes.forEach(node => {
        if (node.nodeName === 'SCRIPT') {
          const script = document.createElement('script');
          const oldScript = node as HTMLScriptElement;
          
          for (let i = 0; i < oldScript.attributes.length; i++) {
            const attr = oldScript.attributes[i];
            script.setAttribute(attr.name, attr.value);
          }
          
          script.text = oldScript.text;
          
          container.appendChild(script);
        } else {
          container.appendChild(node.cloneNode(true));
        }
      });
    }
  }, [html]);

  return <div ref={containerRef} className={`${className} w-full h-full`}></div>;
};

export const Toast: React.FC<{ message: string, onDismiss: () => void, variant?: 'success' | 'error' | 'info' }> = ({ message, onDismiss, variant = 'success' }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onDismiss();
        }, 4000);
        return () => clearTimeout(timer);
    }, [onDismiss]);

    const colors = {
        success: 'bg-emerald-500 shadow-emerald-900/20',
        error: 'bg-red-500 shadow-red-900/20',
        info: 'bg-cyan-500 shadow-cyan-900/20'
    };

    return (
        <div role="alert" aria-live="assertive" className={`fixed bottom-8 left-1/2 -translate-x-1/2 md:translate-x-0 md:left-auto md:right-8 flex items-center gap-3 py-3 px-6 rounded-xl shadow-2xl text-white font-semibold z-[300] animate-fade-in ${colors[variant]}`}>
            {variant === 'success' && <CheckCircleIcon className="h-5 w-5" />}
            {variant === 'error' && <XCircleIcon className="h-5 w-5" />}
            {message}
        </div>
    );
};

export const CountdownTimer: React.FC<{ targetDate: string }> = ({ targetDate }) => {
    const calculateTimeLeft = () => {
        const difference = +new Date(`${targetDate}T23:59:59`) - +new Date();
        let timeLeft = { days: 0, hours: 0, minutes: 0, seconds: 0 };

        if (difference > 0) {
            timeLeft = {
                days: Math.floor(difference / (1000 * 60 * 60 * 24)),
                hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
                minutes: Math.floor((difference / 1000 / 60) % 60),
                seconds: Math.floor((difference / 1000) % 60),
            };
        }
        return timeLeft;
    };

    const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

    useEffect(() => {
        const timer = setTimeout(() => {
            setTimeLeft(calculateTimeLeft());
        }, 1000);
        return () => clearTimeout(timer);
    });

    const unitLabels: { [key: string]: string } = {
        days: 'dias',
        hours: 'horas',
        minutes: 'minutos',
        seconds: 'segundos',
    };

    return (
        <div className="flex justify-center space-x-4">
            {Object.entries(timeLeft).map(([unit, value]) => (
                <div key={unit} className="text-center">
                    <div className="text-3xl font-bold">{String(value).padStart(2, '0')}</div>
                    <div className="text-xs uppercase text-gray-400">{unitLabels[unit] || unit}</div>
                </div>
            ))}
        </div>
    );
};

export const COLORS = [
  '#ef4444', 
  '#f97316', 
  '#eab308', 
  '#84cc16', 
  '#22c55e', 
  '#14b8a6', 
  '#0ea5e9', 
  '#3b82f6', 
  '#6366f1', 
  '#8b5cf6', 
  '#d946ef', 
  '#ec4899', 
];

export const ColorPalettePicker: React.FC<{
    currentColor?: string;
    onColorSelect: (color: string | undefined) => void;
}> = ({ currentColor, onColorSelect }) => {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [wrapperRef]);

    return (
        <div ref={wrapperRef} className="relative">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-6 h-6 rounded-full border-2 border-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                style={{ backgroundColor: currentColor || '#4B5563' }}
                aria-label="Selecionar cor"
            >
            </button>
            {isOpen && (
                <div className="absolute z-10 top-full mt-2 p-2 bg-gray-900 border border-gray-600 rounded-lg shadow-lg grid grid-cols-6 gap-2">
                    <button
                        onClick={() => { onColorSelect(undefined); setIsOpen(false); }}
                        className="w-6 h-6 rounded-full bg-gray-600 flex items-center justify-center text-white"
                        title="Remover cor"
                    >
                        <XCircleIcon className="h-5 w-5"/>
                    </button>
                    {COLORS.map(color => (
                        <button
                            key={color}
                            onClick={() => { onColorSelect(color); setIsOpen(false); }}
                            className={`w-6 h-6 rounded-full transition-transform hover:scale-110 ${currentColor === color ? 'ring-2 ring-white' : ''}`}
                            style={{ backgroundColor: color }}
                            aria-label={`Cor ${color}`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};
