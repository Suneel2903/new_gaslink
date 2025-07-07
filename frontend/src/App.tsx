import { AuthProvider } from './contexts/AuthContext';
import AppRoutes from './routes';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
      <ToastContainer position="top-right" autoClose={3000} aria-label="notification" />
    </AuthProvider>
  );
}

export default App;
