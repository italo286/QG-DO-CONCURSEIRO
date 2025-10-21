import React from 'react';
import { PdfFile } from '../../types';
import { XCircleIcon, DownloadIcon, ArrowsExpandIcon } from '../Icons';
import { parseGoogleDriveUrl } from '../../utils';

// Função para verificar se está rodando na WebView
const isInsideWebView = () => {
    // Acessa o objeto "Android" que criamos na MainActivity
    return (window as any).Android && typeof (window as any).Android.openPdfFullscreen === 'function';
};

export const PdfViewer: React.FC<{ file: PdfFile }> = ({ file }) => {
    
    // 1. Verificação inicial: se não houver URL, exibe a mensagem de erro e para a execução.
    if (!file.url) {
        return (
            <div className="flex flex-col justify-center items-center h-full text-center p-4">
                {/* O XCircleIcon é usado aqui, resolvendo o erro da "Linha 65" */}
                <XCircleIcon className="h-16 w-16 text-red-500 mb-4" />
                <h3 className="text-xl font-semibold text-white">Nenhum arquivo PDF selecionado</h3>
                <p className="text-gray-400 mt-2 text-sm max-w-md">
                    Selecione um PDF da lista para visualizá-lo.
                </p>
            </div>
        );
    }

    // --- LÓGICA PRINCIPAL ---
    // A partir daqui, o TypeScript sabe que 'file.url' é uma string e não 'undefined'.
    // Isso corrige os erros das "Linhas 66-69".

    const googleDriveUrls = parseGoogleDriveUrl(file.url);

    const viewerUrl = googleDriveUrls
        ? googleDriveUrls.embedUrl
        : `https://docs.google.com/gview?url=${encodeURIComponent(file.url)}&embedded=true`;

    const downloadUrl = googleDriveUrls
        ? googleDriveUrls.downloadUrl
        : file.url;

    const fullscreenUrlForNative = viewerUrl;

    const fullscreenUrlForBrowser = googleDriveUrls
        ? googleDriveUrls.embedUrl
        : file.url;

    const displayedFileName = file.fileName;

    const handleFullscreenClick = () => {
        if (isInsideWebView()) {
            (window as any).Android.openPdfFullscreen(fullscreenUrlForNative);
        }
    };

    // 2. Renderização principal: se a URL existir, mostra o visualizador.
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
                    
                    {isInsideWebView() ? (
                        <button onClick={handleFullscreenClick} className="p-2 text-gray-400 hover:text-white" title="Tela Cheia">
                            <ArrowsExpandIcon className="h-5 w-5" />
                            <span className="sr-only">Tela Cheia</span>
                        </button>
                    ) : (
                        <a href={fullscreenUrlForBrowser} target="_blank" rel="noopener noreferrer" className="p-2 text-gray-400 hover:text-white" title="Abrir em nova aba">
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