// src/pages/Dashboard.js
import React, { useState, useEffect } from 'react';
import { 
  Container, Row, Col, Card, Badge, Button, 
  Form, Table, Spinner, Alert, Modal, InputGroup, Pagination, Tab, Tabs
} from 'react-bootstrap';
import { db } from '../firebase';
import { collection, getDocs, onSnapshot } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as XLSX from 'xlsx';
import { deleteDoc, doc } from 'firebase/firestore';
import { FaFileExcel, FaSearch } from 'react-icons/fa';

// Komponen KPI Card yang bisa diklik
const KpiCard = ({ title, value, variant = 'primary', icon, loading, onClick, isActive }) => {
  const variants = {
    primary: 'bg-primary text-white',
    success: 'bg-success text-white',
    warning: 'bg-warning text-white',
    danger: 'bg-danger text-white',
    info: 'bg-info text-white',
    secondary: 'bg-secondary text-white',
    dark: 'bg-dark text-white'
  };

  const cardClass = `${variants[variant]} h-100 cursor-pointer ${isActive ? 'shadow-lg' : 'shadow-sm'}`;

  return (
    <Card 
      className={cardClass} 
      onClick={onClick}
      style={{ 
        cursor: 'pointer', 
        transition: 'all 0.2s',
        transform: isActive ? 'scale(1.02)' : 'scale(1)'
      }}
    >
      <Card.Body className="py-3">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <h6 className="mb-0">{title}</h6>
            {loading ? (
              <Spinner animation="border" size="sm" className="mt-2" />
            ) : (
              <h3 className="mb-0 mt-2">{value}</h3>
            )}
          </div>
          <div className="fs-2">
            {icon}
          </div>
        </div>
      </Card.Body>
    </Card>
  );
};

// Komponen untuk mengonversi tanggal ke Quarter
const getQuarterFromDate = (dateString) => {
  if (!dateString || dateString === '-') return '-';
  
  try {
    if (dateString.includes('Q')) return dateString;
    
    let date;
    if (typeof dateString === 'string') {
      date = new Date(dateString);
      if (isNaN(date.getTime())) {
        const parts = dateString.split('-');
        if (parts.length === 3) {
          date = new Date(parts[0], parts[1] - 1, parts[2]);
        }
      }
    } else if (dateString.toDate) {
      date = dateString.toDate();
    }
    
    if (!date || isNaN(date.getTime())) return '-';
    
    const month = date.getMonth() + 1;
    
    if (month >= 1 && month <= 3) return 'Q1';
    if (month >= 4 && month <= 6) return 'Q2';
    if (month >= 7 && month <= 9) return 'Q3';
    if (month >= 10 && month <= 12) return 'Q4';
    return '-';
  } catch (error) {
    console.error('Error parsing date:', dateString, error);
    return '-';
  }
};

// Fungsi untuk menghitung durasi dari approval ke selesai atau sisa hari
const calculateDuration = (fpp) => {
  if (!fpp.approvalDate) return '-';
  
  try {
    // Convert approvalDate to Date object
    let approvalDate;
    if (fpp.approvalDate.toDate) {
      approvalDate = fpp.approvalDate.toDate();
    } else {
      approvalDate = new Date(fpp.approvalDate);
    }
    
    if (fpp.tanggalSelesai) {
      // Calculate days from approval to finish
      let finishDate;
      if (fpp.tanggalSelesai.toDate) {
        finishDate = fpp.tanggalSelesai.toDate();
      } else {
        finishDate = new Date(fpp.tanggalSelesai);
      }
      
      const diffTime = Math.abs(finishDate - approvalDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return `${diffDays} hari`;
    } else {
      // Calculate remaining days from today to target
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Find last target date from rencanaPenugasan
      let lastTargetDate = null;
      if (fpp.rencanaPenugasan && fpp.rencanaPenugasan.length > 0) {
        const targets = fpp.rencanaPenugasan
          .filter(item => item.tglTarget)
          .map(item => {
            if (item.tglTarget.toDate) {
              return item.tglTarget.toDate();
            } else {
              return new Date(item.tglTarget);
            }
          })
          .filter(date => !isNaN(date.getTime()));
        
        if (targets.length > 0) {
          lastTargetDate = new Date(Math.max(...targets.map(d => d.getTime())));
        }
      }
      
      if (lastTargetDate) {
        const diffTime = Math.abs(lastTargetDate - today);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (today > lastTargetDate) {
          return `Terlambat ${diffDays} hari`;
        } else {
          return `${diffDays} hari lagi`;
        }
      }
      
      return '-';
    }
  } catch (error) {
    console.error('Error calculating duration:', error);
    return '-';
  }
};

// Komponen Detail Modal yang sama dengan Monitoring.js
const DetailModal = ({ show, handleClose, fppData, onDelete, isHead, hasAccessToFpp }) => {
  if (!fppData) return null;

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      if (typeof dateString.toDate === 'function') {
        const date = dateString.toDate();
        return date.toLocaleDateString('id-ID', {
          day: '2-digit',
          month: 'long',
          year: 'numeric'
        });
      } else {
        const date = new Date(dateString);
        return date.toLocaleDateString('id-ID', {
          day: '2-digit',
          month: 'long',
          year: 'numeric'
        });
      }
    } catch (error) {
      return dateString;
    }
  };

  // Helper untuk render checklist items
  const renderChecklistItems = () => {
    if (!fppData.doneChecklist || !fppData.doneChecklist.items) return null;
    
    const items = fppData.doneChecklist.items;
    const department = fppData.doneChecklist.department;
    
    // Daftar label yang lebih readable
    const itemLabels = {
      sk: 'SK',
      se: 'SE',
      ik: 'IK',
      form: 'FORM',
      memo: 'MEMO',
      cr: 'CR',
      pir_st: 'PIR/ST',
      br: 'BR',
      fsd: 'FSD',
      sosialisasi: 'Sosialisasi',
      mom: 'MOM',
      pir: 'PIR',
      datamart: 'Datamart',
      figma: 'Figma',
      ppt: 'PPT',
      survey: 'Survey'
    };
    
    const checkedItems = Object.entries(items)
      .filter(([key, item]) => item.checked)
      .map(([key, item]) => ({
        label: itemLabels[key] || key.toUpperCase(),
        value: item.textValue || null
      }));
    
    if (checkedItems.length === 0) return null;
    
    return (
      <Card className="mb-3">
        <Card.Header className="bg-success text-white">
          <strong>✅ Done Checklist ({department})</strong>
        </Card.Header>
        <Card.Body>
          <p className="text-muted">
            <small>
              Disubmit oleh: {fppData.doneChecklist.submittedBy || '-'}<br />
              Tanggal: {formatDate(fppData.doneChecklist.submittedAt)}
            </small>
          </p>
          <div className="row">
            {checkedItems.map((item, index) => (
              <div key={index} className="col-md-6 mb-2">
                <div className="d-flex align-items-start">
                  <Badge bg="success" className="me-2 mt-1">✓</Badge>
                  <div>
                    <strong>{item.label}</strong>
                    {item.value && (
                      <div className="small text-muted mt-1">
                        <strong>Link:</strong> {item.value}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card.Body>
      </Card>
    );
  };



  // Helper untuk render tim project
  const renderTimProject = () => {
    if (!fppData.timProject || !Array.isArray(fppData.timProject)) return null;
    
    return (
      <Card className="mb-3">
        <Card.Header className="bg-secondary text-white">
          <strong>Tim Project</strong>
        </Card.Header>
        <Card.Body>
          <div className="table-responsive">
            <Table striped bordered size="sm">
              <thead>
                <tr>
                  <th style={{ width: '50px' }}>No</th>
                  <th>Department</th>
                  <th>TIM</th>
                  <th>PIC</th>
                  <th>Output</th>
                </tr>
              </thead>
              <tbody>
                {fppData.timProject.map((tim, index) => (
                  <tr key={index}>
                    <td>{index + 1}</td>
                    <td>{tim.department || '-'}</td>
                    <td>{tim.tim || '-'}</td>
                    <td>{tim.pic || '-'}</td>
                    <td>{(tim.outputs || []).join(', ') || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Card.Body>
      </Card>
    );
  };

  // Helper untuk render rencana penugasan
  const renderRencanaPenugasan = () => {
    if (!fppData.rencanaPenugasan || !Array.isArray(fppData.rencanaPenugasan)) return null;
    
    return (
      <Card className="mb-3">
        <Card.Header className="bg-warning text-dark">
          <strong>Rencana Penugasan</strong>
        </Card.Header>
        <Card.Body>
          <div className="table-responsive">
            <Table striped bordered size="sm">
              <thead>
                <tr>
                  <th style={{ width: '50px' }}>No</th>
                  <th>Keterangan</th>
                  <th style={{ width: '150px' }}>Target</th>
                </tr>
              </thead>
              <tbody>
                {fppData.rencanaPenugasan.map((item, index) => (
                  <tr key={index}>
                    <td>{index + 1}</td>
                    <td>{item.keterangan || '-'}</td>
                    <td>{formatDate(item.tglTarget)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Card.Body>
      </Card>
    );
  };

  return (
    <Modal show={show} onHide={handleClose} size="xl" fullscreen="lg-down" scrollable>
      <Modal.Header closeButton className="bg-primary text-white">
        <Modal.Title>
          <div className="d-flex align-items-center">
            <span>Detail FPP - {fppData.noFpp || '-'}</span>
            <Badge bg={
              fppData.status === 'In Progress' || fppData.status === 'submitted' ? 'warning' :
              fppData.status === 'Selesai' || fppData.status === 'Done' || fppData.status === 'Achieve' ? 'success' :
              fppData.status === 'Hold' ? 'secondary' :
              fppData.status === 'Drop' ? 'danger' :
              fppData.status === 'Revisi FPP' ? 'info' : 'light'
            } className="ms-2">
              {fppData.status === 'submitted' ? 'In Progress' : fppData.status || 'In Progress'}
              {fppData.doneChecklist && ' ✓'}
            </Badge>
          </div>
        </Modal.Title>
      </Modal.Header>
      <Modal.Body style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
        <Tabs defaultActiveKey="info" className="mb-3">
          <Tab eventKey="info" title="Informasi Utama">
            <Row>
              <Col md={6}>
                <Card className="mb-3">
                  <Card.Header className="bg-primary text-white">
                    <strong>Master Project</strong>
                  </Card.Header>
                  <Card.Body>
                    <table className="table table-sm">
                      <tbody>
                        <tr>
                          <td style={{ width: '200px' }}><strong>No. Project/FPP Induk:</strong></td>
                          <td><Badge bg="info">{fppData.masterProjectNumber || '-'}</Badge></td>
                        </tr>
                        <tr>
                          <td><strong>Judul Project:</strong></td>
                          <td>{fppData.masterProjectName || '-'}</td>
                        </tr>
                        <tr>
                          <td><strong>Skala Project:</strong></td>
                          <td>
                            <Badge bg={
                              fppData.skalaProject === 'Small' ? 'success' :
                              fppData.skalaProject === 'Medium' ? 'warning' :
                              fppData.skalaProject === 'Large' ? 'danger' : 'secondary'
                            }>
                              {fppData.skalaProject || '-'}
                            </Badge>
                          </td>
                        </tr>
                        <tr>
                          <td><strong>Departemen Project:</strong></td>
                          <td>
                            {fppData.projectDepartments ? 
                              (Array.isArray(fppData.projectDepartments) ? 
                                fppData.projectDepartments.join(', ') : fppData.projectDepartments) 
                              : '-'}
                          </td>
                        </tr>
                        <tr>
                          <td><strong>Tahun Project:</strong></td>
                          <td>{fppData.tahunProject || '-'}</td>
                        </tr>
                        <tr>
                          <td><strong>Kategori Project:</strong></td>
                          <td>{fppData.kategoriProject || '-'}</td>
                        </tr>
                      </tbody>
                    </table>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={6}>
                <Card className="mb-3">
                  <Card.Header className="bg-success text-white">
                    <strong>FPP Details</strong>
                  </Card.Header>
                  <Card.Body>
                    <table className="table table-sm">
                      <tbody>
                        <tr>
                          <td style={{ width: '200px' }}><strong>No. FPP:</strong></td>
                          <td><Badge bg="dark">{fppData.noFpp || '-'}</Badge></td>
                        </tr>
                        <tr>
                          <td><strong>Judul FPP:</strong></td>
                          <td>{fppData.judulFpp || '-'}</td>
                        </tr>
                        <tr>
                          <td><strong>Departemen:</strong></td>
                          <td><Badge bg="primary">{fppData.department || '-'}</Badge></td>
                        </tr>
                        <tr>
                          <td><strong>Tim:</strong></td>
                          <td>{fppData.tim || '-'}</td>
                        </tr>
                        <tr>
                          <td><strong>PIC:</strong></td>
                          <td>{fppData.pic || '-'}</td>
                        </tr>
                        <tr>
                          <td><strong>Jenis Project:</strong></td>
                          <td>{fppData.jenisProjectResolved || fppData.jenisProject || '-'}</td>
                        </tr>
                        <tr>
                          <td><strong>PIR Type:</strong></td>
                          <td>{fppData.pirType || '-'}</td>
                        </tr>
                      </tbody>
                    </table>
                  </Card.Body>
                </Card>
              </Col>
            </Row>

            {/* Timeline */}
            <Card className="mb-3">
              <Card.Header className="bg-info text-white">
                <strong>Timeline</strong>
              </Card.Header>
              <Card.Body>
                <Row>
                  <Col md={4}>
                    <div className="text-center p-3 border rounded bg-light">
                      <div className="small text-muted">Tanggal Approval</div>
                      <div className="fw-bold">{formatDate(fppData.approvalDate)}</div>
                    </div>
                  </Col>
                  <Col md={4}>
                    <div className="text-center p-3 border rounded bg-light">
                      <div className="small text-muted">Tanggal Start</div>
                      <div className="fw-bold">{formatDate(fppData.approvalDate)}</div>
                    </div>
                  </Col>
                  <Col md={4}>
                    <div className="text-center p-3 border rounded bg-light">
                      <div className="small text-muted">Tanggal Selesai</div>
                      <div className="fw-bold">{formatDate(fppData.tanggalSelesai) || '-'}</div>
                    </div>
                  </Col>
                </Row>
                <div className="mt-3">
                  <strong>Keterangan Status:</strong> {fppData.keterangan || '-'}
                </div>
              </Card.Body>
            </Card>
          </Tab>

          <Tab eventKey="details" title="Detail Penugasan">
            <Card className="mb-3">
              <Card.Header className="bg-info text-white">
                <strong>Detail Penugasan</strong>
              </Card.Header>
              <Card.Body>
                <Row>
                  <Col md={12} className="mb-3">
                    <strong>Latar Belakang:</strong>
                    <div className="p-2 bg-light rounded mt-1">
                      {fppData.latarBelakang || '-'}
                    </div>
                  </Col>
                  <Col md={12} className="mb-3">
                    <strong>Tujuan:</strong>
                    <div className="p-2 bg-light rounded mt-1">
                      {fppData.tujuan || '-'}
                    </div>
                  </Col>
                  <Col md={12} className="mb-3">
                    <strong>Scope:</strong>
                    <div className="p-2 bg-light rounded mt-1">
                      {fppData.scope || '-'}
                    </div>
                  </Col>
                  <Col md={12} className="mb-3">
                    <strong>Unit Kerja Terkait:</strong>
                    <div className="p-2 bg-light rounded mt-1">
                      {fppData.unitKerjaTerkait || '-'}
                    </div>
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          </Tab>

          <Tab eventKey="timeline" title="Timeline & Rencana">
            {renderRencanaPenugasan()}
          </Tab>

          <Tab eventKey="team" title="Tim & Output">
            {renderTimProject()}
            {/* {renderUraianPekerjaan()} */}
          </Tab>

          <Tab eventKey="checklist" title="Done Checklist">
            {renderChecklistItems()}
          </Tab>
        </Tabs>
      </Modal.Body>
      <Modal.Footer className="d-flex justify-content-between">
        <div>
          <Button variant="secondary" onClick={handleClose}>
            Tutup
          </Button>
          <Button variant="outline-primary" as={Link} to="/monitoring" className="ms-2">
            Ke Halaman Monitoring
          </Button>
        </div>
        {(isHead || hasAccessToFpp(fppData)) && (
          <Button 
            variant="outline-danger" 
            onClick={() => {
              if (window.confirm(`Apakah Anda yakin ingin menghapus FPP "${fppData.noFpp}"?`)) {
                onDelete(fppData.id, fppData.masterProjectNumber, fppData);
                handleClose();
              }
            }}
          >
            Delete FPP
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  );
};

function Dashboard() {
  const { user } = useAuth();
  
  // State untuk data
  const [selectedDepartments, setSelectedDepartments] = useState(['ALL']);
  const [fppEntries, setFppEntries] = useState([]);
  const [groupedData, setGroupedData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [displayData, setDisplayData] = useState([]);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedFpp, setSelectedFpp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const getTimestamp = (fpp) => {
    if (fpp.createdAt) {
      if (typeof fpp.createdAt.toDate === 'function') {
        return fpp.createdAt.toDate().getTime();
      } else if (fpp.createdAt.seconds) {
        return fpp.createdAt.seconds * 1000;
      } else {
        return new Date(fpp.createdAt).getTime();
      }
    } else if (fpp.updatedAt) {
      if (typeof fpp.updatedAt.toDate === 'function') {
        return fpp.updatedAt.toDate().getTime();
      } else if (fpp.updatedAt.seconds) {
        return fpp.updatedAt.seconds * 1000;
      } else {
        return new Date(fpp.updatedAt).getTime();
      }
    }
    return new Date().getTime();
  };
  // State untuk filter
  const [filters, setFilters] = useState({
    jenisProject: '',
    pic: '',
    target: '',
    tim: '',
    status: '',
    skalaProject: '',
    search: '',
    department: ''
  });

  // State untuk KPI filter
  const [activeKpiFilter, setActiveKpiFilter] = useState('');

  // State untuk pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  
  // Cek apakah user adalah Head (password: inputmaster)
  const isHead = user?.role === 'head' || user?.isHead || user?.userType === 'head';
  
  // Get user's department untuk filter access
  const getUserDepartment = () => {
    if (!user || !user.isLoggedIn) return '';
    
    // HEAD user
    if (user.role === 'head' || user.isHead) {
      return 'ALL';
    }
    
    // TIM user
    return user.department || '';
  };

  const userDepartment = getUserDepartment();

  // ========== FUNGSI PERBAIKAN: FILTER BERDASARKAN PROJECT DEPARTMENTS ==========
  
  // Fungsi untuk memeriksa apakah user memiliki akses ke FPP berdasarkan Project Departments
  const hasAccessToFpp = (fpp) => {
    if (!user || !user.isLoggedIn) return false;
    
    // HEAD bisa akses semua
    if (user.role === 'head' || user.isHead) {
      return true;
    }
    
    // Jika FPP tidak punya projectDepartments, anggap tidak ada akses
    if (!fpp.projectDepartments || 
        (Array.isArray(fpp.projectDepartments) && fpp.projectDepartments.length === 0)) {
      console.warn(`FPP ${fpp.noFpp} tidak punya projectDepartments`);
      return false;
    }
    
    // Format projectDepartments menjadi array
    let projectDepts = [];
    if (Array.isArray(fpp.projectDepartments)) {
      projectDepts = fpp.projectDepartments.map(dept => dept.trim().toUpperCase());
    } else if (typeof fpp.projectDepartments === 'string') {
      projectDepts = fpp.projectDepartments
        .split(',')
        .map(dept => dept.trim().toUpperCase())
        .filter(dept => dept);
    }
    
    // Cek apakah user department ada dalam projectDepartments
    const userDept = user.department?.toUpperCase();
    return projectDepts.includes(userDept);
  };

  // Fungsi untuk memfilter data berdasarkan akses user
  const filterByUserAccess = (data) => {
    if (isHead) {
      return data || [];
    }
    
    if (!data || data.length === 0) {
      return [];
    }
    
    // Filter berdasarkan projectDepartments
    const filteredData = data.filter(fpp => hasAccessToFpp(fpp));
    
    console.log(`Filtered ${filteredData.length} out of ${data.length} FPPs for user ${user.department}`);
    return filteredData;
  };

  // ========== END PERBAIKAN ==========

  // Fungsi untuk grouping data
  const flatFppList = (data) => {
    if (!data || data.length === 0) return [];
    
    // Buat flat list dari semua FPP
    return data.map(fpp => ({
      masterProject: {
        masterProjectNumber: fpp.masterProjectNumber,
        masterProjectName: fpp.masterProjectName,
        masterProjectType: fpp.masterProjectType
      },
      fppEntries: [fpp] // Setiap group hanya berisi 1 FPP
    }));
  };

  // Setup real-time listener
  useEffect(() => {
    let unsubscribe = null;
    
    const setupListener = () => {
      unsubscribe = onSnapshot(collection(db, 'fpp_monitoring'), (snapshot) => {
        const updatedMonitoringData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        const updatedFormattedData = updatedMonitoringData.map(item => ({
          id: item.id,
          masterProjectNumber: item.masterProjectNumber || item.noFpp || 'NO-PROJECT-' + item.id,
          masterProjectName: item.masterProjectName || item.judulFpp || 'No Project Name',
          masterProjectType: item.masterProjectType || 'project',
          department: item.department || '-',
          tim: item.tim || '-',
          pic: item.pic || '-',
          noFpp: item.noFpp || '-',
          judulFpp: item.judulFpp || '-',
          jenisProject: item.jenisProject || '-',
          jenisProjectResolved: item.jenisProjectResolved || item.jenisProject || '-',
          pirType: item.pirType || '-',
          skalaProject: item.skalaProject || '-',
          status: item.status || 'In Progress',
          rencanaPenugasan: item.rencanaPenugasan || [],
          deliveryTimeline: item.deliveryTimeline || [],
          uraianPekerjaan: item.uraianPekerjaan || [],
          timProject: item.timProject || [],
          approvalDate: item.approvalDate || null,
          tanggalSelesai: item.tanggalSelesai || null,
          keterangan: item.keterangan || '',
          doneChecklist: item.doneChecklist || null,
          latarBelakang: item.latarBelakang || '',
          tujuan: item.tujuan || '',
          scope: item.scope || '',
          unitKerjaTerkait: item.unitKerjaTerkait || '',
          metodologi: item.metodologi || '',
          successCriteria: item.successCriteria || '',
          risikoMitigasi: item.risikoMitigasi || '',
          tahunProject: item.tahunProject || '',
          kategoriProject: item.kategoriProject || '',
          projectDepartments: item.projectDepartments || [],
          parafData: item.parafData || [],
          createdAt: item.createdAt || new Date(),
          updatedAt: item.updatedAt || new Date()
        }));


        
        const updatedAccessibleData = filterByUserAccess(updatedFormattedData);
        setFppEntries(updatedAccessibleData);

        const newFlatList = createFlatFppList(updatedAccessibleData); // GANTI INI
        setGroupedData(newFlatList);
        applyFiltersToData(newFlatList);
        
        const newGrouped = flatFppList(updatedAccessibleData);
        setGroupedData(newGrouped);
        
        applyFiltersToData(newGrouped);
        
        setLoading(false);
      }, (error) => {
        console.error('Error in real-time listener:', error);
        setError('Error dalam real-time update: ' + error.message);
        setLoading(false);
      });
    };
    
    // Setup listener
    setupListener();
    
    // Cleanup listener saat unmount
    return () => {
      if (unsubscribe && typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  // Ambil data awal saat mount
  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const monitoringSnapshot = await getDocs(collection(db, 'fpp_monitoring'));
        const monitoringDataArray = monitoringSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        if (monitoringDataArray.length === 0) {
          setError('Tidak ada data project. Silakan tambah data di halaman Monitoring terlebih dahulu.');
          setLoading(false);
          return;
        }
        
        const formattedData = monitoringDataArray.map(item => ({
          id: item.id,
          masterProjectNumber: item.masterProjectNumber || item.noFpp || 'NO-PROJECT-' + item.id,
          masterProjectName: item.masterProjectName || item.judulFpp || 'No Project Name',
          masterProjectType: item.masterProjectType || 'project',
          department: item.department || '-',
          tim: item.tim || '-',
          pic: item.pic || '-',
          noFpp: item.noFpp || '-',
          judulFpp: item.judulFpp || '-',
          jenisProject: item.jenisProject || '-',
          jenisProjectResolved: item.jenisProjectResolved || item.jenisProject || '-',
          pirType: item.pirType || '-',
          skalaProject: item.skalaProject || '-',
          status: item.status || 'In Progress',
          rencanaPenugasan: item.rencanaPenugasan || [],
          deliveryTimeline: item.deliveryTimeline || [],
          uraianPekerjaan: item.uraianPekerjaan || [],
          timProject: item.timProject || [],
          approvalDate: item.approvalDate || null,
          tanggalSelesai: item.tanggalSelesai || null,
          keterangan: item.keterangan || '',
          doneChecklist: item.doneChecklist || null,
          latarBelakang: item.latarBelakang || '',
          tujuan: item.tujuan || '',
          scope: item.scope || '',
          unitKerjaTerkait: item.unitKerjaTerkait || '',
          metodologi: item.metodologi || '',
          successCriteria: item.successCriteria || '',
          risikoMitigasi: item.risikoMitigasi || '',
          tahunProject: item.tahunProject || '',
          kategoriProject: item.kategoriProject || '',
          projectDepartments: item.projectDepartments || [],
          parafData: item.parafData || [],
          createdAt: item.createdAt || new Date(),
          updatedAt: item.updatedAt || new Date()
        }));

        const validData = formattedData.filter(item => {
          if (!item.projectDepartments || 
              (Array.isArray(item.projectDepartments) && item.projectDepartments.length === 0)) {
            console.warn(`FPP ${item.noFpp} tidak punya projectDepartments, akan difilter`);
            return false;
          }
          return true;
        });
        // SORTING: Urutkan berdasarkan tanggal masuk (terbaru di atas)
        const sortedValidData = validData.sort((a, b) => {
          const timeA = getTimestamp(a);
          const timeB = getTimestamp(b);
          return timeB - timeA; // Descending (terbaru di atas)
        });

        console.log(`Total FPPs: ${formattedData.length}, Valid FPPs (with projectDepartments): ${sortedValidData.length}`);

        const accessibleData = filterByUserAccess(sortedValidData);
        setFppEntries(accessibleData);

        const flatList = createFlatFppList(accessibleData); // GANTI INI
        setGroupedData(flatList); // Nama state tetap sama
        applyFiltersToData(flatList);
        
        const grouped = flatFppList(accessibleData);
        setGroupedData(grouped);
        applyFiltersToData(grouped);
        
      } catch (error) {
        console.error('Error fetching initial data:', error);
        setError('Error mengambil data: ' + error.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchInitialData();
  }, []);

  // Fungsi delete dengan permission control
  const deleteFpp = async (fppId, masterProjectNumber, fppData) => {
    if (!isHead && !hasAccessToFpp(fppData)) {
      alert('Anda tidak memiliki akses untuk menghapus FPP ini!');
      return;
    }

    const confirmMessage = `HAPUS FPP\n\n` +
      `Master Project: ${masterProjectNumber}\n` +
      `No FPP: ${fppData.noFpp}\n` +
      `Judul: ${fppData.judulFpp}\n` +
      `Department: ${fppData.department}\n` +
      `Project Departments: ${Array.isArray(fppData.projectDepartments) ? fppData.projectDepartments.join(', ') : fppData.projectDepartments}\n\n` +
      `Apakah Anda yakin ingin menghapus? Aksi ini tidak dapat dibatalkan!`;
    
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      setLoading(true);
      await deleteDoc(doc(db, 'fpp_monitoring', fppId));
      alert(`✅ FPP berhasil dihapus!\n\nNo FPP: ${fppData.noFpp}`);
    } catch (error) {
      console.error('Error deleting FPP:', error);
      alert('❌ Gagal menghapus FPP:\n' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Hitung KPI berdasarkan data yang difilter
  const calculateKpiData = (data) => {
    const allFppEntries = data.flatMap(group => group.fppEntries);
    const totalFppEntries = allFppEntries.length;
    
    // HITUNG MASTER PROJECT UNIK: Ambil semua masterProjectNumber yang unik
    const uniqueMasterProjects = new Set();
    data.forEach(group => {
      const masterProjectNumber = group.masterProject?.masterProjectNumber;
      if (masterProjectNumber) {
        uniqueMasterProjects.add(masterProjectNumber);
      }
    });
    
    // HITUNG STATUS per FPP
    const inProgress = allFppEntries.filter(fpp => 
      fpp.status === 'In Progress' || fpp.status === 'submitted' || fpp.status === 'draft'
    ).length;
    
    const hold = allFppEntries.filter(fpp => fpp.status === 'Hold').length;
    const selesai = allFppEntries.filter(fpp => 
      fpp.status === 'Selesai' || fpp.status === 'Done' || fpp.status === 'Achieve'
    ).length;
    const drop = allFppEntries.filter(fpp => fpp.status === 'Drop').length;
    const revisi = allFppEntries.filter(fpp => fpp.status === 'Revisi FPP').length;

    return {
      totalMasterProjects: uniqueMasterProjects.size, // PERUBAHAN: pakai size dari Set, bukan data.length
      totalFppEntries: totalFppEntries,
      inProgress,
      hold,
      selesai,
      drop,
      revisi
    };
  };

  // Fungsi untuk apply filters ke data
  const applyFiltersToData = (data) => {
    let filtered = [...(data || [])];
    
    // Filter berdasarkan departemen (hanya untuk Head)
    if (isHead && selectedDepartments.length > 0 && !selectedDepartments.includes('ALL')) {
      filtered = filtered.filter(group => {
        return group.fppEntries.some(fpp => selectedDepartments.includes(fpp.department));
      });
    }
    
    // Filter search
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(group => {
        return group.fppEntries.some(fpp => 
          (fpp.masterProjectNumber && fpp.masterProjectNumber.toLowerCase().includes(searchLower)) ||
          (fpp.noFpp && fpp.noFpp.toLowerCase().includes(searchLower)) ||
          (fpp.judulFpp && fpp.judulFpp.toLowerCase().includes(searchLower)) ||
          (fpp.masterProjectName && fpp.masterProjectName.toLowerCase().includes(searchLower))
        );
      });
    }
    
    // Filter lainnya
    if (filters.jenisProject) {
      filtered = filtered.filter(group => {
        return group.fppEntries.some(fpp => 
          fpp.jenisProjectResolved === filters.jenisProject || 
          fpp.jenisProject === filters.jenisProject
        );
      });
    }
    
    if (filters.pic) {
      filtered = filtered.filter(group => {
        return group.fppEntries.some(fpp => fpp.pic === filters.pic);
      });
    }
    
    if (filters.tim) {
      filtered = filtered.filter(group => {
        return group.fppEntries.some(fpp => fpp.tim === filters.tim);
      });
    }
    
    if (filters.department) {
      filtered = filtered.filter(group => {
        return group.fppEntries.some(fpp => fpp.department === filters.department);
      });
    }
    
    if (filters.status) {
      filtered = filtered.filter(group => {
        return group.fppEntries.some(fpp => {
          const status = fpp.status === 'submitted' ? 'In Progress' : fpp.status;
          return status === filters.status;
        });
      });
    }
    
    // Filter berdasarkan Skala Project
    if (filters.skalaProject) {
      filtered = filtered.filter(group => {
        return group.fppEntries.some(fpp => fpp.skalaProject === filters.skalaProject);
      });
    }
    
    // Filter target quarter
    if (filters.target && filters.target !== 'ALL') {
      filtered = filtered.filter(group => {
        return group.fppEntries.some(fpp => {
          const quarter = getQuarterFromDate(fpp.approvalDate);
          return quarter === filters.target;
        });
      });
    }
    
    // Apply KPI filter jika aktif
    if (activeKpiFilter) {
      filtered = filtered.filter(group => {
        return group.fppEntries.some(fpp => {
          if (activeKpiFilter === 'inProgress') {
            return fpp.status === 'In Progress' || fpp.status === 'submitted' || fpp.status === 'draft';
          } else if (activeKpiFilter === 'hold') {
            return fpp.status === 'Hold';
          } else if (activeKpiFilter === 'selesai') {
            return fpp.status === 'Selesai' || fpp.status === 'Done' || fpp.status === 'Achieve';
          } else if (activeKpiFilter === 'drop') {
            return fpp.status === 'Drop';
          } else if (activeKpiFilter === 'revisi') {
            return fpp.status === 'Revisi FPP';
          }
          return true;
        });
      });
    }
    
    setFilteredData(filtered);
    setCurrentPage(1);
    updateDisplayData(filtered);
  };

  // Fungsi untuk update display data dengan pagination
  const updateDisplayData = (data) => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedData = data.slice(startIndex, endIndex);
    setDisplayData(paginatedData);
};
  // Setup filters saat mounted atau data berubah
  useEffect(() => {
    applyFiltersToData(groupedData);
  }, [groupedData, filters, selectedDepartments, activeKpiFilter]);

  // Update display data saat currentPage berubah
  useEffect(() => {
    updateDisplayData(filteredData);
  }, [filteredData, currentPage]);

  // Handler untuk filter change
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Handler untuk reset filters
  const resetFilters = () => {
    setFilters({
      jenisProject: '',
      pic: '',
      target: '',
      tim: '',
      status: '',
      skalaProject: '',
      search: '',
      department: ''
    });
    setActiveKpiFilter('');
  };

  // Handler untuk KPI card click
  const handleKpiCardClick = (filterType) => {
    setActiveKpiFilter(prev => prev === filterType ? '' : filterType);
  };

  // Handler untuk detail modal
  const handleShowDetail = (fppData) => {
    setSelectedFpp(fppData);
    setShowDetailModal(true);
  };

  // Handler untuk export ke Excel
  const exportToExcel = () => {
    try {
      const allFppEntries = filteredData.flatMap(group => group.fppEntries);
      
      if (allFppEntries.length === 0) {
        alert('Tidak ada data untuk diexport!');
        return;
      }
      
      const excelData = allFppEntries.map(fpp => {
        const formatDateForExcel = (dateValue) => {
          if (!dateValue) return '-';
          try {
            let date;
            if (typeof dateValue.toDate === 'function') {
              date = dateValue.toDate();
            } else {
              date = new Date(dateValue);
            }
            return date.toLocaleDateString('id-ID');
          } catch (error) {
            return '-';
          }
        };
        
        const formatChecklist = (checklist) => {
          if (!checklist || !checklist.items) return '-';
          const checkedItems = Object.entries(checklist.items)
            .filter(([_, item]) => item.checked)
            .map(([key, _]) => key.toUpperCase());
          return checkedItems.join(', ');
        };
        
        const formatDepartments = (departments) => {
          if (!departments) return '-';
          if (Array.isArray(departments)) return departments.join(', ');
          return departments;
        };
        
        const formatUraianPekerjaan = (uraianPekerjaan) => {
          if (!uraianPekerjaan || !Array.isArray(uraianPekerjaan)) return '-';
          return uraianPekerjaan.map(item => 
            `${item.jenisPekerjaan || ''}: ${item.uraian || ''}`
          ).join('; ');
        };
        
        return {
          'Master Project Number': fpp.masterProjectNumber || '-',
          'Master Project Name': fpp.masterProjectName || '-',
          'No FPP': fpp.noFpp || '-',
          'Judul FPP': fpp.judulFpp || '-',
          'Skala Project': fpp.skalaProject || '-',
          'Department': fpp.department || '-',
          'TIM': fpp.tim || '-',
          'PIC': fpp.pic || '-',
          'Jenis Project': fpp.jenisProjectResolved || fpp.jenisProject || '-',
          'PIR Type': fpp.pirType || '-',
          'Status': fpp.status || 'In Progress',
          'Tanggal Approval': formatDateForExcel(fpp.approvalDate),
          'Tanggal Selesai': formatDateForExcel(fpp.tanggalSelesai),
          'Target Quarter': getQuarterFromDate(fpp.approvalDate),
          'Project Departments': formatDepartments(fpp.projectDepartments),
          'Done Checklist Items': fpp.doneChecklist ? formatChecklist(fpp.doneChecklist) : '-',
          'Done Checklist Department': fpp.doneChecklist?.department || '-',
          'Done Checklist Submitted By': fpp.doneChecklist?.submittedBy || '-',
          'Keterangan': fpp.keterangan || '-',
          'Latar Belakang': fpp.latarBelakang || '-',
          'Tujuan': fpp.tujuan || '-',
          'Scope': fpp.scope || '-',
          'Unit Kerja Terkait': fpp.unitKerjaTerkait || '-',
          'Metodologi': fpp.metodologi || '-',
          'Success Criteria': fpp.successCriteria || '-',
          'Risiko Mitigasi': fpp.risikoMitigasi || '-',
          'Tahun Project': fpp.tahunProject || '-',
          'Kategori Project': fpp.kategoriProject || '-',
          // 'Uraian Pekerjaan': formatUraianPekerjaan(fpp.uraianPekerjaan)
        };
      });
      
      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'FPP Data');
      
      const maxWidth = excelData.reduce((w, r) => Math.max(w, Object.values(r).join('').length), 10);
      ws['!cols'] = Array(Object.keys(excelData[0]).length).fill({ wch: maxWidth });
      
      const fileName = `FPP_Dashboard_Export_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
      
      alert(`✅ Data berhasil diexport ke ${fileName}`);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('❌ Gagal export data: ' + error.message);
    }
  };

  // Hitung KPI data
  const kpiData = calculateKpiData(filteredData);
  
  const getUniqueValues = (key) => {
    const values = new Set();
    filteredData.forEach(group => {
      const fpp = group.fppEntries[0]; // Ambil FPP pertama
      if (fpp[key]) values.add(fpp[key]);
    });
    return Array.from(values).sort();
  };

  const createFlatFppList = (data) => {
    if (!data || data.length === 0) return [];
    
    // Urutkan berdasarkan timestamp terlebih dahulu
    const sortedData = [...data].sort((a, b) => {
      const timeA = getTimestamp(a);
      const timeB = getTimestamp(b);
      return timeB - timeA; // Descending (terbaru di atas)
    });
    
    // Buat flat list
    return sortedData.map(fpp => ({
      masterProject: {
        masterProjectNumber: fpp.masterProjectNumber,
        masterProjectName: fpp.masterProjectName,
        masterProjectType: fpp.masterProjectType
      },
      fppEntries: [fpp]
    }));
  };

  // Format date untuk display
  const formatDateForDisplay = (dateValue) => {
    if (!dateValue) return '-';
    try {
      let date;
      if (typeof dateValue.toDate === 'function') {
        date = dateValue.toDate();
      } else {
        date = new Date(dateValue);
      }
      
      if (isNaN(date.getTime())) return '-';
      
      return date.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch (error) {
      return '-';
    }
  };

  // Dapatkan jumlah total halaman
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  // Render pagination
  const renderPagination = () => {
    if (totalPages <= 1) return null;
    
    const pageNumbers = [];
    const maxVisiblePages = 5;
    
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i);
    }
    
    return (
      <Pagination className="justify-content-center mt-3 flex-wrap">
        <Pagination.First 
          onClick={() => setCurrentPage(1)} 
          disabled={currentPage === 1}
          size="sm"
        />
        <Pagination.Prev 
          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} 
          disabled={currentPage === 1}
          size="sm"
        />
        
        {startPage > 1 && (
          <>
            <Pagination.Item onClick={() => setCurrentPage(1)} size="sm">1</Pagination.Item>
            {startPage > 2 && <Pagination.Ellipsis disabled size="sm" />}
          </>
        )}
        
        {pageNumbers.map(number => (
          <Pagination.Item 
            key={number} 
            active={number === currentPage}
            onClick={() => setCurrentPage(number)}
            size="sm"
          >
            {number}
          </Pagination.Item>
        ))}
        
        {endPage < totalPages && (
          <>
            {endPage < totalPages - 1 && <Pagination.Ellipsis disabled size="sm" />}
            <Pagination.Item onClick={() => setCurrentPage(totalPages)} size="sm">
              {totalPages}
            </Pagination.Item>
          </>
        )}
        
        <Pagination.Next 
          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} 
          disabled={currentPage === totalPages}
          size="sm"
        />
        <Pagination.Last 
          onClick={() => setCurrentPage(totalPages)} 
          disabled={currentPage === totalPages}
          size="sm"
        />
      </Pagination>
    );
  };

  // Render UI
  return (
    <div className='container'>
      <Container className="container row py-4 px-3" style={{ overflowX: 'hidden' }}>
        {/* Header */}
        <Row className="">
          <Col>
            <div className='fs-5 fw-semibold'>Dashboard FPP</div>
            <p className="text-muted">
              {isHead ? 'Overview semua departemen' : `Akses terbatas untuk departemen ${userDepartment}`}
            </p>
            
            {/* User Info */}
            <Alert variant="info" className="py-2 mb-3">
              <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center">
                <div className="mb-2 mb-md-0">
                  <strong>{user?.username || user?.email}</strong> 
                  {isHead && <Badge bg="danger" className="ms-2">HEAD</Badge>}
                  <Badge bg="primary" className="ms-2">{userDepartment}</Badge>
                </div>
                <div className="text-md-end">
                  <small>Total Project: {filteredData.length} | Total FPP: {kpiData.totalFppEntries}</small>
                </div>
              </div>
            </Alert>
          </Col>
        </Row>

        {/* KPI Cards */}
        <Row className="mb-4 g-2 container">
          <Col xs={6} sm={4} md={3} lg={2}>
            <KpiCard 
              title="Total Master Project" 
              value={kpiData.totalMasterProjects}
              variant="primary"
              loading={loading}
              onClick={() => handleKpiCardClick('')}
              isActive={!activeKpiFilter}
            />
          </Col>
          <Col xs={6} sm={4} md={3} lg={2}>
            <KpiCard 
              title="Total FPP" 
              value={kpiData.totalFppEntries}
              variant="info"
              loading={loading}
              onClick={() => handleKpiCardClick('')}
              isActive={!activeKpiFilter}
            />
          </Col>
          <Col xs={6} sm={4} md={3} lg={2}>
            <KpiCard 
              title="In Progress" 
              value={kpiData.inProgress}
              variant="warning"
              loading={loading}
              onClick={() => handleKpiCardClick('inProgress')}
              isActive={activeKpiFilter === 'inProgress'}
            />
          </Col>
          <Col xs={6} sm={4} md={3} lg={2}>
            <KpiCard 
              title="Hold" 
              value={kpiData.hold}
              variant="secondary"
              loading={loading}
              onClick={() => handleKpiCardClick('hold')}
              isActive={activeKpiFilter === 'hold'}
            />
          </Col>
          <Col xs={6} sm={4} md={3} lg={2}>
            <KpiCard 
              title="Selesai" 
              value={kpiData.selesai}
              variant="success"
              loading={loading}
              onClick={() => handleKpiCardClick('selesai')}
              isActive={activeKpiFilter === 'selesai'}
            />
          </Col>
          <Col xs={6} sm={4} md={3} lg={2}>
            <KpiCard 
              title="Revisi" 
              value={kpiData.revisi}
              variant="info"
              loading={loading}
              onClick={() => handleKpiCardClick('revisi')}
              isActive={activeKpiFilter === 'revisi'}
            />
          </Col>
        </Row>

        {/* Filters Section */}
        <Card className="mb-4 container">
        <Card.Header className="bg-light">
          <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center">
            <h5 className="mb-2 mb-md-0">
              Data FPP 
              {activeKpiFilter && (
                <Badge bg="warning" className="ms-2">
                  Filter: {activeKpiFilter}
                </Badge>
              )}
            </h5>
            <div>
              <small className="text-muted">
                Menampilkan {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredData.length)} 
                dari {filteredData.length} project
                <br />
                (Halaman {currentPage} dari {totalPages})
              </small>
            </div>
          </div>
        </Card.Header>
          <Card.Body>
            <Row className="g-2">
              {/* Search Input */}
              <Col xs={12} className="mb-2">
                <InputGroup>
                  <InputGroup.Text>
                    <FaSearch />
                  </InputGroup.Text>
                  <Form.Control
                    placeholder="Cari berdasarkan No. Project, No. FPP, atau Judul..."
                    value={filters.search}
                    onChange={(e) => handleFilterChange('search', e.target.value)}
                    size="sm"
                  />
                </InputGroup>
              </Col>

              {/* Filter lainnya */}
              <Col xs={12} sm={6} md={4} lg={3} className="mb-2">
                <Form.Label className="small mb-1">Jenis Project</Form.Label>
                <Form.Select
                  size="sm"
                  value={filters.jenisProject}
                  onChange={(e) => handleFilterChange('jenisProject', e.target.value)}
                >
                  <option value="">Semua Jenis</option>
                  {getUniqueValues('jenisProjectResolved').map((jenis, idx) => (
                    <option key={idx} value={jenis}>{jenis}</option>
                  ))}
                </Form.Select>
              </Col>

              <Col xs={12} sm={6} md={4} lg={2} className="mb-2">
                <Form.Label className="small mb-1">PIC</Form.Label>
                <Form.Select
                  size="sm"
                  value={filters.pic}
                  onChange={(e) => handleFilterChange('pic', e.target.value)}
                >
                  <option value="">Semua PIC</option>
                  {getUniqueValues('pic').map((pic, idx) => (
                    <option key={idx} value={pic}>{pic}</option>
                  ))}
                </Form.Select>
              </Col>

              <Col xs={12} sm={6} md={4} lg={2} className="mb-2">
                <Form.Label className="small mb-1">TIM</Form.Label>
                <Form.Select
                  size="sm"
                  value={filters.tim}
                  onChange={(e) => handleFilterChange('tim', e.target.value)}
                >
                  <option value="">Semua TIM</option>
                  {getUniqueValues('tim').map((tim, idx) => (
                    <option key={idx} value={tim}>{tim}</option>
                  ))}
                </Form.Select>
              </Col>

              <Col xs={12} sm={6} md={4} lg={2} className="mb-2">
                <Form.Label className="small mb-1">Department</Form.Label>
                <Form.Select
                  size="sm"
                  value={filters.department}
                  onChange={(e) => handleFilterChange('department', e.target.value)}
                  disabled={!isHead}
                >
                  <option value="">Semua Department</option>
                  {getUniqueValues('department').map((dept, idx) => (
                    <option key={idx} value={dept}>{dept}</option>
                  ))}
                </Form.Select>
                {/* {!isHead && <small className="text-muted">Filter department hanya untuk Head</small>} */}
              </Col>

              <Col xs={12} sm={6} md={4} lg={2} className="mb-2">
                <Form.Label className="small mb-1">Skala Project</Form.Label>
                <Form.Select
                  size="sm"
                  value={filters.skalaProject}
                  onChange={(e) => handleFilterChange('skalaProject', e.target.value)}
                >
                  <option value="">Semua Skala</option>
                  <option value="Small">Small</option>
                  <option value="Medium">Medium</option>
                  <option value="Large">Large</option>
                </Form.Select>
              </Col>

              <Col xs={12} sm={6} md={4} lg={2} className="mb-2">
                <Form.Label className="small mb-1">Status</Form.Label>
                <Form.Select
                  size="sm"
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                >
                  <option value="">Semua Status</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Hold">Hold</option>
                  <option value="Selesai">Selesai</option>
                  <option value="Drop">Drop</option>
                  <option value="Revisi FPP">Revisi FPP</option>
                </Form.Select>
              </Col>

              <Col xs={12} sm={6} md={4} lg={2} className="mb-2">
                <Form.Label className="small mb-1">Target Quarter</Form.Label>
                <Form.Select
                  size="sm"
                  value={filters.target}
                  onChange={(e) => handleFilterChange('target', e.target.value)}
                >
                  <option value="">Semua Quarter</option>
                  <option value="Q1">Q1</option>
                  <option value="Q2">Q2</option>
                  <option value="Q3">Q3</option>
                  <option value="Q4">Q4</option>
                </Form.Select>
              </Col>
            </Row>
          </Card.Body>
        </Card>

        {/* Data Table */}
        <Card>
          <Card.Header className="bg-light">
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center">
              <h5 className="mb-2 mb-md-0">
                Data FPP 
                {activeKpiFilter && (
                  <Badge bg="warning" className="ms-2">
                    Filter: {activeKpiFilter}
                  </Badge>
                )}
              </h5>
              <div>
                <small className="text-muted">
                  Menampilkan {displayData.length} dari {filteredData.length} project
                  (Total {kpiData.totalFppEntries} FPP)
                </small>
              </div>
            </div>
          </Card.Header>
          <Card.Body className="p-0">
            {loading ? (
              <div className="text-center py-5">
                <Spinner animation="border" variant="primary" />
                <p className="mt-2">Memuat data...</p>
              </div>
            ) : error ? (
              <Alert variant="danger" className="m-3">
                {error}
              </Alert>
            ) : filteredData.length === 0 ? (
              <Alert variant="warning" className="m-3">
                Tidak ada data yang ditemukan dengan filter saat ini.
              </Alert>
            ) : (
              <>
                {/* Table dengan overflow horizontal */}
                <div className="table-responsive" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                  <Table striped bordered hover className="mb-0" style={{ minWidth: '1500px' }}>
                    <thead className="bg-light position-sticky top-0">
                      <tr>
                        <th style={{ minWidth: '50px', maxWidth: '60px' }}>No</th>
                        <th style={{ minWidth: '200px' }}>Master Project</th>
                        <th style={{ minWidth: '150px' }}>No FPP</th>
                        <th style={{ minWidth: '300px' }}>Judul FPP</th>
                        <th style={{ minWidth: '120px' }}>Skala Project</th>
                        <th style={{ minWidth: '120px' }}>Dept</th>
                        <th style={{ minWidth: '150px' }}>TIM</th>
                        <th style={{ minWidth: '150px' }}>PIC</th>
                        <th style={{ minWidth: '150px' }}>Jenis Project</th>
                        <th style={{ minWidth: '120px' }}>Status</th>
                        <th style={{ minWidth: '120px' }}>Approval Date</th>
                        <th style={{ minWidth: '100px' }}>Target Quarter</th>
                        <th style={{ minWidth: '120px' }}>Durasi/Sisa</th>
                        {/* <th style={{ minWidth: '80px' }}>Done</th> */}
                        <th style={{ minWidth: '120px' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayData.flatMap((group, groupIndex) => 
                        group.fppEntries.map((fpp, fppIndex) => {
                          // PERBAIKAN PERHITUNGAN INDEX: Hitung berdasarkan total FPP yang sudah ditampilkan sebelumnya
                          const previousFppCount = displayData
                            .slice(0, groupIndex)
                            .reduce((total, g) => total + g.fppEntries.length, 0);
                          
                          const overallIndex = ((currentPage - 1) * itemsPerPage) + 
                                              previousFppCount + 
                                              fppIndex + 1;
                          
                          return (
                            <tr key={`${fpp.id || fpp.noFpp}-${fppIndex}`}>
                              <td style={{ maxWidth: '60px', overflow: 'hidden' }}>
                                {overallIndex}
                              </td>
                              <td style={{ maxWidth: '200px' }}>
                                <div className="text-truncate">
                                  <strong className="d-block text-truncate">{fpp.masterProjectNumber}</strong>
                                  <small className="text-muted text-truncate d-block">{fpp.masterProjectName}</small>
                                </div>
                              </td>
                              <td style={{ maxWidth: '150px' }}>
                                <Badge bg="dark" className="text-truncate d-inline-block" style={{ maxWidth: '100%' }}>
                                  {fpp.noFpp}
                                </Badge>
                              </td>
                              <td style={{ maxWidth: '300px' }}>
                                <div className="text-truncate">
                                  {fpp.judulFpp}
                                </div>
                              </td>
                              
                              <td style={{ maxWidth: '120px' }}>
                                <Badge bg={
                                  fpp.skalaProject === 'Small' ? 'success' :
                                  fpp.skalaProject === 'Medium' ? 'warning' :
                                  fpp.skalaProject === 'Large' ? 'danger' : 'secondary'
                                } className="text-truncate d-inline-block" style={{ maxWidth: '100%' }}>
                                  {fpp.skalaProject || '-'}
                                </Badge>
                              </td>
                              <td style={{ maxWidth: '120px' }}>
                                <Badge bg="primary" className="text-truncate d-inline-block" style={{ maxWidth: '100%' }}>
                                  {fpp.department}
                                </Badge>
                              </td>
                              <td style={{ maxWidth: '150px' }}>
                                <div className="text-truncate">{fpp.tim}</div>
                              </td>
                              <td style={{ maxWidth: '150px' }}>
                                <div className="text-truncate">{fpp.pic}</div>
                              </td>
                              <td style={{ maxWidth: '150px' }}>
                                <Badge bg="info" className="text-truncate d-inline-block" style={{ maxWidth: '100%' }}>
                                  {fpp.jenisProjectResolved || fpp.jenisProject}
                                </Badge>
                              </td>
                              <td style={{ maxWidth: '120px' }}>
                                <Badge bg={
                                  fpp.status === 'In Progress' || fpp.status === 'submitted' ? 'warning' :
                                  fpp.status === 'Selesai' || fpp.status === 'Done' || fpp.status === 'Achieve' ? 'success' :
                                  fpp.status === 'Hold' ? 'secondary' :
                                  fpp.status === 'Drop' ? 'danger' :
                                  fpp.status === 'Revisi FPP' ? 'info' : 'light'
                                } className="text-truncate d-inline-block" style={{ maxWidth: '100%' }}>
                                  {fpp.status === 'submitted' ? 'In Progress' : fpp.status || 'In Progress'}
                                </Badge>
                              </td>
                              <td style={{ maxWidth: '120px' }}>
                                <div className="text-truncate">{formatDateForDisplay(fpp.approvalDate)}</div>
                              </td>
                              <td style={{ maxWidth: '100px' }}>
                                <Badge bg="dark" className="text-truncate d-inline-block" style={{ maxWidth: '100%' }}>
                                  {getQuarterFromDate(fpp.approvalDate)}
                                </Badge>
                              </td>
                              <td style={{ maxWidth: '120px' }}>
                                <Badge bg={
                                  fpp.status === 'Selesai' || fpp.status === 'Done' ? 'success' :
                                  calculateDuration(fpp).includes('Terlambat') ? 'danger' : 'warning'
                                } className="text-truncate d-inline-block" style={{ maxWidth: '100%' }}>
                                  {calculateDuration(fpp)}
                                </Badge>
                              </td>
                              <td style={{ maxWidth: '120px' }}>
                                <div className="d-flex gap-1 flex-wrap">
                                  <Button 
                                    size="sm" 
                                    variant="outline-primary"
                                    onClick={() => handleShowDetail(fpp)}
                                    className="mb-1"
                                  >
                                    Detail
                                  </Button>
                                  {(isHead || hasAccessToFpp(fpp)) && (
                                    <Button 
                                      size="sm" 
                                      variant="outline-danger"
                                      onClick={() => deleteFpp(fpp.id, fpp.masterProjectNumber, fpp)}
                                      className="mb-1"
                                    >
                                      Delete
                                    </Button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </Table>
                </div>

                {/* Pagination */}
                {renderPagination()}
              </>
            )}
          </Card.Body>
        </Card>

        {/* Detail Modal */}
        {selectedFpp && (
          <DetailModal 
            show={showDetailModal}
            handleClose={() => setShowDetailModal(false)}
            fppData={selectedFpp}
            onDelete={deleteFpp}
            isHead={isHead}
            hasAccessToFpp={hasAccessToFpp}
          />
        )}
      </Container>
    </div>
  );
}

export default Dashboard;