import React, { useEffect, useRef, useId, useState } from 'react';

export const Spinner: React.FC = () => (
    <div role="status" className="inline-flex justify-center items-center">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
        <span className="sr-only">Carregando...</span>
    </div>
);

// FIX: Added 'title' to the component's props to allow passing the HTML title attribute.
export const Button: React.FC<{ onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void; children: React.ReactNode; className?: string; type?: 'button' | 'submit'; disabled?: boolean; title?: string; }> = 
({ onClick, children, className = '', type = 'button', disabled = false, title }) => (
    <button
        type={type}
        onClick={onClick}
        disabled={disabled}
        title={title}
        className={`inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-lg shadow-sm text-white bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
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
                firstFocusableElementRef.current.focus();
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
    }, [isOpen, onClose]);


    if (!isOpen) return null;

    const sizeClasses: {[key: string]: string} = {
        lg: 'max-w-lg',
        xl: 'max-w-xl',
        '2xl': 'max-w-2xl',
        '3xl': 'max-w-3xl',
        '4xl': 'max-w-4xl'
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div ref={modalRef} className={`bg-gray-800 rounded-xl shadow-lg w-full ${sizeClasses[size]} border border-gray-700`} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby={modalTitleId}>
                <div className="p-6 border-b border-gray-700 flex justify-between items-center">
                    <h2 id={modalTitleId} className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500">{title}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white" aria-label="Fechar modal">&times;</button>
                </div>
                <div className="p-6 max-h-[80vh] overflow-y-auto">
                    {children}
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

    // Clear previous content
    container.innerHTML = '';

    if (html) {
      // Use a temporary element to parse the HTML string
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      
      const nodes = Array.from(tempDiv.childNodes);

      nodes.forEach(node => {
        if (node.nodeName === 'SCRIPT') {
          const script = document.createElement('script');
          const oldScript = node as HTMLScriptElement;
          
          // Copy attributes
          for (let i = 0; i < oldScript.attributes.length; i++) {
            const attr = oldScript.attributes[i];
            script.setAttribute(attr.name, attr.value);
          }
          
          // Copy inner text
          script.text = oldScript.text;
          
          container.appendChild(script);
        } else {
          // For other nodes (like iframes, divs, etc.), just clone and append them
          container.appendChild(node.cloneNode(true));
        }
      });
    }
  }, [html]);

  return <div ref={containerRef} className={`${className} w-full h-full`}></div>;
};

export const Toast: React.FC<{ message: string, onDismiss: () => void }> = ({ message, onDismiss }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onDismiss();
        }, 3000);
        return () => clearTimeout(timer);
    }, [onDismiss]);

    return (
        <div role="alert" aria-live="assertive" className="fixed bottom-5 right-5 bg-green-500 text-white py-2 px-4 rounded-lg shadow-lg z-50">
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
