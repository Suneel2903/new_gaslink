import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { PrivateRoute } from './PrivateRoute';
import { PublicRoute } from './PublicRoute';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';
import { OrdersPage } from '../pages/OrdersPage';
import { InventoryPage } from '../pages/InventoryPage';
import { PendingActionsPage } from '../pages/PendingActionsPage';
import { CustomersPage } from '../pages/CustomersPage';
import InvoicesPage from '../pages/InvoicesPage';
import LandingPage from '../pages/LandingPage';
import CylinderPricesPage from '../pages/Admin/CylinderPricesPage';
import CustomerInventoryPage from '../pages/Admin/CustomerInventoryPage';
import PaymentsPage from '../pages/PaymentsPage';

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
        <Route path="customers" element={<CustomersPage />} />
        <Route path="invoices" element={<InvoicesPage />} />
        <Route path="payments" element={<PaymentsPage />} />
        <Route path="admin/cylinder-prices" element={<CylinderPricesPage />} />
        <Route path="admin/customer-inventory" element={<CustomerInventoryPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </Router>
);

export default AppRoutes; 