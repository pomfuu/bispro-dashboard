// src/App.js
import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { Nav, Button, Container, Modal, Form, Alert, Spinner } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './Pages/LoginPage'; // Import LoginPage
import Master from './Pages/Master';
import InputByUnit from './Pages/InputByUnit';
import Draft from './Pages/Draft';
import Monitoring from './Pages/Monitoring';
import Dashboard from './Pages/Dashboard';
import logo from './Assets/logo.png';
const fontLink = document.createElement("link");
fontLink.href = "https://fonts.googleapis.com/css2?family=Open+Sans:wght@300;400;600;700&display=swap";
fontLink.rel = "stylesheet";
document.head.appendChild(fontLink);

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <Container className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
        <div className="text-center">
          <Spinner animation="border" variant="primary" />
          <p className="mt-3">Memeriksa autentikasi...</p>
        </div>
      </Container>
    );
  }
  
  if (!user || !user.isLoggedIn) {
    return <Navigate to="/login" />;
  }
  return children;
}

function ProtectedMaster() {
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(true);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const handleSubmit = (e) => {
    e.preventDefault();
    if (password === 'inputmaster') {
      setShowModal(false);
      setError('');
    } else {
      setError('Password salah! Silakan coba lagi.');
      setPassword('');
    }
  };

  const handleClose = () => {
    setShowModal(false);
    window.history.back();
  };

  if (showModal) {
    return (
      <Modal show={showModal} onHide={handleClose} backdrop="static" keyboard={false}>
        <Modal.Body>
          {error && (
            <Alert variant="danger" dismissible onClose={() => setError('')}>
              {error}
            </Alert>
          )}
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Password</Form.Label>
              <Form.Control
                type="password"
                placeholder="Masukkan password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
              />
            </Form.Group>
            <div className="d-flex gap-2">
              <Button variant="primary" type="submit" className="flex-grow-1">
                Login
              </Button>
              <Button variant="secondary" onClick={handleClose}>
                Batal
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>
    );
  }
  return <Master />;
}

function MainLayout({ children }) {
  const location = useLocation();
  const { user, logout } = useAuth();
  const isActive = (path) => {
    return location.pathname === path;
  };
  const handleLogout = () => {
    if (window.confirm('Apakah Anda yakin ingin logout?')) {
      logout();
      window.location.href = '/login';
    }
  };

  return (
    <div className="d-flex" style={{ minHeight: '100vh', letterSpacing: '-0.35px' }}>
      <div 
        className="text-dark position-fixed" 
        style={{ 
          width: '250px', 
          height: '100vh', 
          overflowY: 'auto',
          zIndex: 1000
        }}
      >
      <div className="p-3 text-center">
        <img 
          src={logo} 
          alt="BisPro Logo" 
          style={{ width: "200px", objectFit: "contain" }}
        />
      </div>

        <div className="p-3">
          <div className="d-flex align-items-center">
            <div>
              <strong>{user?.pic}</strong>
              <div className="small text-muted">
                {user?.unit} - {user?.tim} {user?.isHead && <span className="ms-1">(HEAD)</span>}
              </div>
            </div>
          </div>
          <Button 
            variant="primary" 
            size="md" 
            className="w-100 mt-3 text-white font-weight-bold "
            onClick={handleLogout}
          >
            Logout
          </Button>
        </div>
        
        <Nav className="flex-column p-3 fw-semibold">
          <Nav.Link
            as={Link}
            to="/master"
            className={`text-dark mb-2 rounded p-3 ${isActive('/master') ? 'bg-light' : ''}`}
            style={{ 
              transition: 'all 0.3s ease',
              textDecoration: 'none'
            }}
            onMouseEnter={(e) => {
              if (!isActive('/master')) {
                e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive('/master')) {
                e.target.style.backgroundColor = 'transparent';
              }
            }}
          >
            Master Project
          </Nav.Link>
          
          <Nav.Link
            as={Link}
            to="/input-unit"
            className={`text-dark mb-2 rounded p-3 ${isActive('/input-unit') ? 'bg-light' : ''}`}
            style={{ 
              transition: 'all 0.3s ease',
              textDecoration: 'none'
            }}
            onMouseEnter={(e) => {
              if (!isActive('/input-unit')) {
                e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive('/input-unit')) {
                e.target.style.backgroundColor = 'transparent';
              }
            }}
          >
            Register FPP
          </Nav.Link>
          
          <Nav.Link
            as={Link}
            to="/draft"
            className={`text-dark mb-2 rounded p-3 ${isActive('/draft') ? 'bg-light' : ''}`}
            style={{ 
              transition: 'all 0.3s ease',
              textDecoration: 'none',
            }}
            onMouseEnter={(e) => {
              if (!isActive('/draft')) {
                e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive('/draft')) {
                e.target.style.backgroundColor = 'transparent';
              }
            }}
          >
            Draft
          </Nav.Link>
          
          <Nav.Link
            as={Link}
            to="/monitoring"
            className={`text-dark mb-2 rounded p-3 ${isActive('/monitoring') ? 'bg-light' : ''}`}
            style={{ 
              transition: 'all 0.3s ease',
              textDecoration: 'none'
            }}
            onMouseEnter={(e) => {
              if (!isActive('/monitoring')) {
                e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive('/monitoring')) {
                e.target.style.backgroundColor = 'transparent';
              }
            }}
          >
            Monitoring
          </Nav.Link>
          
          <Nav.Link
            as={Link}
            to="/dashboard"
            className={`text-dark mb-2 rounded p-3 ${isActive('/dashboard') ? 'bg-light' : ''}`}
            style={{ 
              transition: 'all 0.3s ease',
              textDecoration: 'none'
            }}
            onMouseEnter={(e) => {
              if (!isActive('/dashboard')) {
                e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive('/dashboard')) {
                e.target.style.backgroundColor = 'transparent';
              }
            }}
          >
            Dashboard
          </Nav.Link>
        </Nav>
      </div>

      <div 
        className="flex-grow-1" 
        style={{ 
          backgroundColor: '#f8f9fa', 
          marginLeft: '250px',
          minHeight: '100vh'
        }}
      >
        {children}
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <div style={{ fontFamily: "Open Sans, sans-serif" }}>
        <Router>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<Navigate to="/login" replace />} />
            
            {/* Protected Routes */}
            <Route path="/*" element={
              <ProtectedRoute>
                <MainLayout>
                  <Routes>
                    <Route path="/master" element={<ProtectedMaster />} />
                    <Route path="/input-unit" element={<InputByUnit />} />
                    <Route path="/draft" element={<Draft />} />
                    <Route path="/monitoring" element={<Monitoring />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                  </Routes>
                </MainLayout>
              </ProtectedRoute>
            } />
          </Routes>
        </Router>
      </div>
    </AuthProvider>
  );
}

export default App;