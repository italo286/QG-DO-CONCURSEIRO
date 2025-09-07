import React from 'react';
import { PdfFile } from '../../types';
import { XCircleIcon, DownloadIcon, ArrowsExpandIcon } from '../Icons';
import { parseGoogleDriveUrl } from '../../utils';

const isInsideWebView = () => {
    // Acessa o objeto "Android" que criamos na MainActivity
    return (window as any).Android && typeof (window as any).Android.openPdfFullscreen === 'function';
};

export const PdfViewer: React.FC<{ file: PdfFile }> = ({ file }) => {
    // ... (código para quando não há arquivo selecionado permanece o mesmo) ...

    const googleDriveUrls = parseGoogleDriveUrl(file.url);

    const viewerUrl = googleDriveUrls
        ? googleDriveUrls.embedUrl
        : `https://docs.google.com/gview?url=${encodeURIComponent(file.url)}&embedded=true`;

    const downloadUrl = googleDriveUrls
        ? googleDriveUrls.downloadUrl
        : file.url;
    
    // URL para ser usada no modo tela cheia (usaremos a do Google Viewer para consistência)
    const fullscreenUrlForNative = viewerUrl; 

    // URL para abrir em nova aba no navegador
    const fullscreenUrlForBrowser = googleDriveUrls
        ? googleDriveUrls.embedUrl
        : file.url;

    const displayedFileName = file.fileName;

    const handleFullscreenClick = () => {
        if (isInsideWebView()) {
            // Se estiver na WebView, chama a função nativa do Android
            (window as any).Android.openPdfFullscreen(fullscreenUrlForNative);
        }
    };

    return (
        <div className="bg-gray-900 rounded-lg h-full flex flex-col">
            <div className="flex-shrink-0 bg-gray-800 p-2 flex justify-between items-center border-b border-gray-700">
                {/* ... (código do nome do arquivo e botão de download permanece o mesmo) ... */}
                <div className="flex items-center space-x-2">
                    <a href={downloadUrl} download={displayedFileName} target="_blank" rel="noopener noreferrer" className="p-2 text-gray-400 hover:text-white" title="Baixar PDF">
                        <DownloadIcon className="h-5 w-5" />
                    </a>
                    
                    {/* // --- BOTÃO DE TELA CHEIA COM LÓGICA DIFERENTE --- // */}
                    {isInsideWebView() ? (
                        // Botão para o App Android (chama a função JS)
                        <button onClick={handleFullscreenClick} className="p-2 text-gray-400 hover:text-white" title="Tela Cheia">
                            <ArrowsExpandIcon className="h-5 w-5" />
                        </button>
                    ) : (
                        // Link para o Navegador (abre em nova aba)
                        <a href={fullscreenUrlForBrowser} target="_blank" rel="noopener noreferrer" className="p-2 text-gray-400 hover:text-white" title="Abrir em nova aba">
                            <ArrowsExpandIcon className="h-5 w-5" />
                        </a>
                    )}
                </div>
            </div>
            <div className="flex-grow min-h-0">
                <iframe src={viewerUrl} /* ... props do iframe ... */ ></iframe>
            </div>
        </div>
    );
};