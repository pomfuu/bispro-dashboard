import React, { useState, useEffect } from 'react';
import { 
  Container, 
  Card, 
  Form, 
  Button, 
  Table, 
  Modal,
  Alert,
  Spinner,
  Badge,
  Row,
  Col,
  Tabs,
  Tab
} from 'react-bootstrap';
import { db } from '../firebase';
import { 
  collection, 
  addDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  doc,
  serverTimestamp,
  query,
  where
} from 'firebase/firestore';
import { Link } from 'react-router-dom';

const ORGANIZATION_STRUCTURE = {
  'PPD': {
    'AKUISISI': ['Isa', 'Yohanna', 'Gusmita', 'Kenneth', 'Zelin', 'Michael'],
    'LAYANAN': ['Lenny', 'Novandi'],
    'SUPPORT': ['Laras', 'Ulfiah', 'Ema', 'Lia', 'Tanaya'],
    'RECOVERY': ['Rifaldo', 'Intan', 'Djohan']
  },
  'DPA': {
    'AKUISISI': ['Esther', 'Edu', 'Yudha', 'Arya', 'Stanley', 'Ryo'],
    'LAYANAN': ['Gina', 'Hotma', 'Elis'],
    'SUPPORT': ['Indri', 'Kevin', 'Yogi'],
    'RECOVERY': ['Harris', 'Glen', 'Ikhsan']
  },
  'UUD': {
    'UUD': ['Angel', 'Andra']
  },
  'PDM': {
    'HEAD': ['Evi'],
    'PPM': ['Alin', 'Dimas', 'Adhit', 'Irawan', 'Eval'],
    'PDI': ['Gita', 'Arif', 'Marcell', 'Vicky'],
    'PAR': ['Melin', 'Frans', 'Adhit']
  }
};

function Master() {
  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editProjectMode, setEditProjectMode] = useState(false);
  const [currentProjectId, setCurrentProjectId] = useState(null);
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editUserMode, setEditUserMode] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [fppEntries, setFppEntries] = useState([]);
  const [loadingFppEntries, setLoadingFppEntries] = useState(false);
  const [showFppModal, setShowFppModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [alert, setAlert] = useState({ show: false, message: '', variant: '' });
  const [activeTab, setActiveTab] = useState('projects');
  
  const [projectFormData, setProjectFormData] = useState({
    inputType: 'noProject',
    inputValue: '',
    namaProject: '',
    skalaProject: '' // 🔥 TAMBAHKAN INI
  });

  const [userFormData, setUserFormData] = useState({
    nama: '',
    unit: 'PPD',
    unitDetail: '',
    status: 'Active'
  });

  useEffect(() => {
    console.log('Component mounted, initializing data...');
    initializeData();
  }, []);

  const initializeData = async () => {
    await fetchProjects();
    await fetchUsers();
    await fetchFppEntries();
    await initializeUsersIfEmpty();
  };

  const initializeUsersIfEmpty = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      if (querySnapshot.empty) {
        console.log('Initializing users from organization structure...');
        for (const [unit, details] of Object.entries(ORGANIZATION_STRUCTURE)) {
          for (const [unitDetail, names] of Object.entries(details)) {
            for (const name of names) {
              await addDoc(collection(db, 'users'), {
                nama: name,
                unit: unit,
                unitDetail: unitDetail,
                status: 'Active',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
              });
            }
          }
        }
        
        showAlert('Data user berhasil diinisialisasi!', 'success');
        fetchUsers();
      }
    } catch (error) {
      console.error('Error initializing users:', error);
    }
  };

  const fetchProjects = async () => {
    setLoadingProjects(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'projects'));
      const projectsList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      console.log('Fetched projects:', projectsList);
      setProjects(projectsList);
    } catch (error) {
      console.error('Error fetching projects:', error);
      showAlert('Error mengambil data projects: ' + error.message, 'danger');
    }
    setLoadingProjects(false);
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const usersList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      console.log('Fetched users:', usersList);
      setUsers(usersList);
    } catch (error) {
      console.error('Error fetching users:', error);
      showAlert('Error mengambil data users: ' + error.message, 'danger');
    }
    setLoadingUsers(false);
  };

  const fetchFppEntries = async () => {
    setLoadingFppEntries(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'fpp_entries'));
      const fppEntriesList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      console.log('Fetched FPP entries:', fppEntriesList.length);
      setFppEntries(fppEntriesList);
    } catch (error) {
      console.error('Error fetching FPP entries:', error);
    }
    setLoadingFppEntries(false);
  };

  const handleProjectChange = (e) => {
    const { name, value } = e.target;
    setProjectFormData({
      ...projectFormData,
      [name]: value
    });
  };

  const handleUserChange = (e) => {
    const { name, value } = e.target;
    if (name === 'unit') {
      setUserFormData({
        ...userFormData,
        unit: value,
        unitDetail: ''
      });
    } else {
      setUserFormData({
        ...userFormData,
        [name]: value
      });
    }
  };

  const getUnitDetails = () => {
    return ORGANIZATION_STRUCTURE[userFormData.unit] 
      ? Object.keys(ORGANIZATION_STRUCTURE[userFormData.unit]) 
      : [];
  };

  const validateProjectForm = () => {
    if (!projectFormData.inputValue || !projectFormData.namaProject) {
      showAlert('Semua field harus diisi!', 'warning');
      return false;
    }
    return true;
  };

  const validateUserForm = () => {
    if (!userFormData.nama || !userFormData.unit || !userFormData.unitDetail) {
      showAlert('Semua field harus diisi!', 'warning');
      return false;
    }
    return true;
  };

  const handleProjectSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateProjectForm()) return;

    setLoadingProjects(true);
    try {
      // Di handleProjectSubmit dan handleProjectUpdate, tambahkan skalaProject
      const dataToSave = {
        inputType: projectFormData.inputType,
        namaProject: projectFormData.namaProject,
        skalaProject: projectFormData.skalaProject || '', // 🔥 TAMBAHKAN INI
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      if (projectFormData.inputType === 'noProject') {
        dataToSave.noProject = projectFormData.inputValue;
        dataToSave.noFppInduk = '';
      } else {
        dataToSave.noFppInduk = projectFormData.inputValue;
        dataToSave.noProject = '';
      }
      
      await addDoc(collection(db, 'projects'), dataToSave);
      showAlert('Project berhasil ditambahkan!', 'success');
      resetProjectForm();
      fetchProjects();
    } catch (error) {
      console.error('Error adding project:', error);
      showAlert('Error menambah project: ' + error.message, 'danger');
    }
    setLoadingProjects(false);
  };

  const handleUserSubmit = async (e) => {
    e.preventDefault();
    if (!validateUserForm()) return;
    setLoadingUsers(true);
    try {
      await addDoc(collection(db, 'users'), {
        ...userFormData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      showAlert('User berhasil ditambahkan!', 'success');
      resetUserForm();
      fetchUsers();
    } catch (error) {
      console.error('Error adding user:', error);
      showAlert('Error menambah user: ' + error.message, 'danger');
    }
    setLoadingUsers(false);
  };

  const handleEditProject = (project) => {
    setProjectFormData({
      inputType: project.inputType || (project.noProject ? 'noProject' : 'noFppInduk'),
      inputValue: project.noProject || project.noFppInduk,
      namaProject: project.namaProject,
      skalaProject: project.skalaProject || '' // 🔥 TAMBAHKAN INI
    });
    setCurrentProjectId(project.id);
    setEditProjectMode(true);
  };

  const handleEditUser = (user) => {
    setUserFormData({
      nama: user.nama,
      unit: user.unit,
      unitDetail: user.unitDetail,
      status: user.status || 'Active'
    });
    setCurrentUserId(user.id);
    setEditUserMode(true);
  };

  const handleProjectUpdate = async (e) => {
    e.preventDefault();
    if (!validateProjectForm()) return;
    setLoadingProjects(true);
    try {
      const dataToUpdate = {
        inputType: projectFormData.inputType,
        namaProject: projectFormData.namaProject,
        updatedAt: serverTimestamp()
      };

      if (projectFormData.inputType === 'noProject') {
        dataToUpdate.noProject = projectFormData.inputValue;
        dataToUpdate.noFppInduk = '';
      } else {
        dataToUpdate.noFppInduk = projectFormData.inputValue;
        dataToUpdate.noProject = '';
      }
      const projectRef = doc(db, 'projects', currentProjectId);
      await updateDoc(projectRef, dataToUpdate);
      showAlert('Project berhasil diupdate!', 'success');
      resetProjectForm();
      fetchProjects();
    } catch (error) {
      console.error('Error updating project:', error);
      showAlert('Error mengupdate project: ' + error.message, 'danger');
    }
    setLoadingProjects(false);
  };

  const handleUserUpdate = async (e) => {
    e.preventDefault();
    if (!validateUserForm()) return;
    setLoadingUsers(true);
    try {
      const userRef = doc(db, 'users', currentUserId);
      await updateDoc(userRef, {
        ...userFormData,
        updatedAt: serverTimestamp()
      });
      showAlert('User berhasil diupdate!', 'success');
      resetUserForm();
      fetchUsers();
    } catch (error) {
      console.error('Error updating user:', error);
      showAlert('Error mengupdate user: ' + error.message, 'danger');
    }
    setLoadingUsers(false);
  };

  const handleDeleteProject = (project) => {
    setCurrentProjectId(project.id);
    setProjectFormData({
      inputType: project.inputType || (project.noProject ? 'noProject' : 'noFppInduk'),
      inputValue: project.noProject || project.noFppInduk,
      namaProject: project.namaProject,
      skalaProject: project.skalaProject || '' // 🔥 TAMBAHKAN INI
    });
    setShowProjectModal(true);
  };

  const handleDeleteUser = (user) => {
    setCurrentUserId(user.id);
    setUserFormData({
      nama: user.nama,
      unit: user.unit,
      unitDetail: user.unitDetail,
      status: user.status
    });
    setShowUserModal(true);
  };

  const confirmDeleteProject = async () => {
    setLoadingProjects(true);
    try {
      await deleteDoc(doc(db, 'projects', currentProjectId));
      showAlert('Project berhasil dihapus!', 'success');
      setShowProjectModal(false);
      resetProjectForm();
      fetchProjects();
    } catch (error) {
      console.error('Error deleting project:', error);
      showAlert('Error menghapus project: ' + error.message, 'danger');
    }
    setLoadingProjects(false);
  };

  const confirmDeleteUser = async () => {
    setLoadingUsers(true);
    try {
      await deleteDoc(doc(db, 'users', currentUserId));
      showAlert('User berhasil dihapus!', 'success');
      setShowUserModal(false);
      resetUserForm();
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      showAlert('Error menghapus user: ' + error.message, 'danger');
    }
    setLoadingUsers(false);
  };

  const resetProjectForm = () => {
    setProjectFormData({
      inputType: 'noProject',
      inputValue: '',
      namaProject: '',
      skalaProject: '' // 🔥 TAMBAHKAN INI
    });
    setEditProjectMode(false);
    setCurrentProjectId(null);
  };

  const resetUserForm = () => {
    setUserFormData({
      nama: '',
      unit: 'PPD',
      unitDetail: '',
      status: 'Active'
    });
    setEditUserMode(false);
    setCurrentUserId(null);
  };

  const showAlert = (message, variant) => {
    setAlert({ show: true, message, variant });
    setTimeout(() => {
      setAlert({ show: false, message: '', variant: '' });
    }, 3000);
  };

  const handleViewFppEntries = (project) => {
    const projectId = project.noProject || project.noFppInduk;
    const relatedFppEntries = fppEntries.filter(fpp => 
      fpp.masterProjectNumber === projectId
    );
    
    setSelectedProject({
      ...project,
      fppEntries: relatedFppEntries
    });
    setShowFppModal(true);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch (error) {
      return dateString;
    }
  };

  return (
    <Container className="py-4">
      <div className="mb-4">
        <h2 className="d-flex align-items-center">
          <div className="me-2 fw-semibold fs-5" style={{ letterSpacing:'-1.5px' }}>INPUT MASTER</div>
        </h2>
        </div>

      {alert.show && (
        <Alert variant={alert.variant} dismissible onClose={() => setAlert({ show: false })}>
          {alert.message}
        </Alert>
      )}

      <Tabs
        activeKey={activeTab}
        onSelect={(k) => setActiveTab(k)}
        className="mb-4"
      >
        <Tab eventKey="projects" title="Projects">
          <Card className="mb-4 border-0">
              <div className="px-3 mt-3 fw-semibold">
                {editProjectMode ? 'Edit Project' : 'Tambah Project Baru'}
              </div>
            <Card.Body>
              <Form onSubmit={editProjectMode ? handleProjectUpdate : handleProjectSubmit}>
                <Form.Group className="mb-4">
                  <div className="d-flex gap-4">
                    <Form.Check
                      type="radio"
                      id="radio-noProject"
                      name="inputType"
                      value="noProject"
                      label="No Project"
                      checked={projectFormData.inputType === 'noProject'}
                      onChange={handleProjectChange}
                    />
                    <Form.Check
                      type="radio"
                      id="radio-noFppInduk"
                      name="inputType"
                      value="noFppInduk"
                      label="No FPP Induk"
                      checked={projectFormData.inputType === 'noFppInduk'}
                      onChange={handleProjectChange}
                    />
                  </div>
                </Form.Group>

                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>
                        {projectFormData.inputType === 'noProject' ? 'No Project' : 'No FPP Induk'} <span className="text-danger"> *</span>
                      </Form.Label>
                      <Form.Control
                        type="text"
                        name="inputValue"
                        value={projectFormData.inputValue}
                        onChange={handleProjectChange}
                        placeholder={`Masukkan ${projectFormData.inputType === 'noProject' ? 'nomor project' : 'nomor FPP induk'}`}
                        required
                      />
                    </Form.Group>
                  </Col>

                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Nama Project <span className="text-danger"> *</span></Form.Label>
                      <Form.Control
                        type="text"
                        name="namaProject"
                        value={projectFormData.namaProject}
                        onChange={handleProjectChange}
                        placeholder="Masukkan nama project"
                        required
                      />
                    </Form.Group>
                  </Col>
                </Row>

                {/* 🔥 TAMBAHKAN ROW UNTUK SKALA PROJECT */}
                <Row className="mb-3">
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Skala Project</Form.Label>
                      <Form.Select
                        name="skalaProject"
                        value={projectFormData.skalaProject}
                        onChange={handleProjectChange}
                      >
                        <option value="">Pilih Skala</option>
                        <option value="Small">Small</option>
                        <option value="Medium">Medium</option>
                        <option value="Large">Large</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                </Row>

                <div className="d-flex gap-2">
                  <Button 
                    variant={editProjectMode ? "warning" : "primary"} 
                    type="submit"
                    disabled={loadingProjects}
                  >
                    {loadingProjects ? (
                      <>
                        <Spinner size="sm" animation="border" /> Loading...
                      </>
                    ) : (
                      editProjectMode ? 'Update' : 'Simpan'
                    )}
                  </Button>
                  
                  {editProjectMode && (
                    <Button variant="secondary" onClick={resetProjectForm}>
                      Batal
                    </Button>
                  )}
                </div>
              </Form>
            </Card.Body>
          </Card>

          <Card className="">
            <Card.Header className="bg-light text-dark">
              <div className="mb-0 fs-5 py-2 fw-semibold">Daftar Project ({projects.length})</div>
            </Card.Header>
            <Card.Body>
              {loadingProjects && projects.length === 0 ? (
                <div className="text-center py-4">
                  <Spinner animation="border" variant="primary" />
                  <p className="mt-2">Loading data...</p>
                </div>
              ) : projects.length === 0 ? (
                <Alert variant="info">
                  Belum ada data project. Silakan tambahkan project baru.
                </Alert>
              ) : (
                <div className="table-responsive">
                  <Table striped bordered hover>
                    <thead className="table-light">
                      <tr>
                        <th style={{ width: '5%' }}>No</th>
                        <th style={{ width: '10%' }}>Tipe</th>
                        <th style={{ width: '15%' }}>No Project</th>
                        <th style={{ width: '15%' }}>No FPP Induk</th>
                        <th style={{ width: '20%' }}>Nama Project</th>
                        <th style={{ width: '10%' }}>Skala</th> {/* 🔥 TAMBAHKAN KOLOM INI */}
                        <th style={{ width: '15%' }}>FPP Entries</th>
                        <th style={{ width: '15%' }} className="text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projects.map((project, index) => {
                        const projectId = project.noProject || project.noFppInduk;
                        const relatedFppCount = fppEntries.filter(fpp => 
                          fpp.masterProjectNumber === projectId
                        ).length;
                        
                        return (
                          <tr key={project.id}>
                            <td>{index + 1}</td>
                            <td>
                              <Badge bg={project.noProject ? 'primary' : 'info'}>
                                {project.noProject ? 'Project' : 'FPP Induk'}
                              </Badge>
                            </td>
                            <td>{project.noProject || '-'}</td>
                            <td>{project.noFppInduk || '-'}</td>
                            <td>
                              <div>
                                <strong>{project.namaProject}</strong>
                                {relatedFppCount > 0 && (
                                  <div>
                                    <small className="text-muted">
                                      {relatedFppCount} FPP entries
                                    </small>
                                  </div>
                                )}
                              </div>
                            </td>
                            <td>
                              {/* 🔥 TAMPILKAN SKALA */}
                              {project.skalaProject ? (
                                <Badge bg={
                                  project.skalaProject === 'Large' ? 'danger' :
                                  project.skalaProject === 'Medium' ? 'warning' :
                                  'success'
                                }>
                                  {project.skalaProject}
                                </Badge>
                              ) : (
                                <span className="text-muted">-</span>
                              )}
                            </td>
                            <td>
                              {relatedFppCount > 0 ? (
                                <Button
                                  variant="dark"
                                  size="sm"
                                  onClick={() => handleViewFppEntries(project)}
                                  className="w-100"
                                >
                                  View ({relatedFppCount})
                                </Button>
                              ) : (
                                <span className="text-muted">-</span>
                              )}
                            </td>
                            <td className="text-center">
                              <Button
                                variant="warning"
                                size="sm"
                                className="me-1 mb-2"
                                onClick={() => handleEditProject(project)}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => handleDeleteProject(project)}
                              >
                                Delete
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                </div>
              )}
            </Card.Body>
          </Card>
        </Tab>

        <Tab eventKey="users" title="Users">
          <Card className="mb-4 border-0">
              <div className="mb-0 px-3 mt-3 fw-semibold">
                {editUserMode ? 'Edit User' : 'Tambah User Baru'}
              </div>
            <Card.Body>
              <Form onSubmit={editUserMode ? handleUserUpdate : handleUserSubmit}>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Nama <span className="text-danger"> *</span></Form.Label>
                      <Form.Control
                        type="text"
                        name="nama"
                        value={userFormData.nama}
                        onChange={handleUserChange}
                        placeholder="Masukkan nama user"
                        required
                      />
                    </Form.Group>
                  </Col>

                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Status <span className="text-danger"> *</span></Form.Label>
                      <Form.Select
                        name="status"
                        value={userFormData.status}
                        onChange={handleUserChange}
                        required
                      >
                        <option value="Active">Active</option>
                        <option value="Non Active">Non Active</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                </Row>

                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Unit <span className="text-danger"> *</span>  </Form.Label>
                      <Form.Select
                        name="unit"
                        value={userFormData.unit}
                        onChange={handleUserChange}
                        required
                      >
                        <option value=""> </option>
                        <option value="PPD">PPD</option>
                        <option value="DPA">DPA</option>
                        <option value="UUD">UUD</option>
                        <option value="PDM">PDM</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>

                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Unit Detail <span className="text-danger"> *</span></Form.Label>
                      <Form.Select
                        name="unitDetail"
                        value={userFormData.unitDetail}
                        onChange={handleUserChange}
                        required
                        disabled={!userFormData.unit}
                      >
                        <option value=""> </option>
                        {getUnitDetails().map((detail) => (
                          <option key={detail} value={detail}>
                            {detail}
                          </option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                </Row>

                <div className="d-flex gap-2">
                  <Button 
                    variant={editUserMode ? "warning" : "primary"} 
                    type="submit"
                    disabled={loadingUsers}
                  >
                    {loadingUsers ? (
                      <>
                        <Spinner size="sm" animation="border" /> Loading...
                      </>
                    ) : (
                      editUserMode ? 'Update' : 'Simpan'
                    )}
                  </Button>
                  
                  {editUserMode && (
                    <Button variant="secondary" onClick={resetUserForm}>
                      ❌ Batal
                    </Button>
                  )}
                </div>
              </Form>
            </Card.Body>
          </Card>

          {/* Tabel Users */}
          <Card className="">
            <Card.Header className="bg-light text-white">
              <div className="mb-0 text-dark fw-semibold">Daftar User ({users.length})</div>
            </Card.Header>
            <Card.Body>
              {loadingUsers && users.length === 0 ? (
                <div className="text-center py-4">
                  <Spinner animation="border" variant="success" />
                  <p className="mt-2">Loading data...</p>
                </div>
              ) : users.length === 0 ? (
                <Alert variant="info">
                  Belum ada data user. Silakan tambahkan user baru.
                </Alert>
              ) : (
                <div className="table-responsive">
                  <Table striped bordered hover>
                    <thead className="table-light">
                      <tr>
                        <th style={{ width: '5%' }}>No</th>
                        <th style={{ width: '20%' }}>Nama</th>
                        <th style={{ width: '15%' }}>Unit</th>
                        <th style={{ width: '20%' }}>Unit Detail</th>
                        <th style={{ width: '15%' }}>Status</th>
                        <th style={{ width: '20%' }} className="text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user, index) => (
                        <tr key={user.id}>
                          <td>{index + 1}</td>
                          <td>{user.nama}</td>
                          <td>
                            <div>{user.unit}</div>
                          </td>
                          <td>{user.unitDetail}</td>
                          <td>
                            <Badge bg={user.status === 'Active' ? 'success' : 'secondary'}>
                              {user.status}
                            </Badge>
                          </td>
                          <td className="text-center">
                            <Button
                              variant="warning"
                              size="sm"
                              className="me-2"
                              onClick={() => handleEditUser(user)}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleDeleteUser(user)}
                            >
                              Delete
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </Card.Body>
          </Card>
        </Tab>
      </Tabs>

      {/* Modal Konfirmasi Delete Project */}
      <Modal show={showProjectModal} onHide={() => setShowProjectModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>⚠️ Konfirmasi Hapus Project</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Apakah Anda yakin ingin menghapus project ini?</p>
          <div className="bg-light p-3 rounded">
            <strong>Tipe:</strong> {projectFormData.inputType === 'noProject' ? 'No Project' : 'No FPP Induk'}<br />
            <strong>{projectFormData.inputType === 'noProject' ? 'No Project' : 'No FPP Induk'}:</strong> {projectFormData.inputValue}<br />
            <strong>Nama Project:</strong> {projectFormData.namaProject}<br />
            <strong>Skala Project:</strong> {projectFormData.skalaProject || '-'} {/* 🔥 TAMBAHKAN INI */}
          </div>
          <Alert variant="warning" className="mt-3">
            <small>
              ⚠️ <strong>Perhatian:</strong> Hapus project ini mungkin akan mempengaruhi FPP entries yang terkait.
            </small>
          </Alert>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowProjectModal(false)}>
            Batal
          </Button>
          <Button variant="danger" onClick={confirmDeleteProject} disabled={loadingProjects}>
            {loadingProjects ? (
              <>
                <Spinner size="sm" animation="border" /> Menghapus...
              </>
            ) : (
              'Ya, Hapus'
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal Konfirmasi Delete User */}
      <Modal show={showUserModal} onHide={() => setShowUserModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>⚠️ Konfirmasi Hapus User</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Apakah Anda yakin ingin menghapus user ini?</p>
          <div className="bg-light p-3 rounded">
            <strong>Nama:</strong> {userFormData.nama}<br />
            <strong>Unit:</strong> {userFormData.unit}<br />
            <strong>Unit Detail:</strong> {userFormData.unitDetail}<br />
            <strong>Status:</strong> {userFormData.status}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowUserModal(false)}>
            Batal
          </Button>
          <Button variant="danger" onClick={confirmDeleteUser} disabled={loadingUsers}>
            {loadingUsers ? (
              <>
                <Spinner size="sm" animation="border" /> Menghapus...
              </>
            ) : (
              'Ya, Hapus'
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showFppModal} onHide={() => setShowFppModal(false)} size="xl">
        <Modal.Header closeButton>
          <Modal.Title>
            FPP Entries untuk {selectedProject?.namaProject}
            <Badge className="ms-5">
              {selectedProject?.fppEntries?.length || 0} entries
            </Badge>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {loadingFppEntries ? (
            <div className="text-center py-4">
              <Spinner animation="border" variant="primary" />
              <p className="mt-2">Loading FPP entries...</p>
            </div>
          ) : !selectedProject?.fppEntries || selectedProject.fppEntries.length === 0 ? (
            <Alert variant="info">
              Belum ada FPP entries untuk project ini.
            </Alert>
          ) : (
            <>
              <Card className="mb-4">
                <Card.Header className="bg-light">
                  <strong>Master Project Info</strong>
                </Card.Header>
                <Card.Body>
                  <Row>
                    <Col md={3}>
                      <p><strong>Tipe:</strong><br />
                      <Badge bg={selectedProject.noProject ? 'primary' : 'info'}>
                        {selectedProject.noProject ? 'No Project' : 'No FPP Induk'}
                      </Badge></p>
                    </Col>
                    <Col md={3}>
                      <p><strong>Nomor:</strong><br />
                      <Badge bg="secondary">
                        {selectedProject.noProject || selectedProject.noFppInduk}
                      </Badge></p>
                    </Col>
                    <Col md={3}>
                      <p><strong>Skala:</strong><br />
                      {selectedProject.skalaProject ? (
                        <Badge bg={
                          selectedProject.skalaProject === 'Large' ? 'danger' :
                          selectedProject.skalaProject === 'Medium' ? 'warning' :
                          'success'
                        }>
                          {selectedProject.skalaProject}
                        </Badge>
                      ) : '-'}</p>
                    </Col>
                    <Col md={3}>
                      <p><strong>Nama:</strong><br />
                      {selectedProject.namaProject}</p>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>

              {/* Tabel FPP Entries */}
              <div className="table-responsive">
                <Table striped bordered hover>
                  <thead className="table-light">
                    <tr>
                      <th style={{ width: '5%' }}>No</th>
                      <th style={{ width: '15%' }}>No FPP</th>
                      <th style={{ width: '15%' }}>Departemen</th>
                      <th style={{ width: '15%' }}>TIM</th>
                      <th style={{ width: '15%' }}>PIC</th>
                      <th style={{ width: '15%' }}>Status</th>
                      <th style={{ width: '20%' }}>Judul FPP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedProject?.fppEntries?.map((fpp, index) => {
                      const monitoringStatus = fpp.status || 'Draft';
                      return (
                        <tr key={fpp.id}>
                          <td>{index + 1}</td>
                          <td>
                            <div bg="dark" className="mb-1">{fpp.noFpp}</div>
                            <br />
                          </td>
                          <td>
                            <Badge bg="primary">{fpp.department}</Badge>
                          </td>
                          <td>{fpp.tim}</td>
                          <td>{fpp.pic}</td>
                          <td>
                            <Badge bg={
                              monitoringStatus === 'In Progress' || monitoringStatus === 'submitted' ? 'warning' :
                              monitoringStatus === 'Done' || monitoringStatus === 'Selesai' || monitoringStatus === 'Achieve' ? 'success' :
                              monitoringStatus === 'Hold' ? 'secondary' :
                              monitoringStatus === 'Drop' ? 'danger' :
                              monitoringStatus === 'Hutang Collab' ? 'info' : 
                              monitoringStatus === 'draft' ? 'secondary' : 'light'
                            }>
                              {monitoringStatus === 'submitted' ? 'In Progress' : monitoringStatus}
                            </Badge>
                            {fpp.tanggalSelesai && (
                              <div className="small text-muted">
                                Selesai: {formatDate(fpp.tanggalSelesai)}
                              </div>
                            )}
                          </td>
                          <td>
                            <div>
                              <strong>{fpp.judulFpp}</strong>
                              <div className="small text-muted mt-1"> 
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>
              {/* <Card className="mt-4 border-0">
                <Card.Header className="bg-light">
                  <strong>Summary</strong>
                </Card.Header>
                <Card.Body>
                  <Row>
                    <Col md={3} className="text-center">
                      <div className="fs-4 fw-bold text-primary">
                        {selectedProject?.fppEntries?.length || 0}
                      </div>
                      <div className="small text-muted">Total FPP</div>
                    </Col>
                    <Col md={3} className="text-center">
                      <div className="fs-4 fw-bold text-warning">
                        {selectedProject?.fppEntries?.filter(f => 
                          f.status === 'In Progress' || f.status === 'submitted' || f.status === 'draft'
                        ).length || 0}
                      </div>
                      <div className="small text-muted">In Progress</div>
                    </Col>
                    <Col md={3} className="text-center">
                      <div className="fs-4 fw-bold text-success">
                        {selectedProject?.fppEntries?.filter(f => 
                          f.status === 'Done' || f.status === 'Selesai' || f.status === 'Achieve'
                        ).length || 0}
                      </div>
                      <div className="small text-muted">Selesai</div>
                    </Col>
                    <Col md={3} className="text-center">
                      <div className="fs-4 fw-bold text-danger">
                        {selectedProject?.fppEntries?.filter(f => 
                          f.status === 'Drop'
                        ).length || 0}
                      </div>
                      <div className="small text-muted">Drop</div>
                    </Col>
                  </Row>
                </Card.Body>
              </Card> */}
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowFppModal(false)}>
            Tutup
          </Button>
          <Button variant="primary" as={Link} to="/dashboard">
            Ke Dashboard
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
}

export default Master;
