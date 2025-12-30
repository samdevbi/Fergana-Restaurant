import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

export const MemberRole = {
    OWNER: "OWNER",
    CHEFF: "CHEFF",
    STAFF: "STAFF",
    USER: "USER",
} as const;

export type MemberRole = typeof MemberRole[keyof typeof MemberRole];

interface Member {
    _id: string;
    memberRole: MemberRole;
    memberName: string;
}

interface AuthContextType {
    member: Member | null;
    isAuthenticated: boolean;
    login: (member: Member) => void;
    logout: () => void;
    checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [member, setMember] = useState<Member | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        try {
            // Assuming there's an endpoint to get current user info based on cookie
            // If not, we might need to rely on the backend response during login or initial load
            // For now, implementing basic structure. You might need to add /member/detail or similar endpoint
            const response = await api.get('/member/detail');
            if (response.data) {
                setMember(response.data);
                setIsAuthenticated(true);
            }
        } catch (error) {
            console.log("Not authenticated");
            setIsAuthenticated(false);
            setMember(null);
        }
    };

    const login = (memberData: Member) => {
        setMember(memberData);
        setIsAuthenticated(true);
    };

    const logout = async () => {
        try {
            await api.post('/member/logout');
            setMember(null);
            setIsAuthenticated(false);
        } catch (error) {
            console.error("Logout failed", error);
        }
    };

    return (
        <AuthContext.Provider value={{ member, isAuthenticated, login, logout, checkAuth }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};
