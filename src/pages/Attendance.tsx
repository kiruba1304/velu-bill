import React, { useState, useEffect } from 'react';
import { 
  UserCheck, 
  Clock, 
  Settings, 
  Calendar, 
  Search, 
  Save, 
  Download, 
  Timer, 
  LogOut, 
  LogIn, 
  CheckCircle2, 
  X,
  PlusCircle,
  Trash2,
  Check,
  AlertCircle,
  FileText,
  CalendarRange,
  QrCode,
  Key,
  Lock,
  ArrowLeft
} from 'lucide-react';
import QRCode from 'qrcode';
import { useDatabase } from '../hooks/useDatabase';
import { useAuth } from '../hooks/useAuth';
import { AttendanceRecord, AttendanceRules, Holiday, LeavePermissionRequest } from '../types';

export default function Attendance() {
  const db = useDatabase();
  const { currentUser, isSuperAdmin, isAdmin, isSubAdmin, activeBranchId, allowedPages } = useAuth();
  
  // Decide active tab based on role
  const isManager = isSuperAdmin || isAdmin || isSubAdmin;

  const [activeTab, setActiveTab] = useState<'clock' | 'daily' | 'monthly' | 'rules' | 'requests' | 'holidays' | 'my-requests' | 'generator'>(
    isManager ? 'daily' : 'clock'
  );

  // General States
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [rules, setRules] = useState<AttendanceRules>({
    shiftStart: '09:00',
    shiftEnd: '18:00',
    gracePeriodMins: 15,
    allowSubadminHoliday: false,
    allowSubadminModify: false
  });

  const canAssignHolidays = (isSuperAdmin || isAdmin) || (isSubAdmin && !!rules.allowSubadminHoliday);

  const canModifyUserAttendance = (targetRole: string) => {
    if (isSuperAdmin) return true;
    if (isAdmin) return targetRole !== 'super_admin';
    if (isSubAdmin) {
      return allowedPages.includes('attendance_modify') && targetRole !== 'admin' && targetRole !== 'super_admin';
    }
    return false;
  };

  // OTP / QR Code States
  const [managerPassword, setManagerPassword] = useState('');
  const [generatorAuthenticated, setGeneratorAuthenticated] = useState(false);
  const [authError, setAuthError] = useState('');
  const [generatorMode, setGeneratorMode] = useState<'otp' | 'qr'>('otp');
  const [timeLeft, setTimeLeft] = useState(30);
  const [currentOtp, setCurrentOtp] = useState('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');

  // Verification modal states for employee
  const [verificationPendingAction, setVerificationPendingAction] = useState<'in' | 'out' | null>(null);
  const [verificationMethod, setVerificationMethod] = useState<'otp' | 'qr' | null>(null);
  const [verificationInput, setVerificationInput] = useState('');
  const [verificationError, setVerificationError] = useState('');

  // Exit generator fullscreen authentication states
  const [showExitGeneratorAuth, setShowExitGeneratorAuth] = useState(false);
  const [exitPassword, setExitPassword] = useState('');
  const [exitError, setExitError] = useState('');

  // Admin View States
  const [dailyRecords, setDailyRecords] = useState<AttendanceRecord[]>([]);
  const [monthlyRecords, setMonthlyRecords] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);

  // Employee View States
  const [employeeHistory, setEmployeeHistory] = useState<any[]>([]);
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [liveTime, setLiveTime] = useState<Date>(new Date());
  const [elapsedTime, setElapsedTime] = useState<string>('00:00:00');

  // Popup detail state for matrix grid click
  const [activeCellDetail, setActiveCellDetail] = useState<{
    userName: string;
    date: string;
    record: any;
  } | null>(null);

  // Quick edit status for active cell detail
  const [cellEditStatus, setCellEditStatus] = useState<'present' | 'absent' | 'half_day' | 'leave'>('present');
  const [cellEditInTime, setCellEditInTime] = useState('');
  const [cellEditOutTime, setCellEditOutTime] = useState('');
  const [cellEditNotes, setCellEditNotes] = useState('');

  // Holidays States
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [holidayDate, setHolidayDate] = useState<string>('');
  const [holidayName, setHolidayName] = useState<string>('');
  const [holidayBranchId, setHolidayBranchId] = useState<number | 'all'>('all');

  // Admin Leave requests states
  const [leaveRequests, setLeaveRequests] = useState<LeavePermissionRequest[]>([]);
  const [requestFilterStatus, setRequestFilterStatus] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [rejectingRequestId, setRejectingRequestId] = useState<number | null>(null);
  const [rejectReasonInput, setRejectReasonInput] = useState<string>('');

  // Employee Leave requests states
  const [myRequests, setMyRequests] = useState<LeavePermissionRequest[]>([]);
  const [applyType, setApplyType] = useState<'leave' | 'permission'>('leave');
  const [leaveTypeInput, setLeaveTypeInput] = useState<'sick' | 'casual' | 'other'>('sick');
  const [applyStartDate, setApplyStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [applyEndDate, setApplyEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [applyStartTime, setApplyStartTime] = useState<string>('09:00');
  const [applyEndTime, setApplyEndTime] = useState<string>('10:00');
  const [applyReason, setApplyReason] = useState<string>('');


  // 1. Live Clock for Employee View
  useEffect(() => {
    if (activeTab === 'clock') {
      const timer = setInterval(() => setLiveTime(new Date()), 1000);
      return () => clearInterval(timer);
    }
  }, [activeTab]);

  // 2. Elapsed working hours timer
  useEffect(() => {
    if (activeTab === 'clock' && todayRecord && todayRecord.checkInTime && !todayRecord.checkOutTime) {
      const timer = setInterval(() => {
        const now = new Date();
        const [h, m] = (todayRecord.checkInTime || '00:00').split(':').map(Number);
        const checkInDate = new Date();
        checkInDate.setHours(h, m, 0, 0);

        let diffMs = now.getTime() - checkInDate.getTime();
        if (diffMs < 0) diffMs = 0; // Check-in is tomorrow/future edge case

        const hours = Math.floor(diffMs / 3600000);
        const mins = Math.floor((diffMs % 3600000) / 60000);
        const secs = Math.floor((diffMs % 60000) / 1000);

        setElapsedTime(
          `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
        );
      }, 1000);
      return () => clearInterval(timer);
    } else {
      setElapsedTime('00:00:00');
    }
  }, [activeTab, todayRecord]);

  // 3. Load timings rules
  const loadRules = async () => {
    try {
      const r = await db.getAttendanceRules();
      if (r) {
        setRules(r);
      }
    } catch (e) {
      console.error('Failed to load attendance rules:', e);
    }
  };

  // 4. Load employees (Users table) for Admin View
  const loadUsersList = async () => {
    try {
      const list = await db.getUsers();
      setAllUsers(list || []);
    } catch (e) {
      console.error('Failed to load users:', e);
    }
  };

  // 5. Load Daily Sheet
  const loadDailySheet = async () => {
    if (!isManager) return;
    try {
      setLoading(true);
      const records = await db.getAttendance(selectedDate, activeBranchId);
      setDailyRecords(records || []);
    } catch (e) {
      console.error('Failed to load daily sheet:', e);
    } finally {
      setLoading(false);
    }
  };

  // 6. Load Monthly Grid Report
  const loadMonthlyReport = async () => {
    if (!isManager) return;
    try {
      setLoading(true);
      const records = await db.getAttendanceReport(selectedMonth, selectedYear, activeBranchId);
      setMonthlyRecords(records || []);
    } catch (e) {
      console.error('Failed to load monthly report:', e);
    } finally {
      setLoading(false);
    }
  };

  // 7. Load Employee History Calendar
  const loadEmployeeHistory = async () => {
    if (!currentUser) return;
    try {
      setLoading(true);
      const month = new Date().getMonth() + 1;
      const year = new Date().getFullYear();
      const records = await db.getMyAttendanceHistory(currentUser.id, month, year);
      setEmployeeHistory(records || []);
      
      // Determine today's record
      const todayStr = new Date().toISOString().split('T')[0];
      const todayRec = (records || []).find((r: any) => r.date === todayStr);
      setTodayRecord(todayRec || null);
    } catch (e) {
      console.error('Failed to load employee history:', e);
    } finally {
      setLoading(false);
    }
  };

  // Load Holidays
  const loadHolidays = async () => {
    try {
      setLoading(true);
      const list = await db.getHolidays(activeBranchId);
      setHolidays(list || []);
    } catch (e) {
      console.error('Failed to load holidays:', e);
    } finally {
      setLoading(false);
    }
  };

  // Load Leave/Permission Requests (Admin)
  const loadLeaveRequests = async () => {
    if (!isManager) return;
    try {
      setLoading(true);
      const list = await db.getLeaveRequests(activeBranchId);
      setLeaveRequests(list || []);
    } catch (e) {
      console.error('Failed to load leave requests:', e);
    } finally {
      setLoading(false);
    }
  };

  // Load My Requests (Employee)
  const loadMyRequests = async () => {
    if (!currentUser) return;
    try {
      setLoading(true);
      const list = await db.getLeaveRequests(activeBranchId, currentUser.id);
      setMyRequests(list || []);
    } catch (e) {
      console.error('Failed to load employee requests:', e);
    } finally {
      setLoading(false);
    }
  };

  // Admin Add Holiday
  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canAssignHolidays) {
      alert('You do not have permission to assign holidays.');
      return;
    }
    if (!holidayDate || !holidayName) {
      alert('Please fill out all fields.');
      return;
    }
    try {
      setSaving(true);
      const branchVal = holidayBranchId === 'all' ? null : Number(holidayBranchId);
      await db.saveHoliday({
        date: holidayDate,
        name: holidayName,
        branchId: branchVal
      });
      setHolidayDate('');
      setHolidayName('');
      await loadHolidays();
      alert('Holiday assigned successfully!');
    } catch (err: any) {
      alert('Failed to save holiday: ' + (err.message || String(err)));
    } finally {
      setSaving(false);
    }
  };

  // Admin Delete Holiday
  const handleDeleteHoliday = async (id: number) => {
    if (!canAssignHolidays) {
      alert('You do not have permission to delete holidays.');
      return;
    }
    if (!confirm('Are you sure you want to delete this holiday?')) return;
    try {
      setSaving(true);
      await db.deleteHoliday(id);
      await loadHolidays();
      alert('Holiday deleted.');
    } catch (err: any) {
      alert('Failed to delete holiday: ' + (err.message || String(err)));
    } finally {
      setSaving(false);
    }
  };

  // Admin Approve Request
  const handleApproveRequest = async (req: LeavePermissionRequest) => {
    if (!req.id || !currentUser) return;
    try {
      setSaving(true);
      await db.updateLeaveRequestStatus(req.id, 'approved', currentUser.id);
      await loadLeaveRequests();
      alert('Request approved successfully!');
    } catch (err: any) {
      alert('Failed to approve request: ' + (err.message || String(err)));
    } finally {
      setSaving(false);
    }
  };

  // Admin Reject Request Submission
  const handleRejectRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingRequestId || !currentUser) return;
    try {
      setSaving(true);
      await db.updateLeaveRequestStatus(rejectingRequestId, 'rejected', currentUser.id, rejectReasonInput);
      setRejectingRequestId(null);
      setRejectReasonInput('');
      await loadLeaveRequests();
      alert('Request rejected successfully.');
    } catch (err: any) {
      alert('Failed to reject request: ' + (err.message || String(err)));
    } finally {
      setSaving(false);
    }
  };

  // Employee Apply Request
  const handleApplyRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    
    if (applyType === 'leave' && (!applyStartDate || !applyEndDate || !applyReason)) {
      alert('Please fill out all fields.');
      return;
    }
    if (applyType === 'permission' && (!applyStartDate || !applyStartTime || !applyEndTime || !applyReason)) {
      alert('Please fill out all fields.');
      return;
    }

    try {
      setSaving(true);
      let hours: number | null = null;
      if (applyType === 'permission') {
        const [sh, sm] = applyStartTime.split(':').map(Number);
        const [eh, em] = applyEndTime.split(':').map(Number);
        const diffMins = (eh * 60 + em) - (sh * 60 + sm);
        hours = diffMins > 0 ? Number((diffMins / 60).toFixed(2)) : 0;
      }

      const requestPayload = {
        userId: currentUser.id,
        requestType: applyType,
        leaveType: applyType === 'leave' ? leaveTypeInput : null,
        startDate: applyStartDate,
        endDate: applyType === 'leave' ? applyEndDate : applyStartDate,
        startTime: applyType === 'permission' ? applyStartTime : null,
        endTime: applyType === 'permission' ? applyEndTime : null,
        durationHours: hours,
        reason: applyReason,
        status: 'pending',
        branchId: currentUser.branchId || 1
      };

      await db.saveLeaveRequest(requestPayload);
      setApplyReason('');
      await loadMyRequests();
      alert('Your request has been submitted successfully.');
    } catch (err: any) {
      alert('Failed to submit request: ' + (err.message || String(err)));
    } finally {
      setSaving(false);
    }
  };

  // 8. Trigger Loads based on Tab selection
  useEffect(() => {
    loadRules();
    if (isManager) {
      loadUsersList();
    }
  }, [isSuperAdmin, isAdmin, isSubAdmin]);

  useEffect(() => {
    if (activeTab === 'daily') {
      loadDailySheet();
    } else if (activeTab === 'monthly') {
      loadMonthlyReport();
    } else if (activeTab === 'clock') {
      loadEmployeeHistory();
      loadHolidays();
    } else if (activeTab === 'requests') {
      loadLeaveRequests();
    } else if (activeTab === 'holidays') {
      loadHolidays();
    } else if (activeTab === 'my-requests') {
      loadMyRequests();
    }
  }, [activeTab, selectedDate, selectedMonth, selectedYear, activeBranchId, currentUser]);


  // OTP calculation based on time chunk and branchId (changes every 30 seconds)
  const generateOTP = (timestampChunk: number, branchId: number) => {
    const secretSeed = 18923 + (branchId * 997);
    const hash = (timestampChunk * 31337 + secretSeed) % 1000000;
    return String(hash).padStart(6, '0');
  };

  const handleVerifyManagerPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    if (!currentUser) return;
    try {
      setSaving(true);
      await db.login(currentUser.username, managerPassword);
      setGeneratorAuthenticated(true);
      setManagerPassword('');
    } catch (err: any) {
      setAuthError('Incorrect password. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleExitGeneratorSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setExitError('');
    if (!currentUser) return;
    try {
      setSaving(true);
      await db.login(currentUser.username, exitPassword);
      setGeneratorAuthenticated(false);
      setShowExitGeneratorAuth(false);
      setExitPassword('');
      // Set activeTab back to normal daily sheet or My Clock
      setActiveTab(isManager ? 'daily' : 'clock');
    } catch (err: any) {
      setExitError('Incorrect password. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const isFullscreenActive = activeTab === 'generator' && generatorAuthenticated;
    window.dispatchEvent(new CustomEvent('attendance-fullscreen', { detail: isFullscreenActive }));
    
    return () => {
      window.dispatchEvent(new CustomEvent('attendance-fullscreen', { detail: false }));
    };
  }, [activeTab, generatorAuthenticated]);

  useEffect(() => {
    if (activeTab === 'generator' && generatorAuthenticated) {
      const updateCodes = async () => {
        const timestampChunk = Math.floor(Date.now() / 30000);
        const otp = generateOTP(timestampChunk, activeBranchId || 1);
        setCurrentOtp(otp);

        const qrText = `BILL_PODU_ATTENDANCE_${otp}`;
        try {
          const dataUrl = await QRCode.toDataURL(qrText, { width: 256, margin: 2 });
          setQrCodeDataUrl(dataUrl);
        } catch (err) {
          console.error('Failed to generate QR code:', err);
        }
      };

      updateCodes();
      setTimeLeft(30);
      const interval = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            updateCodes();
            return 30;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [activeTab, generatorAuthenticated]);

  const handleVerifyAndSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerificationError('');

    let otp = '';
    if (verificationMethod === 'otp') {
      otp = verificationInput;
    } else {
      if (verificationInput.startsWith('BILL_PODU_ATTENDANCE_')) {
        otp = verificationInput.replace('BILL_PODU_ATTENDANCE_', '');
      } else {
        setVerificationError('Invalid QR Code token.');
        return;
      }
    }

    const nowChunk = Math.floor(Date.now() / 30000);
    const branchId = currentUser?.branchId || activeBranchId || 1;
    const validOTP1 = generateOTP(nowChunk, branchId);
    const validOTP2 = generateOTP(nowChunk - 1, branchId);

    if (otp === validOTP1 || otp === validOTP2) {
      const action = verificationPendingAction;
      setVerificationPendingAction(null);
      if (action === 'in') {
        await handleCheckInAction();
      } else if (action === 'out') {
        await handleCheckOutAction();
      }
    } else {
      setVerificationError('Verification failed. Invalid or expired token.');
    }
  };

  // Handle Employee Check-In Action
  const handleCheckInAction = async () => {
    if (!currentUser) return;
    try {
      setSaving(true);
      const now = new Date();
      const checkInTime = now.toTimeString().split(' ')[0].slice(0, 5); // "HH:MM"
      const todayStr = now.toISOString().split('T')[0];

      // Check if late
      let notes = 'Checked in via employee panel';
      if (rules && rules.shiftStart) {
        const [sh, sm] = rules.shiftStart.split(':').map(Number);
        const graceTime = sh * 60 + sm + (rules.gracePeriodMins || 0);
        const checkInMinutes = now.getHours() * 60 + now.getMinutes();
        if (checkInMinutes > graceTime) {
          notes = 'Late Check-In';
        }
      }

      const record = {
        userId: currentUser.id,
        date: todayStr,
        status: 'present',
        checkInTime,
        checkOutTime: null,
        notes,
        branchId: currentUser.branchId || 1
      };

      await db.saveAttendance(record);
      await loadEmployeeHistory();
      alert('Checked In successfully!');
    } catch (err: any) {
      alert('Check-In failed: ' + (err.message || String(err)));
    } finally {
      setSaving(false);
    }
  };

  // Handle Employee Check-Out Action
  const handleCheckOutAction = async () => {
    if (!currentUser || !todayRecord) return;
    try {
      setSaving(true);
      const now = new Date();
      const checkOutTime = now.toTimeString().split(' ')[0].slice(0, 5); // "HH:MM"

      const record = {
        ...todayRecord,
        checkOutTime,
        updatedAt: now.toISOString()
      };

      await db.saveAttendance(record);
      await loadEmployeeHistory();
      alert('Checked Out successfully!');
    } catch (err: any) {
      alert('Check-Out failed: ' + (err.message || String(err)));
    } finally {
      setSaving(false);
    }
  };

  const handleCheckIn = async () => {
    setVerificationPendingAction('in');
    setVerificationMethod(null);
    setVerificationInput('');
    setVerificationError('');
  };

  const handleCheckOut = async () => {
    setVerificationPendingAction('out');
    setVerificationMethod(null);
    setVerificationInput('');
    setVerificationError('');
  };

  // Admin: Save or update individual record from Daily Sheet
  const handleDailyStatusChange = async (userId: number, status: 'present' | 'absent' | 'half_day' | 'leave') => {
    const existing = dailyRecords.find(r => r.userId === userId);
    const userObj = allUsers.find(u => u.id === userId);
    if (!userObj) return;

    if (!canModifyUserAttendance(userObj.role || 'employee')) {
      alert("You do not have permission to modify this user's attendance.");
      return;
    }

    try {
      setSaving(true);
      let inTime = existing?.checkInTime || null;
      let outTime = existing?.checkOutTime || null;

      // Automatically default timings for quick markings
      if (status === 'present' && !inTime) {
        inTime = rules.shiftStart;
        outTime = rules.shiftEnd;
      } else if (status === 'half_day' && !inTime) {
        inTime = rules.shiftStart;
        outTime = '13:00';
      } else if (status === 'absent' || status === 'leave') {
        inTime = null;
        outTime = null;
      }

      const record = {
        userId,
        date: selectedDate,
        status,
        checkInTime: inTime,
        checkOutTime: outTime,
        notes: existing?.notes || '',
        branchId: userObj.branchId || activeBranchId || 1
      };

      await db.saveAttendance(record);
      await loadDailySheet();
    } catch (err: any) {
      alert('Failed to update status: ' + (err.message || String(err)));
    } finally {
      setSaving(false);
    }
  };

  // Admin: Save edit from detail modal (called from Daily List notes edit or Monthly Cell click)
  const handleDetailSave = async () => {
    if (!activeCellDetail) return;
    const { record, date, userName } = activeCellDetail;
    const userId = record ? record.userId : allUsers.find(u => u.name === userName)?.id;
    const userObj = allUsers.find(u => u.id === userId);
    
    if (!userId || !userObj) {
      alert('User details not found.');
      return;
    }

    try {
      setSaving(true);
      const toSave = {
        userId,
        date,
        status: cellEditStatus,
        checkInTime: cellEditStatus === 'present' || cellEditStatus === 'half_day' ? (cellEditInTime || null) : null,
        checkOutTime: cellEditStatus === 'present' || cellEditStatus === 'half_day' ? (cellEditOutTime || null) : null,
        notes: cellEditNotes || '',
        branchId: userObj.branchId || activeBranchId || 1
      };

      await db.saveAttendance(toSave);
      setActiveCellDetail(null);
      
      // Reload matching tab data
      if (activeTab === 'daily') {
        await loadDailySheet();
      } else {
        await loadMonthlyReport();
      }
      alert('Attendance record updated.');
    } catch (err: any) {
      alert('Failed to save details: ' + (err.message || String(err)));
    } finally {
      setSaving(false);
    }
  };

  // Admin: Open cell details for edit
  const openCellDetail = (userName: string, dateStr: string, record: any) => {
    setActiveCellDetail({ userName, date: dateStr, record });
    setCellEditStatus(record ? record.status : 'present');
    setCellEditInTime(record?.checkInTime || rules.shiftStart);
    setCellEditOutTime(record?.checkOutTime || rules.shiftEnd);
    setCellEditNotes(record?.notes || '');
  };

  // Admin: Mark all default Present for current date
  const handleMarkAllPresent = async () => {
    if (!confirm('Are you sure you want to mark all unmarked employees as Present for today?')) return;
    try {
      setSaving(true);
      for (const user of allUsers) {
        if (user.role === 'super_admin') continue;
        
        // Filter by branch
        if (activeBranchId !== 0 && user.branchId !== activeBranchId) continue;

        // Check permission
        if (!canModifyUserAttendance(user.role || 'employee')) continue;

        // Skip if already marked
        const alreadyMarked = dailyRecords.find(r => r.userId === user.id && r.status);
        if (alreadyMarked) continue;

        const record = {
          userId: user.id,
          date: selectedDate,
          status: 'present',
          checkInTime: rules.shiftStart,
          checkOutTime: rules.shiftEnd,
          notes: 'Auto-marked Present',
          branchId: user.branchId || activeBranchId || 1
        };
        await db.saveAttendance(record);
      }
      await loadDailySheet();
      alert('All unmarked employees marked Present.');
    } catch (err: any) {
      alert('Failed: ' + (err.message || String(err)));
    } finally {
      setSaving(false);
    }
  };

  // Admin: Save Rules timing
  const handleRulesSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin && !isAdmin) {
      alert('Unauthorized access.');
      return;
    }
    try {
      setSaving(true);
      await db.saveAttendanceRules(rules);
      alert('Attendance rules updated successfully.');
      await loadRules();
    } catch (err: any) {
      alert('Failed to save rules: ' + (err.message || String(err)));
    } finally {
      setSaving(false);
    }
  };

  // Format time display
  const formatTimeDisplay = (time24: string | null | undefined) => {
    if (!time24) return '--:--';
    const [hStr, mStr] = time24.split(':');
    const h = parseInt(hStr);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 === 0 ? 12 : h % 12;
    return `${String(displayH).padStart(2, '0')}:${mStr} ${ampm}`;
  };

  // Export Monthly Grid to CSV
  const handleExportCSV = () => {
    if (allUsers.length === 0) return;
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    
    // Header Row: Name, Date 1, Date 2, ..., Stats
    const header = ['Employee Name', 'Role', ...Array.from({ length: daysInMonth }, (_, i) => `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`), 'Present Days', 'Absent Days', 'Leaves', 'Half Days'];
    
    const rows = [header];

    // Filter users
    const filteredUsers = allUsers.filter(u => {
      if (u.role === 'super_admin') return false;
      if (activeBranchId !== 0 && u.branchId !== activeBranchId) return false;
      return u.name.toLowerCase().includes(searchTerm.toLowerCase());
    });

    for (const u of filteredUsers) {
      const userRecs = monthlyRecords.filter(r => r.userId === u.id);
      const rowData: any[] = [u.name, u.role];
      
      let presentCount = 0;
      let absentCount = 0;
      let leaveCount = 0;
      let halfCount = 0;

      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const record = userRecs.find(r => r.date === dateStr);
        if (record) {
          rowData.push(record.status.toUpperCase());
          if (record.status === 'present') presentCount++;
          else if (record.status === 'absent') absentCount++;
          else if (record.status === 'leave') leaveCount++;
          else if (record.status === 'half_day') halfCount++;
        } else {
          rowData.push('N/A');
        }
      }

      rowData.push(presentCount, absentCount, leaveCount, halfCount);
      rows.push(rowData);
    }

    const csvContent = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Attendance_Report_${selectedYear}_${String(selectedMonth).padStart(2, '0')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Helper values for Employee calendar rendering
  const daysInCurrentMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const currentMonthName = new Date().toLocaleString('default', { month: 'long' });

  // Filter daily list
  const filteredDailyRecords = allUsers.filter(u => {
    if (u.role === 'super_admin') return false;
    if (activeBranchId !== 0 && u.branchId !== activeBranchId) return false;
    return u.name.toLowerCase().includes(searchTerm.toLowerCase());
  }).map(u => {
    const rec = dailyRecords.find(r => r.userId === u.id);
    return {
      userId: u.id,
      name: u.name,
      role: u.role,
      username: u.username,
      attendanceId: rec?.id,
      status: rec?.status || 'unmarked',
      checkInTime: rec?.checkInTime,
      checkOutTime: rec?.checkOutTime,
      notes: rec?.notes,
    } as AttendanceRecord;
  });

  // Group employee requests by month & year
  const groupRequestsByMonth = (reqs: LeavePermissionRequest[]) => {
    const groups: { [key: string]: LeavePermissionRequest[] } = {};
    reqs.forEach(r => {
      const dateObj = new Date(r.startDate);
      if (isNaN(dateObj.getTime())) return;
      const monthYear = dateObj.toLocaleString('default', { month: 'long', year: 'numeric' });
      if (!groups[monthYear]) {
        groups[monthYear] = [];
      }
      groups[monthYear].push(r);
    });
    return groups;
  };

  return (
    <div className="min-h-full rounded-none md:rounded-[2rem] bg-white/70 p-4 md:p-8 shadow-soft backdrop-blur-sm">
      
      {/* Title Header */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary-600">Operations</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900">Attendance</h1>
          <p className="mt-2 text-slate-600">Track and manage employee work hours, daily check-ins, and office rules.</p>
        </div>
        
        {/* Navigation Tabs */}
        <div className="flex flex-wrap bg-slate-900/5 p-1.5 rounded-2xl border border-slate-200 gap-1">
          {!isManager && (
            <>
              <button
                onClick={() => setActiveTab('clock')}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200 ${
                  activeTab === 'clock' ? 'bg-white text-slate-900 shadow-md shadow-slate-200' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Clock className="w-4 h-4" /> My Clock
              </button>
              <button
                onClick={() => setActiveTab('my-requests')}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200 ${
                  activeTab === 'my-requests' ? 'bg-white text-slate-900 shadow-md shadow-slate-200' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-4 h-4" /> Apply Leave/Permission
              </button>
              <button
                onClick={() => setActiveTab('holidays')}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200 ${
                  activeTab === 'holidays' ? 'bg-white text-slate-900 shadow-md shadow-slate-200' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CalendarRange className="w-4 h-4" /> Holidays
              </button>
            </>
          )}

          {isManager && (
            <>
              {isSubAdmin && (
                <>
                  <button
                    onClick={() => setActiveTab('clock')}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200 ${
                      activeTab === 'clock' ? 'bg-white text-slate-900 shadow-md shadow-slate-200' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Clock className="w-4 h-4" /> My Clock
                  </button>
                  <button
                    onClick={() => setActiveTab('my-requests')}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200 ${
                      activeTab === 'my-requests' ? 'bg-white text-slate-900 shadow-md shadow-slate-200' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <FileText className="w-4 h-4" /> Apply Leave/Permission
                  </button>
                </>
              )}
              <button
                onClick={() => setActiveTab('daily')}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200 ${
                  activeTab === 'daily' ? 'bg-white text-slate-900 shadow-md shadow-slate-200' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <UserCheck className="w-4 h-4" /> Daily Sheet
              </button>
              <button
                onClick={() => setActiveTab('monthly')}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200 ${
                  activeTab === 'monthly' ? 'bg-white text-slate-900 shadow-md shadow-slate-200' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Calendar className="w-4 h-4" /> Monthly Overview
              </button>
              <button
                onClick={() => setActiveTab('requests')}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200 ${
                  activeTab === 'requests' ? 'bg-white text-slate-900 shadow-md shadow-slate-200' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-4 h-4" /> Approvals
              </button>
              <button
                onClick={() => setActiveTab('holidays')}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200 ${
                  activeTab === 'holidays' ? 'bg-white text-slate-900 shadow-md shadow-slate-200' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CalendarRange className="w-4 h-4" /> Holidays
              </button>
              <button
                onClick={() => {
                  setGeneratorAuthenticated(false);
                  setActiveTab('generator');
                }}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200 ${
                  activeTab === 'generator' ? 'bg-white text-slate-900 shadow-md shadow-slate-200' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <QrCode className="w-4 h-4" /> OTP/QR Generator
              </button>
              {(isSuperAdmin || isAdmin) && (
                <button
                  onClick={() => setActiveTab('rules')}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200 ${
                    activeTab === 'rules' ? 'bg-white text-slate-900 shadow-md shadow-slate-200' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Settings className="w-4 h-4" /> Office Rules
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="mt-6">

        {/* Tab 1: Employee Clock view */}
        {activeTab === 'clock' && currentUser && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Clock-in control panel */}
            <div className="lg:col-span-1 card border border-white/60 bg-white/85 shadow-soft flex flex-col items-center justify-center p-8 text-center">
              <span className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-1">Today's Date</span>
              <span className="text-sm font-semibold text-slate-600 mb-8">{liveTime.toLocaleDateString('default', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
              
              {/* Modern Animated Live Clock */}
              <div className="relative flex items-center justify-center w-56 h-56 rounded-full bg-slate-50/50 border border-slate-100 shadow-soft mb-8">
                {/* SVG seconds circular track */}
                <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 220 220">
                  <defs>
                    <linearGradient id="clockGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#3b82f6" />
                      <stop offset="50%" stopColor="#6366f1" />
                      <stop offset="100%" stopColor="#ec4899" />
                    </linearGradient>
                  </defs>
                  {/* Background Track */}
                  <circle
                    cx="110"
                    cy="110"
                    r="98"
                    className="stroke-slate-100 fill-none"
                    strokeWidth="4"
                  />
                  {/* Glowing Active Track */}
                  <circle
                    cx="110"
                    cy="110"
                    r="98"
                    className="fill-none transition-[stroke-dashoffset] duration-300"
                    stroke="url(#clockGradient)"
                    strokeWidth="5"
                    strokeDasharray="615.75"
                    strokeDashoffset={615.75 - (liveTime.getSeconds() / 60) * 615.75}
                    strokeLinecap="round"
                  />
                </svg>
                
                {/* Clock Inner Content */}
                <div className="flex flex-col items-center justify-center z-10">
                  <div className="flex items-center justify-center">
                    {/* Hours */}
                    <div className="flex h-10 overflow-hidden items-center justify-center">
                      {String(liveTime.getHours() % 12 || 12).padStart(2, '0').split('').map((char, idx) => (
                        <span key={`h-${idx}-${char}`} className="clock-digit text-3xl font-black tracking-tight text-slate-800">
                          {char}
                        </span>
                      ))}
                    </div>

                    <span className="text-2xl font-black text-slate-400 mx-0.5 animate-pulse">:</span>

                    {/* Minutes */}
                    <div className="flex h-10 overflow-hidden items-center justify-center">
                      {String(liveTime.getMinutes()).padStart(2, '0').split('').map((char, idx) => (
                        <span key={`m-${idx}-${char}`} className="clock-digit text-3xl font-black tracking-tight text-slate-800">
                          {char}
                        </span>
                      ))}
                    </div>

                    {/* Seconds */}
                    <div className="flex h-6 overflow-hidden items-center justify-center self-end mb-0.5 ml-1">
                      <span className="text-xs font-bold text-slate-400 mr-0.5">:</span>
                      {String(liveTime.getSeconds()).padStart(2, '0').split('').map((char, idx) => (
                        <span key={`s-${idx}-${char}`} className="clock-digit text-xs font-bold text-slate-400">
                          {char}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span className="mt-2 text-[9px] font-bold uppercase tracking-widest text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full border border-primary-100/50">
                    {liveTime.getHours() >= 12 ? 'PM' : 'AM'}
                  </span>
                </div>
              </div>

              {/* Working Hours timer (if checked-in) */}
              {todayRecord && todayRecord.checkInTime && !todayRecord.checkOutTime && (
                <div className="mb-6 p-3 px-6 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center gap-3">
                  <Timer className="w-5 h-5 text-emerald-500 animate-spin" />
                  <div>
                    <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Working Duration</span>
                    <span className="text-lg font-bold text-emerald-700">{elapsedTime}</span>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="w-full space-y-3">
                {!todayRecord ? (
                  <button
                    onClick={handleCheckIn}
                    disabled={saving}
                    className="btn-primary w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:scale-[1.01]"
                  >
                    <LogIn className="w-5 h-5" /> Check In Now
                  </button>
                ) : !todayRecord.checkOutTime ? (
                  <button
                    onClick={handleCheckOut}
                    disabled={saving}
                    className="bg-rose-600 hover:bg-rose-700 text-white w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all hover:scale-[1.01] shadow-lg shadow-rose-200"
                  >
                    <LogOut className="w-5 h-5" /> Check Out Now
                  </button>
                ) : (
                  <div className="w-full bg-slate-100 border border-slate-200 rounded-2xl p-4 flex flex-col items-center justify-center gap-2">
                    <CheckCircle2 className="w-8 h-8 text-slate-400" />
                    <span className="text-sm font-bold text-slate-500">Day Completed</span>
                    <div className="text-xs text-slate-400">
                      In: {formatTimeDisplay(todayRecord.checkInTime)} | Out: {formatTimeDisplay(todayRecord.checkOutTime)}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Today's log details */}
              {todayRecord && (
                <div className="w-full mt-6 border-t border-slate-100 pt-6 text-left space-y-3">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Today's Details</span>
                  <div className="flex justify-between items-center text-sm py-1 border-b border-slate-50">
                    <span className="text-slate-500">Status</span>
                    <span className={`capitalize font-semibold text-xs px-2.5 py-1 rounded-full ${
                      todayRecord.status === 'present' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                      todayRecord.status === 'half_day' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                      todayRecord.status === 'leave' ? 'bg-purple-50 text-purple-700 border border-purple-100' :
                      'bg-rose-50 text-rose-700 border border-rose-100'
                    }`}>
                      {todayRecord.status === 'present' ? 'Present' : todayRecord.status === 'half_day' ? 'Half Day' : todayRecord.status === 'leave' ? 'Leave' : 'Absent'}
                    </span>
                  </div>
                  {todayRecord.notes && (
                    <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-100 italic">
                      Note: {todayRecord.notes}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Employee Monthly Calendar & Stats */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Personal stats cards */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="card border border-white/60 bg-white/85 shadow-soft p-4">
                  <span className="text-xs font-medium text-slate-400 block">Days Present</span>
                  <span className="text-2xl font-bold text-slate-800 mt-1">
                    {employeeHistory.filter(r => r.status === 'present').length}
                  </span>
                </div>
                <div className="card border border-white/60 bg-white/85 shadow-soft p-4">
                  <span className="text-xs font-medium text-slate-400 block">Half Days</span>
                  <span className="text-2xl font-bold text-slate-800 mt-1">
                    {employeeHistory.filter(r => r.status === 'half_day').length}
                  </span>
                </div>
                <div className="card border border-white/60 bg-white/85 shadow-soft p-4">
                  <span className="text-xs font-medium text-slate-400 block">Leaves Taken</span>
                  <span className="text-2xl font-bold text-slate-800 mt-1">
                    {employeeHistory.filter(r => r.status === 'leave').length}
                  </span>
                </div>
                <div className="card border border-white/60 bg-white/85 shadow-soft p-4">
                  <span className="text-xs font-medium text-slate-400 block">Absent Days</span>
                  <span className="text-2xl font-bold text-slate-800 mt-1">
                    {employeeHistory.filter(r => r.status === 'absent').length}
                  </span>
                </div>
                <div className="card border border-white/60 bg-white/85 shadow-soft p-4">
                  <span className="text-xs font-medium text-slate-400 block">Holidays</span>
                  <span className="text-2xl font-bold text-slate-800 mt-1">
                    {(() => {
                      const now = new Date();
                      return holidays.filter((h) => {
                        if (!h.date) return false;
                        const [hYear, hMonth] = h.date.split('-').map(Number);
                        return hYear === now.getFullYear() && hMonth === (now.getMonth() + 1);
                      }).length;
                    })()}
                  </span>
                </div>
              </div>

              {/* Monthly calendar sheet */}
              <div className="card border border-white/60 bg-white/85 shadow-soft p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary-500" /> Attendance for {currentMonthName}
                </h3>
                <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-slate-400 border-b border-slate-100 pb-2 mb-2">
                  <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
                </div>
                
                {/* Simplified list of days */}
                <div className="grid grid-cols-7 gap-2">
                  {/* Empty cells for starting offset of current month */}
                  {Array.from({ length: new Date(new Date().getFullYear(), new Date().getMonth(), 1).getDay() }).map((_, idx) => (
                    <div key={`offset-${idx}`} className="h-12" />
                  ))}

                  {/* Day cells */}
                  {Array.from({ length: daysInCurrentMonth }).map((_, idx) => {
                    const dayNum = idx + 1;
                    const dateStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                    const record = employeeHistory.find(r => r.date === dateStr);
                    const isHoliday = holidays.some(h => h.date === dateStr);
                    const holidayObj = holidays.find(h => h.date === dateStr);
                    
                    return (
                      <div 
                        key={`day-${dayNum}`}
                        className={`h-12 rounded-xl flex flex-col items-center justify-center border transition-all ${
                          isHoliday ? 'holiday-gold' :
                          record?.status === 'present' ? 'bg-emerald-50 border-emerald-200 text-emerald-800 font-bold' :
                          record?.status === 'half_day' ? 'bg-amber-50 border-amber-200 text-amber-800 font-bold' :
                          record?.status === 'leave' ? 'bg-purple-50 border-purple-200 text-purple-800 font-bold' :
                          record?.status === 'absent' ? 'bg-rose-50 border-rose-200 text-rose-800 font-bold' :
                          'bg-slate-50/50 border-slate-100 text-slate-400'
                        }`}
                        title={
                          isHoliday ? `Holiday: ${holidayObj?.name || 'Assigned Holiday'}` :
                          record ? `In: ${record.checkInTime || '--:--'}, Out: ${record.checkOutTime || '--:--'}. Note: ${record.notes || 'None'}` : 
                          'No Record'
                        }
                      >
                        <span className="text-xs">{dayNum}</span>
                        {isHoliday ? (
                          <span className="text-[8px] uppercase tracking-tighter mt-0.5 font-bold">
                            H
                          </span>
                        ) : record ? (
                          <span className="text-[8px] uppercase tracking-tighter mt-0.5">
                            {record.status === 'present' ? 'P' : record.status === 'half_day' ? 'HD' : record.status === 'leave' ? 'L' : 'A'}
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Admin Daily Attendance Sheet */}
        {activeTab === 'daily' && isManager && (
          <div className="card border border-white/60 bg-white/85 shadow-soft p-6">
            
            {/* Top controls and selectors */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
              
              {/* Date Input */}
              <div className="flex items-center gap-3">
                <label className="text-sm font-semibold text-slate-700">Select Date:</label>
                <input 
                  type="date" 
                  value={selectedDate} 
                  onChange={(e) => setSelectedDate(e.target.value)} 
                  className="input py-2 bg-white rounded-xl shadow-sm border-slate-200"
                />
              </div>

              {/* Search Bar */}
              <div className="relative w-full md:w-72">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                  placeholder="Search employees..." 
                  className="input pl-10 w-full py-2 bg-white rounded-xl shadow-sm border-slate-200"
                />
              </div>

              {/* Bulk Actions */}
              <button
                onClick={handleMarkAllPresent}
                className="btn-secondary flex items-center gap-2 px-4 py-2 text-sm font-semibold hover:border-emerald-100 hover:text-emerald-600 transition-all rounded-xl"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Mark All Present
              </button>
            </div>

            {/* List/Table of Daily Records */}
            {loading ? (
              <div className="text-center py-12">
                <p className="text-slate-500">Loading daily sheet...</p>
              </div>
            ) : filteredDailyRecords.length > 0 ? (
              <div className="overflow-x-auto rounded-2xl border border-slate-100">
                <table className="w-full border-collapse text-left bg-white/50">
                  <thead>
                    <tr className="bg-slate-900/5 text-slate-500 text-xs uppercase tracking-wider font-bold border-b border-slate-100">
                      <th className="px-6 py-4">Employee</th>
                      <th className="px-6 py-4">Role</th>
                      <th className="px-6 py-4 text-center">Status</th>
                      <th className="px-6 py-4">Check-In</th>
                      <th className="px-6 py-4">Check-Out</th>
                      <th className="px-6 py-4">Notes</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredDailyRecords.map((item) => (
                      <tr key={item.userId} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 font-semibold text-slate-800">{item.name}</td>
                        <td className="px-6 py-4 text-slate-500 capitalize">{item.role}</td>
                        
                        {/* Status marking segment buttons */}
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-1.5 bg-slate-900/5 p-1 rounded-xl w-fit mx-auto border border-slate-100">
                            {(['present', 'absent', 'half_day', 'leave'] as const).map((st) => (
                              <button
                                key={st}
                                disabled={!canModifyUserAttendance(item.role || 'employee')}
                                onClick={() => handleDailyStatusChange(item.userId, st)}
                                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg transition-all ${
                                  item.status === st 
                                    ? (st === 'present' ? 'bg-emerald-600 text-white shadow' :
                                       st === 'absent' ? 'bg-rose-600 text-white shadow' :
                                       st === 'half_day' ? 'bg-amber-500 text-white shadow' :
                                       'bg-purple-600 text-white shadow')
                                    : 'text-slate-555 hover:text-slate-950'
                                }`}
                              >
                                {st === 'present' ? 'P' : st === 'absent' ? 'A' : st === 'half_day' ? 'HD' : 'L'}
                              </button>
                            ))}
                          </div>
                        </td>
                        
                        <td className="px-6 py-4 text-slate-600">{formatTimeDisplay(item.checkInTime)}</td>
                        <td className="px-6 py-4 text-slate-600">{formatTimeDisplay(item.checkOutTime)}</td>
                        
                        <td className="px-6 py-4 max-w-[200px] truncate text-slate-400 italic" title={item.notes || ''}>
                          {item.notes || '--'}
                        </td>
                        
                        <td className="px-6 py-4 text-right">
                          {canModifyUserAttendance(item.role || 'employee') ? (
                            <button
                              onClick={() => openCellDetail(item.name || '', selectedDate, dailyRecords.find(r => r.userId === item.userId))}
                              className="text-xs font-semibold text-primary-600 hover:underline"
                            >
                              Edit Log
                            </button>
                          ) : (
                            <button
                              onClick={() => openCellDetail(item.name || '', selectedDate, dailyRecords.find(r => r.userId === item.userId))}
                              className="text-xs font-semibold text-slate-400 hover:underline"
                            >
                              View Details
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500">
                No employees matching criteria found for active branch.
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Admin Monthly Report Grid */}
        {activeTab === 'monthly' && isManager && (
          <div className="card border border-white/60 bg-white/85 shadow-soft p-6">
            
            {/* Grid Selectors and Download controls */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
              <div className="flex flex-wrap items-center gap-3">
                
                {/* Month Select */}
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  className="input py-2 bg-white rounded-xl shadow-sm border-slate-200"
                  title="Select Month"
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {new Date(0, i).toLocaleString('default', { month: 'long' })}
                    </option>
                  ))}
                </select>

                {/* Year Select */}
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="input py-2 bg-white rounded-xl shadow-sm border-slate-200"
                  title="Select Year"
                >
                  {[2025, 2026, 2027, 2028].map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                
                {/* Search in Report */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text" 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)} 
                    placeholder="Search name..." 
                    className="input pl-9 py-1.5 w-48 bg-white rounded-xl border-slate-200"
                  />
                </div>
              </div>

              {/* CSV Export Button */}
              <button
                onClick={handleExportCSV}
                className="btn-primary flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl"
              >
                <Download className="w-4 h-4" /> Export Report (CSV)
              </button>
            </div>

            {/* Matrix Sheet Grid rendering */}
            {loading ? (
              <div className="text-center py-12">
                <p className="text-slate-500">Loading monthly report matrix...</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-100">
                <table className="w-full border-collapse text-left bg-white/50 text-xs">
                  <thead>
                    <tr className="bg-slate-900/5 text-slate-500 font-bold border-b border-slate-100">
                      <th className="px-4 py-3 min-w-[120px] sticky left-0 bg-slate-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">Employee</th>
                      {Array.from({ length: new Date(selectedYear, selectedMonth, 0).getDate() }, (_, i) => (
                        <th key={i + 1} className="px-2 py-3 text-center min-w-[28px]">{i + 1}</th>
                      ))}
                      <th className="px-3 py-3 text-center min-w-[40px] text-emerald-600">P</th>
                      <th className="px-3 py-3 text-center min-w-[40px] text-rose-600">A</th>
                      <th className="px-3 py-3 text-center min-w-[40px] text-purple-600">L</th>
                      <th className="px-3 py-3 text-center min-w-[40px] text-amber-600">HD</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {allUsers.filter(u => {
                      if (u.role === 'super_admin') return false;
                      if (activeBranchId !== 0 && u.branchId !== activeBranchId) return false;
                      return u.name.toLowerCase().includes(searchTerm.toLowerCase());
                    }).map((u) => {
                      const userRecs = monthlyRecords.filter(r => r.userId === u.id);
                      const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
                      
                      let presentCount = 0;
                      let absentCount = 0;
                      let leaveCount = 0;
                      let halfCount = 0;

                      return (
                        <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-2.5 font-semibold text-slate-800 sticky left-0 bg-white shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                            {u.name}
                          </td>
                          {Array.from({ length: daysInMonth }, (_, dayIdx) => {
                            const dayNum = dayIdx + 1;
                            const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                            const record = userRecs.find(r => r.date === dateStr);
                            
                            if (record) {
                              if (record.status === 'present') presentCount++;
                              else if (record.status === 'absent') absentCount++;
                              else if (record.status === 'leave') leaveCount++;
                              else if (record.status === 'half_day') halfCount++;
                            }

                            return (
                              <td key={dayNum} className="px-1 py-2.5 text-center">
                                <button
                                  onClick={() => openCellDetail(u.name || '', dateStr, record)}
                                  className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[9px] mx-auto border transition-all ${
                                    record?.status === 'present' ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:scale-105' :
                                    record?.status === 'absent' ? 'bg-rose-50 border-rose-200 text-rose-700 hover:scale-105' :
                                    record?.status === 'half_day' ? 'bg-amber-50 border-amber-200 text-amber-700 hover:scale-105' :
                                    record?.status === 'leave' ? 'bg-purple-50 border-purple-200 text-purple-700 hover:scale-105' :
                                    'bg-slate-50 border-slate-100 text-slate-300 hover:bg-slate-100 hover:text-slate-500'
                                  }`}
                                  title={record ? `Date: ${dateStr}\nStatus: ${record.status}\nIn: ${record.checkInTime || '--:--'}\nOut: ${record.checkOutTime || '--:--'}\nNote: ${record.notes || ''}` : `Date: ${dateStr}\nNo record marked`}
                                >
                                  {record ? (
                                    record.status === 'present' ? 'P' : 
                                    record.status === 'absent' ? 'A' : 
                                    record.status === 'half_day' ? 'H' : 'L'
                                  ) : '+'}
                                </button>
                              </td>
                            );
                          })}
                          
                          {/* Aggregates counts column */}
                          <td className="px-3 py-2.5 text-center font-bold text-emerald-600">{presentCount}</td>
                          <td className="px-3 py-2.5 text-center font-bold text-rose-600">{absentCount}</td>
                          <td className="px-3 py-2.5 text-center font-bold text-purple-600">{leaveCount}</td>
                          <td className="px-3 py-2.5 text-center font-bold text-amber-500">{halfCount}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Admin Timings and Grace Period Rules */}
        {activeTab === 'rules' && (isSuperAdmin || isAdmin) && (
          <div className="max-w-xl mx-auto card border border-white/60 bg-white/85 shadow-soft p-6">
            <h2 className="mb-4 text-xl font-semibold text-slate-900 flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary-500 animate-spin" /> Attendance & Timings Rules
            </h2>
            <p className="text-sm text-slate-500 mb-6">
              Configure shift timings and grace period settings. Employees checking in past grace threshold are marked Late automatically.
            </p>

            <form onSubmit={handleRulesSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Shift Start Time</label>
                <input 
                  type="time" 
                  value={rules.shiftStart} 
                  onChange={(e) => setRules({ ...rules, shiftStart: e.target.value })} 
                  className="input w-full"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Shift End Time</label>
                <input 
                  type="time" 
                  value={rules.shiftEnd} 
                  onChange={(e) => setRules({ ...rules, shiftEnd: e.target.value })} 
                  className="input w-full"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Grace Period (Minutes)</label>
                <input 
                  type="number" 
                  min="0"
                  max="120"
                  value={rules.gracePeriodMins} 
                  onChange={(e) => setRules({ ...rules, gracePeriodMins: parseInt(e.target.value) || 0 })} 
                  className="input w-full"
                  placeholder="e.g. 15"
                  required
                />
                <span className="text-xs text-slate-400 mt-1 block">Maximum minutes past shift start before check-in is flagged late.</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100 mt-2">
                <div>
                  <label className="text-sm font-semibold text-slate-900">Allow Sub-Admins to Assign Holidays</label>
                  <p className="text-xs text-slate-500">Toggle whether Sub-Admins have permission to create and delete holidays.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setRules({ ...rules, allowSubadminHoliday: !rules.allowSubadminHoliday })}
                  style={{ backgroundColor: rules.allowSubadminHoliday ? 'var(--primary)' : '#cbd5e1' }}
                  className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none"
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${rules.allowSubadminHoliday ? 'translate-x-6' : 'translate-x-1'}`}
                  />
                </button>
              </div>


              <button
                type="submit"
                disabled={saving}
                className="btn-primary w-full py-3 rounded-2xl font-bold flex items-center justify-center gap-2 mt-4"
              >
                <Save className="w-4 h-4" /> Save Rules timings
              </button>
            </form>
          </div>
        )}

        {/* Tab 5: Admin Leave/Permission Approvals */}
        {activeTab === 'requests' && isManager && (
          <div className="space-y-6">
            <div className="card border border-white/60 bg-white/85 shadow-soft p-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
                <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary-500" /> Leave & Permission Approvals
                </h2>
                
                {/* Filter buttons */}
                <div className="flex bg-slate-900/5 p-1 rounded-xl border border-slate-100 gap-1 text-xs font-semibold">
                  {(['pending', 'approved', 'rejected', 'all'] as const).map((st) => (
                    <button
                      key={st}
                      onClick={() => setRequestFilterStatus(st)}
                      className={`capitalize px-3 py-1.5 rounded-lg transition-all ${
                        requestFilterStatus === st 
                          ? 'bg-white text-slate-900 shadow-sm' 
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {loading ? (
                <div className="text-center py-12">
                  <p className="text-slate-500">Loading requests...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {leaveRequests.filter(r => requestFilterStatus === 'all' || r.status === requestFilterStatus).length === 0 ? (
                    <div className="text-center py-12 text-slate-500 bg-slate-50/50 border border-dashed border-slate-200 rounded-2xl">
                      No requests found in this status.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4">
                      {leaveRequests
                        .filter(r => requestFilterStatus === 'all' || r.status === requestFilterStatus)
                        .map((req) => (
                          <div key={req.id} className="border border-slate-100 bg-white/50 hover:bg-white rounded-2xl p-5 shadow-sm transition-all duration-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-800 text-base">{req.employeeName}</span>
                                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 capitalize">{req.employeeRole}</span>
                                <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md ${
                                  req.requestType === 'leave' ? 'bg-purple-50 text-purple-700 border border-purple-100' : 'bg-blue-50 text-blue-700 border border-blue-100'
                                }`}>
                                  {req.requestType === 'leave' ? `${req.leaveType || 'casual'} leave` : 'permission'}
                                </span>
                              </div>

                              <div className="text-xs text-slate-600 space-y-1">
                                {req.requestType === 'leave' ? (
                                  <div className="flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                    <span>Duration: <span className="font-semibold text-slate-800">{req.startDate}</span> to <span className="font-semibold text-slate-800">{req.endDate}</span></span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                                    <span>Date: <span className="font-semibold text-slate-800">{req.startDate}</span> | Time: <span className="font-semibold text-slate-800">{formatTimeDisplay(req.startTime)} - {formatTimeDisplay(req.endTime)}</span> ({req.durationHours} hrs)</span>
                                  </div>
                                )}
                                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 mt-1 italic text-slate-600">
                                  " {req.reason} "
                                </div>
                                {req.status === 'rejected' && req.rejectReason && (
                                  <div className="bg-rose-50 text-rose-700 p-2.5 rounded-xl border border-rose-100 mt-1">
                                    <strong>Rejection Reason:</strong> {req.rejectReason}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 self-start md:self-center shrink-0">
                              {req.status === 'pending' ? (
                                <>
                                  <button
                                    onClick={() => handleApproveRequest(req)}
                                    disabled={saving}
                                    className="px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all flex items-center gap-1 shadow-sm shadow-emerald-100"
                                  >
                                    <Check className="w-3.5 h-3.5" /> Approve
                                  </button>
                                  <button
                                    onClick={() => {
                                      setRejectingRequestId(req.id || null);
                                      setRejectReasonInput('');
                                    }}
                                    disabled={saving}
                                    className="px-3.5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-all flex items-center gap-1 shadow-sm shadow-rose-100"
                                  >
                                    <X className="w-3.5 h-3.5" /> Reject
                                  </button>
                                </>
                              ) : (
                                <span className={`text-xs font-bold px-3 py-1.5 rounded-xl capitalize ${
                                  req.status === 'approved' 
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                                    : 'bg-rose-50 text-rose-700 border border-rose-100'
                                }`}>
                                  {req.status}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 6: Holiday Assigner / Viewer */}
        {activeTab === 'holidays' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Holiday Assigner Form (Admin or Allowed Sub-Admin) */}
            {canAssignHolidays && (
              <div className="lg:col-span-1 card border border-white/60 bg-white/85 shadow-soft p-6 h-fit">
                <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <PlusCircle className="w-5 h-5 text-primary-500" /> Assign Holiday
                </h2>
                <form onSubmit={handleAddHoliday} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Holiday Date</label>
                    <input 
                      type="date" 
                      value={holidayDate}
                      onChange={(e) => setHolidayDate(e.target.value)}
                      className="input w-full"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Holiday Name / Occasion</label>
                    <input 
                      type="text" 
                      value={holidayName}
                      onChange={(e) => setHolidayName(e.target.value)}
                      placeholder="e.g. Independence Day, New Year"
                      className="input w-full"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Applicable Branch</label>
                    <select
                      value={holidayBranchId}
                      onChange={(e) => setHolidayBranchId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                      className="input w-full"
                    >
                      <option value="all">All Branches</option>
                      <option value={activeBranchId || 1}>Current Branch Only</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={saving}
                    className="btn-primary w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2"
                  >
                    <Save className="w-4 h-4" /> Save Holiday
                  </button>
                </form>
              </div>
            )}

            {/* Holidays List */}
            <div className={`${canAssignHolidays ? 'lg:col-span-2' : 'lg:col-span-3'} card border border-white/60 bg-white/85 shadow-soft p-6`}>
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <CalendarRange className="w-5 h-5 text-primary-500" /> Holidays List
              </h2>
              {loading ? (
                <div className="text-center py-12">
                  <p className="text-slate-500">Loading holidays...</p>
                </div>
              ) : holidays.length > 0 ? (
                <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white/50">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="bg-slate-900/5 text-slate-500 font-bold border-b border-slate-100">
                        <th className="px-6 py-3">Date</th>
                        <th className="px-6 py-3">Holiday Occasion</th>
                        <th className="px-6 py-3">Applicable Branch</th>
                        {canAssignHolidays && <th className="px-6 py-3 text-right">Action</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {holidays.map((h) => (
                        <tr key={h.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-3.5 font-semibold text-slate-800">
                            {new Date(h.date).toLocaleDateString('default', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="px-6 py-3.5">{h.name}</td>
                          <td className="px-6 py-3.5">
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                              h.branchId ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            }`}>
                              {h.branchId ? `Branch ${h.branchId}` : 'All Branches'}
                            </span>
                          </td>
                          {canAssignHolidays && (
                            <td className="px-6 py-3.5 text-right">
                              {h.id && (
                                <button
                                  onClick={() => handleDeleteHoliday(h.id!)}
                                  disabled={saving}
                                  className="text-rose-600 hover:text-rose-800 p-1.5 hover:bg-rose-50 rounded-xl transition-all inline-flex items-center"
                                  title="Delete Holiday"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500 bg-slate-50/50 border border-dashed border-slate-200 rounded-2xl">
                  No holidays assigned.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 7: Employee Leave/Permission Application and History */}
        {activeTab === 'my-requests' && currentUser && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Request Form (Left Column) */}
            <div className="lg:col-span-1 card border border-white/60 bg-white/85 shadow-soft p-6 h-fit">
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-primary-500" /> Apply Request
              </h2>

              <div className="flex bg-slate-900/5 p-1 rounded-xl border border-slate-100 gap-1 text-xs font-semibold mb-4">
                <button
                  type="button"
                  onClick={() => setApplyType('leave')}
                  className={`flex-1 py-2 rounded-lg transition-all ${
                    applyType === 'leave' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-505'
                  } text-slate-500`}
                >
                  Leave Request
                </button>
                <button
                  type="button"
                  onClick={() => setApplyType('permission')}
                  className={`flex-1 py-2 rounded-lg transition-all ${
                    applyType === 'permission' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-505'
                  } text-slate-500`}
                >
                  Short Permission
                </button>
              </div>

              <form onSubmit={handleApplyRequest} className="space-y-4">
                {applyType === 'leave' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Leave Type</label>
                    <select
                      value={leaveTypeInput}
                      onChange={(e) => setLeaveTypeInput(e.target.value as any)}
                      className="input w-full"
                    >
                      <option value="sick">Sick Leave</option>
                      <option value="casual">Casual Leave</option>
                      <option value="other">Other Leave</option>
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    {applyType === 'leave' ? 'Start Date' : 'Permission Date'}
                  </label>
                  <input 
                    type="date"
                    value={applyStartDate}
                    onChange={(e) => setApplyStartDate(e.target.value)}
                    className="input w-full"
                    required
                  />
                </div>

                {applyType === 'leave' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">End Date</label>
                    <input 
                      type="date"
                      value={applyEndDate}
                      onChange={(e) => setApplyEndDate(e.target.value)}
                      className="input w-full"
                      required
                    />
                  </div>
                )}

                {applyType === 'permission' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Start Time</label>
                      <input 
                        type="time"
                        value={applyStartTime}
                        onChange={(e) => setApplyStartTime(e.target.value)}
                        className="input w-full"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">End Time</label>
                      <input 
                        type="time"
                        value={applyEndTime}
                        onChange={(e) => setApplyEndTime(e.target.value)}
                        className="input w-full"
                        required
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Reason / Notes</label>
                  <textarea
                    value={applyReason}
                    onChange={(e) => setApplyReason(e.target.value)}
                    placeholder="Provide a clear description of the reason..."
                    className="input w-full h-24 py-2 resize-none"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" /> Submit Request
                </button>
              </form>
            </div>

            {/* Request History Grouped Month-Wise (Right Column) */}
            <div className="lg:col-span-2 card border border-white/60 bg-white/85 shadow-soft p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary-500" /> Request History
              </h2>
              {loading ? (
                <div className="text-center py-12">
                  <p className="text-slate-500">Loading history...</p>
                </div>
              ) : myRequests.length === 0 ? (
                <div className="text-center py-12 text-slate-505 bg-slate-50/50 border border-dashed border-slate-200 rounded-2xl">
                  No requests submitted yet.
                </div>
              ) : (
                <div className="space-y-8">
                  {(() => {
                    const grouped = groupRequestsByMonth(myRequests);
                    const months = Object.keys(grouped).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
                    
                    return months.map((monthYear) => (
                      <div key={monthYear} className="space-y-3">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1.5">
                          {monthYear}
                        </h3>
                        <div className="grid grid-cols-1 gap-3">
                          {grouped[monthYear].map((req) => (
                            <div key={req.id} className="border border-slate-100 bg-white/50 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm hover:bg-white transition-all">
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                                    req.requestType === 'leave' ? 'bg-purple-50 text-purple-700 border border-purple-100' : 'bg-blue-50 text-blue-700 border border-blue-100'
                                  }`}>
                                    {req.requestType === 'leave' ? `${req.leaveType || 'casual'} leave` : 'permission'}
                                  </span>
                                  {req.requestType === 'permission' && (
                                    <span className="text-xs font-semibold text-slate-500">
                                      ({req.durationHours} hrs)
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs font-semibold text-slate-800">
                                  {req.requestType === 'leave' ? (
                                    <span>{req.startDate} to {req.endDate}</span>
                                  ) : (
                                    <span>{req.startDate} | {formatTimeDisplay(req.startTime)} - {formatTimeDisplay(req.endTime)}</span>
                                  )}
                                </div>
                                <div className="text-xs text-slate-505 italic">
                                  "{req.reason}"
                                </div>
                                {req.status === 'rejected' && req.rejectReason && (
                                  <div className="text-xs text-rose-600 bg-rose-50/50 p-2 rounded-xl border border-rose-100 mt-1">
                                    <strong>Rejection Reason:</strong> {req.rejectReason}
                                  </div>
                                )}
                              </div>

                              <div className="shrink-0 self-start sm:self-center">
                                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full capitalize inline-block border ${
                                  req.status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                  req.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                  'bg-rose-50 text-rose-700 border-rose-200'
                                }`}>
                                  {req.status}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 8: OTP / QR Generator (Managers only) */}
        {activeTab === 'generator' && isManager && (
          <div className="max-w-2xl mx-auto card border border-white/60 bg-white/85 shadow-soft p-6 min-h-[400px] flex flex-col justify-center">
            {!generatorAuthenticated ? (
              <form onSubmit={handleVerifyManagerPassword} className="space-y-6 max-w-sm mx-auto text-center py-8">
                <div className="w-16 h-16 bg-slate-100 rounded-3xl flex items-center justify-center text-slate-800 mx-auto border border-slate-200">
                  <Lock className="w-8 h-8" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Manager Authentication</h2>
                  <p className="text-xs text-slate-500 mt-1">Enter your password to view the attendance verification tools.</p>
                </div>
                {authError && (
                  <div className="p-3 rounded-2xl bg-rose-50 border border-rose-100 text-xs font-semibold text-rose-600">
                    {authError}
                  </div>
                )}
                <div>
                  <input
                    type="password"
                    required
                    placeholder="Enter password..."
                    value={managerPassword}
                    onChange={(e) => setManagerPassword(e.target.value)}
                    className="input w-full text-center"
                    autoFocus
                  />
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary w-full py-3 rounded-2xl font-bold"
                >
                  Verify Password
                </button>
              </form>
            ) : (
              <div className="fixed inset-0 z-[120] bg-slate-950 text-white flex flex-col items-center justify-center p-6 animate-fadeIn">
                {/* Exit authentication dialog */}
                {showExitGeneratorAuth && (
                  <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-[130] p-4 text-slate-900">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-sm text-center relative shadow-2xl border border-slate-100">
                      <button
                        type="button"
                        onClick={() => {
                          setShowExitGeneratorAuth(false);
                          setExitPassword('');
                          setExitError('');
                        }}
                        className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 rounded-xl p-1.5 hover:bg-slate-50 transition-colors"
                      >
                        <X className="w-5 h-5 animate-none" />
                      </button>
                      
                      <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-600 mx-auto mb-4 border border-rose-100">
                        <Lock className="w-6 h-6" />
                      </div>
                      
                      <h3 className="text-lg font-bold text-slate-900 mb-1">Exit Generator Session</h3>
                      <p className="text-xs text-slate-550 mb-6 font-medium">Enter your password to close the active session.</p>
                      
                      {exitError && (
                        <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-100 text-xs font-semibold text-rose-600">
                          {exitError}
                        </div>
                      )}
                      
                      <form onSubmit={handleExitGeneratorSession} className="space-y-4">
                        <input
                          type="password"
                          required
                          placeholder="Enter password..."
                          value={exitPassword}
                          onChange={(e) => setExitPassword(e.target.value)}
                          className="input w-full text-center"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setShowExitGeneratorAuth(false);
                              setExitPassword('');
                              setExitError('');
                            }}
                            className="btn-secondary flex-1 py-3 rounded-2xl font-bold"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={saving}
                            className="bg-rose-600 hover:bg-rose-700 text-white flex-1 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-rose-200"
                          >
                            Confirm Exit
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}

                {/* Back arrow button in top left */}
                <div className="absolute top-8 left-8">
                  <button
                    onClick={() => {
                      setShowExitGeneratorAuth(true);
                      setExitError('');
                    }}
                    className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors bg-white/5 border border-white/10 p-3 rounded-2xl shadow hover:bg-white/10"
                    title="Exit Fullscreen Session"
                  >
                    <ArrowLeft className="w-5 h-5" />
                    <span className="text-sm font-semibold">Exit Session</span>
                  </button>
                </div>

                {/* Content of the generator */}
                <div className="text-center space-y-8 py-4 flex flex-col items-center max-w-lg">
                  <div>
                    <h2 className="text-2xl font-extrabold tracking-tight text-white">Attendance Verification Screen</h2>
                    <p className="text-xs text-slate-400 mt-1">Keep this screen open for employees checking in/out.</p>
                  </div>

                  <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10 gap-1 w-fit">
                    <button
                      onClick={() => setGeneratorMode('otp')}
                      className={`flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-xl transition-all duration-200 ${
                        generatorMode === 'otp' ? 'bg-white text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Key className="w-3.5 h-3.5" /> OTP Code
                    </button>
                    <button
                      onClick={() => setGeneratorMode('qr')}
                      className={`flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-xl transition-all duration-200 ${
                        generatorMode === 'qr' ? 'bg-white text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <QrCode className="w-3.5 h-3.5" /> QR Code
                    </button>
                  </div>

                  <div className="flex flex-col items-center justify-center min-h-[260px] w-full">
                    {generatorMode === 'otp' ? (
                      <div className="space-y-4">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block">Current Active OTP</span>
                        <div className="flex justify-center gap-3">
                          {currentOtp.split('').map((char, index) => (
                            <div key={index} className="w-14 h-20 rounded-2xl border-2 border-slate-800 bg-slate-900 flex items-center justify-center text-4xl font-black text-white shadow-xl">
                              {char}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block">Scan Current QR Code</span>
                        {qrCodeDataUrl ? (
                          <div className="p-4 bg-white border border-slate-850 rounded-3xl shadow-2xl">
                            <img src={qrCodeDataUrl} alt="Attendance QR Code" className="w-56 h-56 object-contain" />
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500">Generating QR code...</p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-center gap-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                      <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
                      Regenerating in <span className="font-bold text-white">{timeLeft}</span> seconds
                    </div>
                    <div className="w-56 bg-slate-800 h-2 rounded-full overflow-hidden border border-white/5">
                      <div
                        className="bg-emerald-500 h-full transition-all duration-1000 ease-linear"
                        style={{ width: `${(timeLeft / 30) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Employee Attendance OTP/QR Verification Modal */}
      {verificationPendingAction && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md border border-slate-100 shadow-2xl relative">
            <button
              onClick={() => setVerificationPendingAction(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 rounded-xl p-1.5 hover:bg-slate-50 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-slate-900 mb-2">Verification Required</h3>
            <p className="text-xs text-slate-500 mb-6">
              Please enter the active OTP or scan the QR Code displayed on the manager's screen to complete your check-{verificationPendingAction}.
            </p>

            {verificationError && (
              <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-100 text-xs font-semibold text-rose-600">
                {verificationError}
              </div>
            )}

            {!verificationMethod ? (
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => {
                    setVerificationMethod('otp');
                    setVerificationInput('');
                    setVerificationError('');
                  }}
                  className="flex flex-col items-center justify-center gap-3 p-6 rounded-3xl border border-slate-200 hover:border-primary-500 hover:bg-primary-50/20 transition-all cursor-pointer group"
                >
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-700 group-hover:bg-primary-500 group-hover:text-white transition-all">
                    <Key className="w-6 h-6" />
                  </div>
                  <span className="text-sm font-bold text-slate-800">Enter OTP</span>
                </button>

                <button
                  onClick={() => {
                    setVerificationMethod('qr');
                    setVerificationInput('');
                    setVerificationError('');
                  }}
                  className="flex flex-col items-center justify-center gap-3 p-6 rounded-3xl border border-slate-200 hover:border-primary-500 hover:bg-primary-50/20 transition-all cursor-pointer group"
                >
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-700 group-hover:bg-primary-500 group-hover:text-white transition-all">
                    <QrCode className="w-6 h-6" />
                  </div>
                  <span className="text-sm font-bold text-slate-800">Scan QR Code</span>
                </button>
              </div>
            ) : (
              <form onSubmit={handleVerifyAndSubmit} className="space-y-4">
                {verificationMethod === 'otp' ? (
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Enter 6-Digit OTP</label>
                    <input
                      type="text"
                      maxLength={6}
                      pattern="\d{6}"
                      required
                      autoFocus
                      placeholder="e.g. 123456"
                      value={verificationInput}
                      onChange={(e) => setVerificationInput(e.target.value.replace(/\D/g, ''))}
                      className="input w-full text-center text-2xl font-bold tracking-widest py-3"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Scan QR Code Token</label>
                    <input
                      type="password"
                      required
                      autoFocus
                      placeholder="Scan or paste QR code token here..."
                      value={verificationInput}
                      onChange={(e) => setVerificationInput(e.target.value)}
                      className="input w-full text-center py-3 text-sm"
                    />
                    <p className="text-[10px] text-slate-400 mt-2 text-center">
                      Ensure your QR scanner cursor is focused inside this box.
                    </p>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setVerificationMethod(null)}
                    className="btn-secondary flex-1 py-3 rounded-2xl font-bold"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="btn-primary flex-1 py-3 rounded-2xl font-bold"
                  >
                    Verify & Submit
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Grid cell details & quick edit popup MODAL */}
      {activeCellDetail && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md border border-slate-100 shadow-2xl relative">
            <button
              onClick={() => setActiveCellDetail(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 rounded-xl p-1.5 hover:bg-slate-50 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-slate-900 mb-2">Edit Attendance Record</h3>
            <p className="text-xs text-slate-505 mb-6">
              User: <span className="font-semibold text-slate-800">{activeCellDetail.userName}</span> | Date: <span className="font-semibold text-slate-800">{activeCellDetail.date}</span>
            </p>

            {(() => {
              const targetUserRole = activeCellDetail ? allUsers.find(u => u.name === activeCellDetail.userName)?.role : null;
              const canEditActiveCell = activeCellDetail ? canModifyUserAttendance(targetUserRole || 'employee') : false;

              return (
                <div className="space-y-4">
                  
                  {/* Status Segment Options */}
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Status</label>
                    <div className="grid grid-cols-4 gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
                      {(['present', 'absent', 'half_day', 'leave'] as const).map((st) => (
                        <button
                          key={st}
                          type="button"
                          disabled={!canEditActiveCell}
                          onClick={() => setCellEditStatus(st)}
                          className={`text-xs font-semibold py-2 rounded-xl transition-all ${
                            cellEditStatus === st 
                              ? 'bg-slate-900 text-white shadow' 
                              : 'text-slate-505 hover:text-slate-900'
                          }`}
                        >
                          <span className="capitalize">{st.replace('_', ' ')}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Conditional Timing Inputs (only shown for Present / Half day) */}
                  {(cellEditStatus === 'present' || cellEditStatus === 'half_day') && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Check-In</label>
                        <input 
                          type="time" 
                          disabled={!canEditActiveCell}
                          value={cellEditInTime} 
                          onChange={(e) => setCellEditInTime(e.target.value)} 
                          className="input w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Check-Out</label>
                        <input 
                          type="time" 
                          disabled={!canEditActiveCell}
                          value={cellEditOutTime} 
                          onChange={(e) => setCellEditOutTime(e.target.value)} 
                          className="input w-full"
                        />
                      </div>
                    </div>
                  )}

                  {/* Notes Input */}
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Notes</label>
                    <textarea 
                      disabled={!canEditActiveCell}
                      value={cellEditNotes} 
                      onChange={(e) => setCellEditNotes(e.target.value)} 
                      className="input w-full h-20 py-2 resize-none" 
                      placeholder={canEditActiveCell ? "e.g. Late due to traffic, sick leave, etc." : "No notes added"}
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveCellDetail(null)}
                      className="btn-secondary flex-1 py-3 rounded-2xl font-bold"
                    >
                      {canEditActiveCell ? 'Cancel' : 'Close'}
                    </button>
                    {canEditActiveCell && (
                      <button
                        type="button"
                        onClick={handleDetailSave}
                        disabled={saving}
                        className="btn-primary flex-1 py-3 rounded-2xl font-bold"
                      >
                        Save Log
                      </button>
                    )}
                  </div>

                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Admin Request Reject Reason Modal */}
      {rejectingRequestId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md border border-slate-100 shadow-2xl relative">
            <button
              onClick={() => setRejectingRequestId(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 rounded-xl p-1.5 hover:bg-slate-50 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-500" /> Reject Request
            </h3>
            <p className="text-xs text-slate-505 mb-6">
              Please provide a reason for rejecting this leave/permission request. The employee will see this reason in their history.
            </p>

            <form onSubmit={handleRejectRequestSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Reason for Rejection</label>
                <textarea 
                  value={rejectReasonInput} 
                  onChange={(e) => setRejectReasonInput(e.target.value)} 
                  className="input w-full h-24 py-2 resize-none" 
                  placeholder="e.g. Critical project delivery, team shortage, etc."
                  required
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectingRequestId(null)}
                  className="btn-secondary flex-1 py-3 rounded-2xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-rose-600 hover:bg-rose-700 text-white flex-1 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-rose-200"
                >
                  Reject Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
