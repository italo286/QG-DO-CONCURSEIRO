import React, { useState, useEffect, useCallback, useRef } from 'react';
import { VideoFile } from '../../types';
import { getYoutubeVideoId } from '../../utils';
import { VideoPlayerModal } from './VideoPlayerModal';
import { VideoCameraIcon } from '../Icons';

export const YouTubeCarousel: React.FC<{
    videos: VideoFile[];
}> = ({ videos }) => {
    const [playingVideo, setPlayingVideo] = useState<VideoFile | null>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const timeoutRef = useRef<number | null>(null);

    const resetTimeout = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
    }, []);

    useEffect(() => {
        if (videos.length <= 1) return; // Don't auto-play if only one or no videos

        resetTimeout();
        if (!isPaused) {
            timeoutRef.current = window.setTimeout(
                () =>
                    setCurrentIndex((prevIndex) =>
                        prevIndex === videos.length - 1 ? 0 : prevIndex + 1
                    ),
                5000 // Change slide every 5 seconds
            );
        }
        return () => {
            resetTimeout();
        };
    }, [currentIndex, videos.length, isPaused, resetTimeout]);

    if (!videos || videos.length === 0) {
        return null;
    }

    const getThumbnailUrl = (url: string) => {
        const videoId = getYoutubeVideoId(url);
        // Using hqdefault for better quality
        return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;
    };

    const goToPrevious = () => {
        const isFirstSlide = currentIndex === 0;
        const newIndex = isFirstSlide ? videos.length - 1 : currentIndex - 1;
        setCurrentIndex(newIndex);
    };

    const goToNext = useCallback(() => {
        const isLastSlide = currentIndex === videos.length - 1;
        const newIndex = isLastSlide ? 0 : currentIndex + 1;
        setCurrentIndex(newIndex);
    }, [currentIndex, videos.length]);
    
    const goToSlide = (slideIndex: number) => {
        setCurrentIndex(slideIndex);
    }

    return (
        <>
            <div 
                className="flex flex-col gap-4"
                onMouseEnter={() => setIsPaused(true)}
                onMouseLeave={() => setIsPaused(false)}
            >
                <div 
                    className="relative w-full aspect-video rounded-xl overflow-hidden shadow-lg"
                    aria-roledescription="carousel"
                    aria-label="Vídeos recomendados"
                >
                    {/* Slider Track */}
                    <div 
                        className="flex transition-transform duration-700 ease-in-out h-full"
                        style={{ transform: `translateX(-${currentIndex * 100}%)` }}
                    >
                        {videos.map((video, index) => {
                            const thumbnailUrl = getThumbnailUrl(video.url);
                            return (
                                <div 
                                    key={video.id || index} 
                                    onClick={() => setPlayingVideo(video)} 
                                    className="flex-shrink-0 w-full h-full relative cursor-pointer group"
                                    role="group"
                                    aria-label={`Slide ${index + 1} de ${videos.length}: ${video.name}`}
                                >
                                    {thumbnailUrl ? (
                                        <img src={thumbnailUrl} alt={video.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                                            <VideoCameraIcon className="h-20 w-20 text-gray-600" />
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent"></div>
                                    <div className="absolute bottom-0 left-0 p-4 md:p-6 text-white">
                                        <h3 className="font-bold text-lg md:text-xl drop-shadow-md">{video.name}</h3>
                                    </div>
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                        <svg className="w-16 h-16 text-white/80" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd"></path></svg>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
                
                {/* Navigation controls */}
                {videos.length > 1 && (
                    <div className="flex justify-center items-center gap-4">
                        <button onClick={goToPrevious} className="bg-gray-700 hover:bg-gray-600 text-white p-2 rounded-full transition-colors" aria-label="Vídeo anterior">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                        </button>

                        <div className="flex space-x-2" role="tablist">
                            {videos.map((_, slideIndex) => (
                                <button
                                    key={slideIndex}
                                    onClick={() => goToSlide(slideIndex)}
                                    className={`w-3 h-3 rounded-full transition-colors ${currentIndex === slideIndex ? 'bg-cyan-400' : 'bg-gray-600 hover:bg-gray-500'}`}
                                    aria-label={`Ir para o vídeo ${slideIndex + 1}`}
                                    role="tab"
                                    aria-selected={currentIndex === slideIndex}
                                ></button>
                            ))}
                        </div>

                        <button onClick={goToNext} className="bg-gray-700 hover:bg-gray-600 text-white p-2 rounded-full transition-colors" aria-label="Próximo vídeo">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                        </button>
                    </div>
                )}
            </div>

            <VideoPlayerModal
                isOpen={!!playingVideo}
                onClose={() => setPlayingVideo(null)}
                video={playingVideo}
            />
        </>
    );
};
