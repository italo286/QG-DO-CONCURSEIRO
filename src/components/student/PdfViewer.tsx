import React from 'react';
import { PdfFile } from '../../types';
import { XCircleIcon, DownloadIcon, ArrowsExpandIcon } from '../Icons';
import { parseGoogleDriveUrl } from '../../utils';

// Função para verificar se está rodando na WebView
// Você pode colocar isso em um arquivo de utilitários
const isInsideWebView = () => {
    // A WebView do Android por padrão inclui "; wv" no User Agent
    return /; wv\)/.test(navigator.userAgent);
};


export const PdfViewer: React.FC<{ file: PdfFile }> = ({ file }) => {
    if (!file.url) {
        return (
            <div className="flex flex-col justify-center items-center h-full text-center p-4">
                <XCircleIcon className="h-16 w-16 text-red-500 mb-4" />
                <h3 className="text-xl font-semibold text-white">Nenhum arquivo PDF selecionado</h3>
                <p className="text-gray-400 mt-2 text-sm max-w-md">
                    Selecione um PDF da lista para visualizá-lo.
                </p>
            </div>
        );
    }

    const googleDriveUrls = parseGoogleDriveUrl(file.url);

    const viewerUrl = googleDriveUrls
        ? googleDriveUrls.embedUrl
        : `https://docs.google.com/gview?url=${encodeURIComponent(file.url)}&embedded=true`;

    const downloadUrl = googleDriveUrls
        ? googleDriveUrls.downloadUrl
        : file.url;

    // Não precisamos mais da fullscreenUrl, pois vamos esconder o botão
    const fullscreenUrl = googleDriveUrls
        ? googleDriveUrls.embedUrl
        : file.url;

    const displayedFileName = file.fileName;

    // Variavel para controlar a visibilidade do botão
    const showFullscreenButton = !isInsideWebView();

    return (
        <div className="bg-gray-900 rounded-lg h-full flex flex-col">
            <div className="flex-shrink-0 bg-gray-800 p-2 flex justify-between items-center border-b border-gray-700">
                <span className="text-sm font-semibold truncate text-gray-300" title={displayedFileName}>
                    {displayedFileName}
                </span>
                <div className="flex items-center space-x-2">
                    <a href={downloadUrl} download={displayedFileName} target="_blank" rel="noopener noreferrer" className="p-2 text-gray-400 hover:text-white" title="Baixar PDF">
                        <DownloadIcon className="h-5 w-5" />
                        <span className="sr-only">Baixar PDF</span>
                    </a>
                    
                    {/* // --- ALTERAÇÃO AQUI --- // */}
                    {/* // O botão só será renderizado se não estiver na WebView */}
                    {showFullscreenButton && (
                         <a href={fullscreenUrl} target="_blank" rel="noopener noreferrer" className="p-2 text-gray-400 hover:text-white" title="Abrir em nova aba">
                            <ArrowsExpandIcon className="h-5 w-5" />
                            <span className="sr-only">Abrir em nova aba</span>
                        </a>
                    )}

                </div>
            </div>
            <div className="flex-grow min-h-0">
                <iframe
                    src={viewerUrl}
                    className="w-full h-full border-0"
                    title={`Visualizador de PDF para ${displayedFileName}`}
                    sandbox="allow-scripts allow-same-origin"
                    allowFullScreen
                ></iframe>
            </div>
        </div>
    );
};