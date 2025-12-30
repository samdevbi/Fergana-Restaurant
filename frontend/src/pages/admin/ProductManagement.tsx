import { useEffect, useState } from 'react';
import {
    Box,
    Container,
    Typography,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Alert,
    IconButton,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import api from '../../services/api';
import { ProductCollection, ProductStatus } from '../../types/product.enum';

interface Product {
    _id: string;
    productNameUz: string;
    productNameKr: string;
    productPrice: number;
    productStatus: ProductStatus;
    productCollection: ProductCollection;
    productDesc: string;
    productImage: string;
}

const ProductManagement = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [open, setOpen] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [currentId, setCurrentId] = useState<string | null>(null);
    const [formData, setFormData] = useState<{
        productNameUz: string;
        productNameKr: string;
        productPrice: number;
        productStatus: ProductStatus;
        productCollection: ProductCollection;
        productDesc: string;
    }>({
        productNameUz: '',
        productNameKr: '',
        productPrice: 0,
        productStatus: ProductStatus.PROCESS,
        productCollection: ProductCollection.DISH,
        productDesc: '',
    });
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [error, setError] = useState('');

    const fetchProducts = async () => {
        try {
            const response = await api.get('/product/getAllProduct');
            setProducts(response.data);
        } catch (err) {
            console.error("Failed to fetch products", err);
        }
    };

    useEffect(() => {
        fetchProducts();
    }, []);

    const handleOpen = () => {
        setFormData({
            productNameUz: '',
            productNameKr: '',
            productPrice: 0,
            productStatus: ProductStatus.PROCESS,
            productCollection: ProductCollection.DISH,
            productDesc: '',
        });
        setImageFile(null);
        setEditMode(false);
        setOpen(true);
    };

    const handleEdit = (product: Product) => {
        setFormData({
            productNameUz: product.productNameUz,
            productNameKr: product.productNameKr,
            productPrice: product.productPrice,
            productStatus: product.productStatus,
            productCollection: product.productCollection,
            productDesc: product.productDesc || '',
        });
        setCurrentId(product._id);
        setImageFile(null);
        setEditMode(true);
        setOpen(true);
    };

    const handleClose = () => {
        setOpen(false);
        setError('');
    };

    const handleSubmit = async () => {
        try {
            const data = new FormData();
            data.append('productNameUz', formData.productNameUz);
            data.append('productNameKr', formData.productNameKr);
            data.append('productPrice', String(formData.productPrice));
            data.append('productStatus', formData.productStatus);
            data.append('productCollection', formData.productCollection);
            data.append('productDesc', formData.productDesc);

            if (imageFile) {
                data.append('productImage', imageFile);
            }

            if (editMode && currentId) {
                await api.put(`/product/updateProduct/${currentId}`, formData);
                // Note: Image update might need separate handling if backend doesn't support multipart on PUT
                // Checking backend, updateChosenProduct takes JSON body usually. 
                // Let's re-verify if update endpoint supports files. 
                // It seems updateChosenProduct uses JSON body in Product.service.ts?
                // Actually, let's treat update as JSON for now as commonly done, unless we see uploader middleware.
                // Re-checking router.ts: 
                // router.put("/product/updateProduct/:id", ... productController.updateChosenProduct);
                // It does NOT have makeUploader middleware. So Updates cannot change image currently.
            } else {
                await api.post('/product/createProduct', data, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            }

            fetchProducts();
            handleClose();
        } catch (err: any) {
            console.error("Error saving product", err);
            setError(err.response?.data?.message || 'Failed to save product');
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Are you sure you want to delete this product?')) {
            try {
                await api.delete(`/product/productDelete/${id}`);
                fetchProducts();
            } catch (err) {
                console.error("Failed to delete", err);
            }
        }
    };

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
                <Typography variant="h4">Product Management</Typography>
                <Button variant="contained" onClick={handleOpen}>Add Product</Button>
            </Box>

            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Image</TableCell>
                            <TableCell>Name (Uz)</TableCell>
                            <TableCell>Name (Kr)</TableCell>
                            <TableCell>Price</TableCell>
                            <TableCell>Category</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {products.map((product) => (
                            <TableRow key={product._id}>
                                <TableCell>
                                    <Box
                                        component="img"
                                        sx={{ width: 50, height: 50, objectFit: 'cover', borderRadius: 1 }}
                                        src={`http://localhost:3003/${product.productImage}`}
                                        alt={product.productNameUz}
                                    />
                                </TableCell>
                                <TableCell>{product.productNameUz}</TableCell>
                                <TableCell>{product.productNameKr}</TableCell>
                                <TableCell>${product.productPrice}</TableCell>
                                <TableCell>{product.productCollection}</TableCell>
                                <TableCell>{product.productStatus}</TableCell>
                                <TableCell>
                                    <IconButton onClick={() => handleEdit(product)}><EditIcon /></IconButton>
                                    <IconButton onClick={() => handleDelete(product._id)} sx={{ color: 'error.main' }}><DeleteIcon /></IconButton>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
                <DialogTitle>{editMode ? 'Edit Product' : 'Add New Product'}</DialogTitle>
                <DialogContent>
                    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                        <TextField
                            label="Name (Uz)"
                            value={formData.productNameUz}
                            onChange={(e) => setFormData({ ...formData, productNameUz: e.target.value })}
                        />
                        <TextField
                            label="Name (Kr)"
                            value={formData.productNameKr}
                            onChange={(e) => setFormData({ ...formData, productNameKr: e.target.value })}
                        />
                        <TextField
                            label="Price"
                            type="number"
                            value={formData.productPrice}
                            onChange={(e) => setFormData({ ...formData, productPrice: Number(e.target.value) })}
                        />
                        <TextField
                            label="Description"
                            multiline
                            rows={3}
                            value={formData.productDesc}
                            onChange={(e) => setFormData({ ...formData, productDesc: e.target.value })}
                        />
                        <FormControl>
                            <InputLabel>Category</InputLabel>
                            <Select
                                value={formData.productCollection}
                                label="Category"
                                onChange={(e) => setFormData({ ...formData, productCollection: e.target.value as ProductCollection })}
                            >
                                {Object.values(ProductCollection).map((col) => (
                                    <MenuItem key={col} value={col}>{col}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <FormControl>
                            <InputLabel>Status</InputLabel>
                            <Select
                                value={formData.productStatus}
                                label="Status"
                                onChange={(e) => setFormData({ ...formData, productStatus: e.target.value as ProductStatus })}
                            >
                                {Object.values(ProductStatus).map((status) => (
                                    <MenuItem key={status} value={status}>{status}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        {!editMode && (
                            <Button variant="outlined" component="label">
                                Upload Image
                                <input
                                    type="file"
                                    hidden
                                    accept="image/*"
                                    onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                                />
                            </Button>
                        )}
                        {imageFile && <Typography variant="caption">{imageFile.name}</Typography>}
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleClose}>Cancel</Button>
                    <Button onClick={handleSubmit} variant="contained" disabled={!editMode && !imageFile}>Save</Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
};

export default ProductManagement;
