import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth, MemberRole } from '../context/AuthContext';
import { Box, CircularProgress } from '@mui/material';

interface ProtectedRouteProps {
    allowedRoles?: MemberRole[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles }) => {
    const { isAuthenticated, member, checkAuth } = useAuth();
    const [isLoading, setIsLoading] = React.useState(true);

    React.useEffect(() => {
        const verify = async () => {
            await checkAuth();
            setIsLoading(false);
        };
        verify();
    }, []);

    if (isLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    if (!isAuthenticated || !member) {
        return <Navigate to="/login" replace />;
    }

    if (allowedRoles && !allowedRoles.includes(member.memberRole as MemberRole)) {
        // Redirect to a specific page or home if role doesn't match
        // For now, simpler to just send to home or error page
        return <Navigate to="/" replace />;
    }

    return <Outlet />;
};

export default ProtectedRoute;
