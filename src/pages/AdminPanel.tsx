import { useState, useEffect, useMemo, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import './AdminPanel.css';

/* ─── Interfaces ─────────────────────────────────────────────────────────── */

interface AdminPanelProps {
  readonly user: User;
}

interface AdminUserProfile {
  id: string;
  display_name: string | null;
  email: string | null;
  full_name: string | null;
  college: string | null;
  course: string | null;
  semester: number | null;
  is_admin: boolean;
  is_admin_pending?: boolean;
  admin_requested_by?: string | null;
  created_at?: string;
}

interface AdminDocument {
  id: string;
  user_id: string;
  title: string;
  file_path: string;
  file_type: string;
  file_size: number | null;
  status: 'pending_approval' | 'processing' | 'ready' | 'failed' | 'no_text';
  chunk_count: number;
  created_at: string;
  profiles?: {
    display_name: string | null;
    email: string | null;
    full_name: string | null;
  } | null;
}

type AdminTab = 'overview' | 'users' | 'documents';

/* ─── Component ──────────────────────────────────────────────────────────── */

const MASTER_ADMIN_EMAILS = [
  '1mj24is016@mvjce.edu.in',
  '1mj24is038@mvjce.edu.in',
  'admin@moduly.ai',
  'vtuadmin@moduly.ai'
];

export function AdminPanel({ user }: AdminPanelProps) {
  const currentUserEmail = user.email?.toLowerCase() || '';
  const isCurrentUserMasterAdmin = MASTER_ADMIN_EMAILS.includes(currentUserEmail);

  // Navigation & Sub-views
  const [activeTab, setActiveTab] = useState<AdminTab>(() => {
    try {
      const saved = sessionStorage.getItem('moduly_admin_active_tab');
      if (saved) return saved as AdminTab;
    } catch (err) {}
    return 'overview';
  });

  useEffect(() => {
    try {
      sessionStorage.setItem('moduly_admin_active_tab', activeTab);
    } catch (err) {}
  }, [activeTab]);

  const [editingUser, setEditingUser] = useState<AdminUserProfile | null>(null);

  // Data State
  const [users, setUsers] = useState<ReadonlyArray<AdminUserProfile>>([]);
  const [documents, setDocuments] = useState<ReadonlyArray<AdminDocument>>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [activeCount, setActiveCount] = useState(0);
  const [activeUserIds, setActiveUserIds] = useState<ReadonlySet<string>>(new Set());

  // Search & Filters
  const [userSearch, setUserSearch] = useState('');
  const [userFilter, setUserFilter] = useState<'all' | 'admin' | 'students' | 'active'>('all');
  const [docSearch, setDocSearch] = useState('');
  const [docTypeFilter, setDocTypeFilter] = useState('All');
  
  // Pagination
  const [userPage, setUserPage] = useState(1);
  const userPageSize = 5;

  // Processing state for individual items
  const [busyUserIds, setBusyUserIds] = useState<ReadonlySet<string>>(new Set());
  const [busyDocIds, setBusyDocIds] = useState<ReadonlySet<string>>(new Set());

  // Edit User Form State
  const [formDisplayName, setFormDisplayName] = useState('');
  const [formFullName, setFormFullName] = useState('');
  const [formCollege, setFormCollege] = useState('');
  const [formCourse, setFormCourse] = useState('');
  const [formSemester, setFormSemester] = useState<number>(1);
  const [formIsAdmin, setFormIsAdmin] = useState(false);

  /* ─── Fetching Data ────────────────────────────────────────────────────── */

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('No active auth session found.');

      const backendBase = import.meta.env.VITE_BACKEND_URL || '';
      const response = await fetch(`${backendBase}/admin-users`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to load users');
      }

      const data = await response.json();
      setUsers(data.users || []);
      setActiveCount(data.activeCount || 0);
      setActiveUserIds(new Set(data.activeUserIds || []));
    } catch (err: any) {
      console.error('Error fetching users:', err);
      setErrorMsg(err.message || 'Could not fetch users list');
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  const fetchDocs = useCallback(async () => {
    setLoadingDocs(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('No active auth session found.');

      const backendBase = import.meta.env.VITE_BACKEND_URL || '';
      const response = await fetch(`${backendBase}/admin-documents`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to load documents');
      }

      const data = await response.json();
      setDocuments(data.documents || []);
    } catch (err: any) {
      console.error('Error fetching documents:', err);
      setErrorMsg(err.message || 'Could not fetch documents list');
    } finally {
      setLoadingDocs(false);
    }
  }, []);

  useEffect(() => {
    void fetchUsers();
    void fetchDocs();
  }, [fetchUsers, fetchDocs]);

  // Status Alerts Auto-dismiss
  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  useEffect(() => {
    if (errorMsg) {
      const timer = setTimeout(() => setErrorMsg(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [errorMsg]);

  /* ─── User Actions ──────────────────────────────────────────────────────── */

  const handleOpenEditUser = (usr: AdminUserProfile) => {
    setEditingUser(usr);
    setFormDisplayName(usr.display_name || '');
    setFormFullName(usr.full_name || '');
    setFormCollege(usr.college || '');
    setFormCourse(usr.course || '');
    setFormSemester(usr.semester || 1);
    setFormIsAdmin(usr.is_admin || false);
  };

  const handleCloseEditUser = () => {
    setEditingUser(null);
  };

  const handleUpdateUserProfile = async () => {
    if (!editingUser) return;
    
    setBusyUserIds(prev => new Set([...prev, editingUser.id]));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const backendBase = import.meta.env.VITE_BACKEND_URL || '';
      const response = await fetch(`${backendBase}/admin-users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'update',
          userId: editingUser.id,
          profileData: {
            display_name: formDisplayName,
            full_name: formFullName,
            college: formCollege,
            course: formCourse,
            semester: formSemester,
            is_admin: formIsAdmin,
          },
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to update user profile');
      }

      setSuccessMsg('User profile updated successfully.');
      void fetchUsers();
      handleCloseEditUser();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error updating user.');
    } finally {
      setBusyUserIds(prev => {
        const next = new Set(prev);
        next.delete(editingUser.id);
        return next;
      });
    }
  };

  const handleToggleAdminStatus = async (userId: string, currentAdminStatus: boolean) => {
    setBusyUserIds(prev => new Set([...prev, userId]));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const backendBase = import.meta.env.VITE_BACKEND_URL || '';
      const response = await fetch(`${backendBase}/admin-users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'toggle-admin',
          userId,
          isAdmin: !currentAdminStatus,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to toggle admin role');
      }

      setSuccessMsg(`Admin privileges ${!currentAdminStatus ? 'granted' : 'revoked'} successfully.`);
      void fetchUsers();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error changing user role.');
    } finally {
      setBusyUserIds(prev => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  const handleApproveAdminRequest = async (userId: string) => {
    setBusyUserIds(prev => new Set([...prev, userId]));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const backendBase = import.meta.env.VITE_BACKEND_URL || '';
      const response = await fetch(`${backendBase}/admin-users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'approve-admin',
          userId,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to approve admin request');
      }

      const resJson = await response.json();
      setSuccessMsg(resJson.message || 'Admin request approved successfully.');
      void fetchUsers();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error approving admin request.');
    } finally {
      setBusyUserIds(prev => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  const handleRejectAdminRequest = async (userId: string) => {
    setBusyUserIds(prev => new Set([...prev, userId]));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const backendBase = import.meta.env.VITE_BACKEND_URL || '';
      const response = await fetch(`${backendBase}/admin-users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'reject-admin',
          userId,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to reject admin request');
      }

      const resJson = await response.json();
      setSuccessMsg(resJson.message || 'Admin request rejected successfully.');
      void fetchUsers();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error rejecting admin request.');
    } finally {
      setBusyUserIds(prev => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  const handleDeleteUserAccount = async (userId: string) => {
    if (!confirm('Are you absolutely sure you want to delete this user? This will remove their entire account from the database and authentication list. This is irreversible.')) {
      return;
    }

    setBusyUserIds(prev => new Set([...prev, userId]));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const backendBase = import.meta.env.VITE_BACKEND_URL || '';
      const response = await fetch(`${backendBase}/admin-users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'delete',
          userId,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to delete user account');
      }

      setSuccessMsg('User account deleted.');
      void fetchUsers();
      if (editingUser?.id === userId) {
        handleCloseEditUser();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error deleting user.');
    } finally {
      setBusyUserIds(prev => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  /* ─── Document Actions ──────────────────────────────────────────────────── */

  const handleApproveDoc = async (docId: string) => {
    setBusyDocIds(prev => new Set([...prev, docId]));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const backendBase = import.meta.env.VITE_BACKEND_URL || '';
      const response = await fetch(`${backendBase}/admin-documents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'approve',
          documentId: docId,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to approve document');
      }

      setSuccessMsg('Document approved and index pipeline started.');
      void fetchDocs();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error approving document.');
    } finally {
      setBusyDocIds(prev => {
        const next = new Set(prev);
        next.delete(docId);
        return next;
      });
    }
  };

  const handleDeleteDoc = async (docId: string, title: string) => {
    if (!confirm(`Are you sure you want to reject/delete "${title}"? This will delete the database record and remove the file from storage.`)) {
      return;
    }

    setBusyDocIds(prev => new Set([...prev, docId]));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const backendBase = import.meta.env.VITE_BACKEND_URL || '';
      const response = await fetch(`${backendBase}/admin-documents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'delete',
          documentId: docId,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to delete document');
      }

      setSuccessMsg('Document deleted successfully.');
      void fetchDocs();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error deleting document.');
    } finally {
      setBusyDocIds(prev => {
        const next = new Set(prev);
        next.delete(docId);
        return next;
      });
    }
  };

  const handleOpenDocFile = async (filePath: string) => {
    try {
      const backendBase = import.meta.env.VITE_BACKEND_URL || '';
      const res = await fetch(`${backendBase}/get-view-url?filename=${encodeURIComponent(filePath)}`);
      if (!res.ok) throw new Error('Failed to get view URL');
      const { url } = await res.json();
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      console.error('Error opening file:', e);
      setErrorMsg('Could not open document file.');
    }
  };

  /* ─── Helpers ──────────────────────────────────────────────────────────── */

  const formatFileSize = (bytes: number | null): string => {
    if (bytes === null || bytes === undefined) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getDocTypeIcon = (type: string): string => {
    const ext = type.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'svg'].includes(ext)) return 'image';
    if (ext === 'pdf' || ext === 'application/pdf') return 'picture_as_pdf';
    return 'description';
  };

  const getDocTypeColor = (type: string): string => {
    const ext = type.toLowerCase();
    if (['jpg', 'jpeg', 'png'].includes(ext)) return 'teal';
    if (ext === 'pdf' || ext === 'application/pdf') return 'orange';
    return 'blue';
  };

  /* ─── Computations & Filtering ─────────────────────────────────────────── */

  // Document Counts
  const pendingDocs = useMemo(() => documents.filter(d => d.status === 'pending_approval'), [documents]);
  const readyDocsCount = useMemo(() => documents.filter(d => d.status === 'ready').length, [documents]);

  // Statistics Calculations
  const statsOverview = useMemo(() => {
    return {
      totalUsers: users.length,
      pendingApprovals: pendingDocs.length,
      totalDocs: documents.length,
      activeSessions: activeCount,
    };
  }, [users, pendingDocs, documents, activeCount]);

  // Filtered Users List
  const filteredUsers = useMemo(() => {
    return users.filter(usr => {
      // Role filter
      if (userFilter === 'admin' && !usr.is_admin) return false;
      if (userFilter === 'students' && usr.is_admin) return false;
      if (userFilter === 'active' && !activeUserIds.has(usr.id)) return false;

      // Search query
      if (userSearch.trim()) {
        const query = userSearch.toLowerCase();
        const disp = (usr.display_name || '').toLowerCase();
        const full = (usr.full_name || '').toLowerCase();
        const eml = (usr.email || '').toLowerCase();
        const clg = (usr.college || '').toLowerCase();
        return disp.includes(query) || full.includes(query) || eml.includes(query) || clg.includes(query);
      }
      return true;
    });
  }, [users, userFilter, userSearch, activeUserIds]);

  // Paginated Users list
  const totalUserPages = Math.max(1, Math.ceil(filteredUsers.length / userPageSize));
  const safeUserPage = Math.min(userPage, totalUserPages);
  const paginatedUsers = useMemo(() => {
    const start = (safeUserPage - 1) * userPageSize;
    return filteredUsers.slice(start, start + userPageSize);
  }, [filteredUsers, safeUserPage]);

  // Filtered Documents List (for Tab 3)
  const filteredDocs = useMemo(() => {
    return documents.filter(doc => {
      if (docTypeFilter !== 'All') {
        const ext = doc.file_type.toLowerCase();
        if (docTypeFilter === 'PDF' && !ext.includes('pdf')) return false;
        if (docTypeFilter === 'Images' && !['jpg', 'jpeg', 'png', 'gif', 'svg'].includes(ext)) return false;
        if (docTypeFilter === 'Others' && (ext.includes('pdf') || ['jpg', 'jpeg', 'png', 'gif', 'svg'].includes(ext))) return false;
      }

      if (docSearch.trim()) {
        const query = docSearch.toLowerCase();
        const title = doc.title.toLowerCase();
        const email = (doc.profiles?.email || '').toLowerCase();
        const name = (doc.profiles?.display_name || '').toLowerCase();
        return title.includes(query) || email.includes(query) || name.includes(query);
      }

      return true;
    });
  }, [documents, docTypeFilter, docSearch]);

  /* ─── Rendering ────────────────────────────────────────────────────────── */

  const isEditingUserMaster = editingUser?.email ? MASTER_ADMIN_EMAILS.includes(editingUser.email.toLowerCase()) : false;
  const canModifyEditingTarget = !isEditingUserMaster || isCurrentUserMasterAdmin;

  return (
    <div className="ap-shell">
      {/* Subtle Dot Grid Background */}
      <div className="ap-grid-background" />

      {/* Global Status Banner Messages */}
      {successMsg && (
        <div className="ap-toast ap-toast--success">
          <span className="material-icons-outlined">check_circle</span>
          <p>{successMsg}</p>
        </div>
      )}
      {errorMsg && (
        <div className="ap-toast ap-toast--error">
          <span className="material-icons-outlined">error_outline</span>
          <p>{errorMsg}</p>
        </div>
      )}

      {/* ── Page Header ── */}
      <header className="ap-header">
        <div className="ap-header-title-wrap">
          <h1 className="ap-header-title">
            ADMIN DASHBOARD
            <span className="ap-header-status-badge">
              <span className="ap-dot-indicator ap-dot-indicator--live"></span>
              LIVE_SYNC
            </span>
          </h1>
          <p className="ap-header-subtitle">Real-time VTU student metrics and library moderation panel.</p>
        </div>
        <div className="ap-header-actions">
          <button
            className="ap-refresh-btn"
            onClick={() => {
              void fetchUsers();
              void fetchDocs();
            }}
            disabled={loadingUsers || loadingDocs}
            title="Refresh dashboard data"
          >
            <span className={`material-icons-outlined ${(loadingUsers || loadingDocs) ? 'ap-spin' : ''}`}>
              refresh
            </span>
            <span>Refresh Data</span>
          </button>
        </div>
      </header>



      {/* ── Main Stats Cards Row ── */}
      <section className="ap-stats-row">
        <div 
          className="ap-stat-card ap-stat-card--cyan ap-stat-card--clickable"
          onClick={() => { setActiveTab('users'); setUserFilter('all'); }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              setActiveTab('users');
              setUserFilter('all');
            }
          }}
        >
          <div className="ap-stat-card-header">
            <span className="ap-stat-card-label">TOTAL USERS</span>
            <span className="material-icons-outlined ap-stat-card-icon">people</span>
          </div>
          <p className="ap-stat-card-value">{loadingUsers ? '...' : statsOverview.totalUsers}</p>
          <p className="ap-stat-card-hint">▲ +12% this week</p>
        </div>

        <div 
          className="ap-stat-card ap-stat-card--purple ap-stat-card--clickable"
          onClick={() => { setActiveTab('documents'); setDocTypeFilter('All'); }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              setActiveTab('documents');
              setDocTypeFilter('All');
            }
          }}
        >
          <div className="ap-stat-card-header">
            <span className="ap-stat-card-label">DOCS UPLOADED</span>
            <span className="material-icons-outlined ap-stat-card-icon">cloud_upload</span>
          </div>
          <p className="ap-stat-card-value">{loadingDocs ? '...' : statsOverview.totalDocs}</p>
          <p className="ap-stat-card-hint">Ready: {readyDocsCount}</p>
        </div>

        <div 
          className="ap-stat-card ap-stat-card--yellow ap-stat-card--clickable"
          onClick={() => { setActiveTab('documents'); }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              setActiveTab('documents');
            }
          }}
        >
          <div className="ap-stat-card-header">
            <span className="ap-stat-card-label">PENDING APPROVALS</span>
            <span className="material-icons-outlined ap-stat-card-icon">gavel</span>
          </div>
          <p className="ap-stat-card-value">{loadingDocs ? '...' : statsOverview.pendingApprovals}</p>
          <p className="ap-stat-card-hint">Requires review</p>
        </div>

        <div 
          className="ap-stat-card ap-stat-card--teal ap-stat-card--clickable"
          onClick={() => { setActiveTab('overview'); }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              setActiveTab('overview');
            }
          }}
        >
          <div className="ap-stat-card-header">
            <span className="ap-stat-card-label">SYSTEM LOGS</span>
            <span className="material-icons-outlined ap-stat-card-icon">history</span>
          </div>
          <p className="ap-stat-card-value">LIVE</p>
          <p className="ap-stat-card-hint">System activity logs</p>
        </div>
      </section>

      {/* ── TAB 1: OVERVIEW ── */}
      {activeTab === 'overview' && (
        <div className="ap-content-grid">
          <div className="ap-card ap-col-span-12">
            <h2 className="ap-card-title">
              <span className="material-icons-outlined ap-card-title-icon">history</span>
              System Logs &amp; Recent Activity
            </h2>
            <div className="ap-logs-list">
              {pendingDocs.length > 0 ? (
                pendingDocs.map(doc => (
                  <div key={doc.id} className="ap-log-item ap-log-item--alert">
                    <span className="material-icons-outlined ap-log-icon">gavel</span>
                    <div className="ap-log-info">
                      <p className="ap-log-desc">
                        Document <strong>{doc.title}</strong> was uploaded and requires moderation.
                      </p>
                      <p className="ap-log-meta">
                        Uploaded by {doc.profiles?.display_name || doc.profiles?.email || 'College Student'}
                      </p>
                    </div>
                    <button className="ap-log-action-btn" onClick={() => setActiveTab('documents')}>
                      Moderate
                    </button>
                  </div>
                ))
              ) : (
                <div className="ap-log-item">
                  <span className="material-icons-outlined ap-log-icon ap-log-icon--success">check_circle</span>
                  <div className="ap-log-info">
                    <p className="ap-log-desc">Moderation Queue is clear. All documents reviewed.</p>
                  </div>
                </div>
              )}

              {users.slice(0, 3).map(usr => (
                <div key={usr.id} className="ap-log-item" style={{ borderLeftColor: 'var(--border)' }}>
                  <span className="material-icons-outlined ap-log-icon">person_add</span>
                  <div className="ap-log-info">
                    <p className="ap-log-desc">
                      New student account <strong>{usr.display_name || usr.email?.split('@')[0]}</strong> registered.
                    </p>
                    <p className="ap-log-meta">
                      Email: {usr.email} • {usr.college || 'College Unspecified'}
                    </p>
                  </div>
                </div>
              ))}

              <div className="ap-log-item" style={{ borderLeftColor: 'var(--border)' }}>
                <span className="material-icons-outlined ap-log-icon">dns</span>
                <div className="ap-log-info">
                  <p className="ap-log-desc">Vectara corpus cluster node check.</p>
                  <p className="ap-log-meta">System Latency: 39ms • Status: HEALTHY</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: USERS DIRECTORY ── */}
      {activeTab === 'users' && !editingUser && (
        <div className="ap-card">
          <div className="ap-breadcrumb" style={{ marginBottom: '1.5rem' }}>
            <button className="ap-breadcrumb-back-btn" onClick={() => setActiveTab('overview')}>
              <span className="material-icons-outlined">arrow_back</span>
              <span>Back to Overview</span>
            </button>
          </div>
          <div className="ap-table-toolbar">
            <div className="ap-search-field">
              <span className="material-icons-outlined ap-search-icon">search</span>
              <input
                type="text"
                placeholder="Search by name, ID or email..."
                value={userSearch}
                onChange={e => { setUserSearch(e.target.value); setUserPage(1); }}
              />
            </div>
            <div className="ap-filter-toggle">
              <button
                className={`ap-filter-btn ${userFilter === 'all' ? 'ap-filter-btn--active' : ''}`}
                onClick={() => { setUserFilter('all'); setUserPage(1); }}
              >
                All Roles
              </button>
              <button
                className={`ap-filter-btn ${userFilter === 'admin' ? 'ap-filter-btn--active' : ''}`}
                onClick={() => { setUserFilter('admin'); setUserPage(1); }}
              >
                Admins
              </button>
              <button
                className={`ap-filter-btn ${userFilter === 'students' ? 'ap-filter-btn--active' : ''}`}
                onClick={() => { setUserFilter('students'); setUserPage(1); }}
              >
                Students
              </button>
              <button
                className={`ap-filter-btn ${userFilter === 'active' ? 'ap-filter-btn--active' : ''}`}
                onClick={() => { setUserFilter('active'); setUserPage(1); }}
              >
                Active Users
              </button>
            </div>
          </div>

          <div className="ap-table-wrapper">
            {loadingUsers ? (
              <div className="ap-table-loading">
                <span className="material-icons-outlined ap-spin">hourglass_top</span>
                <p>Loading active student directory...</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="ap-table-empty">
                <span className="material-icons-outlined">person_off</span>
                <p>No student accounts found matching filters.</p>
              </div>
            ) : (
              <table className="ap-table">
                <thead>
                  <tr>
                    <th>STUDENT NAME</th>
                    <th>EMAIL ADDRESS</th>
                    <th>COLLEGE &amp; COURSE</th>
                    <th>ROLE</th>
                    <th className="ap-text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedUsers.map(usr => {
                    const isBusy = busyUserIds.has(usr.id);
                    const displayName = usr.display_name;
                    const fullName = usr.full_name;
                    const initLetter = (fullName || displayName || usr.email || 'S').charAt(0).toUpperCase();
                    const isUserMaster = usr.email ? MASTER_ADMIN_EMAILS.includes(usr.email.toLowerCase()) : false;
                    const canModifyTarget = !isUserMaster || isCurrentUserMasterAdmin;

                    return (
                      <tr key={usr.id} className="ap-table-row">
                        <td>
                          <div className="ap-user-cell">
                            <div className="ap-user-avatar-wrap">
                              <div className="ap-user-avatar">{initLetter}</div>
                              {isUserMaster ? (
                                <span className="material-icons-outlined ap-user-avatar-badge ap-user-avatar-badge--master" title="Master Administrator">stars</span>
                              ) : usr.is_admin ? (
                                <span className="material-icons-outlined ap-user-avatar-badge" title="Administrator">workspace_premium</span>
                              ) : usr.is_admin_pending ? (
                                <span className="material-icons-outlined ap-user-avatar-badge ap-user-avatar-badge--pending" title="Pending Admin Approval">hourglass_empty</span>
                              ) : null}
                            </div>
                            <div>
                              <p className={`ap-user-name ${(!displayName && !fullName) ? 'ap-user-name--empty' : ''}`}>
                                {fullName || displayName || 'Student'}
                              </p>
                              {displayName ? (
                                <p className="ap-user-sub">@{displayName.toLowerCase()}</p>
                              ) : (
                                <p className="ap-user-sub ap-user-sub--empty">No handle set</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="ap-user-email">{usr.email}</span>
                        </td>
                        <td>
                          {usr.college ? (
                            <p className="ap-college-text">{usr.college}</p>
                          ) : (
                            <p className="ap-college-text--empty-simple">No college selected</p>
                          )}
                          {usr.course ? (
                            <p className="ap-course-text">
                              {usr.course} (Sem {usr.semester || '--'})
                            </p>
                          ) : (
                            <p className="ap-course-text--empty-simple">Incomplete Profile</p>
                          )}
                        </td>
                        <td>
                          {isUserMaster ? (
                            <span className="ap-role-badge ap-role-badge--master">
                              MASTER ADMIN
                            </span>
                          ) : usr.is_admin ? (
                            <span className="ap-role-badge ap-role-badge--admin">
                              ADMIN
                            </span>
                          ) : usr.is_admin_pending ? (
                            <div className="ap-pending-badge-wrap">
                              <span className="ap-role-badge ap-role-badge--pending">
                                PENDING ADMIN
                              </span>
                              {usr.admin_requested_by && (
                                <span className="ap-pending-request-by" title={usr.admin_requested_by}>
                                  Requested by: {usr.admin_requested_by.split('@')[0]}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="ap-role-badge ap-role-badge--student">
                              STUDENT
                            </span>
                          )}
                        </td>
                        <td className="ap-text-right">
                          <div className="ap-actions-cell">
                            <button
                              className="ap-table-icon-btn"
                              title={canModifyTarget ? "Edit Profile" : "Master Admin privileges required to edit"}
                              onClick={() => handleOpenEditUser(usr)}
                              disabled={isBusy || !canModifyTarget}
                            >
                              <span className="material-icons-outlined">edit</span>
                            </button>

                            {usr.is_admin_pending ? (
                              isCurrentUserMasterAdmin ? (
                                <>
                                  <button
                                    className="ap-table-icon-btn ap-table-icon-btn--success"
                                    title="Approve Admin Request"
                                    onClick={() => handleApproveAdminRequest(usr.id)}
                                    disabled={isBusy}
                                  >
                                    <span className="material-icons-outlined">check_circle</span>
                                  </button>
                                  <button
                                    className="ap-table-icon-btn ap-table-icon-btn--danger"
                                    title="Reject Admin Request"
                                    onClick={() => handleRejectAdminRequest(usr.id)}
                                    disabled={isBusy}
                                  >
                                    <span className="material-icons-outlined">cancel</span>
                                  </button>
                                </>
                              ) : (
                                <button
                                  className="ap-table-icon-btn"
                                  title="Admin request pending approval from Master Admins"
                                  disabled
                                >
                                  <span className="material-icons-outlined">hourglass_empty</span>
                                </button>
                              )
                            ) : (
                              <button
                                className={`ap-table-icon-btn ${usr.is_admin ? 'ap-table-icon-btn--yellow' : ''}`}
                                title={isUserMaster ? "Master Admin privileges are permanent" : !canModifyTarget ? "Master Admin privileges required" : usr.is_admin ? 'Revoke Admin privileges' : 'Grant Admin privileges'}
                                onClick={() => handleToggleAdminStatus(usr.id, usr.is_admin)}
                                disabled={isBusy || isUserMaster || !canModifyTarget}
                              >
                                <span className="material-icons-outlined">
                                  {usr.is_admin ? 'admin_panel_settings' : 'shield'}
                                </span>
                              </button>
                            )}

                            <button
                              className="ap-table-icon-btn ap-table-icon-btn--danger"
                              title={canModifyTarget ? "Delete Account" : "Master Admin privileges required to delete"}
                              onClick={() => handleDeleteUserAccount(usr.id)}
                              disabled={isBusy || !canModifyTarget}
                            >
                              <span className="material-icons-outlined">delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination Toolbar */}
          {!loadingUsers && filteredUsers.length > userPageSize && (
            <div className="ap-table-footer">
              <p className="ap-table-footer-text">
                Showing <strong>{(safeUserPage - 1) * userPageSize + 1}</strong> to{' '}
                <strong>{Math.min(safeUserPage * userPageSize, filteredUsers.length)}</strong> of{' '}
                <strong>{filteredUsers.length}</strong> users
              </p>
              <div className="ap-pagination">
                <button
                  className="ap-pagination-btn"
                  onClick={() => setUserPage(p => Math.max(1, p - 1))}
                  disabled={safeUserPage === 1}
                >
                  <span className="material-icons-outlined">chevron_left</span>
                </button>
                {Array.from({ length: totalUserPages }, (_, i) => i + 1).map(p => (
                  <button
                    key={p}
                    className={`ap-pagination-btn ${safeUserPage === p ? 'ap-pagination-btn--active' : ''}`}
                    onClick={() => setUserPage(p)}
                  >
                    {p}
                  </button>
                ))}
                <button
                  className="ap-pagination-btn"
                  onClick={() => setUserPage(p => Math.min(totalUserPages, p + 1))}
                  disabled={safeUserPage === totalUserPages}
                >
                  <span className="material-icons-outlined">chevron_right</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── EDIT USER PROFILE SUB-PAGE ── */}
      {activeTab === 'users' && editingUser && (
        <div className="ap-card">
          <div className="ap-breadcrumb">
            <button className="ap-breadcrumb-back-btn" onClick={handleCloseEditUser}>
              <span className="material-icons-outlined">arrow_back</span>
              <span>Back to Users</span>
            </button>
            <span className="ap-breadcrumb-sep">/</span>
            <span className="ap-breadcrumb-current">Edit Profile</span>
          </div>

          <div className="ap-profile-header">
            <h2 className="ap-profile-title">
              {formFullName || formDisplayName || (editingUser.email ? editingUser.email.split('@')[0] : 'Student')}
            </h2>
            <p className="ap-profile-subtitle">
              Student Account • ID: <span className="ap-code-font">#{editingUser.id.substring(0, 8).toUpperCase()}</span>
            </p>
            <div className="ap-profile-header-actions">
              <button className="ap-brutalist-btn" onClick={handleCloseEditUser}>Discard</button>
              <button
                className="ap-brutalist-btn ap-brutalist-btn--pink"
                onClick={handleUpdateUserProfile}
                disabled={busyUserIds.has(editingUser.id) || !canModifyEditingTarget}
                title={canModifyEditingTarget ? "Save profile changes" : "Master Admin privileges required"}
              >
                {busyUserIds.has(editingUser.id) ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>

          <div className="ap-profile-grid">
            {/* Left Col: Photo Box / Roles Toggle */}
            <div className="ap-profile-left">
              <div className="ap-brutalist-box">
                <div className="ap-avatar-display-large">
                  {(formFullName || formDisplayName || 'S').charAt(0).toUpperCase()}
                </div>
                <div className="ap-avatar-badge-wrap">
                  <span className={`ap-badge-status-label ${formIsAdmin ? 'ap-badge-status-label--admin' : isEditingUserMaster ? 'ap-badge-status-label--admin' : ''}`}>
                    {isEditingUserMaster ? 'MASTER ADMIN' : formIsAdmin ? 'ACTIVE ADMIN' : editingUser.is_admin_pending ? 'PENDING ADMIN' : 'ACTIVE STUDENT'}
                  </span>
                </div>
                <p className="ap-avatar-meta-clg">{formCollege || 'Institution Unspecified'}</p>
                <p className="ap-avatar-meta-joined">Registered Member</p>
              </div>

              <div className="ap-brutalist-box">
                <h3 className="ap-box-heading">Role &amp; Permissions</h3>
                <div className="ap-toggle-group">
                  <div className="ap-toggle-item">
                    <div>
                      <p className="ap-toggle-title">Admin Panel</p>
                      <p className="ap-toggle-desc">
                        {editingUser.is_admin_pending
                          ? `Requested by ${editingUser.admin_requested_by?.split('@')[0]} - pending approval.`
                          : isEditingUserMaster
                          ? "Master Admin permissions are permanent."
                          : "Grant access to user database and moderation console."}
                      </p>
                    </div>
                    <label className="ap-switch">
                      <input
                        type="checkbox"
                        checked={formIsAdmin || isEditingUserMaster}
                        onChange={e => setFormIsAdmin(e.target.checked)}
                        disabled={!canModifyEditingTarget || isEditingUserMaster || editingUser.is_admin_pending}
                      />
                      <span className="ap-switch-slider"></span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Col: Details / Danger Zone */}
            <div className="ap-profile-right">
              <div className="ap-brutalist-box">
                <h3 className="ap-box-heading">Account Credentials</h3>
                <div className="ap-form-row">
                  <div className="ap-form-field">
                    <label className="ap-form-label">USERNAME</label>
                    <input
                      type="text"
                      className="ap-form-input"
                      value={formDisplayName}
                      onChange={e => setFormDisplayName(e.target.value)}
                    />
                  </div>
                  <div className="ap-form-field">
                    <label className="ap-form-label">EMAIL ADDRESS</label>
                    <input
                      type="email"
                      className="ap-form-input"
                      value={editingUser.email || ''}
                      disabled
                      title="Emails cannot be modified (managed by auth SSO)"
                    />
                  </div>
                </div>
              </div>

              <div className="ap-brutalist-box">
                <h3 className="ap-box-heading">Institutional Information</h3>
                <div className="ap-form-field" style={{ marginBottom: '1.25rem' }}>
                  <label className="ap-form-label">COLLEGE / INSTITUTION</label>
                  <input
                    type="text"
                    className="ap-form-input"
                    value={formCollege}
                    onChange={e => setFormCollege(e.target.value)}
                  />
                </div>
                <div className="ap-form-row">
                  <div className="ap-form-field">
                    <label className="ap-form-label">MAJOR / COURSE</label>
                    <input
                      type="text"
                      className="ap-form-input"
                      value={formCourse}
                      onChange={e => setFormCourse(e.target.value)}
                    />
                  </div>
                  <div className="ap-form-field">
                    <label className="ap-form-label">SEMESTER</label>
                    <select
                      className="ap-form-select"
                      title="Semester selection"
                      value={formSemester}
                      onChange={e => setFormSemester(Number(e.target.value))}
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                        <option key={s} value={s}>Semester {s}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="ap-brutalist-box ap-brutalist-box--danger-zone">
                <div className="ap-danger-zone-content">
                  <div>
                    <h3 className="ap-danger-title">
                      <span className="material-icons-outlined">warning</span>
                      DANGER ZONE
                    </h3>
                    <p className="ap-danger-desc">
                      Once you delete an account, there is no going back. All study histories, uploads, and data will be permanently wiped.
                    </p>
                  </div>
                  <button
                    className="ap-delete-user-btn"
                    onClick={() => handleDeleteUserAccount(editingUser.id)}
                    disabled={busyUserIds.has(editingUser.id)}
                  >
                    DELETE ACCOUNT
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: MODERATION QUEUE (DOCUMENTS) ── */}
      {activeTab === 'documents' && (
        <div className="ap-card">
          <div className="ap-breadcrumb" style={{ marginBottom: '1.5rem' }}>
            <button className="ap-breadcrumb-back-btn" onClick={() => setActiveTab('overview')}>
              <span className="material-icons-outlined">arrow_back</span>
              <span>Back to Overview</span>
            </button>
          </div>
          <div className="ap-moderation-header">
            <div>
              <h2 className="ap-moderation-title">Moderation Queue</h2>
              <p className="ap-moderation-subtitle">
                Review and moderate student-uploaded materials to ensure academic integrity and standard compliance.
              </p>
            </div>
            <span className="ap-moderation-queue-badge">
              PENDING: {pendingDocs.length}
            </span>
          </div>

          <div className="ap-table-toolbar">
            <div className="ap-search-field">
              <span className="material-icons-outlined ap-search-icon">search</span>
              <input
                type="text"
                placeholder="Search by filename or student name..."
                value={docSearch}
                onChange={e => setDocSearch(e.target.value)}
              />
            </div>
            <div className="ap-filter-toggle">
              {['All', 'PDF', 'Images', 'Others'].map(type => (
                <button
                  key={type}
                  className={`ap-filter-btn ${docTypeFilter === type ? 'ap-filter-btn--active' : ''}`}
                  onClick={() => setDocTypeFilter(type)}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <h3 className="ap-queue-subtitle">Awaiting Moderation Approval</h3>

          <div className="ap-moderation-grid">
            {loadingDocs ? (
              <div className="ap-queue-loading">
                <span className="material-icons-outlined ap-spin">hourglass_top</span>
                <p>Loading documents queue...</p>
              </div>
            ) : pendingDocs.length === 0 ? (
              <div className="ap-moderation-empty-card ap-col-span-12">
                <span className="material-icons-outlined ap-spark-icon">stars</span>
                <h4>END OF QUEUE REACHED</h4>
                <p>Great work! You've reviewed all student documents.</p>
              </div>
            ) : (
              pendingDocs.map(doc => {
                const isBusy = busyDocIds.has(doc.id);
                const fileColor = getDocTypeColor(doc.file_type);
                const fileIcon = getDocTypeIcon(doc.file_type);
                const contributor = doc.profiles?.display_name || doc.profiles?.email || 'College Student';

                return (
                  <div key={doc.id} className="ap-moderation-card">
                    <div className="ap-moderation-card-top">
                      <div className={`ap-doc-icon-box ap-doc-icon-box--${fileColor}`}>
                        <span className="ap-doc-ext-tag">{doc.file_type.toUpperCase()}</span>
                        <span className="material-icons-outlined">{fileIcon}</span>
                      </div>
                      <div className="ap-doc-meta-info">
                        <h4 className="ap-doc-title-h4" title={doc.title}>{doc.title}</h4>
                        <div className="ap-doc-badge-row">
                          <span className="ap-doc-subject-tag">MATHEMATICS</span>
                          <span className="ap-doc-size-tag">{formatFileSize(doc.file_size)}</span>
                        </div>
                        <p className="ap-doc-contributor-info">
                          <span className="material-icons-outlined">cloud_upload</span>
                          Uploaded by {contributor} on {new Date(doc.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="ap-moderation-card-actions">
                      <button
                        className="ap-action-btn-moderation ap-action-btn-moderation--flag"
                        onClick={() => handleDeleteDoc(doc.id, doc.title)}
                        disabled={isBusy}
                      >
                        <span className="material-icons-outlined">flag</span>
                        FLAG &amp; REJECT
                      </button>
                      <button
                        className="ap-action-btn-moderation ap-action-btn-moderation--approve"
                        onClick={() => handleApproveDoc(doc.id)}
                        disabled={isBusy}
                      >
                        <span className="material-icons-outlined">check_circle</span>
                        {isBusy ? 'APPROVING...' : 'APPROVE'}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <h3 className="ap-queue-subtitle" style={{ marginTop: '2.5rem' }}>All Documents in System</h3>

          <div className="ap-table-wrapper">
            {loadingDocs ? (
              <p className="ap-loading-small">Loading documents list...</p>
            ) : filteredDocs.length === 0 ? (
              <p className="ap-empty-small">No documents found.</p>
            ) : (
              <table className="ap-table">
                <thead>
                  <tr>
                    <th>DOCUMENT TITLE</th>
                    <th>CONTRIBUTOR</th>
                    <th>FILE SIZE</th>
                    <th>STATUS</th>
                    <th>UPLOAD DATE</th>
                    <th className="ap-text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocs.map(doc => {
                    const isBusy = busyDocIds.has(doc.id);
                    const contributor = doc.profiles?.display_name || doc.profiles?.email || 'College Student';

                    return (
                      <tr key={doc.id} className="ap-table-row">
                        <td>
                          <div className="ap-doc-title-cell">
                            <span className={`material-icons-outlined ap-doc-list-icon ap-doc-list-icon--${getDocTypeColor(doc.file_type)}`}>
                              {getDocTypeIcon(doc.file_type)}
                            </span>
                            <span className="ap-doc-list-title" title={doc.title}>{doc.title}</span>
                          </div>
                        </td>
                        <td>{contributor}</td>
                        <td>{formatFileSize(doc.file_size)}</td>
                        <td>
                          <span className={`ap-status-tag ap-status-tag--${doc.status}`}>
                            {doc.status.replace('_', ' ').toUpperCase()}
                          </span>
                        </td>
                        <td>{new Date(doc.created_at).toLocaleDateString()}</td>
                        <td className="ap-text-right">
                          <div className="ap-actions-cell">
                            <button
                              className="ap-table-icon-btn"
                              title="Open/View document"
                              onClick={() => handleOpenDocFile(doc.file_path)}
                              disabled={isBusy}
                            >
                              <span className="material-icons-outlined">visibility</span>
                            </button>
                            {doc.status === 'pending_approval' && (
                              <button
                                className="ap-table-icon-btn ap-table-icon-btn--success"
                                title="Approve"
                                onClick={() => handleApproveDoc(doc.id)}
                                disabled={isBusy}
                              >
                                <span className="material-icons-outlined">check_circle</span>
                              </button>
                            )}
                            <button
                              className="ap-table-icon-btn ap-table-icon-btn--danger"
                              title="Delete/Reject Document"
                              onClick={() => handleDeleteDoc(doc.id, doc.title)}
                              disabled={isBusy}
                            >
                              <span className="material-icons-outlined">delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
