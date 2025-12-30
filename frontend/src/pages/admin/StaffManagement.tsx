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
    Chip
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import api from '../../services/api';
import { MemberRole } from '../../context/AuthContext';

interface Member {
    _id: string;
    memberName: string;
    memberRole: string;
    memberStatus: string;
    memberPhone: string;
}

const StaffManagement = () => {
    const [staff, setStaff] = useState<Member[]>([]);
    const [open, setOpen] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [currentId, setCurrentId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        memberName: '',
        memberPassword: '',
        memberRole: MemberRole.STAFF,
        memberStatus: 'ACTIVE',
    });
    const [error, setError] = useState('');

    const fetchStaff = async () => {
        try {
            const response = await api.get('/admin/staff');
            // Support both array response or object with staff property
            const data = response.data.staff || response.data;
            if (Array.isArray(data)) {
                setStaff(data);
            }
        } catch (err) {
            console.error("Failed to fetch staff", err);
        }
    };

    useEffect(() => {
        fetchStaff();
    }, []);

    const handleOpen = () => {
        setFormData({
            memberName: '',
            memberPassword: '',
            memberRole: MemberRole.STAFF,
            memberStatus: 'ACTIVE',
        });
        setEditMode(false);
        setOpen(true);
    };

    const handleEdit = (member: Member) => {
        setFormData({
            memberName: member.memberName,
            memberPassword: '', // Password not shown
            memberRole: member.memberRole as any,
            memberStatus: member.memberStatus,
        });
        setCurrentId(member._id);
        setEditMode(true);
        setOpen(true);
    };

    const handleClose = () => {
        setOpen(false);
        setError('');
    };

    const handleSubmit = async () => {
        try {
            if (editMode && currentId) {
                await api.put(`/admin/updateStaff/${currentId}`, {
                    memberName: formData.memberName,
                    memberStatus: formData.memberStatus,
                    // Role and password might not be updatable by this endpoint based on review
                });
            } else {
                await api.post('/admin/createStaff', formData);
            }

            fetchStaff();
            handleClose();
        } catch (err: any) {
            console.error("Error saving staff", err);
            setError(err.response?.data?.message || 'Failed to save staff');
        }
    };

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
                <Typography variant="h4">Staff Management</Typography>
                <Button variant="contained" onClick={handleOpen}>Add Staff</Button>
            </Box>

            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Username</TableCell>
                            <TableCell>Role</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {staff.map((member) => (
                            <TableRow key={member._id}>
                                <TableCell>{member.memberName}</TableCell>
                                <TableCell>
                                    <Chip label={member.memberRole} color={member.memberRole === MemberRole.CHEFF ? 'warning' : 'default'} />
                                </TableCell>
                                <TableCell>
                                    <Chip label={member.memberStatus} color={member.memberStatus === 'ACTIVE' ? 'success' : 'error'} size="small" />
                                </TableCell>
                                <TableCell>
                                    <IconButton onClick={() => handleEdit(member)}><EditIcon /></IconButton>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
                <DialogTitle>{editMode ? 'Edit Staff' : 'Add New Staff'}</DialogTitle>
                <DialogContent>
                    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                        <TextField
                            label="Username"
                            value={formData.memberName}
                            onChange={(e) => setFormData({ ...formData, memberName: e.target.value })}
                        />
                        {!editMode && (
                            <TextField
                                label="Password"
                                type="password"
                                value={formData.memberPassword}
                                onChange={(e) => setFormData({ ...formData, memberPassword: e.target.value })}
                            />
                        )}
                        <FormControl disabled={editMode}>
                            <InputLabel>Role</InputLabel>
                            <Select
                                value={formData.memberRole}
                                label="Role"
                                onChange={(e) => setFormData({ ...formData, memberRole: e.target.value as any })}
                            >
                                <MenuItem value={MemberRole.STAFF}>Waiter (Staff)</MenuItem>
                                <MenuItem value={MemberRole.CHEFF}>Kitchen (Chef)</MenuItem>
                            </Select>
                        </FormControl>
                        <FormControl>
                            <InputLabel>Status</InputLabel>
                            <Select
                                value={formData.memberStatus}
                                label="Status"
                                onChange={(e) => setFormData({ ...formData, memberStatus: e.target.value })}
                            >
                                <MenuItem value="ACTIVE">Active</MenuItem>
                                <MenuItem value="BLOCK">Blocked</MenuItem>
                                <MenuItem value="DELETE">Deleted</MenuItem>
                            </Select>
                        </FormControl>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleClose}>Cancel</Button>
                    <Button onClick={handleSubmit} variant="contained">Save</Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
};

export default StaffManagement;
