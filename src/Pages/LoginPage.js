import React, { useState, useEffect } from 'react';
import { Container, Card, Form, Button, Alert, Row, Col, Spinner } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function LoginPage() {
  const navigate = useNavigate();
  const { loginAsTim, loginAsHead, fetchAllUsers, allUsers } = useAuth();
  const [loginType, setLoginType] = useState('TIM');
  const [formData, setFormData] = useState({
    unit: '',
    unitDetail: '',
    pic: '',
    password: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [units, setUnits] = useState([]);
  const [unitDetails, setUnitDetails] = useState([]);
  const [pics, setPics] = useState([]);
  useEffect(() => {
    loadUserData();
  }, []);

  useEffect(() => {
    setFormData({
      unit: '',
      unitDetail: '',
      pic: '',
      password: ''
    });
    setUnitDetails([]);
    setPics([]);
    setError('');
    setSuccess('');
    
    if (loginType === 'TIM') {
      const timUnits = [...new Set(allUsers.map(u => u.unit))].sort();
      setUnits(timUnits);
    } else {
      setUnits([]);
    }
  }, [loginType, allUsers]);

  const loadUserData = async () => {
    setLoading(true);
    try {
      await fetchAllUsers();
    } catch (error) {
      console.error('Error loading user data:', error);
    }
    setLoading(false);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'unit') {
      setFormData({
        ...formData,
        unit: value,
        unitDetail: '',
        pic: ''
      });
      
      if (loginType === 'TIM') {
        const details = [...new Set(allUsers
          .filter(u => u.unit === value)
          .map(u => u.unitDetail)
        )].sort();
        setUnitDetails(details);
      }
    } else if (name === 'unitDetail') {
      setFormData({
        ...formData,
        unitDetail: value,
        pic: ''
      });
      
      const userPics = allUsers
        .filter(u => u.unit === formData.unit && u.unitDetail === value)
        .map(u => u.nama)
        .sort();
      setPics(userPics);
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (loginType === 'TIM') {
      if (!formData.unit || !formData.unitDetail || !formData.pic) {
        setError('Semua field harus diisi!');
        return;
      }
      setLoading(true);
      const result = await loginAsTim(formData.unit, formData.unitDetail, formData.pic);
      setLoading(false);
      
      if (result.success) {
        setSuccess('Login berhasil!');
        setTimeout(() => navigate('/dashboard'), 1000);
      } else {
        setError(result.message);
      }
    } else {
      if (!formData.password) {
        setError('Password harus diisi!');
        return;
      }
      setLoading(true);
      const result = loginAsHead(formData.password, 'ALL');
      setLoading(false);
      if (result.success) {
        setSuccess('Login sebagai HEAD berhasil!');
        setTimeout(() => navigate('/dashboard'), 1000);
      } else {
        setError(result.message);
      }
    }
  };

  const handleLoginTypeChange = (type) => {
    setLoginType(type);
  };

  return (
    <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
      <Card className='border-0' style={{ width: '500px' }}>
        <Card.Body className="p-4">
          <div className="d-flex justify-content-center mb-4">
            <div className="btn-group" role="group">
              <Button
                variant={loginType === 'TIM' ? 'primary' : 'outline-primary'}
                onClick={() => handleLoginTypeChange('TIM')}
              >
                Login TIM
              </Button>
              <Button
                variant={loginType === 'HEAD' ? 'primary' : 'outline-primary'}
                onClick={() => handleLoginTypeChange('HEAD')}
              >
                Login Head
              </Button>
            </div>
          </div>

          {error && (
            <Alert variant="danger" dismissible onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          {success && (
            <Alert variant="success" dismissible onClose={() => setSuccess('')}>
              {success}
            </Alert>
          )}

          <Form onSubmit={handleSubmit}>
            {/* Unit Selection - Hanya untuk TIM */}
            {loginType === 'TIM' && (
              <Form.Group className="mb-3">
                <Form.Label>Departemen</Form.Label>
                <Form.Select
                  name="unit"
                  value={formData.unit}
                  onChange={handleChange}
                  required
                  disabled={loading || units.length === 0}
                >
                  <option value="">Pilih Departemen</option>
                  {units.map(unit => (
                    <option key={unit} value={unit}>{unit}</option>
                  ))}
                </Form.Select>
                {units.length === 0 && !loading && (
                  <Form.Text className="text-danger">
                    Tidak ada data user. Hubungi admin.
                  </Form.Text>
                )}
              </Form.Group>
            )}

            {loginType === 'TIM' && (
              <Form.Group className="mb-3">
                <Form.Label>Tim</Form.Label>
                <Form.Select
                  name="unitDetail"
                  value={formData.unitDetail}
                  onChange={handleChange}
                  required
                  disabled={!formData.unit || loading}
                >
                  <option value="">Pilih Tim</option>
                  {unitDetails.map(detail => (
                    <option key={detail} value={detail}>{detail}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            )}

            {/* PIC Selection (hanya untuk TIM) */}
            {loginType === 'TIM' && (
              <Form.Group className="mb-3">
                <Form.Label>PIC</Form.Label>
                <Form.Select
                  name="pic"
                  value={formData.pic}
                  onChange={handleChange}
                  required
                  disabled={!formData.unitDetail || loading}
                >
                  <option value="">Pilih PIC</option>
                  {pics.map(pic => (
                    <option key={pic} value={pic}>{pic}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            )}

            {loginType === 'HEAD' && (
              <>
                <Form.Group className="mb-3">
                  <Form.Label>Password HEAD</Form.Label>
                  <Form.Control
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Masukkan password HEAD"
                    required
                  />
                  <Form.Text className="text-muted">
                  </Form.Text>
                </Form.Group>
              </>
            )}

            {/* Login Button */}
            <Button
              variant="primary"
              type="submit"
              className="w-100 py-2"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Spinner size="sm" animation="border" className="me-2" />
                  Memproses...
                </>
              ) : (
                loginType === 'TIM' ? 'Login' : 'Login'
              )}
            </Button>
          </Form>

          <div className="text-center mt-4">
            <p className="text-muted mb-2">
            </p>
          </div>
        </Card.Body>
      </Card>
    </Container>
  );
}

export default LoginPage;