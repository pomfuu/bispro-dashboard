// src/context/AuthContext.js
import React, { createContext, useState, useContext, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

const AuthContext = createContext();

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    // Cek dari localStorage saat pertama kali load
    const savedUser = localStorage.getItem('fpp_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [loading, setLoading] = useState(true);
  const [allUsers, setAllUsers] = useState([]);

  // Ambil semua user dari database
  const fetchAllUsers = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'users'));
      const usersList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Filter hanya yang aktif
      const activeUsers = usersList.filter(u => u.status === 'Active');
      setAllUsers(activeUsers);
      
      return activeUsers;
    } catch (error) {
      console.error('Error fetching users:', error);
      return [];
    }
  };

  // Login sebagai TIM
  const loginAsTim = async (unit, unitDetail, picName) => {
    try {
      // Cari user di database
      const usersQuery = query(
        collection(db, 'users'),
        where('unit', '==', unit),
        where('unitDetail', '==', unitDetail),
        where('nama', '==', picName)
      );
      
      const querySnapshot = await getDocs(usersQuery);
      
      if (!querySnapshot.empty) {
        const userData = querySnapshot.docs[0].data();
        
        // Format sesuai dengan yang diharapkan Dashboard
        const userFullTim = `${unit}-${unitDetail}`;
        
        const userSession = {
          isLoggedIn: true,
          userType: 'TIM',
          role: 'user',
          
          // Data untuk filter/akses
          department: unit,
          unit: unit,
          tim: unitDetail,
          pic: userFullTim, // Format: "DPA-Akuisisi"
          picName: userData.nama,
          
          // Metadata
          userId: querySnapshot.docs[0].id,
          nama: userData.nama,
          email: userData.email || '',
          status: userData.status || 'Active'
        };
        
        setUser(userSession);
        localStorage.setItem('fpp_user', JSON.stringify(userSession));
        return { success: true, user: userSession };
      } else {
        return { success: false, message: 'User tidak ditemukan' };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, message: 'Error saat login' };
    }
  };

  // Login sebagai HEAD - FIXED VERSION
  const loginAsHead = (password) => {
    console.log('Login as HEAD attempt with password:', password);
    
    // Password check
    if (password === 'inputmaster') {
      const userData = {
        isLoggedIn: true,
        userType: 'HEAD',
        role: 'head',
        
        // Data untuk filter/akses
        department: 'ALL',
        unit: 'ALL',
        tim: '',
        pic: 'HEAD',
        picName: 'HEAD User',
        
        // Flag khusus
        isHead: true,
        accessAll: true
      };
      
      console.log('Setting HEAD user data:', userData);
      setUser(userData);
      localStorage.setItem('fpp_user', JSON.stringify(userData));
      
      return { success: true, message: 'Login sebagai HEAD berhasil' };
    } else {
      return { success: false, message: 'Password HEAD salah' };
    }
  };

  // Logout
  const logout = () => {
    console.log('Logging out user');
    setUser(null);
    localStorage.removeItem('fpp_user');
  };

  // Cek apakah user memiliki akses ke project
  const hasAccessToProject = (project) => {
    if (!user || !user.isLoggedIn) {
      console.log('No user or not logged in');
      return false;
    }
    
    // HEAD bisa akses semua
    if (user.role === 'head' || user.isHead) {
      console.log('HEAD user - full access');
      return true;
    }
    
    // TIM cek berdasarkan department dan tim
    const userFullTim = `${user.department || ''}-${user.tim || ''}`;
    
    console.log('TIM user check:', userFullTim);
    
    // 1. Apakah user adalah PIC utama
    if (project.pic === userFullTim) {
      console.log('User is main PIC');
      return true;
    }
    
    // 2. Apakah user ada di timProject
    if (project.timProject && Array.isArray(project.timProject)) {
      const isInvolved = project.timProject.some(tp => {
        const memberFullTim = `${tp.department || ''}-${tp.tim || ''}`;
        return memberFullTim === userFullTim;
      });
      if (isInvolved) {
        console.log('User is in project team');
        return true;
      }
    }
    
    // 3. Apakah project ini dari department dan tim yang sama
    if (project.department === user.department && project.tim === user.tim) {
      console.log('Project from same department/tim');
      return true;
    }
    
    console.log('User has no access to project');
    return false;
  };

  // Filter data berdasarkan user
  const filterDataByUserAccess = (data) => {
    if (!user || !user.isLoggedIn) {
      console.log('No user or not logged in - returning empty array');
      return [];
    }
    
    // HEAD bisa lihat semua data
    if (user.role === 'head' || user.isHead) {
      console.log('HEAD user - returning all data:', data.length);
      return data;
    }
    
    // Filter untuk TIM
    const userFullTim = `${user.department || ''}-${user.tim || ''}`;
    
    console.log('Filtering for TIM user:', userFullTim);
    
    const filteredData = data.filter(project => {
      // 1. User adalah PIC utama
      if (project.pic === userFullTim) {
        return true;
      }
      
      // 2. User ada di timProject
      if (project.timProject && Array.isArray(project.timProject)) {
        const isInvolved = project.timProject.some(tp => {
          const memberFullTim = `${tp.department || ''}-${tp.tim || ''}`;
          return memberFullTim === userFullTim;
        });
        if (isInvolved) return true;
      }
      
      // 3. Project dari department dan tim yang sama
      if (project.department === user.department && project.tim === user.tim) {
        return true;
      }
      
      return false;
    });
    
    console.log('Filtered data result:', filteredData.length, 'out of', data.length);
    return filteredData;
  };

  // Fungsi untuk mendapatkan userFullTim (helper)
  const getUserFullTim = () => {
    if (!user) {
      console.log('No user found');
      return '';
    }
    
    if (user.role === 'head' || user.isHead) {
      console.log('HEAD user detected');
      return 'HEAD';
    }
    
    const fullTim = `${user.department || ''}-${user.tim || ''}`;
    console.log('TIM user full tim:', fullTim);
    return fullTim;
  };

  // Fungsi untuk mendapatkan user info (debug)
  const getUserInfo = () => {
    if (!user) return 'No user';
    return {
      role: user.role,
      isHead: user.isHead,
      department: user.department,
      tim: user.tim,
      pic: user.pic,
      userType: user.userType
    };
  };

  // Load users saat pertama kali
  useEffect(() => {
    const initialize = async () => {
      await fetchAllUsers();
      setLoading(false);
    };
    
    initialize();
  }, []);

  // Debug: log user changes
  useEffect(() => {
    console.log('AuthContext user changed:', user);
  }, [user]);

  const value = {
    user,
    loading,
    allUsers,
    loginAsTim,
    loginAsHead,
    logout,
    hasAccessToProject,
    filterDataByUserAccess,
    getUserFullTim,
    getUserInfo,
    fetchAllUsers
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};