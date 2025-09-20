import { useState, useEffect } from 'react';
import { auth } from '../firebaseConfig';
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

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (authUser) => {
            if (authUser) {
                try {
                    // Fetch profile from Firestore to get role and other details
                    const userProfile = await FirebaseService.getUserProfile(authUser.uid);
                    if (userProfile) {
                        setCurrentUser(userProfile);
                    } else {
                        // This case can happen if user exists in Auth but not in Firestore DB.
                        // For this app, we log them out.
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

        // Cleanup subscription on unmount
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