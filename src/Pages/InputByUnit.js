import React, { useState, useEffect } from 'react';
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
  Spinner,
  Table
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
import { PDFDocument } from 'pdf-lib';

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

// DEPARTEMEN yang tersedia untuk Project
const PROJECT_DEPARTMENTS = ['PPD', 'DPA', 'UUD', 'PDM'];

function RegisterFPP() {
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [alert, setAlert] = useState({ show: false, message: '', variant: '' });
  const [formErrors, setFormErrors] = useState({});
  const [formNumber, setFormNumber] = useState('766.01/FORM/2025');
  const [isEditingFormNumber, setIsEditingFormNumber] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editDraftId, setEditDraftId] = useState(null);
  const [editFppEntryId, setEditFppEntryId] = useState(null);
  const [isCheckingFpp, setIsCheckingFpp] = useState(false);
  const [fppExistsError, setFppExistsError] = useState('');
  const [projects, setProjects] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [editingOutputIndex, setEditingOutputIndex] = useState(null);
  
  // Data user dari login (simulasi - dalam aplikasi real akan dari auth)
  const [currentUser, setCurrentUser] = useState({
    department: 'PPD',
    tim: 'AKUISISI',
    pic: 'Isa'
  });

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

  // Tabel Paraf dengan struktur seperti di gambar
  const initialParafData = [
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
      jabatan: '', // Biarkan kosong agar bisa diisi
      tanggal: '',
      keterangan: ''
    },
    {
      pejabat: 'PEJABAT BERWENANG UNIT/PIHAK YANG TERLIBAT',
      namaPejabat: '(Nama Pejabat)',
      jabatan: '', // Biarkan kosong agar bisa diisi
      tanggal: '',
      keterangan: ''
    }
  ];

  const [formData, setFormData] = useState({
    masterProjectType: 'noProject',
    masterProjectNumber: '',
    masterProjectName: '',
    skalaProject: '',
    projectDepartments: [],
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
    approvalDate: '',
    parafData: initialParafData
  });

  const navigate = useNavigate();
  const location = useLocation();

  // =============== VALIDATION FUNCTIONS ===============
  const validateForm = () => {
    const errors = {};
    
    // Master Project validation
    if (!formData.masterProjectNumber) {
      errors.masterProjectNumber = 'Nomor Master Project wajib diisi';
    }
    if (!formData.masterProjectName) {
      errors.masterProjectName = 'Judul Project wajib diisi';
    }

    if (formData.projectDepartments.length === 0) {
      errors.projectDepartments = 'Pilih minimal satu departemen yang terlibat';
    }
    
    // Department validation
    if (!formData.department) {
      errors.department = 'Departemen wajib diisi';
    }
    if (!formData.tim) {
      errors.tim = 'Tim wajib diisi';
    }
    if (!formData.pic) {
      errors.pic = 'PIC wajib diisi';
    }
    
    // FPP validation
    if (!formData.judulFpp) {
      errors.judulFpp = 'Judul FPP wajib diisi';
    }
    if (!formData.jenisProject) {
      errors.jenisProject = 'Jenis Project wajib diisi';
    }
    if (formData.jenisProject === 'Lainnya' && !formData.jenisProjectOther) {
      errors.jenisProjectOther = 'Silakan masukkan jenis project';
    }
    
    // PIC validation
    if (formData.department && formData.tim && formData.pic) {
      const allowedPICs = getFilteredUsers();
      if (!allowedPICs.includes(formData.pic)) {
        errors.pic = `PIC "${formData.pic}" tidak valid untuk ${formData.department} - ${formData.tim}`;
      }
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const checkFppExists = async (fppNumber) => {
    if (!fppNumber) return false;
    
    setIsCheckingFpp(true);
    setFppExistsError('');
    
    try {
      const fppCheckQuery = query(
        collection(db, 'fpp_entries'),
        where('noFpp', '==', fppNumber)
      );
      const fppCheckSnapshot = await getDocs(fppCheckQuery);
      
      const exists = !fppCheckSnapshot.empty;
      
      if (exists) {
        // ❌ PERBAIKAN: Periksa apakah ini dokumen yang sama
        const existingDoc = fppCheckSnapshot.docs[0];
        
        if (!isEditMode) {
          setFppExistsError(`No FPP "${fppNumber}" sudah ada di sistem! Harus unique.`);
        } else if (editFppEntryId && existingDoc.id !== editFppEntryId) {
          // ✅ Jika edit mode dan ID berbeda, berarti FPP digunakan orang lain
          setFppExistsError(`No FPP "${fppNumber}" sudah digunakan oleh FPP lain!`);
        }
        // ✅ Jika editFppEntryId === existingDoc.id, berarti update dokumen yang sama, tidak error
      }
      
      return exists;
    } catch (error) {
      console.error('Error checking FPP:', error);
      return false;
    } finally {
      setIsCheckingFpp(false);
    }
  };

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
          projectDepartments: editData.projectDepartments || [],
          skalaProject: editData.skalaProject || '',
          // projectDepartments: editData.projectDepartments || [],
          department: editData.department || currentUser.department,
          tim: editData.tim || currentUser.tim,
          pic: editData.pic || currentUser.pic,
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
                tim: tim.tim || '',
                pic: tim.pic || '',
                outputs: Array.isArray(tim.outputs) ? tim.outputs : []
              }))
            : [{ department: '', tim: '', pic: '', outputs: [] }],
          approvalDate: editData.approvalDate || '',
            parafData: editData.parafData || initialParafData.map((item, index) => ({
            ...item,
            jabatan: editData.parafData?.[index]?.jabatan || item.jabatan,
            keterangan: editData.parafData?.[index]?.keterangan || ''
          })),
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
        setFormData(prev => ({
          ...prev,
          department: currentUser.department,
          tim: currentUser.tim,
          pic: currentUser.pic
        }));
      }
    } catch (error) {
      console.error('❌ Error loading from sessionStorage:', error);
      showAlert('Error loading draft data', 'danger');
    }
  };

  // =============== USE EFFECTS ===============
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

  // =============== DATA FETCHING ===============
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

  // =============== HELPER FUNCTIONS ===============
  const showAlert = (message, variant) => {
    setAlert({ show: true, message, variant });
    setTimeout(() => {
      setAlert({ show: false, message: '', variant: '' });
    }, 3000);
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

  // =============== FORM HANDLERS ===============
  const handleChange = (e) => {
    const { name, value } = e.target;
    
    if (formErrors[name]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: undefined
      }));
    }
    
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
      setFormData(prev => ({
        ...prev,
        department: value,
        tim: '',
        pic: ''
      }));
    } else if (name === 'tim') {
      setFormData(prev => ({
        ...prev,
        tim: value,
        pic: ''
      }));
    } else if (name === 'noFpp') {
      setFormData(prev => ({
        ...prev,
        noFpp: value
      }));
      
      if (value.trim()) {
        const timeoutId = setTimeout(() => {
          checkFppExists(value);
        }, 500);
        return () => clearTimeout(timeoutId);
      } else {
        setFppExistsError('');
      }
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleProjectDepartmentChange = (dept, isChecked) => {
    setFormData(prev => {
      if (isChecked) {
        return {
          ...prev,
          projectDepartments: [...prev.projectDepartments, dept]
        };
      } else {
        return {
          ...prev,
          projectDepartments: prev.projectDepartments.filter(d => d !== dept)
        };
      }
    });
  };

  const handleParafChange = (index, field, value) => {
    const newParafData = [...formData.parafData];
    newParafData[index][field] = value;
    setFormData(prev => ({
      ...prev,
      parafData: newParafData
    }));
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
      newTimProject[index].tim = '';
      newTimProject[index].pic = '';
      newTimProject[index].outputs = [];
      if (editingOutputIndex === index) setEditingOutputIndex(null);
    } else if (field === 'tim') {
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

  // =============== PDF GENERATION FUNCTIONS ===============
  const generateFillablePDF = async () => {
    try {
      // 1. Load template PDF dari public folder
      const templateUrl = '/templates/form-penugasan-project-template.pdf';
      const templateResponse = await fetch(templateUrl);
      
      if (!templateResponse.ok) {
        // Jika template tidak ada, gunakan fallback
        console.log('Template PDF tidak ditemukan, menggunakan fallback...');
        return await generateHTMLPDF();
      }
      
      const templateBytes = await templateResponse.arrayBuffer();
      
      // 2. Load PDF document
      const pdfDoc = await PDFDocument.load(templateBytes);
      const form = pdfDoc.getForm();
      
      // 3. Isi field berdasarkan nama field di template PDF
      // Map data dari formData ke field PDF
      const fieldMapping = {
        // Header - Sesuaikan dengan nama field di template PDF Anda
        'noProject': formData.masterProjectNumber,
        'noFpp': formData.noFpp,
        'judulFpp': formData.judulFpp,
        
        // PIC Business Process & Analyst
        'picBpa': formData.pic,
        
        // Detail Penugasan
        'latarBelakang': formData.latarBelakang,
        'tujuan': formData.tujuan,
        'scope': formData.scope,
        'unitKerjaTerkait': formData.unitKerjaTerkait,
        
        // Rencana Penugasan - tanggal
        'draftDate': formData.rencanaPenugasan[0]?.tglTarget || '',
        'approvalDeptHeadDate': formData.rencanaPenugasan[1]?.tglTarget || '',
        'approvalDivHeadDate': formData.rencanaPenugasan[2]?.tglTarget || '',
        'approvalUserDate': formData.rencanaPenugasan[3]?.tglTarget || '',
        'approvalBodDate': formData.rencanaPenugasan[4]?.tglTarget || '',
        'closeProjectDate': formData.rencanaPenugasan[5]?.tglTarget || '',
        
        // Tim Project - PIC
        'dpaPic': formData.timProject.find(t => t.department === 'DPA')?.pic || '',
        'ppdPic': formData.timProject.find(t => t.department === 'PPD')?.pic || '',
        'uudPic': formData.timProject.find(t => t.department === 'UUD')?.pic || '',
        'pdmPic': formData.timProject.find(t => t.department === 'PDM')?.pic || '',
        
        // Tim Project - Output
        'dpaOutput': formData.timProject.find(t => t.department === 'DPA')?.outputs?.join(', ') || '',
        'ppdOutput': formData.timProject.find(t => t.department === 'PPD')?.outputs?.join(', ') || '',
        'uudOutput': formData.timProject.find(t => t.department === 'UUD')?.outputs?.join(', ') || '',
        'pdmOutput': formData.timProject.find(t => t.department === 'PDM')?.outputs?.join(', ') || '',
        
        // Paraf
        'bpaNama': formData.parafData[0]?.namaPejabat || '',
        'bpaJabatan': formData.parafData[0]?.jabatan || '',
        
        'unitNama': formData.parafData[1]?.namaPejabat || '',
        'unitJabatan': formData.parafData[1]?.jabatan || '',
        
        'unitNama2': formData.parafData[2]?.namaPejabat || '',
        'unitJabatan2': formData.parafData[2]?.jabatan || '',
      };
      
      // 4. Isi field text
      Object.entries(fieldMapping).forEach(([fieldName, value]) => {
        try {
          const field = form.getTextField(fieldName);
          if (field) {
            field.setText(value || '');
          }
        } catch (e) {
          console.warn(`Field ${fieldName} tidak ditemukan di template`);
        }
      });
      
      // 5. Isi checkbox untuk Jenis Project (jika ada di template)
      const jenisProjectText = formData.jenisProject === 'Lainnya' ? 
        formData.jenisProjectOther : formData.jenisProject;
      
      try {
        const jenisProjectField = form.getTextField('jenisProject');
        if (jenisProjectField) {
          jenisProjectField.setText(jenisProjectText || '');
        }
      } catch (e) {
        console.warn('Field jenisProject tidak ditemukan');
      }
      
      // 6. Isi radio button untuk PIR (jika ada di template)
      try {
        const pirField = form.getTextField('pirType');
        if (pirField) {
          pirField.setText(formData.pirType || '');
        }
      } catch (e) {
        console.warn('Field pirType tidak ditemukan');
      }
      
      // 7. Optional: Flatten form agar tidak bisa diedit lagi
      try {
        form.flatten();
      } catch (e) {
        console.warn('Tidak bisa flatten form');
      }
      
      // 8. Save PDF
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      // 9. Download
      const link = document.createElement('a');
      link.href = url;
      link.download = `FORM_PENUGASAN_${formData.noFpp || 'DRAFT'}_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      return true;
      
    } catch (error) {
      console.error('Error generating fillable PDF:', error);
      // Fallback ke metode html2canvas
      return await generateHTMLPDF();
    }
  };

  const generateHTMLPDF = async () => {
    try {
      // Resolve jenis project
      const displayJenisProject = formData.jenisProject === 'Lainnya' 
        ? formData.jenisProjectOther 
        : formData.jenisProject;
      
      // Helper function untuk format tanggal
      const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
      };
      
      // Buat container untuk template PDF
      const pdfContainer = document.createElement('div');
      pdfContainer.style.position = 'fixed';
      pdfContainer.style.left = '-9999px';
      pdfContainer.style.top = '0';
      pdfContainer.style.width = '794px'; // A4 width in pixels at 96 DPI
      pdfContainer.style.backgroundColor = 'white';
      pdfContainer.style.padding = '55px'; // Tambah padding dari 50px ke 55px
      pdfContainer.style.fontFamily = 'Arial, sans-serif';
      pdfContainer.style.fontSize = '11px';
      pdfContainer.style.lineHeight = '1.5';
      pdfContainer.style.boxSizing = 'border-box';
      pdfContainer.style.color = '#000';
      
      // Build HTML sesuai template asli
      pdfContainer.innerHTML = `
        <div style="position: relative;">
          <!-- Header dengan Form Number -->
          <div style="text-align: right; font-size: 9px; margin-bottom: 6px; font-weight: normal;">
            ${formNumber}
          </div>
          
          <!-- Judul Form -->
          <div style="text-align: center; font-weight: bold; font-size: 15px; margin-bottom: 10px; padding-bottom: 4px; border-bottom: 2px solid #000;">
            FORM PENUGASAN PROJECT
          </div>
          
          <!-- Tabel No. Project/FPP Info -->
          <table style="width: 100%; margin-bottom: 6px; border-collapse: collapse; font-size: 10px; border: 1px solid #000;">
            <tr>
              <td style="width: 22%; padding: 5px 6px; font-weight: normal; border-right: 1px solid #000; border-bottom: 1px solid #000;">No. Project / FPP Induk</td>
              <td style="width: 28%; padding: 5px 6px; border-right: 1px solid #000; border-bottom: 1px solid #000;">${formData.masterProjectNumber || ''}</td>
              <td style="width: 15%; padding: 5px 6px; font-weight: normal; border-right: 1px solid #000; border-bottom: 1px solid #000;">No. FPP</td>
              <td style="width: 35%; padding: 5px 6px; border-bottom: 1px solid #000;">${formData.noFpp || ''}</td>
            </tr>
            <tr>
              <td style="padding: 5px 6px; font-weight: normal; border-right: 1px solid #000; border-bottom: 1px solid #000;">Judul FPP</td>
              <td colspan="3" style="padding: 5px 6px; border-bottom: 1px solid #000;">${formData.judulFpp || ''}</td>
            </tr>
            <tr>
              <td style="padding: 5px 6px; font-weight: normal; border-right: 1px solid #000; border-bottom: 1px solid #000;">Jenis Project</td>
              <td colspan="3" style="padding: 5px 6px; border-bottom: 1px solid #000;">
                ${formData.jenisProject === 'OJK Audit' ? '☑' : '☐'} Audit
                <span style="margin-left: 15px;">${formData.jenisProject === 'Priority' ? '☑' : '☐'} Priority</span>
                <span style="margin-left: 15px;">${formData.jenisProject === 'KPI' ? '☑' : '☐'} KPI</span>
                <span style="margin-left: 15px;">${formData.jenisProject === 'Adhoc' ? '☑' : '☐'} Adhoc</span>
                <span style="margin-left: 25px;">${['Merger', 'Carry Over', 'EMAS'].includes(formData.jenisProject) || formData.jenisProject === 'Lainnya' ? '☑' : '☐'} Memo User</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 5px 6px; font-weight: normal; border-right: 1px solid #000;">Post Implementation Review (PIR)</td>
              <td colspan="3" style="padding: 5px 6px;">
                ${formData.pirType === 'Proses' ? '☑' : '☐'} Proses
                <span style="margin-left: 25px;">${formData.pirType === 'Aplikasi' ? '☑' : '☐'} Aplikasi</span>
              </td>
            </tr>
          </table>
          
          <!-- Tabel PIC Business Process & Analyst -->
          <table style="width: 100%; margin-bottom: 8px; border-collapse: collapse; font-size: 10px; border: 1px solid #000;">
            <tr>
              <td style="width: 35%; padding: 5px 6px; font-weight: normal; border-right: 1px solid #000;">PIC Business Process & Analyst</td>
              <td style="padding: 5px 6px;">${formData.pic || ''}</td>
            </tr>
          </table>
          
          <!-- Detail Penugasan -->
          <div style="margin-bottom: 10px;">
            <div style="font-weight: bold; margin-bottom: 6px; font-size: 11px;">
              Detail Penugasan
            </div>
            
            <div style="margin-bottom: 4px;">
              <div style="font-weight: bold; font-size: 10px; margin-bottom: 2px;">1.   Latar Belakang :</div>
              <div style="padding-left: 20px; font-size: 10px; text-align: justify; line-height: 1.3;">
                ${formData.latarBelakang || ''}
              </div>
            </div>
            
            <div style="margin-bottom: 4px;">
              <div style="font-weight: bold; font-size: 10px; margin-bottom: 2px;">2.   Tujuan :</div>
              <div style="padding-left: 20px; font-size: 10px; text-align: justify; line-height: 1.3;">
                ${formData.tujuan || ''}
              </div>
            </div>
            
            <div style="margin-bottom: 4px;">
              <div style="font-weight: bold; font-size: 10px; margin-bottom: 2px;">3.   Scope :</div>
              <div style="padding-left: 20px; font-size: 10px; text-align: justify; line-height: 1.3;">
                ${formData.scope || ''}
              </div>
            </div>
            
            <div style="margin-bottom: 4px;">
              <div style="font-weight: bold; font-size: 10px; margin-bottom: 2px;">4.   Unit Kerja / PIC yang Terlibat:</div>
              <div style="padding-left: 20px; font-size: 10px; line-height: 1.3;">
                ${formData.unitKerjaTerkait || ''}
              </div>
            </div>
            
            <!-- Rencana Penugasan Table -->
            <div style="margin-bottom: 6px;">
              <div style="font-weight: bold; font-size: 10px; margin-bottom: 3px;">5.   Rencana Penugasan:</div>
              <table style="width: 100%; border-collapse: collapse; font-size: 9px; margin-top: 3px; border: 0.3px solid #000;">
                <thead>
                  <tr style="background-color: #d3d3d3;">
                    <th style="border: 0.3px solid #000; padding: 5px; text-align: center; font-weight: bold;">KETERANGAN</th>
                    <th style="border: 0.3px solid #000; padding: 5px; text-align: center; font-weight: bold;">TANGGAL</th>
                    <th style="border: 0.3px solid #000; padding: 5px; text-align: center; font-weight: bold;">KETERANGAN</th>
                    <th style="border: 0.3px solid #000; padding: 5px; text-align: center; font-weight: bold;">TANGGAL</th>
                  </tr>
                </thead>
                <tbody>
                  ${[0, 1, 2].map(i => {
                    const leftItem = formData.rencanaPenugasan[i];
                    const rightItem = formData.rencanaPenugasan[i + 3];
                    // Hanya tampilkan row jika ada data
                    if (!leftItem?.keterangan && !leftItem?.tglTarget && !rightItem?.keterangan && !rightItem?.tglTarget) {
                      return '';
                    }
                    return `
                      <tr>
                        <td style="border: 0.3px solid #000; padding: 5px;">${leftItem?.keterangan || ''}</td>
                        <td style="border: 0.3px solid #000; padding: 5px;">${formatDate(leftItem?.tglTarget)}</td>
                        <td style="border: 0.3px solid #000; padding: 5px;">${rightItem?.keterangan || ''}</td>
                        <td style="border: 0.3px solid #000; padding: 5px;">${formatDate(rightItem?.tglTarget)}</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
            
            <!-- Tim Project Table -->
            <div style="margin-bottom: 8px;">
              <div style="font-weight: bold; font-size: 10px; margin-bottom: 3px;">6.   Tim Project :</div>
              <table style="width: 100%; border-collapse: collapse; font-size: 9px; margin-top: 3px; border: 0.3px solid #000;">
                <thead>
                  <tr style="background-color: #d3d3d3;">
                    <th style="border: 0.3px solid #000; padding: 5px; text-align: center; font-weight: bold; width: 12%;">TIM PROJECT</th>
                    <th style="border: 0.3px solid #000; padding: 5px; text-align: center; font-weight: bold; width: 25%;">PIC</th>
                    <th style="border: 0.3px solid #000; padding: 5px; text-align: center; font-weight: bold; width: 48%;">OUTPUT</th>
                    <th style="border: 0.3px solid #000; padding: 5px; text-align: center; font-weight: bold; width: 15%;">PARAF</th>
                  </tr>
                </thead>
                <tbody>
                  ${['DPA', 'PPD', 'UUD', 'PDM'].map(dept => {
                    const timData = formData.timProject.find(t => t.department === dept);
                    // Hanya tampilkan row jika ada data
                    if (!timData?.pic && (!timData?.outputs || timData.outputs.length === 0)) {
                      return '';
                    }
                    return `
                      <tr>
                        <td style="border: 0.3px solid #000; padding: 6px; text-align: center; font-weight: bold;">${dept}</td>
                        <td style="border: 0.3px solid #000; padding: 6px;">${timData?.pic || ''}</td>
                        <td style="border: 0.3px solid #000; padding: 6px;">${timData?.outputs?.join(', ') || ''}</td>
                        <td style="border: 0.3px solid #000; padding: 6px;"></td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
          
          <!-- Paraf Section -->
          <div style="margin-top: 12px;">
            <!-- Business Process & Analyst -->
            <table style="width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 10px;">
              <thead>
                <tr>
                  <th colspan="2" style="border: 1px solid #000; padding: 5px; text-align: center; font-weight: bold; background-color: #d3d3d3;">
                    PEJABAT BERWENANG BUSINESS PROCESS & ANALYST
                  </th>
                </tr>
                <tr style="background-color: #d3d3d3;">
                  <th style="border: 1px solid #000; padding: 4px; text-align: center; font-weight: bold; width: 50%;">TANDA TANGAN</th>
                  <th style="border: 1px solid #000; padding: 4px; text-align: center; font-weight: bold; width: 50%;">KETERANGAN</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="border: 1px solid #000; padding: 8px; vertical-align: top;">
                    <div style="margin-bottom: 3px;">${formData.parafData[0]?.namaPejabat || '(Nama Pejabat)'}</div>
                    <div style="margin-bottom: 3px; font-size: 9px;">${formData.parafData[0]?.jabatan || 'Business Process & Analyst Division Head'}</div>
                    <div style="height: 40px; margin-top: 10px; border-top: 1px solid #000; padding-top: 5px;">
                      <div style="font-size: 9px;">Tanggal : ${formatDate(formData.parafData[0]?.tanggal)}</div>
                    </div>
                  </td>
                  <td style="border: 1px solid #000; padding: 8px; vertical-align: top;">
                    <div style="min-height: 80px;">${formData.parafData[0]?.keterangan || ''}</div>
                  </td>
                </tr>
              </tbody>
            </table>
            
            <!-- Unit/Pihak yang Terlibat -->
            <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
              <thead>
                <tr>
                  <th colspan="2" style="border: 1px solid #000; padding: 5px; text-align: center; font-weight: bold; background-color: #d3d3d3;">
                    PEJABAT BERWENANG UNIT/PIHAK YANG TERLIBAT
                  </th>
                </tr>
                <tr style="background-color: #d3d3d3;">
                  <th style="border: 1px solid #000; padding: 4px; text-align: center; font-weight: bold; width: 50%;">TANDA TANGAN</th>
                  <th style="border: 1px solid #000; padding: 4px; text-align: center; font-weight: bold; width: 50%;">KETERANGAN</th>
                </tr>
              </thead>
              <tbody>
                ${formData.parafData.slice(1, 3).map((paraf, index) => `
                  <tr>
                    <td style="border: 1px solid #000; padding: 8px; vertical-align: top;">
                      <div style="margin-bottom: 3px;">${paraf?.namaPejabat || '(Nama Pejabat)'}</div>
                      <div style="margin-bottom: 3px; font-size: 9px;">${paraf?.jabatan || 'Pejabat Berwenang Unit / Pihak yang Terlibat'}</div>
                      <div style="height: 40px; margin-top: 10px; border-top: 1px solid #000; padding-top: 5px;">
                        <div style="font-size: 9px;">Tanggal : ${formatDate(paraf?.tanggal)}</div>
                      </div>
                    </td>
                    <td style="border: 1px solid #000; padding: 8px; vertical-align: top;">
                      <div style="min-height: 80px;">${paraf?.keterangan || ''}</div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          
          <!-- Footer -->
          <div style="text-align: right; font-size: 9px; margin-top: 10px;">
            1 dari 1
          </div>
        </div>
      `;
      
      document.body.appendChild(pdfContainer);
      
      // Tunggu rendering
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Capture dengan html2canvas dengan kualitas tinggi
      const canvas = await html2canvas(pdfContainer, {
        scale: 4,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: pdfContainer.offsetWidth,
        height: pdfContainer.offsetHeight,
        windowWidth: pdfContainer.offsetWidth,
        windowHeight: pdfContainer.offsetHeight,
        imageTimeout: 0,
        removeContainer: false,
        allowTaint: false,
        foreignObjectRendering: false
      });
      
      // Hapus container
      document.body.removeChild(pdfContainer);
      
      // Buat PDF dengan resolusi tinggi
      const imgData = canvas.toDataURL('image/png', 1.0);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      // Add image to PDF - full page dengan kompresi minimal
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'NONE');
      
      // Download
      pdf.save(`FORM_PENUGASAN_${formData.noFpp || 'DRAFT'}_${new Date().toISOString().split('T')[0]}.pdf`);
      
      return true;
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      showAlert('Error generating PDF: ' + error.message, 'danger');
      return false;
    }
  };

  const exportToPDF = async () => {
    try {
      // Validasi sebelum export
      if (!validateForm()) {
        showAlert('Harap perbaiki error pada form sebelum export PDF!', 'danger');
        return;
      }
      
      setLoading(true);
      
      // Generate PDF dengan menangkap tampilan website langsung
      await generateHTMLPDF();
      
      showAlert('PDF berhasil di-download!', 'success');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      showAlert('Error generating PDF: ' + error.message, 'danger');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDraft = async (e) => {
    e.preventDefault();
    
    // Debug: Lihat data sebelum disimpan
    console.log('📊 [RegisterFPP] Save draft called:', {
      isEditMode,
      editDraftId,
      editFppEntryId,
      noFpp: formData.noFpp,
      projectDepartments: formData.projectDepartments
    });
    
    if (!validateForm()) {
      showAlert('Harap perbaiki error pada form sebelum menyimpan!', 'danger');
      return;
    }
    
    // Cek FPP number jika ada
    if (formData.noFpp) {
      const fppExists = await checkFppExists(formData.noFpp);
      if (fppExists && fppExistsError) {
        showAlert(fppExistsError, 'danger');
        return;
      }
    }
    
    // Validasi PIC
    if (formData.department && formData.tim && formData.pic) {
      const allowedPICs = getFilteredUsers();
      if (!allowedPICs.includes(formData.pic)) {
        showAlert(
          `PIC "${formData.pic}" tidak valid untuk ${formData.department} - ${formData.tim}`,
          'danger'
        );
        return;
      }
    }
    
    // Validasi jenis project lainnya
    if (formData.jenisProject === 'Lainnya' && !formData.jenisProjectOther) {
      showAlert('Silakan masukkan jenis project (Lainnya)!', 'danger');
      return;
    }

    // Filter tim project yang lengkap
    const completeTimProjects = formData.timProject.filter(tim => 
      tim.department && tim.tim && tim.pic
    );
    
    // Jika ada tim project tidak lengkap, konfirmasi
    if (formData.timProject.length > completeTimProjects.length) {
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
      
      // Resolve jenis project
      const resolvedJenisProject = formData.jenisProject === 'Lainnya'
        ? formData.jenisProjectOther || 'Lainnya'
        : formData.jenisProject;
      
      // 1. Master Project Data
      const masterProjectData = {
        masterProjectType: formData.masterProjectType,
        masterProjectNumber: formData.masterProjectNumber,
        masterProjectName: formData.masterProjectName,
        skalaProject: formData.skalaProject,
        projectDepartments: formData.projectDepartments, // ✅ INCLUDE PROJECT DEPARTMENTS
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

      // 2. Prepare FPP Data
      const fppEntryData = {
        masterProjectId: masterProjectId,
        masterProjectNumber: formData.masterProjectNumber,
        masterProjectName: formData.masterProjectName,
        masterProjectType: formData.masterProjectType,
        skalaProject: formData.skalaProject,
        projectDepartments: formData.projectDepartments, // ✅ PASTIKAN INI ADA
        
        // PIC Data
        department: formData.department,
        tim: formData.tim,
        pic: formData.pic,
        
        // FPP Data
        noFpp: formData.noFpp || '',
        judulFpp: formData.judulFpp,
        jenisProject: formData.jenisProject,
        jenisProjectResolved: resolvedJenisProject,
        jenisProjectOther: formData.jenisProjectOther,
        pirType: formData.pirType,
        
        // Detail Penugasan
        latarBelakang: formData.latarBelakang,
        tujuan: formData.tujuan,
        scope: formData.scope,
        unitKerjaTerkait: formData.unitKerjaTerkait,
        
        // Rencana Penugasan
        rencanaPenugasan: formData.rencanaPenugasan,
        
        // Tim Project (gunakan yang lengkap saja)
        timProject: completeTimProjects,
        
        // Approval & Paraf
        approvalDate: formData.approvalDate,
        parafData: formData.parafData,
        
        // Metadata
        formNumber: formNumber,
        status: 'draft',
        tanggalDraft: new Date().toISOString().split('T')[0],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      console.log('📝 Data yang akan disimpan:', {
        isEditMode,
        editDraftId,
        editFppEntryId,
        projectDepartments: fppEntryData.projectDepartments
      });

      // 3. LOGIKA UPDATE YANG BENAR
      if (isEditMode) {
        console.log('✏️ Mode EDIT - Updating...');
        
        // Update fpp_entries jika ada editFppEntryId
        if (editFppEntryId) {
          console.log('🔄 Updating fpp_entries dengan ID:', editFppEntryId);
          const fppRef = doc(db, 'fpp_entries', editFppEntryId);
          await updateDoc(fppRef, {
            ...fppEntryData,
            updatedAt: serverTimestamp()
          });
          console.log('✅ fpp_entries updated');
        }
        
        // Update fpp_drafts dengan editDraftId
        if (editDraftId) {
          console.log('🔄 Updating fpp_drafts dengan ID:', editDraftId);
          const draftRef = doc(db, 'fpp_drafts', editDraftId);
          await updateDoc(draftRef, {
            ...fppEntryData,
            updatedAt: serverTimestamp()
          });
          console.log('✅ fpp_drafts updated');
        } else {
          // Jika tidak ada draftId, buat draft baru
          console.log('📄 No draftId, creating new draft');
          await addDoc(collection(db, 'fpp_drafts'), fppEntryData);
        }
        
        showAlert('✅ FPP berhasil diupdate!', 'success');
        
      } else {
        // 4. LOGIKA SAVE BARU
        console.log('🆕 Mode NEW - Creating...');
        
        // Simpan ke fpp_entries
        const fppDocRef = await addDoc(collection(db, 'fpp_entries'), fppEntryData);
        const newFppId = fppDocRef.id;
        console.log('✅ New FPP entry created with ID:', newFppId);
        
        // Simpan ke fpp_drafts dengan fppEntryId
        const draftData = {
          ...fppEntryData,
          fppEntryId: newFppId
        };
        
        await addDoc(collection(db, 'fpp_drafts'), draftData);
        console.log('✅ New draft created');
        
        showAlert('✅ FPP berhasil disimpan!', 'success');
      }
      
      // 5. Navigate setelah sukses
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
      skalaProject: '',
      projectDepartments: [],
      department: currentUser.department,
      tim: currentUser.tim,
      pic: currentUser.pic,
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
      approvalDate: '',
      parafData: initialParafData
    });
    setIsEditMode(false);
    setEditDraftId(null);
    setEditFppEntryId(null);
    setEditingOutputIndex(null);
    setFormErrors({});
    setFppExistsError('');
  };

  // =============== RENDER ===============
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

      <Card className="border-0 mb-4">
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
            {/* Master Project Section */}
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
                            
                            if (typeof selectedValue === 'string') {
                              setFormData(prev => ({
                                ...prev,
                                masterProjectNumber: selectedValue,
                                masterProjectName: ''
                              }));
                            } else {
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
                        isInvalid={!!formErrors.masterProjectNumber}
                        required
                        filterBy={(option, props) => {
                          return option.label.toLowerCase().includes(props.text.toLowerCase());
                        }}
                        renderMenuItemChildren={(option, props) => {
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
                      {formErrors.masterProjectNumber && (
                        <Form.Text className="text-danger">{formErrors.masterProjectNumber}</Form.Text>
                      )}
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
                        isInvalid={!!formErrors.masterProjectName}
                      />
                      {formErrors.masterProjectName && (
                        <Form.Text className="text-danger">{formErrors.masterProjectName}</Form.Text>
                      )}
                    </Form.Group>
                  </Col>
                </Row>
                <Row className="mt-3">
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Skala Project</Form.Label>
                      <Form.Select
                        name="skalaProject"
                        value={formData.skalaProject}
                        onChange={handleChange}
                      >
                        <option value="">Pilih Skala</option>
                        <option value="Small">Small</option>
                        <option value="Medium">Medium</option>
                        <option value="Large">Large</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                </Row>
              </Card.Body>
            </Card>

            {/* Departemen Project Section */}
            <Card className="mb-4 border-0">
              <strong className='ms-3'>Departemen Project <span className="text-danger">*</span></strong>
              <Card.Body>
                <Form.Group>
                  <div className="d-flex flex-wrap gap-4 mt-2">
                    {PROJECT_DEPARTMENTS.map((dept) => (
                      <Form.Check
                        key={dept}
                        type="checkbox"
                        id={`project-dept-${dept}`}
                        label={dept}
                        checked={formData.projectDepartments.includes(dept)}
                        onChange={(e) => handleProjectDepartmentChange(dept, e.target.checked)}
                      />
                    ))}
                  </div>
                  {formErrors.projectDepartments && (
                    <Form.Text className="text-danger">{formErrors.projectDepartments}</Form.Text>
                  )}
                  {formData.projectDepartments.length > 0 && (
                    <div className="mt-2">
                      <small className="text-muted">
                        Terpilih: {formData.projectDepartments.join(', ')}
                      </small>
                    </div>
                  )}
                </Form.Group>
              </Card.Body>
            </Card>

            {/* Project Section */}
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
                        isInvalid={!!formErrors.department}
                      >
                        <option value=""> </option>
                        <option value="PPD">PPD</option>
                        <option value="DPA">DPA</option>
                        <option value="UUD">UUD</option>
                        <option value="PDM">PDM</option>
                      </Form.Select>
                      {formErrors.department && (
                        <Form.Text className="text-danger">{formErrors.department}</Form.Text>
                      )}
                      <Form.Text className="text-muted">
                        Auto-filled from login: {currentUser.department}
                      </Form.Text>
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
                        isInvalid={!!formErrors.tim}
                      >
                        <option value=""> </option>
                        {formData.department && UNIT_DETAILS[formData.department]?.map((detail) => (
                          <option key={detail} value={detail}>{detail}</option>
                        ))}
                      </Form.Select>
                      {formErrors.tim && (
                        <Form.Text className="text-danger">{formErrors.tim}</Form.Text>
                      )}
                      <Form.Text className="text-muted">
                        Auto-filled from login: {currentUser.tim}
                      </Form.Text>
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
                        isInvalid={!!formErrors.pic}
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
                      {formErrors.pic && (
                        <Form.Text className="text-danger">{formErrors.pic}</Form.Text>
                      )}
                      <Form.Text className="text-muted">
                        Auto-filled from login: {currentUser.pic}
                      </Form.Text>
                    </Form.Group>
                  </Col>
                </Row>

                <Row className="mb-3">
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>No FPP</Form.Label>
                      <Form.Control
                        type="text"
                        name="noFpp"
                        value={formData.noFpp}
                        onChange={handleChange}
                        disabled={isEditMode}
                        isInvalid={!!fppExistsError}
                      />
                      {isCheckingFpp && (
                        <Form.Text className="text-info">
                          <Spinner size="sm" animation="border" /> Checking FPP number...
                        </Form.Text>
                      )}
                      {fppExistsError && (
                        <Form.Text className="text-danger">{fppExistsError}</Form.Text>
                      )}
                      {!isEditMode && formData.noFpp && (
                        <Form.Text className="text-muted">
                          <small>* No FPP bisa diisi nanti saat edit draft</small>
                        </Form.Text>
                      )}
                      {isEditMode && (
                        <Form.Text className="text-muted">
                          <small>* No FPP tidak dapat diubah dalam mode edit</small>
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
                        isInvalid={!!formErrors.judulFpp}
                      />
                      {formErrors.judulFpp && (
                        <Form.Text className="text-danger">{formErrors.judulFpp}</Form.Text>
                      )}
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
                        isInvalid={!!formErrors.jenisProject}
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
                      {formErrors.jenisProject && (
                        <Form.Text className="text-danger">{formErrors.jenisProject}</Form.Text>
                      )}

                      {formData.jenisProject === 'Lainnya' && (
                        <>
                          <Form.Control
                            type="text"
                            name="jenisProjectOther"
                            className="mt-2"
                            placeholder="Masukkan jenis project..."
                            value={formData.jenisProjectOther}
                            onChange={handleChange}
                            required
                            isInvalid={!!formErrors.jenisProjectOther}
                          />
                          {formErrors.jenisProjectOther && (
                            <Form.Text className="text-danger">{formErrors.jenisProjectOther}</Form.Text>
                          )}
                        </>
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

            {/* Detail Penugasan Section */}
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

            {/* Rencana Penugasan Section */}
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

            {/* Tim Project Section */}
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

            {/* Paraf Section */}
            <Card className="mb-4 border-0">
              <strong className='ms-3'>Paraf</strong>
              <Card.Body>
                <Table bordered className="mb-0">
                  <thead>
                    <tr>
                      <th style={{ width: '40%' }}>PEJABAT BERWENANG</th>
                      <th style={{ width: '30%' }}>TANDA TANGAN</th>
                      <th style={{ width: '30%' }}>KETERANGAN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.parafData.map((row, index) => (
                      <tr key={index}>
                        <td>
                          <div style={{ marginBottom: '8px' }}>
                            <strong>{row.pejabat}</strong>
                          </div>
                          
                          {/* Input Nama Pejabat */}
                          <Form.Control
                            type="text"
                            value={row.namaPejabat}
                            onChange={(e) => handleParafChange(index, 'namaPejabat', e.target.value)}
                            placeholder="Nama Pejabat"
                            className="mb-2"
                          />
                          
                          {/* Input Jabatan */}
                          <Form.Control
                            type="text"
                            value={row.jabatan}
                            onChange={(e) => handleParafChange(index, 'jabatan', e.target.value)}
                            placeholder={
                              index === 0 
                                ? "Business Process & Analyst Division Head" 
                                : "Pejabat Berwenang Unit / Pihak yang Terlibat"
                            }
                            className="mb-2 small"
                          />
                          
                          {/* Input Tanggal */}
                          <div className="mt-2">
                            <Form.Control
                              type="date"
                              value={row.tanggal}
                              onChange={(e) => handleParafChange(index, 'tanggal', e.target.value)}
                              placeholder="Tanggal"
                              className="small"
                              style={{ width: '150px' }}
                            />
                          </div>
                        </td>
                        <td className="text-center align-middle">
                          <div 
                            style={{ 
                              height: '80px', 
                              border: '1px dashed #999',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: '#f8f9fa'
                            }}
                          >
                            <span className="text-muted">Area Tanda Tangan</span>
                          </div>
                        </td>
                        <td className="align-middle">
                          <Form.Control
                            as="textarea"
                            rows={3}
                            value={row.keterangan || ''}
                            onChange={(e) => handleParafChange(index, 'keterangan', e.target.value)}
                            placeholder="Keterangan tambahan..."
                            className="small"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Card.Body>
            </Card>

            {/* Approval Section */}
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

            {/* Action Buttons */}
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
                onClick={exportToPDF}
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