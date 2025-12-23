// src/pages/Monitoring.js
import React, { useState, useEffect } from 'react';
import { Container, Card, Badge, Table, Button, Form, Modal, Alert, Spinner, Row, Col, InputGroup, Pagination } from 'react-bootstrap';
import { db } from '../firebase';
import { collection, getDocs, updateDoc, doc, query, where } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { FaFileExcel, FaDownload, FaEdit, FaSyncAlt } from 'react-icons/fa';
import * as XLSX from 'xlsx';

function Monitoring() {
  // Auth
  const { user, canEditProject, getAllActivePICs } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [monitoringData, setMonitoringData] = useState([]);
  const [alert, setAlert] = useState({ show: false, message: '', variant: '' });
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [originalData, setOriginalData] = useState(null);

  const hasChanges = () => {
    if (!originalData || !selectedItem) return false;
    
    // Debug: Tampilkan data untuk comparison
    console.log('🔍 Checking changes...');
    console.log('Original data:', {
      projectDepartments: originalData.projectDepartments,
      keterangan: originalData.keterangan,
      timProjectLength: originalData.timProject?.length,
      tanggalSelesai: originalData.tanggalSelesai,
      status: originalData.status
    });
    
    console.log('Current form data:', {
      projectDepartments: formData.projectDepartments,
      keterangan: formData.keterangan,
      timProjectLength: formData.timProject?.length,
      tanggalSelesai: formData.tanggalSelesai,
      status: formData.status
    });
    
    // 1. Cek perubahan projectDepartments
    const deptChanged = JSON.stringify(originalData.projectDepartments?.sort()) !== 
                        JSON.stringify(formData.projectDepartments?.sort());
    
    // 2. Cek perubahan keterangan
    const keteranganChanged = originalData.keterangan !== formData.keterangan;
    
    // 3. Cek perubahan tanggalSelesai
    const tanggalSelesaiChanged = originalData.tanggalSelesai !== formData.tanggalSelesai;
    
    // 4. Cek perubahan status
    const statusChanged = originalData.status !== formData.status;
    
    // 5. Cek perubahan timProject
    let timProjectChanged = false;
    
    if (originalData.timProject?.length !== formData.timProject?.length) {
      timProjectChanged = true;
    } else {
      // Bandingkan setiap item timProject
      for (let i = 0; i < formData.timProject.length; i++) {
        const originalTim = originalData.timProject[i];
        const currentTim = formData.timProject[i];
        
        if (!originalTim && currentTim) {
          timProjectChanged = true;
          break;
        }
        
        if (originalTim && currentTim) {
          if (originalTim.pic !== currentTim.pic ||
              JSON.stringify(originalTim.outputs?.sort()) !== JSON.stringify(currentTim.outputs?.sort())) {
            timProjectChanged = true;
            break;
          }
        }
      }
    }
    
    const changesExist = deptChanged || keteranganChanged || tanggalSelesaiChanged || timProjectChanged || statusChanged;
    
    console.log('Changes detected:', {
      deptChanged,
      keteranganChanged,
      tanggalSelesaiChanged,
      timProjectChanged,
      statusChanged,
      total: changesExist
    });
    
    return changesExist;
  };
  
  // Tambahkan fungsi ini di bagian helper functions
  const formatProjectDepartmentsForDisplay = (departments) => {
    if (!departments) return 'Tidak ada data';
    
    if (Array.isArray(departments)) {
      return departments.length > 0 ? departments.join(', ') : 'Tidak ada data';
    }
    
    if (typeof departments === 'string') {
      const deptArray = departments.split(/[, ]+/).filter(d => d.trim() !== '');
      return deptArray.length > 0 ? deptArray.join(', ') : 'Tidak ada data';
    }
    
    return 'Format tidak dikenali';
  };

  // State untuk edit output
  const [editingOutputIndex, setEditingOutputIndex] = useState(null);
  
  // State untuk users dari database
  const [allUsers, setAllUsers] = useState([]);
  
  // State untuk modal khusus
  const [showDoneModal, setShowDoneModal] = useState(false);
  const [showDropModal, setShowDropModal] = useState(false);
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [showRevisiModal, setShowRevisiModal] = useState(false);
  const [showRevisiFPPModal, setShowRevisiFPPModal] = useState(false);
  
  // State untuk input modal
  const [doneChecklist, setDoneChecklist] = useState({});
  const [doneChecklistError, setDoneChecklistError] = useState('');
  const [dropAlasan, setDropAlasan] = useState('');
  const [holdAlasan, setHoldAlasan] = useState('');
  const [revisiAlasan, setRevisiAlasan] = useState('');
  
  // State untuk modal Revisi FPP (nomor baru)
  const [revisiFPPData, setRevisiFPPData] = useState({
    noFppBaru: '',
    tanggalRevisi: '',
    alasanRevisi: '',
    keterangan: ''
  });
  
  const checkIfHeadUser = () => {
    if (!user) return false;
    return user.role === 'head' || user.isHead || false;
  };

  // User department
  const [userDepartment, setUserDepartment] = useState('');
  const [isHeadUser, setIsHeadUser] = useState(false);
  
  // Form state untuk edit modal
  const [formData, setFormData] = useState({
    tanggalSelesai: '',
    keterangan: '',
    status: 'In Progress',
    timProject: [],
    projectDepartments: []
  });
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTim, setFilterTim] = useState('');
  const [filterPIC, setFilterPIC] = useState('');
  
  // Pagination
  const [currentPages, setCurrentPages] = useState({
    merah: 1,
    kuning: 1,
    hijau: 1,
    lainnya: 1
  });
  
  const itemsPerPage = 30;
  
  // Data untuk dropdown
  const [availableTim, setAvailableTim] = useState([]);
  const [availablePICs, setAvailablePICs] = useState([]);

  // Define OUTPUT_OPTIONS
  const OUTPUT_OPTIONS = {
    DPA: ['Project Charter', 'BR', 'MEMO Implementasi', 'FSD', 'PIR'],
    PPD: ['Project Charter', 'SK', 'SE', 'IK', 'FORM', 'MEMO', 'CR', 'PIR', 'FSD', 'Matrix'],
    UUD: ['Project Charter', 'UUD', 'Figma', 'PPT', 'Survey'],
    PDM: ['Project Charter', 'Sosialisasi', 'Memo', 'PIR', 'Serah Terima', 'Datamart']
  };

  // Departemen Project yang tersedia
  const PROJECT_DEPARTMENTS = ['PPD', 'DPA', 'UUD', 'PDM'];

  // Checklist options untuk modal Done berdasarkan DEPARTMENT
  const DONE_CHECKLIST_OPTIONS = {
    PPD: [
      { id: 'sk', label: 'SK', type: 'checkbox', hasText: true, textLabel: 'Keterangan SK' },
      { id: 'se', label: 'SE', type: 'checkbox', hasText: true, textLabel: 'Keterangan SE' },
      { id: 'ik', label: 'IK', type: 'checkbox', hasText: true, textLabel: 'Keterangan IK' },
      { id: 'form', label: 'FORM', type: 'checkbox', hasText: true, textLabel: 'Keterangan FORM' },
      { id: 'memo', label: 'MEMO', type: 'checkbox', hasText: true, textLabel: 'Keterangan MEMO' },
      { id: 'cr', label: 'CR', type: 'checkbox', hasText: true, textLabel: 'Keterangan CR' },
      { id: 'pir_st', label: 'PIR/ST', type: 'checkbox', hasText: true, textLabel: 'Keterangan PIR/ST' }
    ],
    DPA: [
      { id: 'br', label: 'BR', type: 'checkbox', hasText: true, textLabel: 'Keterangan BR' },
      { id: 'fsd', label: 'FSD', type: 'checkbox', hasText: true, textLabel: 'Keterangan FSD' },
      { id: 'memo', label: 'MEMO', type: 'checkbox', hasText: true, textLabel: 'Keterangan MEMO' },
      { id: 'pir_st', label: 'PIR/ST', type: 'checkbox', hasText: true, textLabel: 'Keterangan PIR/ST' }
    ],
    PDM: [
      { id: 'sosialisasi', label: 'Sosialisasi', type: 'checkbox', hasText: true, textLabel: 'Keterangan Sosialisasi' },
      { id: 'ik', label: 'IK', type: 'checkbox', hasText: true, textLabel: 'Keterangan IK' },
      { id: 'mom', label: 'MOM', type: 'checkbox', hasText: true, textLabel: 'Keterangan MOM' },
      { id: 'pir', label: 'PIR', type: 'checkbox', hasText: true, textLabel: 'Keterangan PIR' },
      { id: 'datamart', label: 'Datamart', type: 'checkbox', hasText: true, textLabel: 'Keterangan Datamart' },
      { id: 'memo', label: 'Memo', type: 'checkbox', hasText: true, textLabel: 'Keterangan Memo' }
    ],
    UUD: [
      { id: 'figma', label: 'Figma', type: 'checkbox', hasText: true, textLabel: 'Link/Keterangan Figma' },
      { id: 'ppt', label: 'PPT', type: 'checkbox', hasText: true, textLabel: 'Link/Keterangan PPT' },
      { id: 'survey', label: 'Survey', type: 'checkbox', hasText: true, textLabel: 'Link/Keterangan Survey' }
    ]
  };


  // Kemudian di useEffect:
  useEffect(() => {
    fetchMonitoringData();
    fetchAllUsers();
    
    if (user) {
      const userDept = user.unit || user.tim || '';
      setUserDepartment(userDept.toUpperCase());
      
      // Cek apakah user adalah head
      const isHead = checkIfHeadUser();
      setIsHeadUser(isHead);
    }
  }, [user]);

  // ========== FUNGSI UNTUK CEK AKSES EDIT ==========
  
  const canUserEditItem = (item) => {
    // 1. Cek apakah user adalah head (password inputmaster)
    // Gunakan checkIfHeadUser() langsung daripada state isHeadUser
    if (checkIfHeadUser()) {
      return true;
    }
    
    // 2. Cek apakah user terlibat dalam project berdasarkan department
    const userDeptUpper = userDepartment.toUpperCase();
    
    // Jika user dari department yang sama dengan PIC utama
    if (item.department && item.department.toUpperCase() === userDeptUpper) {
      return true;
    }
    
    // Cek di timProject
    if (item.timProject && Array.isArray(item.timProject)) {
      const isInvolved = item.timProject.some(tim => {
        // Cek department di tim project
        if (tim.department && tim.department.toUpperCase() === userDeptUpper) {
          return true;
        }
        
        // Cek berdasarkan nama PIC
        if (tim.pic) {
          const userFromDB = allUsers.find(u => 
            u.nama && u.nama.toLowerCase() === tim.pic.toLowerCase()
          );
          
          if (userFromDB && userFromDB.unit) {
            const picDept = userFromDB.unit.toUpperCase();
            return picDept === userDeptUpper;
          }
        }
        
        return false;
      });
      
      if (isInvolved) {
        return true;
      }
    }
    
    return false;
  };

  const fetchMonitoringData = async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, 'fpp_monitoring'));
      const allData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Sort by createdAt descending
      allData.sort((a, b) => {
        let dateA = new Date(0);
        let dateB = new Date(0);
        
        if (a.createdAt) {
          if (typeof a.createdAt.toDate === 'function') {
            dateA = a.createdAt.toDate();
          } else if (typeof a.createdAt === 'string') {
            dateA = new Date(a.createdAt);
          }
        }
        
        if (b.createdAt) {
          if (typeof b.createdAt.toDate === 'function') {
            dateB = b.createdAt.toDate();
          } else if (typeof b.createdAt === 'string') {
            dateB = new Date(b.createdAt);
          }
        }
        
        return dateB - dateA;
      });

      // Filter data berdasarkan akses user
      let filteredData = allData;
      if (!isHeadUser && userDepartment) {
        filteredData = allData.filter(item => canUserEditItem(item));
      }
      
      setMonitoringData(filteredData);
      
      // Extract unique Tim untuk filter
      const timList = [...new Set(filteredData.map(item => item.department).filter(Boolean))].sort();
      setAvailableTim(timList);
      
      // Extract unique PICs untuk filter
      const pics = [...new Set(filteredData.map(item => item.pic).filter(Boolean))].sort();
      setAvailablePICs(pics);
      
    } catch (error) {
      console.error('Error fetching monitoring data:', error);
      showAlert('Error mengambil data: ' + error.message, 'danger');
    }
    setLoading(false);
  };

  const fetchAllUsers = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'users'));
      const usersList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      usersList.sort((a, b) => (a.nama || '').localeCompare(b.nama || ''));
      setAllUsers(usersList);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const findLastTargetDate = (rencanaPenugasan) => {
    if (!rencanaPenugasan || rencanaPenugasan.length === 0) return null;
    
    const validDates = rencanaPenugasan
      .filter(item => item.tglTarget)
      .map(item => {
        if (typeof item.tglTarget === 'string') {
          return new Date(item.tglTarget);
        } else if (item.tglTarget && typeof item.tglTarget.toDate === 'function') {
          return item.tglTarget.toDate();
        }
        return null;
      })
      .filter(date => date && !isNaN(date.getTime()));
    
    if (validDates.length === 0) return null;
    
    const lastDate = new Date(Math.max(...validDates.map(d => d.getTime())));
    return lastDate;
  };

  const calculateRemainingDays = (approvalDate, targetDate) => {
    if (!approvalDate || !targetDate) return null;
    
    const approval = approvalDate && typeof approvalDate.toDate === 'function' 
      ? approvalDate.toDate() 
      : new Date(approvalDate);
    
    const target = targetDate && typeof targetDate.toDate === 'function'
      ? targetDate.toDate()
      : new Date(targetDate);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (isNaN(approval.getTime()) || isNaN(target.getTime())) {
      return null;
    }
    
    const totalDays = Math.ceil((target - approval) / (1000 * 60 * 60 * 24));
    const remainingDays = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
    
    return { totalDays, remainingDays, targetDate: target, today };
  };

  const calculateDaysFromApproveToFinish = (approvalDate, finishDate) => {
    if (!approvalDate || !finishDate) return null;
    
    const approval = approvalDate && typeof approvalDate.toDate === 'function'
      ? approvalDate.toDate()
      : new Date(approvalDate);
    
    const finish = finishDate && typeof finishDate.toDate === 'function'
      ? finishDate.toDate()
      : new Date(finishDate);
    
    if (isNaN(approval.getTime()) || isNaN(finish.getTime())) {
      return null;
    }
    
    const daysDifference = Math.ceil((finish - approval) / (1000 * 60 * 60 * 24));
    return daysDifference;
  };

  const getBadgeColor = (remainingDays, totalDays) => {
    if (remainingDays === null) return 'secondary';
    
    if (remainingDays <= 3) return 'danger';
    
    const fiftyPercent = totalDays * 0.5;
    if (remainingDays <= fiftyPercent) return 'warning';
    
    return 'success';
  };

  const getAchievementStatus = (tanggalSelesai, targetDate) => {
    if (!tanggalSelesai || !targetDate) return null;
    
    const selesai = tanggalSelesai && typeof tanggalSelesai.toDate === 'function'
      ? tanggalSelesai.toDate()
      : new Date(tanggalSelesai);
    
    const target = targetDate && typeof targetDate.toDate === 'function'
      ? targetDate.toDate()
      : new Date(targetDate);
    
    if (isNaN(selesai.getTime()) || isNaN(target.getTime())) {
      return null;
    }
    
    if (selesai <= target) {
      return { status: 'Achieve', variant: 'success' };
    } else {
      return { status: 'Not Achieve', variant: 'danger' };
    }
  };

  // Fungsi untuk mendapatkan warna monitoring (untuk Excel)
  const getMonitoringColor = (item) => {
    const targetDate = findLastTargetDate(item.rencanaPenugasan);
    const statusBadge = getStatusBadgeInfo(item);
    const currentStatus = statusBadge.text;
    
    // Jika bukan In Progress, return "Abu-abu"
    if (currentStatus !== 'In Progress') {
      return 'Abu-abu';
    }
    
    if (!targetDate) {
      return 'Abu-abu';
    }
    
    if (item.tanggalSelesai) {
      const achievement = getAchievementStatus(item.tanggalSelesai, targetDate);
      if (achievement && achievement.status === 'Achieve') {
        return 'Hijau';
      } else {
        return 'Merah';
      }
    }
    
    const calculation = calculateRemainingDays(item.approvalDate, targetDate);
    
    if (!calculation) {
      return 'Abu-abu';
    }
    
    const { remainingDays, totalDays } = calculation;
    
    if (remainingDays <= 3) {
      return 'Merah';
    } else {
      const fiftyPercent = totalDays * 0.5;
      if (remainingDays <= fiftyPercent) {
        return 'Kuning';
      } else {
        return 'Hijau';
      }
    }
  };

  const applyFilters = () => {
    let filtered = [...monitoringData];

    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      filtered = filtered.filter(item => {
        const judulFpp = (item.judulFpp || '').toLowerCase();
        const noFpp = (item.noFpp || '').toLowerCase();
        const department = (item.department || '').toLowerCase();
        const masterProjectNumber = (item.masterProjectNumber || '').toLowerCase();
        return judulFpp.includes(searchLower) || 
               noFpp.includes(searchLower) ||
               department.includes(searchLower) ||
               masterProjectNumber.includes(searchLower);
      });
    }

    if (filterTim) {
      filtered = filtered.filter(item => 
        item.department && item.department.toLowerCase() === filterTim.toLowerCase()
      );
    }

    if (filterPIC) {
      filtered = filtered.filter(item => 
        item.pic && item.pic.toLowerCase() === filterPIC.toLowerCase()
      );
    }

    return filtered;
  };

  const showAlert = (message, variant) => {
    setAlert({ show: true, message, variant });
    setTimeout(() => {
      setAlert({ show: false, message: '', variant: '' });
    }, 3000);
  };

  const renderMonitoringCell = (item) => {
    const targetDate = findLastTargetDate(item.rencanaPenugasan);
    const statusBadge = getStatusBadgeInfo(item);
    
    // 1. Jika project sudah SELESAI (ada tanggal selesai), hitung dari approval ke selesai
    if (item.tanggalSelesai && item.approvalDate) {
      const daysFromApproveToFinish = calculateDaysFromApproveToFinish(item.approvalDate, item.tanggalSelesai);
      
      if (daysFromApproveToFinish !== null) {
        return (
          <div className="d-flex flex-column">
            <div className="text-primary fw-bold">
              {daysFromApproveToFinish} hari
            </div>
            <div className="text-muted small">
              {formatDate(item.approvalDate)} → {formatDate(item.tanggalSelesai)}
            </div>
          </div>
        );
      }
    }
    
    // 2. Jika project masih IN PROGRESS (tanpa tanggal selesai), hitung sisa waktu ke target
    if (targetDate && item.approvalDate && !item.tanggalSelesai) {
      const calculation = calculateRemainingDays(item.approvalDate, targetDate);
      
      if (calculation) {
        const { remainingDays, totalDays } = calculation;
        const badgeColor = getBadgeColor(remainingDays, totalDays);
        
        let displayText = '';
        if (remainingDays > 0) {
          displayText = `${remainingDays} hari lagi`;
        } else if (remainingDays === 0) {
          displayText = 'Hari ini';
        } else {
          displayText = `Terlambat ${Math.abs(remainingDays)} hari`;
        }
        
        return (
          <div className="d-flex flex-column">
            <Badge bg={badgeColor} className="mb-1">
              {displayText}
            </Badge>
            <div className="text-muted small">
              Target: {formatDate(targetDate)}
            </div>
          </div>
        );
      }
    }
    
    // 3. Fallback: jika data tidak lengkap
    return (
      <div className="d-flex flex-column">
        <Badge bg="secondary" className="mb-1">
          {statusBadge.text}
        </Badge>
        <div className="text-muted small">
          {!item.approvalDate && 'Belum approval'}
          {!targetDate && !item.approvalDate && ' | '}
          {!targetDate && 'Belum target'}
        </div>
      </div>
    );
  };

  const getStatusBadgeInfo = (item) => {
    let status = item.status;
    
    if (!status || status === 'submitted') {
      status = 'In Progress';
    }
    
    if (item.tanggalSelesai && status === 'In Progress') {
      status = 'Done';
    }
    
    const badgeConfig = {
      'In Progress': { color: 'primary', text: 'In Progress' },
      'Drop': { color: 'danger', text: 'Drop' },
      'Hold': { color: 'warning', text: 'Hold' },
      'Done': { color: 'success', text: 'Done' },
      'Revisi FPP': { color: 'info', text: 'Revisi FPP' }
    };
    
    return badgeConfig[status] || { color: 'primary', text: status };
  };

  const renderMonitoringText = (item) => {
    return renderMonitoringCell(item);
  };

  const groupDataByMonitoringColor = (data) => {
    const merah = [];
    const kuning = [];
    const hijau = [];
    const lainnya = [];
    
    data.forEach(item => {
      const statusBadge = getStatusBadgeInfo(item);
      const currentStatus = statusBadge.text;
      
      if (currentStatus !== 'In Progress') {
        lainnya.push(item);
        return;
      }
      
      const targetDate = findLastTargetDate(item.rencanaPenugasan);
      
      if (!targetDate) {
        lainnya.push(item);
        return;
      }
      
      if (item.tanggalSelesai) {
        const achievement = getAchievementStatus(item.tanggalSelesai, targetDate);
        if (achievement && achievement.status === 'Achieve') {
          hijau.push(item);
        } else {
          merah.push(item);
        }
        return;
      }
      
      const calculation = calculateRemainingDays(item.approvalDate, targetDate);
      
      if (!calculation) {
        lainnya.push(item);
        return;
      }
      
      const { remainingDays, totalDays } = calculation;
      
      if (remainingDays <= 3) {
        merah.push(item);
      } else {
        const fiftyPercent = totalDays * 0.5;
        if (remainingDays <= fiftyPercent) {
          kuning.push(item);
        } else {
          hijau.push(item);
        }
      }
    });
    
    return { merah, kuning, hijau, lainnya };
  };

  const formatDate = (dateValue) => {
    if (!dateValue) return '-';
    
    try {
      let date;
      if (dateValue && typeof dateValue.toDate === 'function') {
        date = dateValue.toDate();
      } else if (typeof dateValue === 'string') {
        date = new Date(dateValue);
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
      console.error('Error formatting date:', dateValue, error);
      return '-';
    }
  };

  const formatDateForExcel = (dateValue) => {
    if (!dateValue) return '';
    
    try {
      let date;
      if (dateValue && typeof dateValue.toDate === 'function') {
        date = dateValue.toDate();
      } else if (typeof dateValue === 'string') {
        date = new Date(dateValue);
      } else {
        date = new Date(dateValue);
      }
      
      if (isNaN(date.getTime())) return '';
      
      return date.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });
    } catch (error) {
      console.error('Error formatting date for Excel:', dateValue, error);
      return '';
    }
  };

  const getAllAvailablePICs = () => {
    const activeUsers = allUsers.filter(user => 
      (user.status === 'Active' || user.status === 'active' || !user.status) && 
      user.nama && 
      user.nama.trim() !== ''
    );
    
    const uniquePICs = [...new Set(activeUsers.map(user => user.nama.trim()))];
    return uniquePICs.sort();
  };

  // ========== FUNGSI EXPORT TO EXCEL ==========
  
  const exportToExcel = () => {
    const filteredData = applyFilters();
    const groupedData = groupDataByMonitoringColor(filteredData);
    
    if (filteredData.length === 0) {
      showAlert('Tidak ada data untuk diexport!', 'warning');
      return;
    }

    try {
      // Gabungkan semua data dari semua kelompok
      const allData = [
        ...groupedData.merah,
        ...groupedData.kuning,
        ...groupedData.hijau,
        ...groupedData.lainnya
      ];

      // Siapkan data untuk Excel
      const excelData = allData.map(item => {
        // Hitung monitoring info untuk kolom durasi
        let monitoringText = '';
        let durasi = '';
        
        if (item.tanggalSelesai && item.approvalDate) {
          const daysFromApproveToFinish = calculateDaysFromApproveToFinish(item.approvalDate, item.tanggalSelesai);
          if (daysFromApproveToFinish !== null) {
            durasi = `${daysFromApproveToFinish} hari`;
            monitoringText = `${formatDateForExcel(item.approvalDate)} → ${formatDateForExcel(item.tanggalSelesai)}`;
          }
        } else if (item.approvalDate) {
          const targetDate = findLastTargetDate(item.rencanaPenugasan);
          if (targetDate) {
            const calculation = calculateRemainingDays(item.approvalDate, targetDate);
            if (calculation) {
              const { remainingDays } = calculation;
              if (remainingDays > 0) {
                durasi = `${remainingDays} hari lagi`;
              } else if (remainingDays === 0) {
                durasi = 'Hari ini';
              } else {
                durasi = `Terlambat ${Math.abs(remainingDays)} hari`;
              }
              monitoringText = `Target: ${formatDateForExcel(targetDate)}`;
            }
          }
        }

        // Format rencana penugasan
        const rencanaPenugasanText = item.rencanaPenugasan?.length > 0 ?
          item.rencanaPenugasan.map(rencana => 
            `${rencana.keterangan || '-'}: ${formatDateForExcel(rencana.tglTarget)}`
          ).join('; ') : '-';

        // Format tim project
        const timProjectText = item.timProject?.length > 0 ?
          item.timProject.map(tim => 
            `${tim.department || '-'} - ${tim.tim || '-'}: ${tim.pic || tim.nama || '-'} (${(tim.outputs || []).join(', ') || '-'})`
          ).join('; ') : '-';

        // Format checklist items
        const checklistItems = item.doneChecklist?.items ? 
          Object.entries(item.doneChecklist.items)
            .filter(([key, checklistItem]) => checklistItem.checked)
            .map(([key, checklistItem]) => `${key}: ${checklistItem.textValue || '-'}`)
            .join('; ') : '-';

        return {
          // Basic Info
          'No Project/Induk FPP': item.masterProjectNumber || '-',
          'No FPP': item.noFpp || '-',
          'Judul FPP': item.judulFpp || '-',
          'Department': item.department || '-',
          'TIM': item.tim || '-',
          'PIC': item.pic || '-',
          'Departemen Project': item.projectDepartments?.join(', ') || '-',
          'Jenis Project': item.jenisProjectResolved || item.jenisProject || '-',
          'PIR Type': item.pirType || '-',
          'Status': getStatusBadgeInfo(item).text,
          'Warna Monitoring': getMonitoringColor(item),
          
          // Dates
          'Tanggal Approval': formatDateForExcel(item.approvalDate),
          'Tanggal Selesai': formatDateForExcel(item.tanggalSelesai),
          'Durasi': durasi,
          'Monitoring Info': monitoringText,
          
          // Target Dates dari Rencana Penugasan
          'Rencana Penugasan': rencanaPenugasanText,
          
          // Team Info
          'Tim Project': timProjectText,
          
          // Additional Info
          'Keterangan': item.keterangan || '-',
          'Unit Kerja Terkait': item.unitKerjaTerkait || '-',
          
          // Done Checklist Info
          'Done Checklist Department': item.doneChecklist?.department || '-',
          'Done Checklist Items': checklistItems,
          'Done Checklist Submitted By': item.doneChecklist?.submittedBy || '-',
          'Done Checklist Submitted At': formatDateForExcel(item.doneChecklist?.submittedAt),
          
          // Other Status Reasons
          'Alasan Drop': item.dropAlasan || '-',
          'Alasan Hold': item.holdAlasan || '-',
          'Alasan Revisi FPP': item.revisiAlasan || '-',
          
          // Metadata
          'Created At': formatDateForExcel(item.createdAt),
          'Updated At': formatDateForExcel(item.updatedAt)
        };
      });

      // Create worksheet
      const ws = XLSX.utils.json_to_sheet(excelData);
      
      // Set column widths
      const wscols = [
        { wch: 20 }, // No Project/Induk FPP
        { wch: 15 }, // No FPP
        { wch: 40 }, // Judul FPP
        { wch: 10 }, // Department
        { wch: 10 }, // TIM
        { wch: 20 }, // PIC
        { wch: 20 }, // Departemen Project
        { wch: 20 }, // Jenis Project
        { wch: 10 }, // PIR Type
        { wch: 15 }, // Status
        { wch: 15 }, // Warna Monitoring
        { wch: 15 }, // Tanggal Approval
        { wch: 15 }, // Tanggal Selesai
        { wch: 15 }, // Durasi
        { wch: 30 }, // Monitoring Info
        { wch: 50 }, // Rencana Penugasan
        { wch: 50 }, // Tim Project
        { wch: 30 }, // Keterangan
        { wch: 20 }, // Unit Kerja Terkait
        { wch: 15 }, // Done Checklist Department
        { wch: 50 }, // Done Checklist Items
        { wch: 20 }, // Done Checklist Submitted By
        { wch: 15 }, // Done Checklist Submitted At
        { wch: 30 }, // Alasan Drop
        { wch: 30 }, // Alasan Hold
        { wch: 30 }, // Alasan Revisi FPP
        { wch: 15 }, // Created At
        { wch: 15 }  // Updated At
      ];
      ws['!cols'] = wscols;

      // Create workbook
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Monitoring Data");

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const filename = `Monitoring_Export_${timestamp}.xlsx`;

      // Save file
      XLSX.writeFile(wb, filename);
      
      showAlert(`Data berhasil diexport ke ${filename}`, 'success');
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      showAlert('Error saat mengeksport data ke Excel: ' + error.message, 'danger');
    }
  };

  // ========== FUNGSI UNTUK MODAL ==========
  
  const initializeDoneChecklist = () => {
    if (!userDepartment || !selectedItem) return;
    
    const departmentKey = userDepartment.toUpperCase();
    const checklistOptions = DONE_CHECKLIST_OPTIONS[departmentKey] || [];
    
    const initialChecklist = {};
    checklistOptions.forEach(item => {
      initialChecklist[item.id] = {
        checked: false,
        textValue: ''
      };
    });
    
    setDoneChecklist(initialChecklist);
    setDoneChecklistError('');
  };

  const handleChecklistChange = (id, checked) => {
    setDoneChecklist(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        checked
      }
    }));
  };

  const handleChecklistTextChange = (id, value) => {
    setDoneChecklist(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        textValue: value
      }
    }));
  };

  const validateDoneChecklist = () => {
    const hasChecked = Object.values(doneChecklist).some(item => item.checked);
    
    if (!hasChecked) {
      setDoneChecklistError('Minimal pilih satu checklist untuk menyelesaikan project.');
      return false;
    }
    
    setDoneChecklistError('');
    return true;
  };

  const handleSubmitDoneStatus = async () => {
    if (!validateDoneChecklist()) {
      return;
    }
    
    setLoading(true);
    try {
      const updateData = {
        tanggalSelesai: formData.tanggalSelesai || new Date().toISOString().split('T')[0],
        keterangan: formData.keterangan || '',
        status: 'Done',
        timProject: formData.timProject,
        projectDepartments: formData.projectDepartments,
        doneChecklist: {
          department: userDepartment,
          items: doneChecklist,
          submittedAt: new Date(),
          submittedBy: user?.pic || user?.nama || 'Unknown'
        },
        updatedAt: new Date()
      };
      
      const docRef = doc(db, 'fpp_monitoring', selectedItem.id);
      await updateDoc(docRef, updateData);
      
      showAlert('Status berhasil diupdate ke Done! Checklist tersimpan.', 'success');
      setShowDoneModal(false);
      setDoneChecklist({});
      fetchMonitoringData();
    } catch (error) {
      console.error('Error updating to Done:', error);
      showAlert('Error update: ' + error.message, 'danger');
    }
    setLoading(false);
  };

  const handleSubmitDropStatus = async () => {
    if (!dropAlasan.trim()) {
      showAlert('Harap isi alasan Drop', 'warning');
      return;
    }
    
    setLoading(true);
    try {
      const updateData = {
        status: 'Drop',
        dropAlasan: dropAlasan,
        updatedAt: new Date()
      };
      
      const docRef = doc(db, 'fpp_monitoring', selectedItem.id);
      await updateDoc(docRef, updateData);
      
      showAlert('Status berhasil diupdate ke Drop!', 'success');
      setShowDropModal(false);
      setDropAlasan('');
      fetchMonitoringData();
    } catch (error) {
      console.error('Error updating to Drop:', error);
      showAlert('Error update: ' + error.message, 'danger');
    }
    setLoading(false);
  };

  const handleSubmitHoldStatus = async () => {
    if (!holdAlasan.trim()) {
      showAlert('Harap isi alasan Hold', 'warning');
      return;
    }
    
    setLoading(true);
    try {
      const updateData = {
        status: 'Hold',
        holdAlasan: holdAlasan,
        updatedAt: new Date()
      };
      
      const docRef = doc(db, 'fpp_monitoring', selectedItem.id);
      await updateDoc(docRef, updateData);
      
      showAlert('Status berhasil diupdate ke Hold!', 'success');
      setShowHoldModal(false);
      setHoldAlasan('');
      fetchMonitoringData();
    } catch (error) {
      console.error('Error updating to Hold:', error);
      showAlert('Error update: ' + error.message, 'danger');
    }
    setLoading(false);
  };

  const handleSubmitRevisiStatus = async () => {
    if (!revisiAlasan.trim()) {
      showAlert('Harap isi alasan Revisi FPP', 'warning');
      return;
    }
    
    setLoading(true);
    try {
      const updateData = {
        status: 'Revisi FPP',
        revisiAlasan: revisiAlasan,
        updatedAt: new Date()
      };
      
      const docRef = doc(db, 'fpp_monitoring', selectedItem.id);
      await updateDoc(docRef, updateData);
      
      showAlert('Status berhasil diupdate ke Revisi FPP!', 'success');
      setShowRevisiModal(false);
      setRevisiAlasan('');
      fetchMonitoringData();
    } catch (error) {
      console.error('Error updating to Revisi FPP:', error);
      showAlert('Error update: ' + error.message, 'danger');
    }
    setLoading(false);
  };

  // ========== FUNGSI UNTUK REVISI FPP (GANTI NOMOR) ==========
  
  const handleOpenRevisiFPPModal = (item) => {
    // Cek apakah user boleh melakukan revisi FPP
    if (!canUserEditItem(item)) {
      showAlert('Anda tidak memiliki akses untuk merevisi FPP ini.', 'warning');
      return;
    }
    
    setSelectedItem(item);
    
    // Set default data untuk modal revisi FPP
    const today = new Date().toISOString().split('T')[0];
    setRevisiFPPData({
      noFppBaru: item.noFpp || '',
      tanggalRevisi: today,
      alasanRevisi: item.revisiAlasan || '',
      keterangan: item.keterangan || ''
    });
    
    setShowRevisiFPPModal(true);
  };
  const handleSubmitRevisiFPP = async () => {
    if (!revisiFPPData.noFppBaru.trim()) {
      showAlert('Harap isi nomor FPP baru', 'warning');
      return;
    }
    
    if (!revisiFPPData.tanggalRevisi) {
      showAlert('Harap pilih tanggal revisi', 'warning');
      return;
    }
    
    if (!revisiFPPData.alasanRevisi.trim()) {
      showAlert('Harap isi alasan revisi FPP', 'warning');
      return;
    }
    
    setLoading(true);
    try {
      // Cek apakah nomor FPP baru sudah digunakan
      const fppCheckQuery = query(
        collection(db, 'fpp_monitoring'),
        where('noFpp', '==', revisiFPPData.noFppBaru)
      );
      const fppCheckSnapshot = await getDocs(fppCheckQuery);
      
      if (!fppCheckSnapshot.empty) {
        const existingDoc = fppCheckSnapshot.docs[0];
        if (existingDoc.id !== selectedItem.id) {
          showAlert(`No FPP "${revisiFPPData.noFppBaru}" sudah digunakan oleh FPP lain!`, 'danger');
          setLoading(false);
          return;
        }
      }
      
      const updateData = {
        noFpp: revisiFPPData.noFppBaru,
        status: 'Revisi FPP',
        revisiAlasan: revisiFPPData.alasanRevisi,
        tanggalRevisi: revisiFPPData.tanggalRevisi,
        keterangan: revisiFPPData.keterangan,
        updatedAt: new Date()
      };
      
      const docRef = doc(db, 'fpp_monitoring', selectedItem.id);
      await updateDoc(docRef, updateData);
      
      showAlert('Revisi FPP berhasil! Nomor FPP telah diperbarui.', 'success');
      setShowRevisiFPPModal(false);
      setRevisiFPPData({
        noFppBaru: '',
        tanggalRevisi: '',
        alasanRevisi: '',
        keterangan: ''
      });
      
      fetchMonitoringData();
    } catch (error) {
      console.error('Error updating FPP revision:', error);
      showAlert('Error update: ' + error.message, 'danger');
    }
    setLoading(false);
  };

  // Tambahkan fungsi ini untuk debug data Firestore
  const debugFirestoreData = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'fpp_monitoring'));
      const allData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      console.log('=== DEBUG FIRESTORE DATA ===');
      allData.forEach(item => {
        console.log(`Item: ${item.noFpp || item.judulFpp}`);
        console.log('projectDepartments:', {
          raw: item.projectDepartments,
          type: typeof item.projectDepartments,
          isArray: Array.isArray(item.projectDepartments),
          value: item.projectDepartments
        });
        console.log('---');
      });
    } catch (error) {
      console.error('Debug error:', error);
    }
  };

// Panggil di useEffect atau buat tombol untuk debug
// useEffect(() => {
//   debugFirestoreData();
// }, []);

  const handleOpenEditModal = (item) => {
    // Cek apakah user boleh mengedit project ini
    if (!canUserEditItem(item)) {
      showAlert('Anda tidak memiliki akses untuk mengedit project ini. Hanya user dari department terkait yang dapat mengedit.', 'warning');
      return;
    }
    
    console.log('Opening edit modal for:', item.noFpp);
    console.log('Raw projectDepartments from database:', item.projectDepartments);
    
    const itemStatus = item.status === 'submitted' ? 'In Progress' : item.status || 'In Progress';
    
    // Format tanggal untuk input type="date"
    const formatDateForInput = (dateValue) => {
      if (!dateValue) return '';
      
      try {
        let date;
        if (dateValue && typeof dateValue.toDate === 'function') {
          date = dateValue.toDate();
        } else {
          date = new Date(dateValue);
        }
        
        if (isNaN(date.getTime())) return '';
        
        return date.toISOString().split('T')[0];
      } catch (error) {
        console.error('Error formatting date for input:', error);
        return '';
      }
    };
    
    // Handle timProject data structure
    const timProjectData = Array.isArray(item.timProject) && item.timProject.length > 0 
      ? item.timProject.map(tim => ({
          department: tim.department || item.department || '',
          tim: tim.tim || item.tim || '',
          pic: tim.pic || tim.nama || '',
          peran: tim.peran || '',
          outputs: Array.isArray(tim.outputs) ? tim.outputs : []
        }))
      : [{ 
          department: item.department || '',
          tim: item.tim || '',
          pic: item.pic || '', 
          peran: '', 
          outputs: [] 
        }];
    
    // Handle projectDepartments
    let projectDepartmentsData = [];
    
    if (item.projectDepartments) {
      if (Array.isArray(item.projectDepartments)) {
        projectDepartmentsData = item.projectDepartments
          .filter(dept => dept && dept.trim() !== '')
          .map(dept => dept.trim().toUpperCase());
      } else if (typeof item.projectDepartments === 'string') {
        projectDepartmentsData = item.projectDepartments
          .split(/[,]/)
          .map(dept => dept.trim().toUpperCase())
          .filter(dept => dept !== '');
      }
    }
    
    // Format tanggalSelesai dari database
    const tanggalSelesaiFromDB = formatDateForInput(item.tanggalSelesai);
    
    const modalFormData = {
      tanggalSelesai: tanggalSelesaiFromDB,
      keterangan: item.keterangan || '',
      status: itemStatus, // Pastikan status juga disertakan
      timProject: timProjectData,
      projectDepartments: projectDepartmentsData
    };
    
    // ✅ SET ORIGINAL DATA untuk comparison - TAMBAHKAN STATUS
    setOriginalData({
      projectDepartments: [...projectDepartmentsData],
      keterangan: item.keterangan || '',
      timProject: JSON.parse(JSON.stringify(timProjectData)),
      tanggalSelesai: tanggalSelesaiFromDB,
      status: itemStatus // ✅ TAMBAHKAN INI
    });
    
    setSelectedItem(item);
    setFormData(modalFormData);
    setEditingOutputIndex(null);
    setShowEditModal(true);
  };

  const handleTimProjectChange = (index, field, value) => {
    const newTimProject = [...formData.timProject];
    
    if (!newTimProject[index]) {
      newTimProject[index] = { 
        department: selectedItem?.department || '',
        tim: selectedItem?.tim || '',
        pic: '', 
        peran: '', 
        outputs: [] 
      };
    }
    
    newTimProject[index][field] = value;
    
    setFormData(prev => ({
      ...prev,
      timProject: newTimProject
    }));
  };

  const handleOutputChange = (timIndex, output, checked) => {
    const newTimProject = [...formData.timProject];
    if (!newTimProject[timIndex]) {
      newTimProject[timIndex] = { outputs: [] };
    }
    if (!newTimProject[timIndex].outputs) {
      newTimProject[timIndex].outputs = [];
    }
    
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

  const handleProjectDepartmentChange = (dept, isChecked) => {
    setFormData(prev => {
      const deptUpper = dept.toUpperCase();
      
      if (isChecked) {
        // Cek apakah sudah ada (case insensitive)
        const alreadyExists = prev.projectDepartments.some(
          existingDept => existingDept.toUpperCase() === deptUpper
        );
        
        if (!alreadyExists) {
          return {
            ...prev,
            projectDepartments: [...prev.projectDepartments, dept]
          };
        }
        return prev;
      } else {
        return {
          ...prev,
          projectDepartments: prev.projectDepartments.filter(
            d => d.toUpperCase() !== deptUpper
          )
        };
      }
    });
  };

  const handleStatusChange = (e) => {
    const newStatus = e.target.value;
    
    // ✅ PERBAIKAN: Hanya validasi tanggal selesai jika mengubah status DARI "In Progress"
    const isChangingFromInProgress = formData.status === 'In Progress';
    
    if (isChangingFromInProgress && newStatus !== 'In Progress' && !formData.tanggalSelesai) {
      showAlert('Harap isi tanggal selesai terlebih dahulu sebelum mengubah status', 'warning');
      return;
    }
    
    setFormData(prev => ({ ...prev, status: newStatus }));
    
    // Buka modal sesuai status
    if (newStatus === 'Done') {
      initializeDoneChecklist();
      setShowDoneModal(true);
    } else if (newStatus === 'Drop') {
      setShowDropModal(true);
    } else if (newStatus === 'Hold') {
      setShowHoldModal(true);
    } else if (newStatus === 'Revisi FPP') {
      setShowRevisiModal(true);
    }
  };

  const handleSubmitUpdate = async () => {
    // ✅ PERBAIKAN: Validasi berdasarkan perubahan, bukan hanya tanggal selesai
    const changes = hasChanges();
    
    if (!changes) {
      showAlert('Tidak ada perubahan yang disimpan.', 'info');
      return;
    }
    
    // ✅ PERBAIKAN: Hanya wajibkan tanggal selesai jika mengubah status dari "In Progress"
    if (formData.status !== 'In Progress' && !formData.tanggalSelesai) {
      showAlert('Harap isi tanggal selesai untuk status ' + formData.status, 'warning');
      return;
    }
    
    // ✅ PERBAIKAN: Jika status tetap "In Progress" tapi ada perubahan lainnya, tetap boleh simpan
    setLoading(true);
    try {
      // Data yang akan diupdate
      const updateData = {
        // ✅ Tanggal selesai hanya diupdate jika diisi
        ...(formData.tanggalSelesai && { tanggalSelesai: formData.tanggalSelesai }),
        
        // ✅ Selalu update keterangan jika ada perubahan
        keterangan: formData.keterangan || '',
        
        // ✅ Selalu update status
        status: formData.status,
        
        // ✅ Selalu update timProject dan projectDepartments jika ada perubahan
        timProject: formData.timProject,
        projectDepartments: formData.projectDepartments,
        updatedAt: new Date()
      };
      
      // Jika status berubah ke "Drop", "Hold", atau "Revisi FPP", tambahkan alasan
      if (formData.status === 'Drop' && dropAlasan) {
        updateData.dropAlasan = dropAlasan;
      } else if (formData.status === 'Hold' && holdAlasan) {
        updateData.holdAlasan = holdAlasan;
      } else if (formData.status === 'Revisi FPP' && revisiAlasan) {
        updateData.revisiAlasan = revisiAlasan;
      }
      
      console.log('🔄 Updating data:', updateData);
      
      const docRef = doc(db, 'fpp_monitoring', selectedItem.id);
      await updateDoc(docRef, updateData);
      
      showAlert(`Perubahan berhasil disimpan! Status: ${formData.status}`, 'success');
      
      // Reset semua modal
      setShowEditModal(false);
      setShowDoneModal(false);
      setShowDropModal(false);
      setShowHoldModal(false);
      setShowRevisiModal(false);
      
      // Reset state
      setDropAlasan('');
      setHoldAlasan('');
      setRevisiAlasan('');
      setOriginalData(null); // Reset original data
      
      // Refresh data
      fetchMonitoringData();
    } catch (error) {
      console.error('Error updating:', error);
      showAlert('Error update: ' + error.message, 'danger');
    }
    setLoading(false);
  };
  // ========== PAGINATION FUNCTIONS ==========

  const filteredData = applyFilters();
  const groupedData = groupDataByMonitoringColor(filteredData);

  const getPaginatedData = (data, groupName) => {
    const currentPage = currentPages[groupName] || 1;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return data.slice(startIndex, endIndex);
  };

  const handlePageChange = (groupName, pageNumber) => {
    setCurrentPages(prev => ({
      ...prev,
      [groupName]: pageNumber
    }));
  };

  const renderPaginationForGroup = (data, groupName) => {
    if (data.length <= itemsPerPage) return null;
    
    const totalPages = Math.ceil(data.length / itemsPerPage);
    const currentPage = currentPages[groupName] || 1;
    
    return (
      <div className="d-flex justify-content-center mt-3">
        <Pagination>
          <Pagination.First 
            onClick={() => handlePageChange(groupName, 1)} 
            disabled={currentPage === 1}
          />
          <Pagination.Prev 
            onClick={() => handlePageChange(groupName, Math.max(1, currentPage - 1))} 
            disabled={currentPage === 1}
          />
          
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pageNum;
            if (totalPages <= 5) {
              pageNum = i + 1;
            } else if (currentPage <= 3) {
              pageNum = i + 1;
            } else if (currentPage >= totalPages - 2) {
              pageNum = totalPages - 4 + i;
            } else {
              pageNum = currentPage - 2 + i;
            }
            
            return (
              <Pagination.Item
                key={pageNum}
                active={pageNum === currentPage}
                onClick={() => handlePageChange(groupName, pageNum)}
              >
                {pageNum}
              </Pagination.Item>
            );
          })}
          
          <Pagination.Next 
            onClick={() => handlePageChange(groupName, Math.min(totalPages, currentPage + 1))} 
            disabled={currentPage === totalPages}
          />
          <Pagination.Last 
            onClick={() => handlePageChange(groupName, totalPages)} 
            disabled={currentPage === totalPages}
          />
        </Pagination>
      </div>
    );
  };

  // ========== RENDER FUNCTIONS ==========

  // ========== RENDER FUNCTIONS ==========

    const renderTableSection = (title, data, groupName, color, showCount = true) => {
      const paginatedData = getPaginatedData(data, groupName);
      const currentPage = currentPages[groupName] || 1;
      
      if (data.length === 0) return null;
      
      return (
        <Card className="mb-4">
          <Card.Header className="d-flex flex-wrap justify-content-between align-items-center gap-2">
            <div className="mb-0 fw-semibold">
              {title} {showCount && <Badge bg="light" text="dark" className="ms-2">{data.length}</Badge>}
            </div>
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <Badge bg="light" text="dark" className="fs-6">
                Halaman {currentPage} dari {Math.ceil(data.length / itemsPerPage)}
              </Badge>
              <Badge bg="light" text="dark" className="fs-6">
                Total: {data.length}
              </Badge>
            </div>
          </Card.Header>
          <Card.Body className="p-0">
            <div className="table-responsive" style={{ overflowX: 'auto' }}>
              <Table hover className="mb-0" style={{ minWidth: '1200px' }}>
                <thead className="table-light">
                  <tr>
                    <th style={{ width: '50px', minWidth: '50px' }}>No</th>
                    <th style={{ minWidth: '120px' }}>No FPP</th>
                    <th style={{ minWidth: '200px' }}>Judul FPP</th>
                    <th style={{ minWidth: '150px' }}>Tanggal Target</th>
                    <th style={{ minWidth: '150px' }}>Monitoring</th>
                    <th style={{ minWidth: '100px' }}>Status</th>
                    <th style={{ minWidth: '120px' }}>PIC</th>
                    <th style={{ minWidth: '100px' }}>Department</th>
                    <th style={{ width: '200px', minWidth: '200px' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map((item, index) => {
                    const targetDate = findLastTargetDate(item.rencanaPenugasan);
                    const statusBadge = getStatusBadgeInfo(item);
                    const globalIndex = (currentPage - 1) * itemsPerPage + index + 1;
                    const canEdit = canUserEditItem(item);
                    
                    return (
                      <tr key={item.id} className="align-middle">
                        <td className="text-center">{globalIndex}</td>
                        <td>
                          <div className="text-truncate" style={{ maxWidth: '120px' }} title={item.noFpp || '-'}>
                            <span className="fw-bold">{item.noFpp || '-'}</span>
                          </div>
                        </td>
                        <td>
                          <div>
                            <div className="text-truncate" style={{ maxWidth: '200px' }} title={item.judulFpp || '-'}>
                              <strong>{item.judulFpp || '-'}</strong>
                            </div>
                            <small className="text-muted text-truncate d-block" style={{ maxWidth: '200px' }}>
                              {item.department || '-'}
                            </small>
                          </div>
                        </td>
                        <td>
                          {targetDate ? (
                            <div style={{ whiteSpace: 'nowrap' }}>
                              <div className="fw-bold">{formatDate(targetDate)}</div>
                              <small className="text-muted d-block">
                                Approval: {formatDate(item.approvalDate)}
                              </small>
                            </div>
                          ) : (
                            <span className="text-muted">-</span>
                          )}
                        </td>
                        <td className='fs-7 fw-semibold' style={{ whiteSpace: 'nowrap' }}>
                          {renderMonitoringText(item)}
                        </td>
                        <td>
                          <Badge bg={statusBadge.color} style={{ whiteSpace: 'nowrap' }}>
                            {statusBadge.text}
                          </Badge>
                        </td>
                        <td>
                          <div className="text-truncate" style={{ maxWidth: '120px' }} title={item.pic || '-'}>
                            <span className="fw-bold">{item.pic || '-'}</span>
                          </div>
                        </td>
                        <td>
                          <Badge bg="info" style={{ whiteSpace: 'nowrap' }}>{item.department || '-'}</Badge>
                        </td>
                        <td>
                          <div className="d-flex gap-1 flex-nowrap">
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => handleOpenEditModal(item)}
                              title="Edit Monitoring"
                              disabled={!canEdit}
                              style={{ opacity: canEdit ? 1 : 0.5, whiteSpace: 'nowrap' }}
                            >
                              <FaEdit /> Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="info"
                              onClick={() => handleOpenRevisiFPPModal(item)}
                              title="Revisi FPP (Ganti Nomor)"
                              disabled={!canEdit}
                              style={{ opacity: canEdit ? 1 : 0.5, whiteSpace: 'nowrap' }}
                            >
                              <FaSyncAlt /> Revisi
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
            {renderPaginationForGroup(data, groupName)}
          </Card.Body>
        </Card>
      );
    };

  // ========== MODAL RENDER FUNCTIONS ==========

  const renderDoneModal = () => {
    if (!userDepartment || !selectedItem) return null;
    
    const departmentKey = userDepartment.toUpperCase();
    const checklistOptions = DONE_CHECKLIST_OPTIONS[departmentKey] || [];
    
    return (
      <Modal show={showDoneModal} onHide={() => setShowDoneModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Complete Project - Checklist Output</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="success">
            <strong>Project: {selectedItem?.judulFpp || '-'}</strong><br />
            <small>No FPP: {selectedItem?.noFpp || '-'}</small><br />
            <small>Department: {selectedItem?.department || '-'}</small>
          </Alert>
          
          <Form.Group className="mb-4">
            <Form.Label className="fw-bold mb-3">
              Checklist Output yang telah diselesaikan:
              {doneChecklistError && <span className="text-danger ms-2">{doneChecklistError}</span>}
            </Form.Label>
            
            <div className="border rounded p-3" style={{ backgroundColor: '#f8f9fa' }}>
              {checklistOptions.map((item) => (
                <div key={item.id} className="mb-3">
                  <Form.Check 
                    type="checkbox"
                    id={`checklist-${item.id}`}
                    label={
                      <span className="fw-semibold">
                        {item.label}
                        {item.hasText && <span className="text-danger"> *</span>}
                      </span>
                    }
                    checked={doneChecklist[item.id]?.checked || false}
                    onChange={(e) => handleChecklistChange(item.id, e.target.checked)}
                    className="mb-2"
                  />
                  
                  {item.hasText && doneChecklist[item.id]?.checked && (
                    <Form.Group className="ms-4">
                      <Form.Label className="small">{item.textLabel}</Form.Label>
                      <Form.Control
                        type="text"
                        placeholder={`Masukkan ${item.textLabel.toLowerCase()}...`}
                        value={doneChecklist[item.id]?.textValue || ''}
                        onChange={(e) => handleChecklistTextChange(item.id, e.target.value)}
                        size="sm"
                      />
                    </Form.Group>
                  )}
                </div>
              ))}
            </div>
            
            <Alert variant="info" className="mt-3">
              <i className="bi bi-info-circle me-2"></i>
              Pastikan semua output yang telah diselesaikan dicentang. Minimal satu checklist harus dipilih.
            </Alert>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button 
            variant="secondary" 
            onClick={() => {
              setShowDoneModal(false);
              setDoneChecklist({});
            }}
            disabled={loading}
          >
            Batal
          </Button>
          <Button 
            variant="success" 
            onClick={handleSubmitDoneStatus}
            disabled={loading}
          >
            {loading ? (
              <>
                <Spinner size="sm" animation="border" className="me-2" />
                Proses...
              </>
            ) : (
              'Selesaikan Project'
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    );
  };

  const renderDropModal = () => (
    <Modal show={showDropModal} onHide={() => setShowDropModal(false)}>
      <Modal.Header closeButton>
        <Modal.Title>Drop Project</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Alert variant="danger">
          <strong>Project: {selectedItem?.judulFpp || '-'}</strong><br />
          <small>No FPP: {selectedItem?.noFpp || '-'}</small>
        </Alert>
        
        <Form.Group className="mb-3">
          <Form.Label>Alasan Drop <span className="text-danger">*</span></Form.Label>
          <Form.Control
            as="textarea"
            rows={3}
            placeholder="Jelaskan alasan mengapa project di-drop..."
            value={dropAlasan}
            onChange={(e) => setDropAlasan(e.target.value)}
          />
          <Form.Text className="text-muted">
            Berikan penjelasan detail mengapa project ini harus di-drop.
          </Form.Text>
        </Form.Group>
      </Modal.Body>
      <Modal.Footer>
        <Button 
          variant="secondary" 
          onClick={() => {
            setShowDropModal(false);
            setDropAlasan('');
          }}
          disabled={loading}
        >
          Batal
        </Button>
        <Button 
          variant="danger" 
          onClick={handleSubmitDropStatus}
          disabled={loading || !dropAlasan.trim()}
        >
          {loading ? (
            <>
              <Spinner size="sm" animation="border" className="me-2" />
              Proses...
            </>
          ) : (
            'Drop Project'
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  );

  const renderHoldModal = () => (
    <Modal show={showHoldModal} onHide={() => setShowHoldModal(false)}>
      <Modal.Header closeButton>
        <Modal.Title>Hold Project</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Alert variant="warning">
          <strong>Project: {selectedItem?.judulFpp || '-'}</strong><br />
          <small>No FPP: {selectedItem?.noFpp || '-'}</small>
        </Alert>
        
        <Form.Group className="mb-3">
          <Form.Label>Alasan Hold <span className="text-danger">*</span></Form.Label>
          <Form.Control
            as="textarea"
            rows={3}
            placeholder="Jelaskan alasan mengapa project di-hold..."
            value={holdAlasan}
            onChange={(e) => setHoldAlasan(e.target.value)}
          />
          <Form.Text className="text-muted">
            Berikan penjelasan detail mengapa project ini harus di-hold.
          </Form.Text>
        </Form.Group>
      </Modal.Body>
      <Modal.Footer>
        <Button 
          variant="secondary" 
          onClick={() => {
            setShowHoldModal(false);
            setHoldAlasan('');
          }}
          disabled={loading}
        >
          Batal
        </Button>
        <Button 
          variant="warning" 
          onClick={handleSubmitHoldStatus}
          disabled={loading || !holdAlasan.trim()}
        >
          {loading ? (
            <>
              <Spinner size="sm" animation="border" className="me-2" />
              Proses...
            </>
          ) : (
            'Hold Project'
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  );

  const renderRevisiModal = () => (
    <Modal show={showRevisiModal} onHide={() => setShowRevisiModal(false)}>
      <Modal.Header closeButton>
        <Modal.Title>Revisi FPP (Status)</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Alert variant="info">
          <strong>Project: {selectedItem?.judulFpp || '-'}</strong><br />
          <small>No FPP: {selectedItem?.noFpp || '-'}</small>
        </Alert>
        
        <Form.Group className="mb-3">
          <Form.Label>Alasan Revisi FPP <span className="text-danger">*</span></Form.Label>
          <Form.Control
            as="textarea"
            rows={3}
            placeholder="Jelaskan alasan revisi FPP..."
            value={revisiAlasan}
            onChange={(e) => setRevisiAlasan(e.target.value)}
          />
          <Form.Text className="text-muted">
            Berikan penjelasan detail mengapa FPP ini perlu direvisi.
          </Form.Text>
        </Form.Group>
      </Modal.Body>
      <Modal.Footer>
        <Button 
          variant="secondary" 
          onClick={() => {
            setShowRevisiModal(false);
            setRevisiAlasan('');
          }}
          disabled={loading}
        >
          Batal
        </Button>
        <Button 
          variant="info" 
          onClick={handleSubmitRevisiStatus}
          disabled={loading || !revisiAlasan.trim()}
        >
          {loading ? (
            <>
              <Spinner size="sm" animation="border" className="me-2" />
              Proses...
            </>
          ) : (
            'Revisi FPP'
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  );

  const renderRevisiFPPModal = () => {
    if (!selectedItem) return null;
    
    return (
      <Modal show={showRevisiFPPModal} onHide={() => setShowRevisiFPPModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Revisi FPP - Ganti Nomor</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="warning">
            <strong>Perhatian:</strong> Anda akan mengganti nomor FPP untuk project ini.
            <br />
            <small>Pastikan nomor FPP baru belum digunakan oleh project lain.</small>
          </Alert>
          
          <Form.Group className="mb-3">
            <Form.Label>Nomor FPP Lama</Form.Label>
            <Form.Control
              type="text"
              value={selectedItem.noFpp || '-'}
              readOnly
              style={{ backgroundColor: '#e9ecef' }}
            />
          </Form.Group>
          
          <Form.Group className="mb-3">
            <Form.Label>Nomor FPP Baru <span className="text-danger">*</span></Form.Label>
            <Form.Control
              type="text"
              placeholder="Masukkan nomor FPP baru..."
              value={revisiFPPData.noFppBaru}
              onChange={(e) => setRevisiFPPData(prev => ({ ...prev, noFppBaru: e.target.value }))}
              required
            />
          </Form.Group>
          
          <Form.Group className="mb-3">
            <Form.Label>Tanggal Revisi <span className="text-danger">*</span></Form.Label>
            <Form.Control
              type="date"
              value={revisiFPPData.tanggalRevisi}
              onChange={(e) => setRevisiFPPData(prev => ({ ...prev, tanggalRevisi: e.target.value }))}
              required
            />
          </Form.Group>
          
          <Form.Group className="mb-3">
            <Form.Label>Alasan Revisi FPP <span className="text-danger">*</span></Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={revisiFPPData.alasanRevisi}
              onChange={(e) => setRevisiFPPData(prev => ({ ...prev, alasanRevisi: e.target.value }))}
              required
            />
          </Form.Group>
          
          <Form.Group className="mb-3">
            <Form.Label>Keterangan Tambahan</Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              value={revisiFPPData.keterangan}
              onChange={(e) => setRevisiFPPData(prev => ({ ...prev, keterangan: e.target.value }))}
            />
          </Form.Group>
          
          <Alert variant="info" className="mt-3">
            <i className="bi bi-info-circle me-2"></i>
            Setelah direvisi, project akan berstatus <Badge bg="info">Revisi FPP</Badge>
            dan nomor FPP akan diperbarui di semua sistem.
          </Alert>
        </Modal.Body>
        <Modal.Footer>
          <Button 
            variant="secondary" 
            onClick={() => {
              setShowRevisiFPPModal(false);
              setRevisiFPPData({
                noFppBaru: '',
                tanggalRevisi: '',
                alasanRevisi: '',
                keterangan: ''
              });
            }}
            disabled={loading}
          >
            Batal
          </Button>
          <Button 
            variant="warning" 
            onClick={handleSubmitRevisiFPP}
            disabled={loading || !revisiFPPData.noFppBaru.trim() || !revisiFPPData.tanggalRevisi || !revisiFPPData.alasanRevisi.trim()}
          >
            {loading ? (
              <>
                <Spinner size="sm" animation="border" className="me-2" />
                Proses...
              </>
            ) : (
              'Simpan Revisi FPP'
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    );
  };

  const renderEditModal = () => {
    if (!selectedItem) return null;
    
    const canEdit = canUserEditItem(selectedItem);
    const allPICs = getAllAvailablePICs();
    
    // Format tanggal untuk input type="date"
    const formatDateForInput = (dateValue) => {
      if (!dateValue) return '';
      
      try {
        let date;
        if (dateValue && typeof dateValue.toDate === 'function') {
          date = dateValue.toDate();
        } else if (typeof dateValue === 'string') {
          date = new Date(dateValue);
        } else {
          date = new Date(dateValue);
        }
        
        if (isNaN(date.getTime())) return '';
        
        return date.toISOString().split('T')[0];
      } catch (error) {
        console.error('Error formatting date for input:', error);
        return '';
      }
    };
    
    // Hitung apakah tanggal selesai sudah diisi
    const isTanggalSelesaiFilled = formData.tanggalSelesai && formData.tanggalSelesai.trim() !== '';
    
    return (
      <Modal show={showEditModal} onHide={() => setShowEditModal(false)} size="xl" backdrop="static">
        <Modal.Header closeButton>
          <Modal.Title>
            <div className="d-flex align-items-center">
              <span>Edit Monitoring - {selectedItem.judulFpp || 'Project'}</span>
              <Badge bg={getStatusBadgeInfo({ status: formData.status }).color} className="ms-2">
                {formData.status}
              </Badge>
            </div>
          </Modal.Title>
        </Modal.Header>
        {hasChanges() && (
          <div className="bg-warning bg-opacity-10 p-2 border-start border-warning border-4 mx-3 mt-2">
            <div className="d-flex align-items-center">
              <i className="bi bi-exclamation-circle-fill text-warning me-2"></i>
              <span className="small">
                <strong>Ada perubahan yang belum disimpan:</strong> 
                {formData.projectDepartments?.length !== originalData?.projectDepartments?.length && " Departemen,"}
                {formData.keterangan !== originalData?.keterangan && " Keterangan,"}
                {formData.timProject?.length !== originalData?.timProject?.length && " Tim Project,"}
                {formData.tanggalSelesai !== originalData?.tanggalSelesai && " Tanggal Selesai,"}
                {formData.status !== originalData?.status && ` Status (${originalData?.status} → ${formData.status})`}
              </span>
            </div>
          </div>
        )}

        {/* Indikator Validasi Tanggal Selesai jika status berubah */}
        {formData.status !== 'In Progress' && !formData.tanggalSelesai && (
          <div className="bg-danger bg-opacity-10 p-2 border-start border-danger border-4 mx-3 mt-2">
            <div className="d-flex align-items-center">
              <i className="bi bi-exclamation-triangle-fill text-danger me-2"></i>
              <span className="small">
                <strong>Peringatan:</strong> Status diubah ke "{formData.status}", harap isi tanggal selesai.
              </span>
            </div>
          </div>
        )}
        <Modal.Body style={{ maxHeight: '80vh', overflowY: 'auto' }}>
          {/* Tampilkan data FPP lengkap (readonly) */}
          <Card className="mb-4">
            <Card.Header className="bg-light">
              <h6 className="mb-0">Data FPP</h6>
            </Card.Header>
            <Card.Body>
              <Row>
                <Col md={6}>
                  <div className="mb-3">
                    <small className="text-muted">No FPP</small>
                    <div className="fw-semibold">{selectedItem.noFpp || '-'}</div>
                  </div>
                  <div className="mb-3">
                    <small className="text-muted">Judul FPP</small>
                    <div className="fw-semibold">{selectedItem.judulFpp || '-'}</div>
                  </div>
                  <div className="mb-3">
                    <small className="text-muted">Department</small>
                    <div className="fw-semibold">{selectedItem.department || '-'}</div>
                  </div>
                  <div className="mb-3">
                    <small className="text-muted">PIC Utama</small>
                    <div className="fw-semibold">{selectedItem.pic || '-'}</div>
                  </div>
                  <div className="mb-3">
                    <small className="text-muted">Jenis Project</small>
                    <div className="fw-semibold">{selectedItem.jenisProjectResolved || selectedItem.jenisProject || '-'}</div>
                  </div>
                  <div className="mb-3">
                    <small className="text-muted">PIR Type</small>
                    <div className="fw-semibold">{selectedItem.pirType || '-'}</div>
                  </div>
                </Col>
                <Col md={6}>
                  <div className="mb-3">
                    <small className="text-muted">Tanggal Approval</small>
                    <div className="fw-semibold">{formatDate(selectedItem.approvalDate)}</div>
                  </div>
                  <div className="mb-3">
                    <small className="text-muted">Target Selesai</small>
                    <div className="fw-semibold">
                      {findLastTargetDate(selectedItem.rencanaPenugasan) 
                        ? formatDate(findLastTargetDate(selectedItem.rencanaPenugasan))
                        : '-'
                      }
                    </div>
                  </div>
                  <div className="mb-3">
                    <small className="text-muted">Status Saat Ini</small>
                    <div>
                      <Badge bg={getStatusBadgeInfo(selectedItem).color}>
                        {getStatusBadgeInfo(selectedItem).text}
                      </Badge>
                    </div>
                  </div>
                  <div className="mb-3">
                    <small className="text-muted">Monitoring</small>
                    <div className="fw-semibold">
                      {renderMonitoringText(selectedItem)}
                    </div>
                  </div>
                  <div className="mb-3">
                    <small className="text-muted">Tanggal Selesai</small>
                    <div className="fw-semibold">
                      {selectedItem.tanggalSelesai ? formatDate(selectedItem.tanggalSelesai) : 'Belum ada'}
                    </div>
                  </div>
                </Col>
              </Row>
              
              {/* Rencana Penugasan */}
              {selectedItem.rencanaPenugasan && selectedItem.rencanaPenugasan.length > 0 && (
                <div className="mt-0">
                  <small className="text-muted">Rencana Penugasan</small>
                  <div className="small">
                    <ul className="mb-0">
                      {selectedItem.rencanaPenugasan
                        .filter(rencana => rencana.keterangan || rencana.tglTarget)
                        .map((rencana, idx) => (
                          <li key={idx}>
                            <strong>{rencana.keterangan || 'Keterangan'}:</strong> {formatDate(rencana.tglTarget)}
                          </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
              
              {/* Unit Kerja Terkait */}
              {selectedItem.unitKerjaTerkait && (
                <div className="mt-3">
                  <small className="text-muted">Unit Kerja Terkait</small>
                  <div className="fw-semibold">{selectedItem.unitKerjaTerkait}</div>
                </div>
              )}
            </Card.Body>
          </Card>
          
          {/* Info Akses User */}
          {!canEdit && (
            <Alert variant="danger" className="mb-4">
              <i className="bi bi-exclamation-triangle-fill me-2"></i>
              <strong>Akses Dibatasi:</strong> Anda hanya dapat melihat data project ini, 
              tidak dapat melakukan perubahan. Hanya user dari department terkait yang dapat mengedit.
            </Alert>
          )}
          
          {canEdit ? (
            <>
              <h5 className="mb-3">Edit Monitoring</h5>
              
              {/* Di dalam renderEditModal, tambahkan debug info */}
              <Card className="mb-4">
                <Card.Header className="bg-light">
                  <h6 className="mb-0">Departemen Project</h6>
                </Card.Header>
                <Card.Body>
                  <Form.Group>
                    <Form.Label className="fw-bold mb-3">Pilih Departemen yang Terlibat:</Form.Label>

                    
                    {/* Tampilkan data sebelumnya */}
                    <Alert variant="info" className="mb-3 p-2">
                      <small>
                        <strong>Data sebelumnya:</strong> {
                          selectedItem.projectDepartments 
                            ? (Array.isArray(selectedItem.projectDepartments) 
                                ? selectedItem.projectDepartments.join(', ') 
                                : selectedItem.projectDepartments)
                            : 'Tidak ada data'
                        }
                      </small>
                    </Alert>
                    
                    <div className="d-flex flex-wrap gap-4 mt-2">
                      {PROJECT_DEPARTMENTS.map((dept) => {
                        const isChecked = formData.projectDepartments.some(
                          d => d.toUpperCase() === dept.toUpperCase()
                        );
                        
                        console.log(`Checkbox ${dept}:`, {
                          dept,
                          formData: formData.projectDepartments,
                          isChecked,
                          includes: formData.projectDepartments.includes(dept)
                        });
                        
                        return (
                          <Form.Check
                            key={dept}
                            type="checkbox"
                            id={`project-dept-edit-${dept}`}
                            label={dept}
                            checked={isChecked}
                            onChange={(e) => handleProjectDepartmentChange(dept, e.target.checked)}
                          />
                        );
                      })}
                    </div>
                    
                    {/* Info checkbox terpilih */}
                    {formData.projectDepartments.length > 0 && (
                      <Alert variant="success" className="mt-3 p-2">
                        <small>
                          <strong>Terpilih untuk update:</strong> {formData.projectDepartments.join(', ')}
                        </small>
                      </Alert>
                    )}
                    
                    {/* Info jika tidak ada data */}
                    {formData.projectDepartments.length === 0 && (
                      <Alert variant="warning" className="mt-2 p-2">
                        <small>
                          <i className="bi bi-exclamation-triangle me-1"></i>
                          Belum ada departemen yang dipilih
                        </small>
                      </Alert>
                    )}
                  </Form.Group>
                </Card.Body>
              </Card>
              
              {/* SECTION KETERANGAN */}
              <Card className="mb-4">
                <Card.Header className="bg-light">
                  <h6 className="mb-0">Keterangan</h6>
                </Card.Header>
                <Card.Body>
                  <Form.Group className="mb-3">
                    <Form.Label>Keterangan / Catatan</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={4}
                      value={formData.keterangan}
                      onChange={(e) => setFormData(prev => ({ ...prev, keterangan: e.target.value }))}
                    />
                  </Form.Group>
                </Card.Body>
              </Card>
              
              {/* SECTION TIM PROJECT & OUTPUTS */}
              <Card className="mb-4">
                <Card.Header className="bg-light d-flex justify-content-between align-items-center">
                  <h6 className="mb-0">Tim Project & Outputs</h6>
                  <Button
                    variant="outline-primary"
                    size="sm"
                    onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        timProject: [...prev.timProject, { 
                          pic: '', 
                          peran: '', 
                          outputs: [],
                          department: selectedItem.department || '',
                          tim: selectedItem.tim || ''
                        }]
                      }));
                    }}
                  >
                    + Tambah Anggota Tim
                  </Button>
                </Card.Header>
                <Card.Body>
                  
                  {formData.timProject.map((tim, timIndex) => (
                    <Card key={timIndex} className="mb-3 border">
                      <Card.Body>
                        <div className="d-flex justify-content-between align-items-center mb-3">
                          <h6 className="mb-0">Anggota Tim #{timIndex + 1}</h6>
                          {formData.timProject.length > 1 && (
                            <Button
                              variant="outline-danger"
                              size="sm"
                              onClick={() => {
                                const newTimProject = formData.timProject.filter((_, idx) => idx !== timIndex);
                                setFormData(prev => ({ ...prev, timProject: newTimProject }));
                              }}
                            >
                              Hapus
                            </Button>
                          )}
                        </div>
                        
                        <Row className="align-items-center mb-3">
                          <Col md={4}>
                            <Form.Group>
                              <Form.Label>Department</Form.Label>
                              <Form.Control
                                type="text"
                                value={tim.department || selectedItem.department || ''}
                                readOnly
                                style={{ backgroundColor: '#e9ecef' }}
                              />
                            </Form.Group>
                          </Col>
                          <Col md={4}>
                            <Form.Group>
                              <Form.Label>TIM</Form.Label>
                              <Form.Control
                                type="text"
                                value={tim.tim || selectedItem.tim || ''}
                                readOnly
                                style={{ backgroundColor: '#e9ecef' }}
                              />
                            </Form.Group>
                          </Col>
                          <Col md={4}>
                            <Form.Group>
                              <Form.Label>PIC <span className="text-danger">*</span></Form.Label>
                              <Form.Select
                                value={tim.pic || ''}
                                onChange={(e) => handleTimProjectChange(timIndex, 'pic', e.target.value)}
                                required
                              >
                                <option value="">Pilih PIC...</option>
                                {allPICs.map(pic => (
                                  <option key={pic} value={pic}>{pic}</option>
                                ))}
                              </Form.Select>
                            </Form.Group>
                          </Col>
                        </Row>
                        
                        <Form.Group>
                          <div className="d-flex justify-content-between align-items-center mb-2">
                            <Form.Label className="mb-0">Output yang Dikerjakan</Form.Label>
                            <Button 
                              variant="outline-info" 
                              size="sm"
                              onClick={() => {
                                setEditingOutputIndex(prev => prev === timIndex ? null : timIndex);
                              }}
                            >
                              {editingOutputIndex === timIndex ? 'Tutup' : 'Edit Output'}
                            </Button>
                          </div>
                          
                          {editingOutputIndex === timIndex ? (
                            <div className="border rounded p-3 mt-2" style={{ backgroundColor: '#f8f9fa' }}>
                              <div className="row">
                                {OUTPUT_OPTIONS[selectedItem.department]?.map((output) => (
                                  <div key={output} className="col-md-6 mb-2">
                                    <Form.Check
                                      type="checkbox"
                                      id={`output-${timIndex}-${output}`}
                                      label={output}
                                      checked={tim.outputs?.includes(output) || false}
                                      onChange={(e) => handleOutputChange(timIndex, output, e.target.checked)}
                                    />
                                  </div>
                                ))}
                              </div>
                              
                              <div className="d-flex justify-content-between mt-3">
                                <Button 
                                  size="sm" 
                                  variant="outline-secondary"
                                  onClick={() => handleTimProjectChange(timIndex, 'outputs', [])}
                                >
                                  Clear Semua Output
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="primary" 
                                  onClick={() => setEditingOutputIndex(null)}
                                >
                                  Selesai
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="p-3 bg-light rounded border mt-2">
                              <div className="mb-2">
                                <strong>Output terpilih:</strong>
                              </div>
                              <div className="text-primary fw-bold mb-3" style={{ minHeight: '28px' }}>
                                {tim.outputs && tim.outputs.length > 0 ? (
                                  <div className="d-flex flex-wrap gap-2">
                                    {tim.outputs.map((output, idx) => (
                                      <Badge key={idx} bg="info" className="me-1 mb-1">
                                        {output}
                                      </Badge>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-muted fw-normal">Belum ada output yang dipilih</span>
                                )}
                              </div>
                            </div>
                          )}
                        </Form.Group>
                      </Card.Body>
                    </Card>
                  ))}
                  
                  {formData.timProject.length === 0 && (
                    <Alert variant="light" className="text-center py-4">
                      <div className="mb-2">
                        <i className="bi bi-people fs-2 text-muted"></i>
                      </div>
                      <p className="mb-0">Belum ada anggota tim yang ditambahkan.</p>
                      <p className="small text-muted">Klik "Tambah Anggota Tim" untuk menambahkan.</p>
                    </Alert>
                  )}
                </Card.Body>
              </Card>

              <Card className="mb-4">
                <Card.Header className="bg-light">
                  <h6 className="mb-0">Tanggal & Status</h6>
                </Card.Header>
                <Card.Body>
                  <Row>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>
                          Tanggal Selesai <span className="text-danger">*</span>
                        </Form.Label>
                        <Form.Control
                          type="date"
                          value={formData.tanggalSelesai}
                          onChange={(e) => setFormData(prev => ({ ...prev, tanggalSelesai: e.target.value }))}
                          required
                        />
                        <Form.Text className="text-muted">
                          Wajib diisi untuk mengubah status project
                        </Form.Text>
                      </Form.Group>
                    </Col>
                    
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>
                          Status Project
                        </Form.Label>
                        <Form.Select
                          value={formData.status}
                          onChange={handleStatusChange}
                          disabled={!isTanggalSelesaiFilled}
                          className={!isTanggalSelesaiFilled ? 'bg-light' : ''}
                        >
                          <option value="In Progress">In Progress</option>
                          <option value="Done">Done</option>
                          <option value="Hold">Hold</option>
                          <option value="Drop">Drop</option>
                          <option value="Revisi FPP">Revisi FPP</option>
                        </Form.Select>
                        {!isTanggalSelesaiFilled && (
                          <Form.Text className="text-danger">
                            ⚠️ Harap isi tanggal selesai terlebih dahulu untuk mengubah status
                          </Form.Text>
                        )}
                      </Form.Group>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>
              
              {/* SECTION SUMMARY */}
              <Card className="border-info">
                <Card.Header className="bg-info bg-opacity-10 d-flex justify-content-between align-items-center">
                  <strong>Ringkasan Perubahan</strong>
                  <Badge bg={getStatusBadgeInfo({ status: formData.status }).color}>
                    {formData.status}
                  </Badge>
                </Card.Header>
                <Card.Body>
                  <Row>
                    <Col md={6}>
                      <ul className="mb-0">
                        <li>
                          <strong>Tanggal Selesai:</strong> 
                          {formData.tanggalSelesai 
                            ? ` ${formatDate(formData.tanggalSelesai)}` 
                            : ' Belum diisi'
                          }
                        </li>
                        <li><strong>Jumlah Anggota Tim:</strong> {formData.timProject.length} orang</li>
                        <li>
                          <strong>Total Output:</strong> {
                            formData.timProject.reduce((total, tim) => total + (tim.outputs?.length || 0), 0)
                          } item
                        </li>
                        <li>
                          <strong>Departemen Project:</strong> {
                            formData.projectDepartments.length > 0 
                              ? formData.projectDepartments.join(', ')
                              : 'Belum dipilih'
                          }
                        </li>
                      </ul>
                    </Col>
                    <Col md={6}>
                      <ul className="mb-0">
                        <li>
                          <strong>Status:</strong> 
                          <Badge bg={getStatusBadgeInfo({ status: formData.status }).color} className="ms-2">
                            {formData.status}
                          </Badge>
                        </li>
                        <li>
                          <strong>Validasi:</strong> 
                          {isTanggalSelesaiFilled ? (
                            <Badge bg="success" className="ms-2">✓ Tanggal selesai terisi</Badge>
                          ) : (
                            <Badge bg="warning" className="ms-2">⚠️ Tanggal selesai belum diisi</Badge>
                          )}
                        </li>
                        <li>
                          <strong>Akses Edit:</strong> 
                          <Badge bg="success" className="ms-2">
                            {isHeadUser ? 'HEAD User' : 'Department Terkait'}
                          </Badge>
                        </li>
                      </ul>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>
            </>
          ) : (
            <Alert variant="info" className="text-center py-4">
              <i className="bi bi-eye fs-2 text-info"></i>
              <h5 className="mt-3">Mode View Only</h5>
              <p className="mb-0">Anda hanya dapat melihat data project ini karena bukan dari department terkait atau bukan HEAD user.</p>
            </Alert>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button 
            variant="secondary" 
            onClick={() => {
              setShowEditModal(false);
              setEditingOutputIndex(null);
              setOriginalData(null); // Reset original data saat tutup
            }}
            disabled={loading}
          >
            Tutup
          </Button>
          {canEdit && (
            <Button 
              variant="primary" 
              onClick={handleSubmitUpdate}
              disabled={loading || (!hasChanges() && !formData.tanggalSelesai)} // ✅ Perbaikan kondisi
              title={
                !hasChanges() && !formData.tanggalSelesai 
                  ? "Tidak ada perubahan yang perlu disimpan atau tanggal selesai belum diisi" 
                  : "Simpan perubahan"
              }
            >
              {loading ? (
                <>
                  <Spinner size="sm" animation="border" className="me-2" />
                  Proses...
                </>
              ) : (
                'Simpan Perubahan'
              )}
            </Button>
          )}
        </Modal.Footer>
      </Modal>
    );
  };

  // ========== MAIN RENDER ==========

  return (
    <Container fluid className="py-4">
      {/* Alert */}
      {alert.show && (
        <Alert 
          variant={alert.variant} 
          dismissible 
          onClose={() => setAlert({ show: false, message: '', variant: '' })}
          className="position-fixed top-0 end-0 m-3"
          style={{ zIndex: 9999, maxWidth: '400px' }}
        >
          {alert.message}
        </Alert>
      )}
      
      {/* Di dalam Container, tambahkan tombol debug */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <div className="h3 fw-semibold fs-5">Monitoring Project</div>
          {userDepartment && (
            <div className="text-muted small">
              Akses: <Badge bg={isHeadUser ? "danger" : "info"}>{isHeadUser ? "HEAD User (Full Access)" : `Department: ${userDepartment}`}</Badge>
            </div>
          )}
        </div>
        <div className="d-flex gap-2">
          {/* Tombol debug sementara */}
          
          <Button 
            variant="success"
            onClick={exportToExcel}
            disabled={loading}
            className="d-flex align-items-center gap-2"
          >
            <FaFileExcel /> Export Excel
          </Button>
          {/* <Button 
            variant="outline-primary" 
            onClick={fetchMonitoringData}
            disabled={loading}
          >
            {loading ? (
              <>
                <Spinner size="sm" animation="border" className="me-2" />
                Loading...
              </>
            ) : (
              <><FaDownload /> Refresh Data</>
            )}
          </Button> */}
        </div>
      </div>
      
      {/* Filters */}
      <Card className="mb-4">
        <Card.Body>
          <Row className="g-3">
            <Col md={4}>
              <Form.Group>
                <Form.Label>Search</Form.Label>
                <InputGroup>
                  <Form.Control
                    type="text"
                    placeholder="Cari berdasarkan No Project, No FPP, atau Judul"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPages({
                        merah: 1,
                        kuning: 1,
                        hijau: 1,
                        lainnya: 1
                      });
                    }}
                  />
                </InputGroup>
              </Form.Group>
            </Col>
            
            <Col md={4}>
              <Form.Group>
                <Form.Label>Filter Department</Form.Label>
                <Form.Select
                  value={filterTim}
                  onChange={(e) => {
                    setFilterTim(e.target.value);
                    setCurrentPages({
                      merah: 1,
                      kuning: 1,
                      hijau: 1,
                      lainnya: 1
                    });
                  }}
                >
                  <option value="">Semua Department</option>
                  {availableTim.map((tim) => (
                    <option key={tim} value={tim}>{tim}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            
            <Col md={4}>
              <Form.Group>
                <Form.Label>Filter PIC</Form.Label>
                <Form.Select
                  value={filterPIC}
                  onChange={(e) => {
                    setFilterPIC(e.target.value);
                    setCurrentPages({
                      merah: 1,
                      kuning: 1,
                      hijau: 1,
                      lainnya: 1
                    });
                  }}
                >
                  <option value="">Semua PIC</option>
                  {availablePICs.map((pic) => (
                    <option key={pic} value={pic}>{pic}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
          </Row>
        </Card.Body>
      </Card>
      
      {/* Summary Stats */}
      <Row className="mb-4">
        <Col md={3}>
          <Card bg="danger" text="white" className="text-center">
            <Card.Body>
              <Card.Title>Merah</Card.Title>
              <Card.Text className="display-6">{groupedData.merah.length}</Card.Text>
              <small>Deadline ≤ 3 hari atau Terlambat</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card bg="warning" text="dark" className="text-center">
            <Card.Body>
              <Card.Title>Kuning</Card.Title>
              <Card.Text className="display-6">{groupedData.kuning.length}</Card.Text>
              <small>≤ 50% dari waktu tersisa</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card bg="success" text="white" className="text-center">
            <Card.Body>
              <Card.Title>Hijau</Card.Title>
              <Card.Text className="display-6">{groupedData.hijau.length}</Card.Text>
              <small>Achieve atau 50% waktu</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card bg="secondary" text="white" className="text-center">
            <Card.Body>
              <Card.Title>Lainnya</Card.Title>
              <Card.Text className="display-6">{groupedData.lainnya.length}</Card.Text>
              <small>Done, Drop, Hold, Revisi</small>
            </Card.Body>
          </Card>
        </Col>
      </Row>
      
      {/* Render semua section */}
      {renderTableSection("Merah", groupedData.merah, 'merah', 'danger')}
      {renderTableSection("Kuning", groupedData.kuning, 'kuning', 'warning')}
      {renderTableSection("Hijau", groupedData.hijau, 'hijau', 'success')}
      {renderTableSection("Status Updated", groupedData.lainnya, 'lainnya', 'secondary')}
      
      {/* Modals */}
      {renderEditModal()}
      {renderDoneModal()}
      {renderDropModal()}
      {renderHoldModal()}
      {renderRevisiModal()}
      {renderRevisiFPPModal()}
    </Container>
  );
}

export default Monitoring;