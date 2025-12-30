import { useEffect, useState } from 'react';
import { Box, Container, Grid, Card, CardContent, Typography, Chip, CircularProgress, Alert } from '@mui/material';
import api from '../../services/api';

interface OrderItem {
    _id: string;
    itemQuantity: number;
    productData: {
        productName: string;
        productPrice: number;
    }[];
}

interface Order {
    _id: string;
    orderNumber: string;
    tableNumber: number;
    orderStatus: string;
    orderItems: OrderItem[];
    createdAt: string;
}

const KitchenOrderView = () => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchOrders = async () => {
        try {
            const response = await api.get('/staff/kitchen/getOrders');
            if (response.data && response.data.orders) {
                setOrders(response.data.orders);
            }
        } catch (err) {
            console.error("Failed to fetch orders", err);
            setError("Failed to load orders");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOrders();
        const interval = setInterval(fetchOrders, 30000); // Poll every 30s
        return () => clearInterval(interval);
    }, []);



    if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}><CircularProgress /></Box>;

    return (
        <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
            <Typography variant="h4" gutterBottom>
                Kitchen Orders
            </Typography>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <Grid container spacing={3}>
                {orders.length === 0 ? (
                    <Box sx={{ p: 3 }}><Typography>No active orders</Typography></Box>
                ) : (
                    orders.map((order) => (
                        <Grid size={{ xs: 12, md: 6, lg: 4 }} key={order._id}>
                            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', border: '1px solid #ddd' }}>
                                <CardContent sx={{ flexGrow: 1 }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                        <Typography variant="h5" component="div">
                                            Table {order.tableNumber}
                                        </Typography>
                                        <Chip label={order.orderStatus} color={order.orderStatus === 'PROCESS' ? 'warning' : 'default'} />
                                    </Box>
                                    <Typography color="text.secondary" gutterBottom>
                                        Order #{order.orderNumber}
                                    </Typography>
                                    <Box sx={{ mt: 2 }}>
                                        {order.orderItems.map((item, idx) => (
                                            <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, borderBottom: '1px dashed #eee', pb: 1 }}>
                                                <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                                                    {item.productData[0]?.productName || 'Unknown Item'}
                                                </Typography>
                                                <Typography variant="body1">
                                                    x{item.itemQuantity}
                                                </Typography>
                                            </Box>
                                        ))}
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>
                    ))
                )}
            </Grid>
        </Container>
    );
};

export default KitchenOrderView;
