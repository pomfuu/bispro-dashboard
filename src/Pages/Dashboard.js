// src/pages/Dashboard.js
import React, { useState, useEffect } from 'react';
import { 
  Container, Row, Col, Card, Badge, Button, 
  Form, Table, Spinner, Alert, Modal, InputGroup, Pagination
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

// Komponen Detail Modal
const DetailModal = ({ show, handleClose, fppData }) => {
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

  return (
    <Modal show={show} onHide={handleClose} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Detail FPP</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {/* Master Project Info */}
        <Card className="mb-3">
          <Card.Header className="bg-primary text-white">
            <strong>Master Project</strong>
          </Card.Header>
          <Card.Body>
            <Row>
              <Col md={6}>
                <p><strong>No. Project/FPP Induk:</strong><br />
                <Badge bg="info">{fppData.masterProjectNumber || '-'}</Badge></p>
              </Col>
              <Col md={6}>
                <p><strong>Judul Project:</strong><br />
                {fppData.masterProjectName || '-'}</p>
              </Col>
            </Row>
          </Card.Body>
        </Card>

        {/* FPP Info */}
        <Card className="mb-3">
          <Card.Header className="bg-success text-white">
            <strong>FPP Details</strong>
          </Card.Header>
          <Card.Body>
            <Row>
              <Col md={4}>
                <p><strong>Departemen:</strong><br />
                <Badge bg="primary">{fppData.department || '-'}</Badge></p>
              </Col>
              <Col md={4}>
                <p><strong>Tim:</strong><br />
                {fppData.tim || '-'}</p>
              </Col>
              <Col md={4}>
                <p><strong>PIC:</strong><br />
                {fppData.pic || '-'}</p>
              </Col>
            </Row>
            <Row>
              <Col md={6}>
                <p><strong>No. FPP:</strong><br />
                <Badge bg="dark">{fppData.noFpp || '-'}</Badge></p>
              </Col>
              <Col md={6}>
                <p><strong>Judul FPP:</strong><br />
                {fppData.judulFpp || '-'}</p>
              </Col>
            </Row>
            <Row>
              <Col md={6}>
                <p><strong>Jenis Project:</strong><br />
                {fppData.jenisProjectResolved || fppData.jenisProject || '-'}</p>
              </Col>
              <Col md={6}>
                <p><strong>Status:</strong><br />
                <Badge bg={
                  fppData.status === 'In Progress' || fppData.status === 'submitted' ? 'warning' :
                  fppData.status === 'Done' || fppData.status === 'Selesai' || fppData.status === 'Achieve' ? 'success' :
                  fppData.status === 'Hold' ? 'secondary' :
                  fppData.status === 'Drop' ? 'danger' :
                  fppData.status === 'Hutang Collab' ? 'info' : 'light'
                }>
                  {fppData.status === 'submitted' ? 'In Progress' : fppData.status || 'Not Yet'}
                  {fppData.doneChecklist && ' ✓'}
                </Badge></p>
              </Col>
            </Row>
          </Card.Body>
        </Card>

        {/* Done Checklist */}
        {renderChecklistItems()}

        {/* Rencana Penugasan */}
        {fppData.rencanaPenugasan && fppData.rencanaPenugasan.length > 0 && (
          <Card className="mb-3">
            <Card.Header className="bg-info text-white">
              <strong>Rencana Penugasan</strong>
            </Card.Header>
            <Card.Body>
              <Table striped bordered size="sm">
                <thead>
                  <tr>
                    <th>No</th>
                    <th>Keterangan</th>
                    <th>Target</th>
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
            </Card.Body>
          </Card>
        )}

        {/* Tim Project */}
        {fppData.timProject && fppData.timProject.length > 0 && (
          <Card className="mb-3">
            <Card.Header className="bg-warning text-dark">
              <strong>Tim Project</strong>
            </Card.Header>
            <Card.Body>
              <Table striped bordered size="sm">
                <thead>
                  <tr>
                    <th>No</th>
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
            </Card.Body>
          </Card>
        )}

        {/* Dates Info */}
        <Card>
          <Card.Header className="bg-secondary text-white">
            <strong>Timeline</strong>
          </Card.Header>
          <Card.Body>
            <Row>
              <Col md={4}>
                <p><strong>Tanggal Approval:</strong><br />
                {formatDate(fppData.approvalDate)}</p>
              </Col>
              <Col md={4}>
                <p><strong>Tanggal Start:</strong><br />
                {formatDate(fppData.approvalDate)}</p>
              </Col>
              <Col md={4}>
                <p><strong>Tanggal Selesai:</strong><br />
                {formatDate(fppData.tanggalSelesai) || '-'}</p>
              </Col>
            </Row>
            <Row>
              <Col md={12}>
                <p><strong>Keterangan:</strong><br />
                {fppData.keterangan || '-'}</p>
              </Col>
            </Row>
          </Card.Body>
        </Card>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose}>
          Tutup
        </Button>
        <Button variant="primary" as={Link} to="/monitoring">
          Ke Halaman Monitoring
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

function Dashboard() {
  const { user, getUserFullTim } = useAuth();
  
  // Debug info
  useEffect(() => {
    console.log('=== DASHBOARD DEBUG INFO ===');
    console.log('User object:', user);
    console.log('User full tim:', getUserFullTim());
    console.log('Is Head?', user?.role === 'head' || user?.isHead);
    console.log('===========================');
  }, [user, getUserFullTim]);
  
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
  
  // State untuk filter
  const [filters, setFilters] = useState({
    jenisProject: '',
    pic: '',
    target: '',
    tim: '',
    status: '',
    search: '',
    department: ''
  });

  // State untuk KPI filter
  const [activeKpiFilter, setActiveKpiFilter] = useState('');

  // State untuk pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 30;
  
  // Cek apakah user adalah Head
  const isHead = user?.role === 'head' || user?.isHead;
  
  // Get user's info
  const userFullTim = getUserFullTim();

  // Fungsi untuk grouping data
  const groupByMasterProject = (data) => {
    console.log('Grouping data, length:', data?.length);
    
    if (!data || data.length === 0) return [];
    
    const grouped = {};
    
    data.forEach(fpp => {
      const masterProjectNumber = fpp.masterProjectNumber || 
                                 fpp.noFpp || 
                                 'NO-PROJECT-' + fpp.id;
      
      const masterProjectName = fpp.masterProjectName || 
                               fpp.judulFpp || 
                               'No Project Name';
      
      const masterProjectType = fpp.masterProjectType || 'project';
      
      if (!grouped[masterProjectNumber]) {
        grouped[masterProjectNumber] = {
          masterProject: {
            masterProjectNumber: masterProjectNumber,
            masterProjectName: masterProjectName,
            masterProjectType: masterProjectType
          },
          fppEntries: []
        };
      }
      
      grouped[masterProjectNumber].fppEntries.push(fpp);
    });
    
    console.log('Grouped result:', Object.values(grouped).length);
    return Object.values(grouped);
  };

  // Fungsi untuk memfilter data berdasarkan akses user
  const filterByUserAccess = (data) => {
    console.log('filterByUserAccess called, isHead:', isHead, 'data length:', data?.length);
    
    if (isHead) {
      console.log('HEAD user - returning all data');
      return data || [];
    }
    
    if (!data || data.length === 0) {
      return [];
    }
    
    // User biasa hanya bisa melihat data yang terkait dengan mereka
    const filtered = data.filter(fpp => {
      // Cek apakah user adalah PIC utama dari FPP
      const isMainPic = fpp.pic === userFullTim;
      
      // Cek apakah user ada di tim project
      let isInProjectTeam = false;
      if (fpp.timProject && Array.isArray(fpp.timProject)) {
        isInProjectTeam = fpp.timProject.some(member => {
          const memberFullTim = `${member.department || ''}-${member.tim || ''}`;
          return memberFullTim === userFullTim;
        });
      }
      
      return isMainPic || isInProjectTeam;
    });
    
    console.log('TIM user filtered data:', filtered.length, 'out of', data.length);
    return filtered;
  };

  // Ambil data dari monitoring
  const fetchAllData = async () => {
    setLoading(true);
    setError(null);
    
    console.log('fetchAllData started, isHead:', isHead);
    
    try {
      // Ambil SEMUA data dari fpp_monitoring
      const monitoringSnapshot = await getDocs(collection(db, 'fpp_monitoring'));
      const monitoringDataArray = monitoringSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      console.log('Raw data from Firestore:', monitoringDataArray.length);
      
      if (monitoringDataArray.length === 0) {
        setError('Tidak ada data project. Silakan tambah data di halaman Monitoring terlebih dahulu.');
        setLoading(false);
        return null;
      }
      
      // Format data untuk Dashboard
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
        status: item.status || 'Not Yet',
        rencanaPenugasan: item.rencanaPenugasan || [],
        timProject: item.timProject || [],
        approvalDate: item.approvalDate || null,
        tanggalSelesai: item.tanggalSelesai || null,
        keterangan: item.keterangan || '',
        doneChecklist: item.doneChecklist || null,
        createdAt: item.createdAt || new Date(),
        updatedAt: item.updatedAt || new Date()
      }));
      
      console.log('Formatted data:', formattedData.length);
      
      // Hanya filter data untuk user biasa, HEAD melihat semua
      const accessibleData = isHead ? formattedData : filterByUserAccess(formattedData);
      
      console.log('Accessible data after filter:', accessibleData.length);
      
      setFppEntries(accessibleData);
      
      // Group data by Master Project
      const grouped = groupByMasterProject(accessibleData);
      
      console.log('Grouped data:', grouped.length);
      
      setGroupedData(grouped);
      
      // Untuk HEAD, langsung set filteredData tanpa apply filter
      if (isHead) {
        console.log('HEAD user - setting filtered data directly');
        setFilteredData(grouped);
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        setDisplayData(grouped.slice(startIndex, endIndex));
      } else {
        applyFiltersToData(grouped);
      }
      
      // Setup real-time listener
      const unsubscribe = onSnapshot(collection(db, 'fpp_monitoring'), (snapshot) => {
        console.log('Real-time update received');
        
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
          status: item.status || 'Not Yet',
          rencanaPenugasan: item.rencanaPenugasan || [],
          timProject: item.timProject || [],
          approvalDate: item.approvalDate || null,
          tanggalSelesai: item.tanggalSelesai || null,
          keterangan: item.keterangan || '',
          doneChecklist: item.doneChecklist || null,
          createdAt: item.createdAt || new Date(),
          updatedAt: item.updatedAt || new Date()
        }));
        
        // Hanya filter data untuk user biasa, HEAD melihat semua
        const updatedAccessibleData = isHead ? updatedFormattedData : filterByUserAccess(updatedFormattedData);
        
        setFppEntries(updatedAccessibleData);
        
        const newGrouped = groupByMasterProject(updatedAccessibleData);
        setGroupedData(newGrouped);
        
        if (isHead) {
          setFilteredData(newGrouped);
          const startIndex = (currentPage - 1) * itemsPerPage;
          const endIndex = startIndex + itemsPerPage;
          setDisplayData(newGrouped.slice(startIndex, endIndex));
        } else {
          applyFiltersToData(newGrouped);
        }
      });
      
      return unsubscribe;
      
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Error mengambil data: ' + error.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Fungsi delete dengan permission control
  const deleteFpp = async (fppId, masterProjectNumber, fppData) => {
    // Cek permission
    if (!isHead) {
      alert('Hanya user dengan role HEAD yang dapat menghapus FPP!');
      return;
    }

    // Konfirmasi delete
    const confirmMessage = `HAPUS FPP\n\n` +
      `Master Project: ${masterProjectNumber}\n` +
      `No FPP: ${fppData.noFpp}\n` +
      `Judul: ${fppData.judulFpp}\n` +
      `Department: ${fppData.department}\n\n` +
      `Apakah Anda yakin ingin menghapus? Aksi ini tidak dapat dibatalkan!`;
    
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      // Tampilkan loading
      setLoading(true);
      
      // Hapus dari Firestore
      await deleteDoc(doc(db, 'fpp_monitoring', fppId));
      
      // Tampilkan success message
      alert(`✅ FPP berhasil dihapus!\n\nNo FPP: ${fppData.noFpp}`);
      
      // Refresh data
      await fetchAllData();
      
    } catch (error) {
      console.error('Error deleting FPP:', error);
      alert('❌ Gagal menghapus FPP:\n' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Hitung KPI berdasarkan data yang difilter
  const calculateKpiData = (data) => {
    // Flatten semua FPP entries
    const allFppEntries = data.flatMap(group => group.fppEntries);
    
    // Hitung total FPP entries
    const totalFppEntries = allFppEntries.length;
    
    // Hitung berdasarkan status
    const notYet = allFppEntries.filter(fpp => 
      fpp.status === 'Not Yet' || !fpp.status || fpp.status === ''
    ).length;
    
    const inProgress = allFppEntries.filter(fpp => 
      fpp.status === 'In Progress' || fpp.status === 'submitted' || fpp.status === 'draft'
    ).length;
    
    const hold = allFppEntries.filter(fpp => fpp.status === 'Hold').length;
    
    const selesai = allFppEntries.filter(fpp => 
      fpp.status === 'Selesai' || fpp.status === 'Done' || fpp.status === 'Achieve'
    ).length;
    
    const drop = allFppEntries.filter(fpp => fpp.status === 'Drop').length;

    return {
      totalMasterProjects: data.length,
      totalFppEntries: totalFppEntries,
      notYet,
      inProgress,
      hold,
      selesai,
      drop
    };
  };

  // Fungsi untuk apply filters ke data
  const applyFiltersToData = (data) => {
    console.log('applyFiltersToData called with:', data?.length, 'groups');
    
    let filtered = [...(data || [])];
    
    // Filter berdasarkan departemen (hanya untuk Head)
    if (isHead && selectedDepartments.length > 0 && !selectedDepartments.includes('ALL')) {
      console.log('Filtering by departments:', selectedDepartments);
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
    
    // Filter berdasarkan KPI (Not Yet, In Progress, etc.)
    if (activeKpiFilter) {
      filtered = filtered.filter(group => {
        return group.fppEntries.some(fpp => {
          const status = fpp.status === 'submitted' ? 'In Progress' : fpp.status;
          return status === activeKpiFilter;
        });
      });
    }
    
    console.log('Filtered result:', filtered.length);
    setFilteredData(filtered);
    setCurrentPage(1); // Reset ke halaman 1 ketika filter berubah
    
    // Hitung pagination
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    setDisplayData(filtered.slice(startIndex, endIndex));
  };

  // Handle department selection (hanya untuk Head)
  const handleDepartmentToggle = (dept) => {
    if (!isHead) return;
    
    setSelectedDepartments(prev => {
      if (dept === 'ALL') {
        return ['ALL'];
      }
      
      let newSelection;
      if (prev.includes('ALL')) {
        newSelection = [dept];
      } else {
        if (prev.includes(dept)) {
          newSelection = prev.filter(d => d !== dept);
          if (newSelection.length === 0) {
            newSelection = ['ALL'];
          }
        } else {
          newSelection = [...prev, dept];
        }
      }
      return newSelection;
    });
  };

  // Ambil data unik untuk filter dropdown
  const getUniqueValues = (data) => {
    const jenisProjects = [];
    const pics = [];
    const tims = [];
    const statuses = [];
    const departments = [];
    
    data.flatMap(group => group.fppEntries).forEach(fpp => {
      // Jenis Project
      const jenis = fpp.jenisProjectResolved || fpp.jenisProject;
      if (jenis && !jenisProjects.includes(jenis)) {
        jenisProjects.push(jenis);
      }
      
      // PIC
      if (fpp.pic && !pics.includes(fpp.pic)) {
        pics.push(fpp.pic);
      }
      
      // Tim
      if (fpp.tim && !tims.includes(fpp.tim)) {
        tims.push(fpp.tim);
      }
      
      // Department
      if (fpp.department && !departments.includes(fpp.department)) {
        departments.push(fpp.department);
      }
      
      // Status
      const status = fpp.status === 'submitted' ? 'In Progress' : fpp.status;
      if (status && !statuses.includes(status)) {
        statuses.push(status);
      }
    });
    
    return {
      jenisProjects: jenisProjects.sort(),
      pics: pics.sort(),
      tims: tims.sort(),
      departments: departments.sort(),
      statuses: statuses.sort()
    };
  };

  // Handler untuk perubahan filter
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handler untuk search
  const handleSearchChange = (e) => {
    setFilters(prev => ({
      ...prev,
      search: e.target.value
    }));
  };

  // Handler untuk KPI card click
  const handleKpiClick = (status) => {
    if (activeKpiFilter === status) {
      setActiveKpiFilter(''); // Toggle off
    } else {
      setActiveKpiFilter(status);
    }
  };

  // Reset semua filter
  const resetFilters = () => {
    setSelectedDepartments(['ALL']);
    setFilters({
      jenisProject: '',
      pic: '',
      target: '',
      tim: '',
      status: '',
      search: '',
      department: ''
    });
    setActiveKpiFilter('');
    setCurrentPage(1);
  };

  // Handle page change
  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
    const startIndex = (pageNumber - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    setDisplayData(filteredData.slice(startIndex, endIndex));
  };

  // Handle lihat detail
  const handleViewDetail = (fpp) => {
    setSelectedFpp(fpp);
    setShowDetailModal(true);
  };

  // Format date untuk display
  const formatDateDisplay = (dateValue) => {
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

  // Fungsi untuk export ke Excel
  const exportToExcel = () => {
    if (filteredData.length === 0) {
      alert('Tidak ada data untuk diexport!');
      return;
    }

    try {
      // Flatten data dan tambahkan semua kolom yang ada di detail modal
      const excelData = filteredData.flatMap(group => 
        group.fppEntries.map(fpp => {
          // Format dates
          const formatDateForExcel = (dateValue) => {
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
                month: 'long',
                year: 'numeric'
              });
            } catch (error) {
              return '-';
            }
          };

          // Format checklist items
          const checklistItems = fpp.doneChecklist?.items ? 
            Object.entries(fpp.doneChecklist.items)
              .filter(([key, item]) => item.checked)
              .map(([key, item]) => `${key}: ${item.textValue || '-'}`)
              .join('; ') : '-';

          // Format rencana penugasan
          const rencanaPenugasanText = fpp.rencanaPenugasan?.length > 0 ?
            fpp.rencanaPenugasan.map(item => 
              `${item.keterangan || '-'}: ${formatDateForExcel(item.tglTarget)}`
            ).join('; ') : '-';

          // Format tim project
          const timProjectText = fpp.timProject?.length > 0 ?
            fpp.timProject.map(tim => 
              `${tim.department || '-'} - ${tim.tim || '-'}: ${tim.pic || '-'} (${(tim.outputs || []).join(', ')})`
            ).join('; ') : '-';

          return {
            // Basic Info
            'No Project/Induk FPP': fpp.masterProjectNumber || '-',
            'No FPP': fpp.noFpp || '-',
            'Judul FPP': fpp.judulFpp || '-',
            'Department': fpp.department || '-',
            'TIM': fpp.tim || '-',
            'PIC': fpp.pic || '-',
            'Jenis Project': fpp.jenisProjectResolved || fpp.jenisProject || '-',
            'Status': fpp.status === 'submitted' ? 'In Progress' : fpp.status || 'Not Yet',
            
            // Dates
            'Tanggal Approval': formatDateForExcel(fpp.approvalDate),
            'Tanggal Start': formatDateForExcel(fpp.approvalDate),
            'Tanggal Selesai': formatDateForExcel(fpp.tanggalSelesai),
            'Durasi': calculateDuration(fpp),
            
            // Detail Info
            'Master Project Name': fpp.masterProjectName || '-',
            'Keterangan': fpp.keterangan || '-',
            
            // Done Checklist
            'Done Checklist Department': fpp.doneChecklist?.department || '-',
            'Done Checklist Items': checklistItems,
            'Done Checklist Submitted By': fpp.doneChecklist?.submittedBy || '-',
            'Done Checklist Submitted At': formatDateForExcel(fpp.doneChecklist?.submittedAt),
            
            // Rencana Penugasan
            'Rencana Penugasan': rencanaPenugasanText,
            
            // Tim Project
            'Tim Project': timProjectText,
            
            // Metadata
            'Created At': formatDateForExcel(fpp.createdAt),
            'Updated At': formatDateForExcel(fpp.updatedAt)
          };
        })
      );

      // Create worksheet
      const ws = XLSX.utils.json_to_sheet(excelData);
      
      // Set column widths
      const wscols = [
        { wch: 20 }, // No Project/Induk FPP
        { wch: 15 }, // No FPP
        { wch: 40 }, // Judul FPP
        { wch: 10 }, // Department
        { wch: 15 }, // TIM
        { wch: 20 }, // PIC
        { wch: 20 }, // Jenis Project
        { wch: 15 }, // Status
        { wch: 15 }, // Tanggal Approval
        { wch: 15 }, // Tanggal Start
        { wch: 15 }, // Tanggal Selesai
        { wch: 10 }, // Durasi
        { wch: 30 }, // Master Project Name
        { wch: 30 }, // Keterangan
        { wch: 15 }, // Done Checklist Department
        { wch: 50 }, // Done Checklist Items
        { wch: 20 }, // Done Checklist Submitted By
        { wch: 15 }, // Done Checklist Submitted At
        { wch: 50 }, // Rencana Penugasan
        { wch: 50 }, // Tim Project
        { wch: 15 }, // Created At
        { wch: 15 }  // Updated At
      ];
      ws['!cols'] = wscols;

      // Create workbook
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Dashboard Data");

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `Dashboard_Export_${timestamp}.xlsx`;

      // Save file
      XLSX.writeFile(wb, filename);
      
      alert(`Data berhasil diexport ke ${filename}`);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('Error saat mengeksport data ke Excel: ' + error.message);
    }
  };

  // Apply filters ketika filters berubah
  useEffect(() => {
    console.log('Filters changed, applying...');
    if (groupedData.length > 0 && !isHead) {
      applyFiltersToData(groupedData);
    } else if (isHead && groupedData.length > 0) {
      // Untuk HEAD, kita perlu apply filters juga jika ada filter yang diaktifkan
      applyFiltersToData(groupedData);
    }
  }, [selectedDepartments, filters, activeKpiFilter, groupedData]);

  // Update display data ketika filteredData berubah
  useEffect(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    setDisplayData(filteredData.slice(startIndex, endIndex));
  }, [filteredData, currentPage]);

  // Hitung KPI
  const kpiData = calculateKpiData(filteredData);

  // Load data saat component mount
  useEffect(() => {
    let unsubscribe;
    
    const loadData = async () => {
      unsubscribe = await fetchAllData();
    };
    
    loadData();
    
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const uniqueValues = getUniqueValues(filteredData);

  // Render pagination
  const renderPagination = () => {
    if (filteredData.length <= itemsPerPage) return null;
    
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    const pageNumbers = [];
    
    // Always show first page
    pageNumbers.push(1);
    
    // Show pages around current page
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
      pageNumbers.push(i);
    }
    
    // Always show last page
    if (totalPages > 1) {
      pageNumbers.push(totalPages);
    }
    
    // Remove duplicates and sort
    const uniquePageNumbers = [...new Set(pageNumbers)].sort((a, b) => a - b);
    
    return (
      <div className="d-flex justify-content-center mt-4">
        <Pagination>
          <Pagination.First 
            onClick={() => handlePageChange(1)} 
            disabled={currentPage === 1}
          />
          <Pagination.Prev 
            onClick={() => handlePageChange(Math.max(1, currentPage - 1))} 
            disabled={currentPage === 1}
          />
          
          {uniquePageNumbers.map((pageNum, index) => {
            // Add ellipsis if there's a gap
            if (index > 0 && pageNum - uniquePageNumbers[index - 1] > 1) {
              return (
                <Pagination.Ellipsis key={`ellipsis-${pageNum}`} disabled />
              );
            }
            
            return (
              <Pagination.Item
                key={pageNum}
                active={pageNum === currentPage}
                onClick={() => handlePageChange(pageNum)}
              >
                {pageNum}
              </Pagination.Item>
            );
          })}
          
          <Pagination.Next 
            onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))} 
            disabled={currentPage === totalPages}
          />
          <Pagination.Last 
            onClick={() => handlePageChange(totalPages)} 
            disabled={currentPage === totalPages}
          />
        </Pagination>
      </div>
    );
  };

  // Fungsi untuk reset dan reload
  const handleResetAndReload = () => {
    localStorage.removeItem('fpp_user');
    window.location.reload();
  };

  return (
    <Container className="py-4">
      <div className="mb-4">
        <div className="fs-5 fw-semibold">Dashboard</div>
      </div>

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Filter Department (hanya untuk Head) */}
      {isHead && (
        <Card className="mb-4 border-0">
          <Card.Body>
            <div className="mb-3 fw-semibold">Filter Departemen:</div>
            <div className="mb-2">
              <small className="text-muted">
                {selectedDepartments.includes('ALL') 
                  ? 'Semua Departemen terpilih' 
                  : `${selectedDepartments.length} departemen terpilih: ${selectedDepartments.join(', ')}`}
              </small>
            </div>
            <div className="d-flex flex-wrap gap-2">
              <Button
                variant={selectedDepartments.includes('ALL') ? "primary" : "outline-primary"}
                onClick={() => handleDepartmentToggle('ALL')}
              >
                ALL
              </Button>
              {['PPD', 'DPA', 'UUD', 'PDM'].map(dept => (
                <Button
                  key={dept}
                  variant={selectedDepartments.includes(dept) ? "primary" : "outline-primary"}
                  onClick={() => handleDepartmentToggle(dept)}
                >
                  {dept}
                </Button>
              ))}
            </div>
          </Card.Body>
        </Card>
      )}

      {/* KPI Cards */}
      <Row className="mb-4 g-3">
        <Col xs={12} sm={6} md={4} lg={2}>
          <KpiCard 
            title="Total Project" 
            value={kpiData.totalMasterProjects}
            variant="light"
            loading={loading}
          />
        </Col>
        <Col xs={12} sm={6} md={4} lg={2}>
          <KpiCard 
            title="Total FPP" 
            value={kpiData.totalFppEntries}
            variant="light"
            loading={loading}
          />
        </Col>
        <Col xs={12} sm={6} md={4} lg={2}>
          <KpiCard 
            title="Not Yet" 
            value={kpiData.notYet}
            variant="light"
            loading={loading}
            onClick={() => handleKpiClick('Not Yet')}
            isActive={activeKpiFilter === 'Not Yet'}
          />
        </Col>
        <Col xs={12} sm={6} md={4} lg={2}>
          <KpiCard 
            title="In Progress" 
            value={kpiData.inProgress}
            variant="light"
            loading={loading}
            onClick={() => handleKpiClick('In Progress')}
            isActive={activeKpiFilter === 'In Progress'}
          />
        </Col>
        <Col xs={12} sm={6} md={4} lg={2}>
          <KpiCard 
            title="Hold" 
            value={kpiData.hold}
            variant="light"
            loading={loading}
            onClick={() => handleKpiClick('Hold')}
            isActive={activeKpiFilter === 'Hold'}
          />
        </Col>
        <Col xs={12} sm={6} md={4} lg={2}>
          <KpiCard 
            title="Selesai" 
            value={kpiData.selesai}
            variant="light"
            loading={loading}
            onClick={() => handleKpiClick('Done')}
            isActive={activeKpiFilter === 'Done'}
          />
        </Col>
        <Col xs={12} sm={6} md={4} lg={2}>
          <KpiCard 
            title="Drop" 
            value={kpiData.drop}
            variant="light"
            loading={loading}
            onClick={() => handleKpiClick('Drop')}
            isActive={activeKpiFilter === 'Drop'}
          />
        </Col>
      </Row>

      {/* Search and Filters */}
      <Card className="mb-4">
        <Card.Body>
          <Row className="align-items-end">
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Search Project/FPP</Form.Label>
                <InputGroup>
                  <InputGroup.Text>
                    <FaSearch />
                  </InputGroup.Text>
                  <Form.Control
                    type="text"
                    name="search"
                    placeholder="Cari berdasarkan No Project, No FPP, atau Judul..."
                    value={filters.search}
                    onChange={handleSearchChange}
                  />
                </InputGroup>
              </Form.Group>
            </Col>
            <Col md={2}>
              <Form.Group className="mb-3">
                <Form.Label>Jenis Project</Form.Label>
                <Form.Select
                  name="jenisProject"
                  value={filters.jenisProject}
                  onChange={handleFilterChange}
                >
                  <option value="">Semua Jenis</option>
                  {uniqueValues.jenisProjects.map(jenis => (
                    <option key={jenis} value={jenis}>{jenis}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            {isHead && (
              <>
                <Col md={2}>
                  <Form.Group className="mb-3">
                    <Form.Label>Department</Form.Label>
                    <Form.Select
                      name="department"
                      value={filters.department}
                      onChange={handleFilterChange}
                    >
                      <option value="">Semua Department</option>
                      {uniqueValues.departments.map(dept => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={2}>
                  <Form.Group className="mb-3">
                    <Form.Label>Tim</Form.Label>
                    <Form.Select
                      name="tim"
                      value={filters.tim}
                      onChange={handleFilterChange}
                    >
                      <option value="">Semua Tim</option>
                      {uniqueValues.tims.map(tim => (
                        <option key={tim} value={tim}>{tim}</option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
              </>
            )}
            <Col md={2}>
              <Form.Group className="mb-3">
                <Form.Label>PIC</Form.Label>
                <Form.Select
                  name="pic"
                  value={filters.pic}
                  onChange={handleFilterChange}
                >
                  <option value="">Semua PIC</option>
                  {uniqueValues.pics.map(pic => (
                    <option key={pic} value={pic}>{pic}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={2}>
              <Form.Group className="mb-3">
                <Form.Label>Status</Form.Label>
                <Form.Select
                  name="status"
                  value={filters.status}
                  onChange={handleFilterChange}
                >
                  <option value="">Semua Status</option>
                  {uniqueValues.statuses.map(status => (
                    <option key={status} value={status}>
                      {status === 'submitted' ? 'In Progress' : status}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={2} className="d-flex gap-2">
              <Button 
                variant="dark" 
                onClick={resetFilters}
                className="w-100 mb-3"
              >
                Reset
              </Button>
              <Button 
                variant="success" 
                onClick={exportToExcel}
                className="w-100 mb-3 d-flex align-items-center justify-content-center gap-2"
              >
                <FaFileExcel /> Excel
              </Button>
            </Col>
          </Row>
          <div className="mt-2">
            <small className="text-muted">
              Menampilkan {displayData.length} dari {filteredData.length} Master Projects 
              (Total {filteredData.flatMap(group => group.fppEntries).length} FPP entries)
              {activeKpiFilter && ` | Filter: ${activeKpiFilter}`}
              {isHead ? ' | Akses: HEAD (Semua Data)' : ` | Akses: ${userFullTim}`}
            </small>
          </div>
        </Card.Body>
      </Card>

      {/* Tabel Data */}
      <Card>
        <Card.Header className="bg-light text-dark d-flex justify-content-between align-items-center">
          <div className="mb-0 fw-semibold">
            Daftar Project & FPP {isHead && '(Semua Data)'}
          </div>
          <div className="d-flex align-items-center gap-2">
            <Badge bg="light" text="dark" className="fs-6">
              Halaman {currentPage} dari {Math.ceil(filteredData.length / itemsPerPage) || 1}
            </Badge>
            <Badge bg="light" text="dark" className="fs-6">
              Total: {filteredData.length} Master Projects
            </Badge>
          </div>
        </Card.Header>
        <Card.Body>
          {loading ? (
            <div className="text-center py-5">
              <Spinner animation="border" variant="primary" />
              <p className="mt-3">Memuat data...</p>
            </div>
          ) : filteredData.length === 0 ? (
            <Alert variant="info">
              {fppEntries.length === 0 ? (
                <>
                  {!isHead ? (
                    <>
                      Tidak ada project yang terkait dengan Anda ({userFullTim}).<br />
                      Project akan muncul jika Anda menjadi PIC utama atau anggota tim project.
                    </>
                  ) : (
                    <>
                      Database kosong. Data dari Monitoring belum ada.<br />
                      <Button variant="primary" className="mt-2" onClick={fetchAllData}>
                        Coba Muat Ulang
                      </Button>
                      <Button 
                        variant="warning" 
                        className="mt-2 ms-2"
                        onClick={() => console.log('Firestore data check')}
                      >
                        Debug Firestore
                      </Button>
                    </>
                  )}
                </>
              ) : (
                'Tidak ada data project yang sesuai dengan filter.'
              )}
            </Alert>
          ) : (
            <>
              <div className="table-responsive">
                <Table striped bordered hover>
                    <thead className="table-light">
                      <tr>
                        <th style={{ width: '5%' }}>No</th>
                        <th style={{ width: '15%' }}>No Project/Induk FPP</th>
                        <th style={{ width: '10%' }}>No FPP</th>
                        <th style={{ width: '20%' }}>Judul FPP</th>
                        <th style={{ width: '10%' }}>Tanggal Start</th>
                        <th style={{ width: '10%' }}>Tanggal Selesai</th>
                        <th style={{ width: '10%' }}>PIC</th>
                        <th style={{ width: '10%' }}>Durasi</th>
                        <th style={{ width: '10%' }}>Status</th>
                        <th style={{ width: '15%' }}>Aksi</th> {/* Ganti dari Detail ke Aksi */}
                      </tr>
                    </thead>
                      <tbody>
                        {displayData.flatMap((group, groupIndex) => 
                          group.fppEntries.map((fpp, fppIndex) => {
                            const globalIndex = ((currentPage - 1) * itemsPerPage) + 
                                              (groupIndex * group.fppEntries.length) + fppIndex + 1;
                            
                            return (
                              <tr key={fpp.id}>
                                <td className="text-center">{globalIndex}</td>
                                <td>
                                  <Badge bg="info" className="d-block mb-1">
                                    {group.masterProject.masterProjectNumber}
                                  </Badge>
                                  <small className="text-muted">
                                    {group.masterProject.masterProjectName}
                                  </small>
                                </td>
                                <td>
                                  <Badge bg="dark">{fpp.noFpp}</Badge>
                                </td>
                                <td>
                                  <strong>{fpp.judulFpp}</strong><br />
                                  <small className="text-muted">
                                    {fpp.department} | {fpp.tim}
                                  </small>
                                </td>
                                <td>{formatDateDisplay(fpp.approvalDate)}</td>
                                <td>{formatDateDisplay(fpp.tanggalSelesai)}</td>
                                <td>
                                  <div>
                                    {fpp.pic}
                                    {!isHead && fpp.pic === userFullTim && (
                                      <Badge bg="success" className="ms-1">PIC Anda</Badge>
                                    )}
                                  </div>
                                </td>
                                <td>
                                  <Badge bg={
                                    calculateDuration(fpp).includes('Terlambat') ? 'danger' :
                                    calculateDuration(fpp).includes('hari lagi') ? 'warning' : 'info'
                                  }>
                                    {calculateDuration(fpp)}
                                  </Badge>
                                </td>
                                <td>
                                  <Badge bg={
                                    fpp.status === 'In Progress' || fpp.status === 'submitted' ? 'warning' :
                                    fpp.status === 'Done' || fpp.status === 'Selesai' || fpp.status === 'Achieve' ? 'success' :
                                    fpp.status === 'Hold' ? 'secondary' :
                                    fpp.status === 'Drop' ? 'danger' : 'light'
                                  }>
                                    {fpp.status === 'submitted' ? 'In Progress' : fpp.status || 'Not Yet'}
                                    {fpp.doneChecklist && ' ✓'}
                                  </Badge>
                                </td>
                                <td>
                                  <div className="d-flex flex-column gap-2">
                                    {/* Button Detail */}
                                    <Button 
                                      variant="outline-primary" 
                                      size="sm"
                                      onClick={() => handleViewDetail(fpp)}
                                      className="w-100"
                                    >
                                      <strong>Detail</strong>
                                    </Button>
                                    
                                    {/* Button Delete - hanya untuk HEAD */}
                                    {isHead && (
                                      <Button 
                                        variant="outline-danger" 
                                        size="sm"
                                        onClick={() => {
                                          if (window.confirm(`Yakin hapus FPP: ${fpp.noFpp}?\n\nJudul: ${fpp.judulFpp}\n\nAksi ini tidak dapat dibatalkan!`)) {
                                            deleteFpp(fpp.id, group.masterProject.masterProjectNumber, fpp);
                                          }
                                        }}
                                        className="w-100"
                                      >
                                        <strong>Delete</strong>
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
              {renderPagination()}
            </>
          )}
        </Card.Body>
      </Card>

      {/* Modal Detail */}
      <DetailModal 
        show={showDetailModal}
        handleClose={() => setShowDetailModal(false)}
        fppData={selectedFpp}
      />
    </Container>
  );
}

export default Dashboard;