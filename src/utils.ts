
import jsPDF from 'jspdf';
import { Question } from './types';

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (file.size > 2 * 1024 * 1024) { // 2MB limit
        return reject(new Error("O arquivo é muito grande. O limite é 2MB."));
    }
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = (error) => reject(error);
  });
};

export const getWeekDates = (date: Date): Date[] => {
    const start = new Date(date);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday to start on Monday
    start.setDate(diff);

    const week = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        week.push(d);
    }
    return week;
};

export const parseGoogleDriveUrl = (url: string): { id: string; embedUrl: string; downloadUrl: string } | null => {
    const regex = /(?:file\/d\/|id=|\/u\/\d+\/folders\/|open\?id=)([a-zA-Z0-9_-]{25,})/;
    const match = url.match(regex);
    if (match && match[1]) {
        const fileId = match[1];
        return {
            id: fileId,
            embedUrl: `https://drive.google.com/file/d/${fileId}/preview`,
            downloadUrl: `https://drive.google.com/uc?export=download&id=${fileId}`,
        };
    }
    return null;
};

export const getYoutubeVideoId = (url: string): string | null => {
    if (!url) return null;
    const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
};

export const convertMediaUrlToEmbed = (url: string | undefined): string => {
    if (!url) return '';

    if (url.includes('drive.google.com')) {
        const parsed = parseGoogleDriveUrl(url);
        if (parsed) {
            return parsed.embedUrl;
        }
    }

    if (url.includes('youtube.com') || url.includes('youtu.be')) {
        const videoId = getYoutubeVideoId(url);
        if (videoId) {
            return `https://www.youtube.com/embed/${videoId}`;
        }
    }
    
    return url;
};

export const getMediaThumbnail = (url: string): string | null => {
    if (!url) return null;
    
    // YouTube
    const ytId = getYoutubeVideoId(url);
    if (ytId) return `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`;
    
    // Google Drive
    const driveInfo = parseGoogleDriveUrl(url);
    if (driveInfo) return `https://drive.google.com/thumbnail?id=${driveInfo.id}&sz=w600`;
    
    return null;
};

export const rgbToHex = (rgb: string): string => {
    if (!rgb || !rgb.startsWith('rgb')) return rgb;
    const match = rgb.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)$/);
    if (!match) return rgb;

    const [, r, g, b] = match.map(Number);
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
};

export const markdownToHtml = (text: string): string => {
    if (!text) return '';

    const processInline = (str: string) => {
        return str
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/__(.*?)__/g, '<u>$1</u>');
    };
    
    const lines = text.split('\n');
    let html = '';
    let listType: 'ul' | 'ol' | null = null;

    for (const line of lines) {
        const trimmedLine = line.trim();
        
        const ulMatch = trimmedLine.match(/^(\*|-)\s+(.*)/);
        const olMatch = trimmedLine.match(/^(?:\d+\.|[a-zA-Z][.)]|[IVXLCDM]+\.)\s+(.*)/i); // Matches 1., a), I. etc. (case-insensitive for roman)

        if (ulMatch) {
            if (listType !== 'ul') {
                if (listType) html += `</${listType}>`; // Close previous list
                html += '<ul class="list-disc list-inside space-y-1 my-2">';
                listType = 'ul';
            }
            html += `<li>${processInline(ulMatch[2])}</li>`;
        } else if (olMatch) {
            if (listType !== 'ol') {
                if (listType) html += `</${listType}>`; // Close previous list
                html += '<ol class="list-decimal list-inside space-y-1 my-2">';
                listType = 'ol';
            }
            html += `<li>${processInline(olMatch[1])}</li>`;
        } else {
            if (listType) {
                html += `</${listType}>`; // Close any open list
                listType = null;
            }
            if (trimmedLine) {
                if (trimmedLine.startsWith('# ')) {
                    html += `<h1 class="text-2xl font-bold mb-4 mt-2">${processInline(trimmedLine.substring(2))}</h1>`;
                } else if (trimmedLine.startsWith('## ')) {
                    html += `<h2 class="text-xl font-bold mb-3 mt-2">${processInline(trimmedLine.substring(3))}</h2>`;
                } else if (trimmedLine.startsWith('### ')) {
                    html += `<h3 class="text-lg font-bold mb-2 mt-2">${processInline(trimmedLine.substring(4))}</h3>`;
                } else {
                    html += `<p class="my-2">${processInline(trimmedLine)}</p>`;
                }
            }
        }
    }
    
    if (listType) {
        html += `</${listType}>`;
    }

    return html;
};

/**
 * Retorna a data e hora atual no fuso horário de Brasília (America/Sao_Paulo).
 * Utiliza a API Intl para garantir consistência entre o que o usuário vê (relógio)
 * e a lógica do sistema (cronograma/notificações).
 */
export const getBrasiliaDate = (): Date => {
    const now = new Date();
    try {
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/Sao_Paulo',
            year: 'numeric', month: 'numeric', day: 'numeric',
            hour: 'numeric', minute: 'numeric', second: 'numeric',
            hour12: false
        });
        const parts = formatter.formatToParts(now);
        const getPart = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0');
        
        // Criamos um objeto Date que "finge" ser local para facilitargetHours/getMinutes, 
        // mas com os valores numéricos reais de Brasília.
        const brDate = new Date();
        brDate.setFullYear(getPart('year'), getPart('month') - 1, getPart('day'));
        brDate.setHours(getPart('hour'), getPart('minute'), getPart('second'), now.getMilliseconds());
        return brDate;
    } catch (e) {
        // Fallback para UTC-3 caso a API Intl falhe (raro em browsers modernos)
        const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
        return new Date(utc + (3600000 * -3));
    }
};


export const getLocalDateISOString = (date: Date): string => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};


// --- CÓDIGO DE GERAÇÃO DE PDF (VERSÃO AVANÇADA) ---

interface ContentItem {
    originalText: string;
    prefix?: string;
    isBold: boolean;
    isLastOption?: boolean;
}

const FONT_FAMILY = 'helvetica';
const FONT_SIZE_NORMAL = 10;
const FONT_SIZE_LARGE = 18;

const UNIFORM_MARGIN_PT = 36;
const QUESTION_COLUMN_GUTTER_PT = 20;

const SPACE_AFTER_QUESTION_STATEMENT_PT = 5;
const SPACE_BETWEEN_OPTIONS_PT = 2;
const SPACE_AFTER_QUESTION_BLOCK_PT = 12;

const MIN_CONTENT_HEIGHT_TO_ATTEMPT_DRAW = FONT_SIZE_NORMAL * 1.5 * 2;

function drawPartialContent(
    doc: jsPDF,
    items: ContentItem[],
    startX: number,
    startY: number,
    columnWidth: number,
    availableHeight: number
): { yAfter: number, remainingItems: ContentItem[] } {
    let currentY = startY;
    const remainingItemsOutput: ContentItem[] = [];
    const lineHeight = FONT_SIZE_NORMAL * 1.2;

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        
        const heightLeftInColumn = (startY + availableHeight) - currentY;
        
        doc.setFont(FONT_FAMILY, item.isBold ? 'bold' : 'normal');
        doc.setFontSize(FONT_SIZE_NORMAL);
        
        const textToSplit = (item.prefix || '') + item.originalText;
        const allLines = doc.splitTextToSize(textToSplit, columnWidth);
        
        let linesThatFit: string[] = [];
        let remainingLinesForThisItem: string[] = [];
        let spaceTakenByCurrentItem = 0;

        for (const line of allLines) {
            if (spaceTakenByCurrentItem + lineHeight <= heightLeftInColumn) {
                linesThatFit.push(line);
                spaceTakenByCurrentItem += lineHeight;
            } else {
                remainingLinesForThisItem.push(line);
            }
        }

        if (linesThatFit.length > 0) {
            doc.text(linesThatFit, startX, currentY, { align: 'justify', maxWidth: columnWidth });
            currentY += linesThatFit.length * lineHeight;
        }

        if (remainingLinesForThisItem.length > 0) {
             remainingItemsOutput.push({
                ...item,
                originalText: remainingLinesForThisItem.join(' '),
                prefix: linesThatFit.length > 0 ? (item.prefix?.startsWith(' ') ? '  ' : '') : item.prefix,
            });
            remainingItemsOutput.push(...items.slice(i + 1));
            break; 
        }

        const heightLeftAfterText = (startY + availableHeight) - currentY;
        let spaceAfter = 0;
        if (item.prefix?.match(/^\d+\./)) {
            spaceAfter = SPACE_AFTER_QUESTION_STATEMENT_PT;
        } else if (!item.isLastOption) {
            spaceAfter = SPACE_BETWEEN_OPTIONS_PT;
        }

        if (spaceAfter <= heightLeftAfterText) {
             currentY += spaceAfter;
        }
    }

    return { yAfter: currentY, remainingItems: remainingItemsOutput };
}

function drawAnswerKeyPage(doc: jsPDF, questions: Question[], layoutProps: { PAGE_WIDTH: number, PAGE_HEIGHT: number, UNIFORM_MARGIN_PT: number }) {
    doc.addPage();
    let currentY = layoutProps.UNIFORM_MARGIN_PT;

    doc.setFont(FONT_FAMILY, 'bold');
    doc.setFontSize(FONT_SIZE_LARGE);
    doc.text("Gabarito Oficial", layoutProps.PAGE_WIDTH / 2, currentY, { align: 'center' });
    currentY += doc.getTextDimensions("Gabarito Oficial").h * 2;

    doc.setFontSize(FONT_SIZE_NORMAL);
    
    questions.forEach((q, index) => {
        if (currentY > layoutProps.PAGE_HEIGHT - layoutProps.UNIFORM_MARGIN_PT) {
            doc.addPage();
            currentY = layoutProps.UNIFORM_MARGIN_PT;
        }
        const answerIndex = q.options.findIndex(opt => opt === q.correctAnswer);
        const letter = answerIndex > -1 ? String.fromCharCode(65 + answerIndex) : '?';
        const answerText = `Questão ${index + 1}: ${letter}`;
        doc.setFont(FONT_FAMILY, 'normal');
        doc.text(answerText, layoutProps.UNIFORM_MARGIN_PT, currentY);
        currentY += FONT_SIZE_NORMAL * 1.5;
    });
}

export const generateQuestionsPdf = (questions: Question[], topicName: string, subjectName?: string): string => {
    if (questions.length === 0) {
        alert("Não há questões para gerar o PDF.");
        return '';
    }

    const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
    const PAGE_WIDTH = doc.internal.pageSize.getWidth();
    const PAGE_HEIGHT = doc.internal.pageSize.getHeight();
    const CONTENT_WIDTH_TOTAL = PAGE_WIDTH - 2 * UNIFORM_MARGIN_PT;

    // --- START: HEADER SECTION ---
    let yPos = UNIFORM_MARGIN_PT;
    
    // Column 1: Logo
    const logoUrl = "https://i.ibb.co/B5mR4PG0/ppuw.png";
    const logoWidth = 70;
    const logoHeight = 34;
    const logoX = UNIFORM_MARGIN_PT;
    doc.addImage(logoUrl, 'PNG', logoX, yPos, logoWidth, logoHeight);
    
    // Column 2: Info
    const col2X = UNIFORM_MARGIN_PT + logoWidth + 20;
    let col2Y = UNIFORM_MARGIN_PT + 8;
    
    doc.setFontSize(FONT_SIZE_NORMAL);
    
    // B1: Aluno(a)
    doc.setFont(FONT_FAMILY, 'bold');
    const studentNamePrefix = "Aluno(a):";
    doc.text(studentNamePrefix, col2X, col2Y);
    const studentPrefixWidth = doc.getTextWidth(studentNamePrefix);
    doc.setLineWidth(0.5);
    doc.line(col2X + studentPrefixWidth + 5, col2Y, PAGE_WIDTH - UNIFORM_MARGIN_PT, col2Y);
    col2Y += FONT_SIZE_NORMAL * 1.5;

    // B2: Disciplina
    if (subjectName) {
        doc.setFont(FONT_FAMILY, 'bold');
        const subjectPrefix = `Disciplina:`;
        doc.text(subjectPrefix, col2X, col2Y);
        const subjectPrefixWidth = doc.getTextWidth(subjectPrefix);
        
        doc.setFont(FONT_FAMILY, 'normal');
        doc.text(subjectName, col2X + subjectPrefixWidth + 5, col2Y);
        col2Y += FONT_SIZE_NORMAL * 1.5;
    }
    
    // B3: Quantidade de Questões
    const totalQuestions = questions.length;
    doc.setFont(FONT_FAMILY, 'bold');
    const questionsPrefix = "Total de questões:";
    doc.text(questionsPrefix, col2X, col2Y);
    const questionsPrefixWidth = doc.getTextWidth(questionsPrefix);

    doc.setFont(FONT_FAMILY, 'normal');
    const countText = `${totalQuestions} ${totalQuestions === 1 ? 'questão' : 'questões'}`;
    doc.text(countText, col2X + questionsPrefixWidth + 5, col2Y);
    
    const headerEndY = Math.max(yPos + logoHeight, col2Y);
    
    // Title
    yPos = headerEndY + 30;
    doc.setFont(FONT_FAMILY, 'bold');
    doc.setFontSize(FONT_SIZE_LARGE);
    doc.text(topicName, PAGE_WIDTH / 2, yPos, { align: 'center' });
    yPos += doc.getTextDimensions(topicName).h + 15;

    // Separator line
    doc.setLineWidth(1);
    doc.line(UNIFORM_MARGIN_PT, yPos, PAGE_WIDTH - UNIFORM_MARGIN_PT, yPos);
    yPos += 15;
    
    // --- END: HEADER SECTION ---

    const questionsStartGlobalY = yPos;
    const footerHeight = FONT_SIZE_NORMAL * 3;
    const contentLimitY = PAGE_HEIGHT - UNIFORM_MARGIN_PT - footerHeight;

    let currentPageNum = 1;
    let yPosLeftCol = questionsStartGlobalY;
    let yPosRightCol = questionsStartGlobalY;
    let currentActiveColumn = 'left';

    const columnContentWidth = (CONTENT_WIDTH_TOTAL - QUESTION_COLUMN_GUTTER_PT) / 2;
    const xLeftCol = UNIFORM_MARGIN_PT;
    const xRightCol = UNIFORM_MARGIN_PT + columnContentWidth + QUESTION_COLUMN_GUTTER_PT;

    for (let qIdx = 0; qIdx < questions.length; qIdx++) {
        const q = questions[qIdx];
        let contentItemsForQuestion: ContentItem[] = [
            { originalText: `${qIdx + 1}. ${q.statement}`, prefix: ``, isBold: true },
            ...q.options.map((opt, optIdx) => ({
                originalText: opt,
                prefix: `  ${String.fromCharCode(97 + optIdx)}) `,
                isBold: false,
                isLastOption: optIdx === q.options.length - 1
            }))
        ];
        
        let questionFullyDrawn = false;
        while (!questionFullyDrawn) {
            const currentX = currentActiveColumn === 'left' ? xLeftCol : xRightCol;
            let currentYPos = currentActiveColumn === 'left' ? yPosLeftCol : yPosRightCol;
            const availableColHeight = contentLimitY - currentYPos;

            if (availableColHeight < MIN_CONTENT_HEIGHT_TO_ATTEMPT_DRAW) {
                if (currentActiveColumn === 'left') {
                    currentActiveColumn = 'right';
                    continue;
                } else {
                    doc.addPage();
                    currentPageNum++;
                    yPosLeftCol = UNIFORM_MARGIN_PT;
                    yPosRightCol = UNIFORM_MARGIN_PT;
                    currentActiveColumn = 'left';
                    continue;
                }
            }

            const drawResult = drawPartialContent(doc, contentItemsForQuestion, currentX, currentYPos, columnContentWidth, availableColHeight);

            if (currentActiveColumn === 'left') {
                yPosLeftCol = drawResult.yAfter;
            } else {
                yPosRightCol = drawResult.yAfter;
            }
            
            contentItemsForQuestion = drawResult.remainingItems;

            if (contentItemsForQuestion.length === 0) {
                questionFullyDrawn = true;
                if (currentActiveColumn === 'left') {
                    yPosLeftCol += SPACE_AFTER_QUESTION_BLOCK_PT;
                } else {
                    yPosRightCol += SPACE_AFTER_QUESTION_BLOCK_PT;
                }
            } else {
                if (currentActiveColumn === 'left') {
                    currentActiveColumn = 'right';
                } else {
                    doc.addPage();
                    currentPageNum++;
                    yPosLeftCol = UNIFORM_MARGIN_PT;
                    yPosRightCol = UNIFORM_MARGIN_PT;
                    currentActiveColumn = 'left';
                }
            }
        }
    }

    drawAnswerKeyPage(doc, questions, { PAGE_WIDTH, PAGE_HEIGHT, UNIFORM_MARGIN_PT });
    
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        
        const footerY = PAGE_HEIGHT - UNIFORM_MARGIN_PT;
        doc.setFont(FONT_FAMILY, 'normal');
        doc.setFontSize(FONT_SIZE_NORMAL - 2);
        
        const pageNumText = `Página ${i} de ${totalPages}`;
        const pageNumTextWidth = doc.getTextWidth(pageNumText);
        doc.text(pageNumText, PAGE_WIDTH - UNIFORM_MARGIN_PT - pageNumTextWidth, footerY);
    }

    return doc.output('datauristring');
};
