// src/Pages/Draft.js
import React, { useState, useEffect } from 'react';
import { 
  Container, 
  Card, 
  Badge, 
  Button, 
  Table,
  Alert,
  Spinner,
  Pagination,
  Form,
  InputGroup,
  Modal
} from 'react-bootstrap';
import { db } from '../firebase';
import { 
  collection, 
  getDocs,
  deleteDoc,
  doc,
  setDoc,
  serverTimestamp
} from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

function Draft() {
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState({ show: false, message: '', variant: '' });
  const [drafts, setDrafts] = useState([]);
  const [filteredDrafts, setFilteredDrafts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [selectedDraft, setSelectedDraft] = useState(null);
  const navigate = useNavigate();

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    console.log('📥 Draft.js mounted');
    fetchDrafts();
  }, []);

  useEffect(() => {
    applySearch();
    setCurrentPage(1);
  }, [drafts, searchQuery]);

  const fetchDrafts = async () => {
    setLoading(true);
    try {
      console.log('🔄 Fetching drafts from Firebase...');
      const draftsSnapshot = await getDocs(collection(db, 'fpp_drafts'));
      const draftsList = draftsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      draftsList.sort((a, b) => {
        const dateA = new Date(a.tanggalDraft || 0);
        const dateB = new Date(b.tanggalDraft || 0);
        return dateB - dateA;
      });
      
      console.log(`✅ Loaded ${draftsList.length} drafts`);
      setDrafts(draftsList);
    } catch (error) {
      console.error('❌ Error fetching drafts:', error);
      showAlert('Error mengambil data draft: ' + error.message, 'danger');
    }
    setLoading(false);
  };

  const applySearch = () => {
    if (!searchQuery) {
      setFilteredDrafts(drafts);
      return;
    }

    const filtered = drafts.filter(draft => {
      const searchLower = searchQuery.toLowerCase();
      const projectNumber = (draft.masterProjectNumber || '').toLowerCase();
      const noFpp = (draft.noFpp || '').toLowerCase();
      const judulFpp = (draft.judulFpp || '').toLowerCase();
      const department = (draft.department || '').toLowerCase();
      
      return (
        projectNumber.includes(searchLower) ||
        noFpp.includes(searchLower) ||
        judulFpp.includes(searchLower) ||
        department.includes(searchLower)
      );
    });

    setFilteredDrafts(filtered);
  };

  const showAlert = (message, variant) => {
    setAlert({ show: true, message, variant });
    setTimeout(() => {
      setAlert({ show: false, message: '', variant: '' });
    }, 3000);
  };

  const handleEditDraft = (draft) => {
    console.log('✏️ Editing draft:', {
      id: draft.id,
      noFpp: draft.noFpp,
      timProject: draft.timProject
    });
    
    try {
      // Pastikan semua data terstruktur dengan benar
      const processedTimProject = Array.isArray(draft.timProject) 
        ? draft.timProject.map(tim => ({
            department: tim.department || '',
            tim: tim.tim || '', 
            pic: tim.pic || '',
            outputs: Array.isArray(tim.outputs) ? tim.outputs : []
          }))
        : [{ department: '', tim: '', pic: '', outputs: [] }];
      
      // Pastikan rencanaPenugasan lengkap
      const processedRencanaPenugasan = Array.isArray(draft.rencanaPenugasan) 
        ? draft.rencanaPenugasan 
        : Array(6).fill().map(() => ({ keterangan: '', tglTarget: '' }));
      
      // Pastikan parafData lengkap
      const processedParafData = Array.isArray(draft.parafData) && draft.parafData.length >= 3
        ? draft.parafData
        : [
            {
              pejabat: 'PEJABAT BERWENANG BUSINESS PROCESS & ANALYST',
              namaPejabat: '(Nama Pejabat)',
              jabatan: 'Business Process & Analyst Division Head',
              tanggal: '',
              keterangan: ''
            },
            {
              pejabat: 'PEJABAT BERWENANG UNIT/PIHAK YANG TERLIBAT',
              namaPejabat: '(Nama Pejabat)',
              jabatan: '',
              tanggal: '',
              keterangan: ''
            },
            {
              pejabat: 'PEJABAT BERWENANG UNIT/PIHAK YANG TERLIBAT',
              namaPejabat: '(Nama Pejabat)',
              jabatan: '',
              tanggal: '',
              keterangan: ''
            }
          ];
      
      const editData = {
        isEditMode: true,
        draftId: draft.id,
        fppEntryId: draft.fppEntryId || null,
        
        // Master Project
        masterProjectType: draft.masterProjectType || 'noProject',
        masterProjectNumber: draft.masterProjectNumber || '',
        masterProjectName: draft.masterProjectName || '',
        skalaProject: draft.skalaProject || '', // ✅ TAMBAHKAN
        
        // Project Departments (checkbox)
        projectDepartments: Array.isArray(draft.projectDepartments) 
          ? draft.projectDepartments 
          : [], // ✅ TAMBAHKAN
        
        // PIC Data
        department: draft.department || '',
        tim: draft.tim || '',
        pic: draft.pic || '',
        
        // FPP Data
        noFpp: draft.noFpp || '',
        judulFpp: draft.judulFpp || '',
        jenisProject: draft.jenisProject || '',
        jenisProjectOther: draft.jenisProjectOther || '',
        pirType: draft.pirType || 'Proses',
        
        // Detail Penugasan
        latarBelakang: draft.latarBelakang || '',
        tujuan: draft.tujuan || '',
        scope: draft.scope || '',
        unitKerjaTerkait: draft.unitKerjaTerkait || '',
        
        // Rencana Penugasan (gunakan processed)
        rencanaPenugasan: processedRencanaPenugasan,
        
        // Tim Project (gunakan processed)
        timProject: processedTimProject,
        
        // Approval
        approvalDate: draft.approvalDate || '',
        
        // Paraf Data (gunakan processed)
        parafData: processedParafData,
        
        // Form Metadata
        formNumber: draft.formNumber || '766.01/FORM/2025',
        tanggalDraft: draft.tanggalDraft || new Date().toISOString().split('T')[0]
      };
      
      console.log('📤 Prepared edit data:', {
        projectDepartments: editData.projectDepartments,
        timProject: editData.timProject,
        parafData: editData.parafData
      });
      
      sessionStorage.setItem('editFppDraft', JSON.stringify(editData));
      
      // ✅ NAVIGASI KE ROUTE YANG BENAR
      navigate('/input-unit');
      
    } catch (error) {
      console.error('❌ Error in handleEditDraft:', error);
      showAlert('Gagal membuka draft untuk edit', 'danger');
    }
  };

  const handleDeleteDraft = async (draftId) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus draft ini?')) {
      setLoading(true);
      try {
        await deleteDoc(doc(db, 'fpp_drafts', draftId));
        showAlert('Draft berhasil dihapus!', 'success');
        fetchDrafts();
      } catch (error) {
        console.error('Error deleting draft:', error);
        showAlert('Error menghapus draft: ' + error.message, 'danger');
      }
      setLoading(false);
    }
  };

  const handleSubmitDraft = (draft) => {
    if (!draft.approvalDate) {
      showAlert('Approval date belum diisi! Isi dulu sebelum submit.', 'warning');
      return;
    }
    
    setSelectedDraft(draft);
    setShowSubmitModal(true);
  };

  const confirmSubmitDraft = async () => {
    if (!selectedDraft) return;
    
    setLoading(true);
    try {
      const submittedId = `fpp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const submittedData = {};
      Object.keys(selectedDraft).forEach(key => {
        if (key !== 'id' && selectedDraft[key] !== undefined) {
          submittedData[key] = selectedDraft[key];
        }
      });
      
      submittedData.submittedId = submittedId;
      submittedData.status = 'submitted';
      submittedData.submissionDate = new Date().toISOString();
      submittedData.submittedAt = serverTimestamp();
      submittedData.originalDraftId = selectedDraft.id;
      
      await setDoc(doc(db, 'fpp_monitoring', submittedId), submittedData);
      await deleteDoc(doc(db, 'fpp_drafts', selectedDraft.id));
      
      showAlert('FPP berhasil di-submit! Data telah dipindahkan ke Monitoring.', 'success');
      
      setShowSubmitModal(false);
      setSelectedDraft(null);
      
      navigate('/monitoring');
      
    } catch (error) {
      console.error('Error submitting draft:', error);
      showAlert('Error submit FPP: ' + error.message, 'danger');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const dataToDisplay = searchQuery ? filteredDrafts : drafts;

  // Pagination calculation
  const totalPages = Math.ceil(dataToDisplay.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = dataToDisplay.slice(indexOfFirstItem, indexOfLastItem);

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  const renderPaginationItems = () => {
    let items = [];
    const maxPagesToShow = 5;
    
    if (totalPages <= maxPagesToShow) {
      for (let i = 1; i <= totalPages; i++) {
        items.push(
          <Pagination.Item 
            key={i} 
            active={i === currentPage}
            onClick={() => handlePageChange(i)}
          >
            {i}
          </Pagination.Item>
        );
      }
    } else {
      items.push(
        <Pagination.Item 
          key={1} 
          active={1 === currentPage}
          onClick={() => handlePageChange(1)}
        >
          1
        </Pagination.Item>
      );

      if (currentPage > 3) {
        items.push(<Pagination.Ellipsis key="ellipsis-start" disabled />);
      }

      const startPage = Math.max(2, currentPage - 1);
      const endPage = Math.min(totalPages - 1, currentPage + 1);
      
      for (let i = startPage; i <= endPage; i++) {
        items.push(
          <Pagination.Item 
            key={i} 
            active={i === currentPage}
            onClick={() => handlePageChange(i)}
          >
            {i}
          </Pagination.Item>
        );
      }

      if (currentPage < totalPages - 2) {
        items.push(<Pagination.Ellipsis key="ellipsis-end" disabled />);
      }

      items.push(
        <Pagination.Item 
          key={totalPages} 
          active={totalPages === currentPage}
          onClick={() => handlePageChange(totalPages)}
        >
          {totalPages}
        </Pagination.Item>
      );
    }

    return items;
  };

  return (
    <Container className="py-4">
      <div className="mb-4">
        <div className="d-flex fs-5 fw-semibold align-items-center">
          <div bg="secondary" className="me-2">DRAFT FPP</div>
        </div>
      </div>

      {alert.show && (
        <Alert variant={alert.variant} dismissible onClose={() => setAlert({ show: false })}>
          {alert.message}
        </Alert>
      )}

      {/* Search Section */}
      <Card className="border-0 mb-4">
        <Card.Body>
          <Form.Group>
            <Form.Label>Search by No Project / No FPP / Judul / Departemen</Form.Label>
            <InputGroup>
              <InputGroup.Text>🔎</InputGroup.Text>
              <Form.Control
                type="text"
                placeholder="Ketik untuk mencari..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <Button 
                  variant="outline-secondary"
                  onClick={() => setSearchQuery('')}
                >
                  ✕
                </Button>
              )}
            </InputGroup>
          </Form.Group>
        </Card.Body>
      </Card>

      <Card className="">
        <Card.Header className="bg-light text-dark border-none d-flex justify-content-between align-items-center">
          <div className="mb-0 fw-semibold">List Draft FPP</div>
          <div className="d-flex gap-2 align-items-center">
            <Badge bg="light" text="dark">{dataToDisplay.length} Draft</Badge>
          </div>
        </Card.Header>
        <Card.Body>
          {loading ? (
            <div className="text-center py-5">
              <Spinner animation="border" variant="secondary" />
              <p className="mt-3 text-muted">Loading data...</p>
            </div>
          ) : dataToDisplay.length === 0 ? (
            <div className="text-center py-5">
              <h5 className="text-muted">{searchQuery ? 'Tidak ada draft yang sesuai' : 'Tidak ada draft'}</h5>
              <Button 
                variant="primary" 
                onClick={() => navigate('/input-unit')}
                className="mt-2"
              >
                Buat Draft Baru
              </Button>
            </div>
          ) : (
            <>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <strong>Total: {dataToDisplay.length} Draft</strong>
                  <span className="text-muted ms-2">
                    | Halaman {currentPage} dari {totalPages || 1}
                  </span>
                </div>
                <Badge bg="secondary">
                  Menampilkan {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, dataToDisplay.length)} dari {dataToDisplay.length}
                </Badge>
              </div>

              <div className="table-responsive">
                <Table striped bordered hover>
                  <thead className="table-light">
                    <tr>
                      <th style={{ width: '50px' }}>No</th>
                      <th>Tanggal Draft</th>
                      <th>No Project</th>
                      <th>No FPP</th>
                      <th>Judul FPP</th>
                      <th>Departemen</th>
                      <th>Tim</th>
                      <th>PIC</th>
                      <th>Approval Date</th>
                      <th style={{ width: '220px' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentItems.map((draft, index) => {
                      const globalIndex = indexOfFirstItem + index + 1;
                      const hasApproval = !!draft.approvalDate;
                      
                      return (
                        <tr key={draft.id}>
                          <td className="text-center">{globalIndex}</td>
                          <td>
                            <div bg="info">{formatDate(draft.tanggalDraft)}</div>
                          </td>
                          <td>
                            <div bg="primary">
                              {draft.masterProjectNumber || '-'}
                            </div>
                          </td>
                          <td>
                            <strong>{draft.noFpp || '-'}</strong>
                          </td>
                          <td>{draft.judulFpp || '-'}</td>
                          <td>
                            <div bg="primary">{draft.department || '-'}</div>
                          </td>
                          <td>
                            <div bg="success">{draft.tim || '-'}</div>
                          </td>
                          <td>{draft.pic || '-'}</td>
                          <td>
                            {hasApproval ? (
                              <div bg="success">{formatDate(draft.approvalDate)}</div>
                            ) : (
                              <Badge bg="danger">Belum diisi</Badge>
                            )}
                          </td>
                          <td>
                            <div className="d-flex flex-column flex-md-row gap-2">
                              <Button 
                                variant="warning" 
                                size="sm"
                                onClick={() => handleEditDraft(draft)}
                                title="Edit Draft"
                                className="mb-1 mb-md-0"
                              >
                                Edit
                              </Button>
                              <Button 
                                variant={hasApproval ? "success" : "secondary"}
                                size="sm"
                                onClick={() => hasApproval ? handleSubmitDraft(draft) : null}
                                title={hasApproval ? "Submit FPP ke Monitoring" : "Isi Approval Date dulu"}
                                disabled={!hasApproval}
                                className="mb-1 mb-md-0"
                              >
                                Submit
                              </Button>
                              <Button 
                                variant="danger" 
                                size="sm"
                                onClick={() => handleDeleteDraft(draft.id)}
                                title="Hapus Draft"
                                disabled={loading}
                              >
                                Delete
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="d-flex justify-content-center mt-4">
                  <Pagination>
                    <Pagination.First 
                      onClick={() => handlePageChange(1)}
                      disabled={currentPage === 1}
                    />
                    <Pagination.Prev 
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                    />
                    
                    {renderPaginationItems()}
                    
                    <Pagination.Next 
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    />
                    <Pagination.Last 
                      onClick={() => handlePageChange(totalPages)}
                      disabled={currentPage === totalPages}
                    />
                  </Pagination>
                </div>
              )}
            </>
          )}
        </Card.Body>
      </Card>

      {/* Modal Konfirmasi Submit */}
      <Modal show={showSubmitModal} onHide={() => !loading && setShowSubmitModal(false)}>
        <Modal.Header closeButton disabled={loading}>
          <Modal.Title>Konfirmasi Submit FPP</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedDraft && (
            <>
              <div className="alert alert-info">
                <strong>Detail FPP:</strong>
                <ul className="mb-0 mt-2">
                  <li>No FPP: <strong>{selectedDraft.noFpp}</strong></li>
                  <li>Judul: {selectedDraft.judulFpp}</li>
                  <li>Departemen: {selectedDraft.department}</li>
                  <li>Approval Date: {formatDate(selectedDraft.approvalDate)}</li>
                </ul>
              </div>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button 
            variant="secondary" 
            onClick={() => setShowSubmitModal(false)}
            disabled={loading}
          >
            Batal
          </Button>
          <Button 
            variant="success" 
            onClick={confirmSubmitDraft}
            disabled={loading}
          >
            {loading ? (
              <>
                <Spinner size="sm" animation="border" /> Submitting...
              </>
            ) : (
              '✅ Ya, Submit ke Monitoring'
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
}

export default Draft;