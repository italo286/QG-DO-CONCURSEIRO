import React, { useRef, useState, useEffect, useCallback } from 'react';
import { rgbToHex } from '../../utils';
import { BoldIcon, UnderlineIcon, ListBulletIcon, HighlighterIcon, TextColorIcon, XCircleIcon } from '../Icons';

type NotesEditorProps = {
    initialContent: string;
    onSave: (content: string) => void;
    isReadOnly?: boolean;
};

export const NotesEditor = React.forwardRef<HTMLDivElement, NotesEditorProps>(
    ({ initialContent, onSave, isReadOnly = false }, ref) => {
    const editorRef = (ref as React.RefObject<HTMLDivElement>) || useRef<HTMLDivElement>(null);
    const [isBold, setIsBold] = useState(false);
    const [isUnderline, setIsUnderline] = useState(false);
    const [isList, setIsList] = useState(false);
    const [currentForeColor, setCurrentForeColor] = useState('#000000');
    const [currentBackColor, setCurrentBackColor] = useState('transparent');

    useEffect(() => {
        document.execCommand("styleWithCSS", false, 'true');
    }, []);

    const updateToolbarState = useCallback(() => {
        if (editorRef.current && document.activeElement === editorRef.current) {
            setIsBold(document.queryCommandState('bold'));
            setIsUnderline(document.queryCommandState('underline'));
            setIsList(document.queryCommandState('insertUnorderedList'));
            
            let backColor = document.queryCommandValue('backColor');
            if (backColor === 'rgba(0, 0, 0, 0)' || !backColor || backColor === 'rgb(255, 255, 255)') {
                backColor = 'transparent';
            }
            setCurrentBackColor(rgbToHex(backColor));
            
            let foreColor = document.queryCommandValue('foreColor');
             if (!foreColor) {
                foreColor = 'rgb(0, 0, 0)';
            }
            setCurrentForeColor(rgbToHex(foreColor));
        }
    }, [editorRef]);

    useEffect(() => {
        if (editorRef.current && initialContent !== editorRef.current.innerHTML) {
            editorRef.current.innerHTML = initialContent;
        }
    }, [initialContent, editorRef]);

    const handleBlur = () => {
        if (editorRef.current && !isReadOnly) {
            onSave(editorRef.current.innerHTML);
        }
    };
    
    const preventLosingFocus = (e: React.MouseEvent) => {
        e.preventDefault();
    };

    const handleCommand = (command: string, value?: string) => {
        if (editorRef.current) {
            document.execCommand(command, false, value);
            updateToolbarState();
        }
    };
    
    useEffect(() => {
        const editor = editorRef.current;
        if (editor) {
            document.addEventListener('selectionchange', updateToolbarState);
            editor.addEventListener('keyup', updateToolbarState);
            editor.addEventListener('mouseup', updateToolbarState);
            return () => {
                document.removeEventListener('selectionchange', updateToolbarState);
                editor.removeEventListener('keyup', updateToolbarState);
                editor.removeEventListener('mouseup', updateToolbarState);
            };
        }
    }, [updateToolbarState, editorRef]);

    const ColorPalette: React.FC<{ command: 'foreColor' | 'backColor'; activeColor: string }> = ({ command, activeColor }) => {
        const colors = command === 'foreColor'
            ? ['#0F172A', '#EF4444', '#F97316', '#EAB308', '#22C55E', '#0EA5E9', '#6366F1', '#D946EF']
            : ['#FEF08A', '#FECACA', '#BBF7D0', '#BFDBFE', '#DDD6FE', '#FBCFE8', 'transparent'];
        
        return (
            <div className="flex items-center space-x-1">
                {colors.map(color => {
                    const isActive = activeColor.toUpperCase() === (color === 'transparent' ? 'TRANSPARENT' : color.toUpperCase());
                    return (
                        <button
                            key={color}
                            type="button"
                            onMouseDown={preventLosingFocus}
                            onClick={() => handleCommand(command, color === 'transparent' ? 'white' : color)}
                            className={`h-6 w-6 rounded-full border border-gray-400/50 ${isActive ? 'ring-2 ring-offset-1 ring-offset-gray-800 ring-cyan-400' : ''}`}
                            style={{ backgroundColor: color === 'transparent' ? '#fff' : color }}
                            aria-label={color === 'transparent' ? 'Remover marca-texto' : color}
                            aria-pressed={isActive}
                        >
                         {color === 'transparent' && <XCircleIcon className="text-red-500" aria-hidden="true" />}
                        </button>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="bg-gray-800 rounded-lg border border-gray-700 shadow-inner flex flex-col h-full">
            {!isReadOnly && (
                <div role="toolbar" aria-label="Editor de texto" className="flex-shrink-0 flex items-center flex-wrap gap-y-2 p-2 border-b border-gray-700 bg-gray-900/50 rounded-t-lg">
                    <button type="button" onMouseDown={preventLosingFocus} onClick={() => handleCommand('bold')} className={`p-2 hover:bg-gray-700 rounded-md ${isBold ? 'bg-cyan-600 text-white' : 'text-gray-300'}`} aria-label="Negrito" aria-pressed={isBold}><BoldIcon className="h-5 w-5"/></button>
                    <button type="button" onMouseDown={preventLosingFocus} onClick={() => handleCommand('underline')} className={`p-2 hover:bg-gray-700 rounded-md ${isUnderline ? 'bg-cyan-600 text-white' : 'text-gray-300'}`} aria-label="Sublinhado" aria-pressed={isUnderline}><UnderlineIcon className="h-5 w-5"/></button>
                    <button type="button" onMouseDown={preventLosingFocus} onClick={() => handleCommand('insertUnorderedList')} className={`p-2 hover:bg-gray-700 rounded-md ${isList ? 'bg-cyan-600 text-white' : 'text-gray-300'}`} aria-label="Lista com marcadores" aria-pressed={isList}><ListBulletIcon className="h-5 w-5"/></button>
                    <div className="p-2 flex items-center space-x-2" role="group" aria-label="Marca-texto">
                        <HighlighterIcon className="h-5 w-5 text-yellow-400" aria-hidden="true"/>
                        <ColorPalette command="backColor" activeColor={currentBackColor} />
                    </div>
                    <div className="p-2 flex items-center space-x-2" role="group" aria-label="Cor do Texto">
                        <TextColorIcon className="h-5 w-5" aria-hidden="true"/>
                        <ColorPalette command="foreColor" activeColor={currentForeColor} />
                    </div>
                </div>
            )}
            <div className="flex-grow overflow-y-auto">
                <div
                    ref={editorRef}
                    contentEditable={!isReadOnly}
                    onBlur={handleBlur}
                    className="prose prose-sm max-w-none p-4 bg-white text-gray-900 h-full focus:outline-none rounded-b-lg [&_ul]:list-disc [&_ul]:list-inside"
                    role="textbox"
                    aria-multiline="true"
                    aria-label="Área de anotações"
                />
            </div>
        </div>
    );
});
