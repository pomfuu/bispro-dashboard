import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Typeahead } from 'react-bootstrap-typeahead';
import 'react-bootstrap-typeahead/css/Typeahead.css';
import { 
  Container, 
  Card, 
  Badge, 
  Button, 
  Form, 
  Row, 
  Col,
  Alert,
  Spinner
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
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const OUTPUT_OPTIONS = {
  DPA: ['Project Charter', 'BR', 'MEMO Implementasi', 'FSD', 'PIR'],
  PPD: ['Project Charter', 'SK', 'SE', 'IK', 'FORM', 'MEMO', 'CR', 'PIR', 'FSD', 'Matrix'],
  UUD: ['Project Charter', 'UUD', 'Figma', 'PPT', 'Survey'],
  PDM: ['Project Charter', 'Sosialisasi', 'Memo', 'PIR', 'Serah Terima', 'Datamart']
};

const UNIT_DETAILS = {
  PPD: ['AKUISISI', 'LAYANAN', 'SUPPORT', 'RECOVERY'],
  DPA: ['AKUISISI', 'LAYANAN', 'SUPPORT', 'RECOVERY'],
  UUD: ['UUD'],
  PDM: ['HEAD', 'PPM', 'PDI', 'PAR']
};

const KETERANGAN_OPTIONS = [
  'Draft',
  'Approval Dept. head',
  'Approval Div. Head',
  'Approval User',
  'Approval BOD',
  'Close Project'
];

function RegisterFPP() {
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [alert, setAlert] = useState({ show: false, message: '', variant: '' });
  const [formNumber, setFormNumber] = useState('766.01/FORM/2025');
  const [isEditingFormNumber, setIsEditingFormNumber] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editDraftId, setEditDraftId] = useState(null);
  const [editFppEntryId, setEditFppEntryId] = useState(null);
  const formRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const [projects, setProjects] = useState([]);
  // const [users, setUsers] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [editingOutputIndex, setEditingOutputIndex] = useState(null);
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

  const getAllActiveUsers = () => {
    const allUsers = [];
    Object.keys(ORGANIZATION_STRUCTURE).forEach(dept => {
      Object.keys(ORGANIZATION_STRUCTURE[dept]).forEach(tim => {
        allUsers.push(...ORGANIZATION_STRUCTURE[dept][tim]);
      });
    });
    return [...new Set(allUsers)]; // Remove duplicates
  };

  const [formData, setFormData] = useState({
    masterProjectType: 'noProject',
    masterProjectNumber: '',
    masterProjectName: '',
    department: '',
    tim: '',
    pic: '',
    noFpp: '',
    judulFpp: '',
    jenisProject: '',
    jenisProjectOther: '',
    pirType: 'Proses',
    latarBelakang: '',
    tujuan: '',
    scope: '',
    unitKerjaTerkait: '',

    rencanaPenugasan: [
      { keterangan: '', tglTarget: '' },
      { keterangan: '', tglTarget: '' },
      { keterangan: '', tglTarget: '' },
      { keterangan: '', tglTarget: '' },
      { keterangan: '', tglTarget: '' },
      { keterangan: '', tglTarget: '' }
    ],
    
    timProject: [
      { department: '', tim: '', pic: '', outputs: [] }
    ],
    approvalDate: ''
  });

  const loadFromSessionStorage = () => {
    try {
      console.log('🔍 Checking sessionStorage for edit data...');
      const sessionKeys = ['editFppDraft', 'editDraft', 'fppEditData'];
      let editData = null;
      let foundKey = null;
      
      for (const key of sessionKeys) {
        const dataStr = sessionStorage.getItem(key);
        if (dataStr) {
          console.log(`✅ Found data in sessionStorage with key: ${key}`);
          editData = JSON.parse(dataStr);
          foundKey = key;
          break;
        }
      }
      
      if (editData) {
        console.log('📦 Parsed edit data:', {
          draftId: editData.draftId,
          fppEntryId: editData.fppEntryId,
          noFpp: editData.noFpp,
          isEditMode: editData.isEditMode,
          keys: Object.keys(editData)
        });
        
        if (foundKey) {
          sessionStorage.removeItem(foundKey);
        }
        
        const safeData = {
          masterProjectType: editData.masterProjectType || 'noProject',
          masterProjectNumber: editData.masterProjectNumber || '',
          masterProjectName: editData.masterProjectName || '',
          department: editData.department || '',
          tim: editData.tim || '',
          pic: editData.pic || '',
          noFpp: editData.noFpp || '',
          judulFpp: editData.judulFpp || '',
          jenisProject: editData.jenisProject || '',
          jenisProjectOther: editData.jenisProjectOther || '',
          pirType: editData.pirType || 'Proses',
          latarBelakang: editData.latarBelakang || '',
          tujuan: editData.tujuan || '',
          scope: editData.scope || '',
          unitKerjaTerkait: editData.unitKerjaTerkait || '',
          rencanaPenugasan: Array.isArray(editData.rencanaPenugasan) 
            ? editData.rencanaPenugasan.map(item => ({
                keterangan: item.keterangan || '',
                tglTarget: item.tglTarget || ''
              }))
            : [
                { keterangan: '', tglTarget: '' },
                { keterangan: '', tglTarget: '' },
                { keterangan: '', tglTarget: '' },
                { keterangan: '', tglTarget: '' },
                { keterangan: '', tglTarget: '' },
                { keterangan: '', tglTarget: '' }
              ],
          timProject: Array.isArray(editData.timProject) 
            ? editData.timProject.map(tim => ({
                department: tim.department || '',
                tim: tim.tim || '', // Pastikan tim field ada
                pic: tim.pic || '',
                outputs: Array.isArray(tim.outputs) ? tim.outputs : []
              }))
            : [{ department: '', tim: '', pic: '', outputs: [] }],
          approvalDate: editData.approvalDate || ''
        };
        
        console.log('🔄 Setting form data with:', {
          noFpp: safeData.noFpp,
          department: safeData.department,
          tim: safeData.tim,
          timProjectCount: safeData.timProject.length
        });
        
        setFormData(safeData);
        
        if (editData.isEditMode || editData.draftId) {
          setIsEditMode(true);
          if (editData.draftId) {
            setEditDraftId(editData.draftId);
            console.log('✏️ Edit mode activated with draftId:', editData.draftId);
          }
          if (editData.fppEntryId) {
            setEditFppEntryId(editData.fppEntryId);
            console.log('📄 FPP Entry ID set:', editData.fppEntryId);
          }
          
          showAlert('Draft berhasil di-load untuk diedit!', 'info');
        }
      } else {
        console.log('ℹ️ No edit data found in sessionStorage');
      }
    } catch (error) {
      console.error('❌ Error loading from sessionStorage:', error);
      showAlert('Error loading draft data', 'danger');
    }
  };

  useEffect(() => {
    console.log('🚀 RegisterFPP Component Mounted');
    console.log('📍 Current location:', location.pathname);
    
    const initializeData = async () => {
      setInitialLoading(true);
      try {
        await fetchData();
        loadFromSessionStorage();
      } catch (error) {
        console.error('Error initializing:', error);
      } finally {
        setInitialLoading(false);
      }
    };
    
    initializeData();
    return () => {
      console.log('🧹 Cleaning up RegisterFPP component');
    };
  }, []);

  useEffect(() => {
    const handleBeforeUnload = () => {
      sessionStorage.removeItem('editFppDraft');
      sessionStorage.removeItem('editDraft');
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const fetchData = async () => {
    try {
      console.log('📡 Fetching data from Firebase...');
      const projectsSnapshot = await getDocs(collection(db, 'projects'));
      const projectsList = projectsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setProjects(projectsList);
      console.log(`✅ Loaded ${projectsList.length} projects`);
      
      const draftsSnapshot = await getDocs(collection(db, 'fpp_drafts'));
      const draftsList = draftsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setDrafts(draftsList);
      console.log(`✅ Loaded ${draftsList.length} drafts`);

    } catch (error) {
      console.error('❌ Error fetching data:', error);
      showAlert('Error mengambil data: ' + error.message, 'danger');
    }
  };

  const showAlert = (message, variant) => {
    setAlert({ show: true, message, variant });
    setTimeout(() => {
      setAlert({ show: false, message: '', variant: '' });
    }, 3000);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'masterProjectNumber') {
      const selectedProject = projects.find(p => 
        (formData.masterProjectType === 'noProject' && p.noProject === value) ||
        (formData.masterProjectType === 'noInduk' && p.noFppInduk === value)
      );
      
      setFormData(prev => ({
        ...prev,
        masterProjectNumber: value,
        masterProjectName: selectedProject ? selectedProject.namaProject : ''
      }));
    } else if (name === 'jenisProject') {
      setFormData(prev => ({
        ...prev,
        jenisProject: value,
        jenisProjectOther: value === 'Lainnya' ? '' : prev.jenisProjectOther
      }));
    } else if (name === 'jenisProjectOther') {
      setFormData(prev => ({
        ...prev,
        jenisProjectOther: value
      }));
    } else if (name === 'department') {
      // Reset TIM dan PIC jika Department berubah
      setFormData(prev => ({
        ...prev,
        department: value,
        tim: '',
        pic: ''
      }));
    } else if (name === 'tim') {
      // Reset PIC jika TIM berubah
      setFormData(prev => ({
        ...prev,
        tim: value,
        pic: ''
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleRencanaPenugasanChange = (index, field, value) => {
    const newRencana = [...formData.rencanaPenugasan];
    newRencana[index][field] = value;
    setFormData(prev => ({
      ...prev,
      rencanaPenugasan: newRencana
    }));
  };

  const handleTimProjectChange = (index, field, value) => {
    const newTimProject = [...formData.timProject];
    newTimProject[index][field] = value;
    
    if (field === 'department') {
      // Reset tim dan pic jika department berubah
      newTimProject[index].tim = '';
      newTimProject[index].pic = '';
      newTimProject[index].outputs = [];
      if (editingOutputIndex === index) setEditingOutputIndex(null);
    } else if (field === 'tim') {
      // Reset pic jika tim berubah
      newTimProject[index].pic = '';
    }
    
    setFormData(prev => ({
      ...prev,
      timProject: newTimProject
    }));
  };

  const handleOutputChange = (timIndex, output, checked) => {
    const newTimProject = [...formData.timProject];
    if (checked) {
      if (!newTimProject[timIndex].outputs.includes(output)) {
        newTimProject[timIndex].outputs.push(output);
      }
    } else {
      newTimProject[timIndex].outputs = newTimProject[timIndex].outputs.filter(o => o !== output);
    }
    setFormData(prev => ({
      ...prev,
      timProject: newTimProject
    }));
  };

  const addTimProject = () => {
    setFormData(prev => ({
      ...prev,
      timProject: [...prev.timProject, { department: '', tim: '', pic: '', outputs: [] }]
    }));
  };

  const removeTimProject = (index) => {
    if (formData.timProject.length > 1) {
      const newTimProject = formData.timProject.filter((_, i) => i !== index);
      setFormData(prev => ({
        ...prev,
        timProject: newTimProject
      }));
      if (editingOutputIndex === index) setEditingOutputIndex(null);
    }
  };

  const getFilteredProjects = () => {
    if (formData.masterProjectType === 'noProject') {
      return projects.filter(p => p.noProject);
    } else {
      return projects.filter(p => p.noFppInduk);
    }
  };

  const getFilteredUsers = () => {
    if (formData.department && formData.tim) {
      const deptData = ORGANIZATION_STRUCTURE[formData.department];
      if (deptData && deptData[formData.tim]) {
        return deptData[formData.tim];
      }
    }
    return [];
  };

  // Fungsi baru: Get filtered PICs for each tim project
  const getFilteredPICsForTimProject = (timProjectIndex) => {
    const timProject = formData.timProject[timProjectIndex];
    
    if (!timProject.department || !timProject.tim) {
      return [];
    }
    
    const deptData = ORGANIZATION_STRUCTURE[timProject.department];
    if (deptData && deptData[timProject.tim]) {
      return deptData[timProject.tim];
    }
    
    return [];
  };

  const exportToPDF = async () => {
    const element = formRef.current;
    
    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = 10;
      
      pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
      pdf.save(`FPP_${formData.noFpp || 'draft'}_${new Date().toISOString().split('T')[0]}.pdf`);
      
      return true;
    } catch (error) {
      console.error('Error generating PDF:', error);
      showAlert('Error generating PDF: ' + error.message, 'danger');
      return false;
    }
  };

  const handleSaveDraft = async (e) => {
    e.preventDefault();
    
    // Periksa mandatory fields utama
    const mandatoryFields = [
      { name: 'masterProjectType', label: 'Tipe Master Project' },
      { name: 'masterProjectNumber', label: 'Nomor Master Project' },
      { name: 'department', label: 'Departemen' },
      { name: 'tim', label: 'Tim' },
      { name: 'pic', label: 'PIC' },
      { name: 'noFpp', label: 'No FPP' },
      { name: 'judulFpp', label: 'Judul FPP' },
      { name: 'jenisProject', label: 'Jenis Project' },
    ];

    for (const field of mandatoryFields) {
      if (!formData[field.name]) {
        showAlert(`Field ${field.label} wajib diisi!`, 'danger');
        return;
      }
    }

      if (formData.department && formData.tim && formData.pic) {
        const allowedPICs = getFilteredUsers();
        if (!allowedPICs.includes(formData.pic)) {
          showAlert(
            `PIC "${formData.pic}" tidak valid untuk ${formData.department} - ${formData.tim}. ` +
            `PIC yang valid: ${allowedPICs.join(', ')}`,
            'danger'
          );
          return;
        }
      }
    
    if (formData.jenisProject === 'Lainnya' && !formData.jenisProjectOther) {
      showAlert('Silakan masukkan jenis project (Lainnya)!', 'danger');
      return;
    }


    // Periksa duplicate FPP number
    try {
      const fppCheckQuery = query(
        collection(db, 'fpp_entries'),
        where('noFpp', '==', formData.noFpp)
      );
      const fppCheckSnapshot = await getDocs(fppCheckQuery);
      
      if (!fppCheckSnapshot.empty && !isEditMode) {
        showAlert(`No FPP "${formData.noFpp}" sudah ada di sistem! Harus unique.`, 'danger');
        return;
      }
      
      if (isEditMode && !fppCheckSnapshot.empty) {
        const existingDoc = fppCheckSnapshot.docs[0];
        if (existingDoc.id !== editFppEntryId) {
          showAlert(`No FPP "${formData.noFpp}" sudah digunakan oleh FPP lain!`, 'danger');
          return;
        }
      }
    } catch (error) {
      console.error('Error checking FPP:', error);
    }

    // PERUBAHAN: Validasi untuk tim project TIDAK mandatory
    // Hanya peringatan jika ada data tim project tapi tidak lengkap
    const incompleteTimProjects = formData.timProject.filter(tim => 
      (tim.department || tim.tim || tim.pic) && 
      (!tim.department || !tim.tim || !tim.pic)
    );
    
    if (incompleteTimProjects.length > 0) {
      const confirmSubmit = window.confirm(
        'Ada Tim Project yang belum lengkap. Apakah Anda ingin tetap menyimpan?\n\n' +
        'Tim Project yang tidak lengkap akan dihapus otomatis.'
      );
      
      if (!confirmSubmit) {
        return;
      }
    }

    setLoading(true);
    
    try {
      console.log(isEditMode ? '🔄 Updating draft...' : '💾 Saving new draft...');
      
      const resolvedJenisProject = formData.jenisProject === 'Lainnya'
        ? formData.jenisProjectOther || 'Lainnya'
        : formData.jenisProject;
      
      const masterProjectData = {
        masterProjectType: formData.masterProjectType,
        masterProjectNumber: formData.masterProjectNumber,
        masterProjectName: formData.masterProjectName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      let masterProjectId;
      const masterQuery = query(
        collection(db, 'master_projects'),
        where('masterProjectNumber', '==', formData.masterProjectNumber)
      );
      
      const masterSnapshot = await getDocs(masterQuery);
      if (masterSnapshot.empty) {
        const masterDocRef = await addDoc(collection(db, 'master_projects'), masterProjectData);
        masterProjectId = masterDocRef.id;
        console.log('✅ Master project baru dibuat:', masterProjectId);
      } else {
        masterProjectId = masterSnapshot.docs[0].id;
        const masterRef = doc(db, 'master_projects', masterProjectId);
        await updateDoc(masterRef, {
          ...masterProjectData,
          updatedAt: serverTimestamp()
        });
        console.log('✅ Master project diupdate:', masterProjectId);
      }

      // PERUBAHAN: Filter tim project yang lengkap (semua field terisi)
      const completeTimProjects = formData.timProject.filter(tim => 
        tim.department && tim.tim && tim.pic
      );

      const fppEntryData = {
        masterProjectId: masterProjectId,
        masterProjectNumber: formData.masterProjectNumber,
        masterProjectName: formData.masterProjectName,
        masterProjectType: formData.masterProjectType,
        
        department: formData.department,
        tim: formData.tim,
        pic: formData.pic,
        noFpp: formData.noFpp,
        judulFpp: formData.judulFpp,
        jenisProject: formData.jenisProject,
        jenisProjectResolved: resolvedJenisProject,
        jenisProjectOther: formData.jenisProjectOther,
        pirType: formData.pirType,
        
        latarBelakang: formData.latarBelakang,
        tujuan: formData.tujuan,
        scope: formData.scope,
        unitKerjaTerkait: formData.unitKerjaTerkait,
        
        rencanaPenugasan: formData.rencanaPenugasan,
        timProject: completeTimProjects, // Hanya simpan yang lengkap
        approvalDate: formData.approvalDate,
        
        formNumber: formNumber,
        status: 'draft',
        tanggalDraft: new Date().toISOString().split('T')[0],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      console.log('📊 Save mode:', {
        isEditMode,
        editFppEntryId,
        editDraftId,
        noFpp: formData.noFpp,
        timProjectsCount: formData.timProject.length,
        completeTimProjectsCount: completeTimProjects.length
      });

      if (isEditMode && editFppEntryId) {
        console.log('✏️ Updating existing FPP entry with ID:', editFppEntryId);
        
        const fppRef = doc(db, 'fpp_entries', editFppEntryId);
        await updateDoc(fppRef, {
          ...fppEntryData,
          updatedAt: serverTimestamp()
        });
        
        if (editDraftId) {
          const draftRef = doc(db, 'fpp_drafts', editDraftId);
          await updateDoc(draftRef, {
            ...fppEntryData,
            updatedAt: serverTimestamp()
          });
          console.log('✅ FPP draft juga diupdate');
        }
        
        showAlert('✅ FPP berhasil diupdate!', 'success');
      } else {
        console.log('🆕 Creating new FPP entry');
        
        const fppDocRef = await addDoc(collection(db, 'fpp_entries'), fppEntryData);
        const newFppId = fppDocRef.id;
        console.log('✅ New FPP entry created with ID:', newFppId);
        
        const draftData = {
          ...fppEntryData,
          fppEntryId: newFppId
        };
        
        await addDoc(collection(db, 'fpp_drafts'), draftData);
        console.log('✅ New draft created');
        
        showAlert('✅ FPP berhasil disimpan!', 'success');
      }
      
      setTimeout(() => {
        navigate('/draft');
      }, 1500);
      
    } catch (error) {
      console.error('❌ Error saving FPP:', error);
      showAlert(`Error menyimpan FPP: ${error.message}`, 'danger');
    } finally {
      setLoading(false);
    }
  };

  const handlePrintOnly = async (e) => {
    e.preventDefault();
    
    try {
      await exportToPDF();
      showAlert('PDF berhasil di-download!', 'success');
    } catch (error) {
      console.error('Error generating PDF:', error);
      showAlert('Error generating PDF: ' + error.message, 'danger');
    }
  };

  const handleCancelFPP = () => {
    if (window.confirm('Apakah Anda yakin ingin membatalkan? Data yang belum disimpan akan hilang.')) {
      resetForm();
      navigate('/draft');
    }
  };

  const resetForm = () => {
    setFormData({
      masterProjectType: 'noProject',
      masterProjectNumber: '',
      masterProjectName: '',
      department: '',
      tim: '',
      pic: '',
      noFpp: '',
      judulFpp: '',
      jenisProject: '',
      jenisProjectOther: '',
      pirType: 'Proses',
      latarBelakang: '',
      tujuan: '',
      scope: '',
      unitKerjaTerkait: '',
      rencanaPenugasan: [
        { keterangan: '', tglTarget: '' },
        { keterangan: '', tglTarget: '' },
        { keterangan: '', tglTarget: '' },
        { keterangan: '', tglTarget: '' },
        { keterangan: '', tglTarget: '' },
        { keterangan: '', tglTarget: '' }
      ],
      timProject: [
        { department: '', tim: '', pic: '', outputs: [] }
      ],
      approvalDate: ''
    });
    setIsEditMode(false);
    setEditDraftId(null);
    setEditFppEntryId(null);
    setEditingOutputIndex(null);
  };

  if (initialLoading) {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" variant="primary" />
        <p className="mt-3">Loading form data...</p>
      </Container>
    );
  }

  return (
    <Container className="p-5">
      <div className=" d-flex justify-content-between align-items-center">
        <div>
          <div className="d-flex align-items-center">
            <div className="me-1 ms-3 fs-4 fw-semibold" style={{  letterSpacing: '-0.4px' }}>
              {isEditMode ? "Edit FPP" : "Register FPP"}
            </div>
            {isEditMode && (
              <Badge bg="danger" className="ms-2">
                Editing: {formData.noFpp || 'Draft'}
              </Badge>
            )}
          </div>
        </div>
        <div>
          {isEditingFormNumber ? (
            <div className="d-flex gap-2">
              <Form.Control
                type="text"
                size="sm"
                value={formNumber}
                onChange={(e) => setFormNumber(e.target.value)}
                style={{ width: '180px' }}
              />
              <Button 
                size="sm" 
                variant="success"
                onClick={() => setIsEditingFormNumber(false)}
              >
                ✓
              </Button>
            </div>
          ) : (
            <div 
              className="text-muted small" 
              style={{ cursor: 'pointer' }}
              onClick={() => setIsEditingFormNumber(true)}
            >
              {formNumber} *
            </div>
          )}
        </div>
      </div>

      {alert.show && (
        <Alert variant={alert.variant} dismissible onClose={() => setAlert({ show: false })}>
          {alert.message}
        </Alert>
      )}

      {isEditMode && (
        <Alert variant="warning" className="mb-3">
          <div className=" my-1 d-flex justify-content-between align-items-center">
            <div>
              <strong>Mode Edit</strong>
              {formData.noFpp && (
                <span className="ms-4">
                  <Badge bg="dark">{formData.noFpp}</Badge>
                </span>
              )}
            </div>
            <Button 
              variant="outline-danger" 
              size="sm"
              onClick={() => {
                if (window.confirm('Batalkan edit dan kembali ke form kosong?')) {
                  resetForm();
                }
              }}
            >
              Batalkan Edit
            </Button>
          </div>
        </Alert>
      )}

      <Card className="border-0 mb-4" ref={formRef}>
        <Card.Header className="bg-ligth d-flex justify-content-between border-0 align-items-center">
          <div className="mb-1 fw-semibold " style={{ letterSpacing:'-0.8px' }}>
            Form Penugasan FPP
          </div>
          <div className="d-flex align-items-center gap-2">
            <span className="badge bg-light text-dark">{formNumber}</span>
            {isEditMode && (
              <Badge bg="danger">EDIT MODE</Badge>
            )}
          </div>
        </Card.Header>
        <Card.Body>
          <Form>
            <Card className="mb-4 border-0">
              <strong className='ms-3'>Master Project</strong>
              <Card.Body>
                <Row className="mb-3">
                  <Col md={2}>
                    <Form.Check
                      type="radio"
                      id="radio-noProject"
                      name="masterProjectType"
                      value="noProject"
                      label="No Project"
                      checked={formData.masterProjectType === 'noProject'}
                      onChange={handleChange}
                    />
                  </Col>
                  <Col md={2}>
                    <Form.Check
                      type="radio"
                      id="radio-noInduk"
                      name="masterProjectType"
                      value="noInduk"
                      label="No Induk"
                      checked={formData.masterProjectType === 'noInduk'}
                      onChange={handleChange}
                    />
                  </Col>
                </Row>
                <Row>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>
                        {formData.masterProjectType === 'noProject' ? 'No Project' : 'No Induk'} <span className="text-danger"> *</span>
                      </Form.Label>
                      <Typeahead
                        id="masterProjectNumber"
                        onChange={(selected) => {
                          if (selected && selected.length > 0) {
                            const selectedValue = selected[0];
                            
                            // Handle jika user mengetik custom value
                            if (typeof selectedValue === 'string') {
                              setFormData(prev => ({
                                ...prev,
                                masterProjectNumber: selectedValue,
                                masterProjectName: ''
                              }));
                            } else {
                              // Handle jika memilih dari dropdown
                              const selectedProject = projects.find(p => 
                                (formData.masterProjectType === 'noProject' && p.noProject === selectedValue.label) ||
                                (formData.masterProjectType === 'noInduk' && p.noFppInduk === selectedValue.label)
                              );
                              
                              setFormData(prev => ({
                                ...prev,
                                masterProjectNumber: selectedValue.label,
                                masterProjectName: selectedProject ? selectedProject.namaProject : ''
                              }));
                            }
                          } else {
                            // Reset jika kosong
                            setFormData(prev => ({
                              ...prev,
                              masterProjectNumber: '',
                              masterProjectName: ''
                            }));
                          }
                        }}
                        options={getFilteredProjects().map(project => ({
                          id: project.id,
                          label: formData.masterProjectType === 'noProject' ? project.noProject : project.noFppInduk,
                          project: project
                        }))}
                        placeholder={`Cari atau ketik ${formData.masterProjectType === 'noProject' ? 'No Project' : 'No Induk'}...`}
                        selected={formData.masterProjectNumber ? [{
                          id: formData.masterProjectNumber,
                          label: formData.masterProjectNumber
                        }] : []}
                        allowNew
                        newSelectionPrefix="Tambah baru: "
                        isInvalid={!formData.masterProjectNumber}
                        required
                        filterBy={(option, props) => {
                          // Filter untuk search
                          return option.label.toLowerCase().includes(props.text.toLowerCase());
                        }}
                        renderMenuItemChildren={(option, props) => {
                          // Custom render untuk dropdown item
                          return (
                            <div>
                              <div>{option.label}</div>
                              {option.project && (
                                <small className="text-muted">{option.project.namaProject}</small>
                              )}
                            </div>
                          );
                        }}
                      />
                      <Form.Control.Feedback type="invalid">
                        Harap pilih atau masukkan {formData.masterProjectType === 'noProject' ? 'No Project' : 'No Induk'}
                      </Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Judul Project <span className="text-danger"> *</span></Form.Label>
                      <Form.Control
                        type="text"
                        value={formData.masterProjectName}
                        readOnly
                        style={{ backgroundColor: '#e9ecef' }}
                      />
                    </Form.Group>
                  </Col>
                </Row>
              </Card.Body>
            </Card>

            <Card className="mb-4 border-0">
              <strong className='ms-3'>Project</strong>
              <Card.Body>
                <Row className="mb-3">
                  <Col md={4}>
                    <Form.Group>
                      <Form.Label>Departemen <span className="text-danger"> *</span></Form.Label>
                      <Form.Select
                        name="department"
                        value={formData.department}
                        onChange={handleChange}
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
                  <Col md={4}>
                    <Form.Group>
                      <Form.Label>Tim <span className="text-danger"> *</span></Form.Label>
                      <Form.Select
                        name="tim"
                        value={formData.tim}
                        onChange={handleChange}
                        required
                        disabled={!formData.department}
                      >
                        <option value=""> </option>
                        {formData.department && UNIT_DETAILS[formData.department]?.map((detail) => (
                          <option key={detail} value={detail}>{detail}</option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group>
                      <Form.Label>PIC <span className="text-danger"> *</span></Form.Label>
                      <Form.Select
                        name="pic"
                        value={formData.pic}
                        onChange={handleChange}
                        required
                        disabled={!formData.department || !formData.tim}
                      >
                        <option value=""> 
                          {!formData.department || !formData.tim 
                            ? "Pilih Departemen dan TIM terlebih dahulu" 
                            : "Pilih PIC"}
                        </option>
                        {getFilteredUsers().map((userName, index) => (
                          <option key={`${formData.department}-${formData.tim}-${userName}-${index}`} value={userName}>
                            {userName}
                          </option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                </Row>

                <Row className="mb-3">
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>No FPP <span className="text-danger"> *</span></Form.Label>
                      <Form.Control
                        type="text"
                        name="noFpp"
                        value={formData.noFpp}
                        onChange={handleChange}
                        required
                        disabled={isEditMode}
                      />
                      {isEditMode && (
                        <Form.Text className="text-muted">
                          No FPP tidak dapat diubah dalam mode edit
                        </Form.Text>
                      )}
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Judul FPP <span className="text-danger"> *</span></Form.Label>
                      <Form.Control
                        type="text"
                        name="judulFpp"
                        value={formData.judulFpp}
                        onChange={handleChange}
                        required
                      />
                    </Form.Group>
                  </Col>
                </Row>

                <Row>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Jenis Project <span className="text-danger"> *</span></Form.Label>
                      <Form.Select
                        name="jenisProject"
                        value={formData.jenisProject}
                        onChange={handleChange}
                        required
                      >
                        <option value=""> </option>
                        <option value="Priority">Priority</option>
                        <option value="KPI">KPI</option>
                        <option value="Adhoc">Adhoc</option>
                        <option value="OJK Audit">OJK Audit</option>
                        <option value="Merger">Merger</option>
                        <option value="Carry Over">Carry Over</option>
                        <option value="EMAS">EMAS</option>
                        <option value="Lainnya">Lainnya</option>
                      </Form.Select>

                      {formData.jenisProject === 'Lainnya' && (
                        <Form.Control
                          type="text"
                          name="jenisProjectOther"
                          className="mt-2"
                          placeholder="Masukkan jenis project..."
                          value={formData.jenisProjectOther}
                          onChange={handleChange}
                          required
                        />
                      )}
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>PIR <span className="text-danger"> *</span></Form.Label>
                      <div className="d-flex gap-4 mt-2">
                        <Form.Check
                          type="radio"
                          id="radio-proses"
                          name="pirType"
                          value="Proses"
                          label="Proses"
                          checked={formData.pirType === 'Proses'}
                          onChange={handleChange}
                        />
                        <Form.Check
                          type="radio"
                          id="radio-aplikasi"
                          name="pirType"
                          value="Aplikasi"
                          label="Aplikasi"
                          checked={formData.pirType === 'Aplikasi'}
                          onChange={handleChange}
                        />
                      </div>
                    </Form.Group>
                  </Col>
                </Row>
              </Card.Body>
            </Card>

            <Card className="mb-4 border-0">
              <strong className='ms-3'>Detail Penugasan</strong>
              <Card.Body>
                <Row className="mb-3">
                  <Col md={12}>
                    <Form.Group>
                      <Form.Label>Latar Belakang</Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={3}
                        name="latarBelakang"
                        value={formData.latarBelakang}
                        onChange={handleChange}
                      />
                    </Form.Group>
                  </Col>
                </Row>
                <Row className="mb-3">
                  <Col md={12}>
                    <Form.Group>
                      <Form.Label>Tujuan</Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={3}
                        name="tujuan"
                        value={formData.tujuan}
                        onChange={handleChange}
                      />
                    </Form.Group>
                  </Col>
                </Row>
                <Row className="mb-3">
                  <Col md={12}>
                    <Form.Group>
                      <Form.Label>Scope</Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={3}
                        name="scope"
                        value={formData.scope}
                        onChange={handleChange}
                      />
                    </Form.Group>
                  </Col>
                </Row>
                <Row>
                  <Col md={12}>
                    <Form.Group>
                      <Form.Label>Unit Kerja Terkait</Form.Label>
                      <Form.Control
                        type="text"
                        name="unitKerjaTerkait"
                        value={formData.unitKerjaTerkait}
                        onChange={handleChange}
                      />
                    </Form.Group>
                  </Col>
                </Row>
              </Card.Body>
            </Card>

            <Card className="mb-4 border-0">
              <strong className='ms-3'>Rencana Penugasan</strong>
              <Card.Body>
                <Row>
                  <Col md={6}>
                    {formData.rencanaPenugasan.slice(0, 3).map((item, index) => (
                      <Row key={index} className="mb-3">
                        <Col md={6}>
                          <Form.Group>
                            <Form.Label>Keterangan {index + 1}</Form.Label>
                            <Form.Select
                              value={item.keterangan}
                              onChange={(e) => handleRencanaPenugasanChange(index, 'keterangan', e.target.value)}
                            >
                              <option value=""></option>
                              {KETERANGAN_OPTIONS.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </Form.Select>
                          </Form.Group>
                        </Col>
                        <Col md={6}>
                          <Form.Group>
                            <Form.Label>Tgl Target {index + 1}</Form.Label>
                            <Form.Control
                              type="date"
                              value={item.tglTarget}
                              onChange={(e) => handleRencanaPenugasanChange(index, 'tglTarget', e.target.value)}
                              placeholder=""
                            />
                          </Form.Group>
                        </Col>
                      </Row>
                    ))}
                  </Col>
                  <Col md={6}>
                    {formData.rencanaPenugasan.slice(3, 6).map((item, index) => (
                      <Row key={index + 3} className="mb-3">
                        <Col md={6}>
                          <Form.Group>
                            <Form.Label>Keterangan {index + 4}</Form.Label>
                            <Form.Select
                              value={item.keterangan}
                              onChange={(e) => handleRencanaPenugasanChange(index + 3, 'keterangan', e.target.value)}
                            >
                              <option value=""></option>
                              {KETERANGAN_OPTIONS.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </Form.Select>
                          </Form.Group>
                        </Col>
                        <Col md={6}>
                          <Form.Group>
                            <Form.Label>Tgl Target {index + 4}</Form.Label>
                            <Form.Control
                              type="date"
                              value={item.tglTarget}
                              onChange={(e) => handleRencanaPenugasanChange(index + 3, 'tglTarget', e.target.value)}
                              placeholder=""
                            />
                          </Form.Group>
                        </Col>
                      </Row>
                    ))}
                  </Col>
                </Row>
              </Card.Body>
            </Card>

            <Card className="mb-4 border-0">
              <div className="d-flex justify-content-between align-items-center">
                <strong className='ms-3'>Tim Project </strong>
                <Button 
                  variant="primary px-3 me-3 py-2" 
                  size="sm"
                  onClick={addTimProject}
                >
                  Tambah Tim
                </Button>
              </div>
              <Card.Body>
                {formData.timProject.map((tim, index) => (
                  <Card key={index} className="mb-3 border">
                    <Card.Body>
                      <div className="d-flex justify-content-between mb-2">
                        <strong>Tim {index + 1} </strong>
                        {formData.timProject.length > 1 && (
                          <Button 
                            variant="outline-danger" 
                            size="sm"
                            onClick={() => removeTimProject(index)}
                          >
                            ❌
                          </Button>
                        )}
                      </div>
                      <Row className="mb-3">
                        <Col md={3}>
                          <Form.Group>
                            <Form.Label>Department</Form.Label>
                            <Form.Select
                              value={tim.department}
                              onChange={(e) => handleTimProjectChange(index, 'department', e.target.value)}
                            >
                              <option value="">Pilih Department</option>
                              <option value="PPD">PPD</option>
                              <option value="PDM">PDM</option>
                              <option value="DPA">DPA</option>
                              <option value="UUD">UUD</option>
                            </Form.Select>
                          </Form.Group>
                        </Col>
                        
                        <Col md={3}>
                          <Form.Group>
                            <Form.Label>TIM</Form.Label>
                            <Form.Select
                              value={tim.tim || ''}
                              onChange={(e) => handleTimProjectChange(index, 'tim', e.target.value)}
                              disabled={!tim.department}
                            >
                              <option value="">Pilih TIM</option>
                              {tim.department && UNIT_DETAILS[tim.department]?.map((detail) => (
                                <option key={detail} value={detail}>{detail}</option>
                              ))}
                            </Form.Select>
                          </Form.Group>
                        </Col>
                        
                        <Col md={3}>
                          <Form.Group>
                            <Form.Label>PIC</Form.Label>
                            <Form.Select
                              value={tim.pic}
                              onChange={(e) => handleTimProjectChange(index, 'pic', e.target.value)}
                              disabled={!tim.department || !tim.tim}
                            >
                              <option value="">Pilih PIC</option>
                              {getFilteredPICsForTimProject(index).map((userName, idx) => (
                                <option key={`${tim.department}-${tim.tim}-${userName}-${idx}`} value={userName}>
                                  {userName}
                                </option>
                              ))}
                            </Form.Select>
                          </Form.Group>
                        </Col>
                        
                        <Col md={3}>
                          <Form.Group>
                            <div className="d-flex justify-content-between align-items-baseline">
                              <Form.Label className="mb-0">Output</Form.Label>
                              <Button 
                                variant="link" 
                                size="sm" 
                                className="p-0"
                                onClick={() => {
                                  setEditingOutputIndex(prev => prev === index ? null : index);
                                }}
                                title="Edit Output"
                              >
                                Edit
                              </Button>
                            </div>

                            {editingOutputIndex === index ? (
                              <div className="border rounded p-2 mt-2" style={{ maxHeight: '180px', overflowY: 'auto', backgroundColor: '#f8f9fa' }}>
                                {tim.department && OUTPUT_OPTIONS[tim.department] ? (
                                  OUTPUT_OPTIONS[tim.department].map((output) => (
                                    <Form.Check
                                      key={output}
                                      type="checkbox"
                                      id={`output-${index}-${output}`}
                                      label={output}
                                      checked={tim.outputs.includes(output)}
                                      onChange={(e) => handleOutputChange(index, output, e.target.checked)}
                                    />
                                  ))
                                ) : (
                                  <div className="text-muted small">Pilih Department dulu</div>
                                )}

                                <div className="d-flex justify-content-end mt-2">
                                  <Button size="sm" variant="primary" onClick={() => setEditingOutputIndex(null)}>Done</Button>
                                </div>
                              </div>
                            ) : (
                              <div className="p-3 bg-light rounded border mt-2">
                                <div className="text-primary fw-bold mb-2" style={{ minHeight: '28px' }}>
                                  {tim.outputs.length > 0 ? tim.outputs.join(', ') : <span className="text-muted">-</span>}
                                </div>
                                <div>
                                  <Button 
                                    variant="outline-secondary" 
                                    size="sm"
                                    onClick={() => handleTimProjectChange(index, 'outputs', [])}
                                  >
                                    Clear
                                  </Button>
                                </div>
                              </div>
                            )}
                          </Form.Group>
                        </Col>
                      </Row>
                    
                    </Card.Body>
                  </Card>
                ))}
              </Card.Body>
            </Card>

            <Card className="mb-4 pb-4 border-0">
              <strong className='ms-3'>Approval</strong>
              <Card.Body>
                <Row>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Tanggal Approval</Form.Label>
                      <Form.Control
                        type="date"
                        name="approvalDate"
                        value={formData.approvalDate}
                        onChange={handleChange}
                      />
                    </Form.Group>
                  </Col>
                </Row>
              </Card.Body>
            </Card>

            {/* Buttons */}
            <div className="d-flex gap-3 justify-content-end">
              <Button 
                variant="secondary" 
                onClick={handleCancelFPP}
                disabled={loading}
              >
                {isEditMode ? 'Batal Edit' : 'Cancel FPP'}
              </Button>
              
              <Button 
                variant="outline-primary" 
                onClick={handlePrintOnly}
                disabled={loading}
              >
                Export PDF
              </Button>
              
              <Button 
                variant={isEditMode ? "warning" : "primary"} 
                onClick={handleSaveDraft}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Spinner size="sm" animation="border" /> Processing...
                  </>
                ) : (
                  <span>
                    {isEditMode ? 'Update Draft' : 'Save Draft'}
                  </span>
                )}
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>
    </Container>
  );
}

export default RegisterFPP;