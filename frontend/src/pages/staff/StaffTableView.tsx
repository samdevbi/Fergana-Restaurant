import { useEffect, useState } from 'react';
import { Box, Container, Grid, Typography, CircularProgress, Alert, Paper } from '@mui/material';
import api from '../../services/api';

interface Table {
    _id: string;
    tableNumber: string;
    status: 'ACTIVE' | 'OCCUPIED' | 'PAUSE' | 'BLOCK';
    capacity: number;
    location: string;
}

const StaffTableView = () => {
    const [tables, setTables] = useState<Table[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchTables = async () => {
        try {
            const response = await api.get('/staff/service/getTables');
            if (response.data && response.data.tables) {
                setTables(response.data.tables);
            }
        } catch (err) {
            console.error("Failed to fetch tables", err);
            setError("Failed to load tables");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTables();
        const interval = setInterval(fetchTables, 10000); // Poll every 10s
        return () => clearInterval(interval);
    }, []);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'ACTIVE': return '#4caf50'; // Green
            case 'OCCUPIED': return '#f44336'; // Red
            case 'BLOCK': return '#9e9e9e'; // Grey
            case 'PAUSE': return '#ff9800'; // Orange
            default: return '#e0e0e0';
        }
    };

    if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}><CircularProgress /></Box>;

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            <Typography variant="h4" gutterBottom>
                Table Status
            </Typography>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <Grid container spacing={4}>
                {tables.map((table) => (
                    <Grid size={{ xs: 6, sm: 4, md: 3 }} key={table._id}>
                        <Paper
                            elevation={3}
                            sx={{
                                height: 150,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                bgcolor: getStatusColor(table.status),
                                color: 'white',
                                borderRadius: 4,
                                cursor: 'pointer',
                                transition: 'transform 0.2s',
                                '&:hover': {
                                    transform: 'scale(1.05)',
                                }
                            }}
                        >
                            <Typography variant="h3" fontWeight="bold">
                                {table.tableNumber}
                            </Typography>
                            <Typography variant="subtitle1">
                                {table.status}
                            </Typography>
                            <Typography variant="caption">
                                {table.capacity} Seats
                            </Typography>
                        </Paper>
                    </Grid>
                ))}
            </Grid>
        </Container>
    );
};

export default StaffTableView;
