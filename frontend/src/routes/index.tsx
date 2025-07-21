import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';
import { OrdersPage } from '../pages/OrdersPage';
import { InventoryPage } from '../pages/InventoryPage';
import { PendingActionsPage } from '../pages/PendingActionsPage';
import { SettingsPage } from '../pages/SettingsPage';
import { CustomersPage } from '../pages/CustomersPage';
import InvoicesPage from '../pages/InvoicesPage';
import LandingPage from '../pages/LandingPage';
import CylinderPricesPage from '../pages/Admin/CylinderPricesPage';
import CustomerInventoryPage from '../pages/Admin/CustomerInventoryPage';
import PaymentsPage from '../pages/PaymentsPage';
import CorporationInvoicesPage from '../pages/CorporationInvoicesPage';
import NotFoundPage from '../pages/NotFoundPage';

const AppRoutes = () => (
  <Router>
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/app" element={<DashboardLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="pending-actions" element={<PendingActionsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="invoices" element={<InvoicesPage />} />
        <Route path="payments" element={<PaymentsPage />} />
        <Route path="admin/cylinder-prices" element={<CylinderPricesPage />} />
        <Route path="admin/customer-inventory" element={<CustomerInventoryPage />} />
        <Route path="corporation-invoices" element={<CorporationInvoicesPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  </Router>
);

export default AppRoutes; 