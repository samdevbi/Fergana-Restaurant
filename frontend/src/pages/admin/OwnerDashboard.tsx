import { useEffect, useState } from 'react';
import { Box, Container, Grid, Typography, CircularProgress, Card, CardContent } from '@mui/material';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
// import { useNavigate } from 'react-router-dom';

interface DashboardData {
    today: {
        ordersCount: number;
        revenue: number;
    };
    tables: {
        total: number;
        active: number;
        occupied: number;
        paused: number;
        blocked: number;
    };
}

const OwnerDashboard = () => {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const { logout } = useAuth();

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await api.get('/admin/analytics/getDashboard');
                setData(response.data);
            } catch (error) {
                console.error("Failed to fetch dashboard data", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
                <Typography variant="h4" gutterBottom>
                    Owner Dashboard
                </Typography>
                <Typography variant="body1" sx={{ cursor: 'pointer', color: 'blue' }} onClick={logout}>
                    Logout
                </Typography>
            </Box>

            <Grid container spacing={3}>
                {/* Revenue Card */}
                <Grid size={{ xs: 12, md: 6, lg: 4 }}>
                    <Card sx={{ bgcolor: '#e3f2fd' }}>
                        <CardContent>
                            <Typography color="text.secondary" gutterBottom>
                                Today's Revenue
                            </Typography>
                            <Typography variant="h3">
                                ${data?.today.revenue.toLocaleString()}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>

                {/* Orders Card */}
                <Grid size={{ xs: 12, md: 6, lg: 4 }}>
                    <Card sx={{ bgcolor: '#e8f5e9' }}>
                        <CardContent>
                            <Typography color="text.secondary" gutterBottom>
                                Today's Orders
                            </Typography>
                            <Typography variant="h3">
                                {data?.today.ordersCount}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>

                {/* Active Tables Card */}
                <Grid size={{ xs: 12, md: 6, lg: 4 }}>
                    <Card sx={{ bgcolor: '#fff3e0' }}>
                        <CardContent>
                            <Typography color="text.secondary" gutterBottom>
                                Active Tables
                            </Typography>
                            <Typography variant="h3">
                                {data?.tables.active} / {data?.tables.total}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
        </Container>
    );
};

export default OwnerDashboard;
