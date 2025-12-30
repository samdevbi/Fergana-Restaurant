import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, MemberRole } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import ProtectedRoute from './components/ProtectedRoute';
import OwnerDashboard from './pages/admin/OwnerDashboard';
import KitchenOrderView from './pages/kitchen/KitchenOrderView';
import StaffTableView from './pages/staff/StaffTableView';

import ProductManagement from './pages/admin/ProductManagement';
import StaffManagement from './pages/admin/StaffManagement';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          {/* Owner Routes */}
          <Route element={<ProtectedRoute allowedRoles={[MemberRole.OWNER]} />}>
            <Route path="/admin" element={<OwnerDashboard />} />
            <Route path="/admin/products" element={<ProductManagement />} />
            <Route path="/admin/staff" element={<StaffManagement />} />
          </Route>

          {/* Kitchen Routes */}
          <Route element={<ProtectedRoute allowedRoles={[MemberRole.CHEFF]} />}>
            <Route path="/kitchen" element={<KitchenOrderView />} />
          </Route>

          {/* Staff Routes */}
          <Route element={<ProtectedRoute allowedRoles={[MemberRole.STAFF]} />}>
            <Route path="/staff" element={<StaffTableView />} />
          </Route>

          {/* Default Route */}
          <Route path="/" element={<Navigate to="/admin" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
