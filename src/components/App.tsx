
import { useState, useEffect } from 'react';
import { auth, messaging } from '../firebaseConfig';
import * as FirebaseService from '../services/firebaseService';
import { User } from '../types';
import { LoginPage } from './auth';
import { ProfessorDashboard } from './ProfessorDashboard';
import { StudentDashboard } from './student/StudentDashboard';
import { Spinner } from './ui';

window.androidGoBack = () => {
  if (window.customGoBack && typeof window.customGoBack === 'function') {
    return window.customGoBack();
  }
  return false;
};

export const App = () => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isStudentView, setIsStudentView] = useState(false);

    // --- Notificações Push ---
    const setupNotifications = async (userId: string) => {
        if (!messaging) return;

        try {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                const token = await messaging.getToken();
                if (token) {
                    await FirebaseService.updateUserFcmToken(userId, token);
                    console.log("FCM Token registrado:", token);
                    
                    // Se estiver no Android, avisa a interface nativa
                    if ((window as any).Android && typeof (window as any).Android.onFcmTokenRegistered === 'function') {
                        (window as any).Android.onFcmTokenRegistered(token);
                    }
                }
            }
        } catch (error) {
            console.error("Erro ao configurar notificações:", error);
        }
    };

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (authUser) => {
            if (authUser) {
                try {
                    const userProfile = await FirebaseService.getUserProfile(authUser.uid);
                    if (userProfile) {
                        setCurrentUser(userProfile);
                        // Tenta registrar o token push após login bem-sucedido
                        setupNotifications(authUser.uid);
                    } else {
                        await auth.signOut();
                        setCurrentUser(null);
                    }
                } catch (error) {
                    console.error("Error fetching user profile:", error);
                    await auth.signOut();
                    setCurrentUser(null);
                }
            } else {
                setCurrentUser(null);
            }
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleLogout = async () => {
        try {
            await auth.signOut();
            setCurrentUser(null);
        } catch (error) {
            console.error("Error signing out:", error);
        }
    };
    
    const handleUpdateUser = (updatedUser: User) => {
        setCurrentUser(updatedUser);
    }

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-900">
                <Spinner />
            </div>
        );
    }

    if (!currentUser) {
        return <LoginPage />;
    }
    
    if (isStudentView && currentUser.role === 'professor') {
        return <StudentDashboard 
            user={currentUser} 
            onLogout={() => {}} 
            onUpdateUser={() => {}} 
            isPreview={true} 
            onToggleStudentView={() => setIsStudentView(false)}
        />
    }

    if (currentUser.role === 'professor') {
        return <ProfessorDashboard user={currentUser} onLogout={handleLogout} onUpdateUser={handleUpdateUser} />;
    }
    
    return <StudentDashboard user={currentUser} onLogout={handleLogout} onUpdateUser={handleUpdateUser} />;
};
