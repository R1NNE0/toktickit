import React, { useState, useEffect, useCallback, useRef } from "react";
import { useDialogFocus } from "../useDialogFocus.js";
import { useAuth } from "../context/AuthContext.js";
import {
  type AdminUser,
  type UserRole,
  type CreateAdminUserData,
  type UpdateAdminUserData,
  getAdminUsers,
  createAdminUser,
  updateAdminUser,
  resetAdminUserInitialPassword,
  ApiError,
} from "../api.js";

function roleLabel(role: UserRole): string {
  switch (role) {
    case "REQUESTER": return "Requester";
    case "IT_STAFF": return "IT Staff";
    case "ADMINISTRATOR": return "Administrator";
    default: return role;
  }
}

export const UserManagement: React.FC = () => {
  const { user: authUser, reload: reloadAuth } = useAuth();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("");

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [resettingUser, setResettingUser] = useState<AdminUser | null>(null);

  // Form states - Create
  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createRole, setCreateRole] = useState<UserRole>("REQUESTER");
  const [createActive, setCreateActive] = useState(true);
  const [createPassword, setCreatePassword] = useState("");
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  const [savingCreate, setSavingCreate] = useState(false);

  // Form states - Edit
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<UserRole>("REQUESTER");
  const [editActive, setEditActive] = useState(true);
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [savingEdit, setSavingEdit] = useState(false);

  // Form states - Reset Password
  const [resetPassword, setResetPassword] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetPasswordError, setResetPasswordError] = useState<string | null>(null);
  const [savingReset, setSavingReset] = useState(false);
  useDialogFocus(showCreateModal ? "create" : editingUser ? "edit" : resettingUser ? "reset" : null, () => {
    if (!savingCreate && !savingEdit && !savingReset) {
      setShowCreateModal(false); setEditingUser(null); setResettingUser(null);
    }
  });
  const requestGeneration = useRef(0);

  // Fetch users
  const fetchUsers = useCallback(async () => {
    const generation = ++requestGeneration.current;
    setLoading(true);
    setError(null);
    try {
      const params: { search?: string; role?: UserRole } = {};
      if (search.trim()) params.search = search.trim();
      if (roleFilter) params.role = roleFilter as UserRole;

      const res = await getAdminUsers(params);
      if (generation !== requestGeneration.current) return;
      setUsers(res.data);
    } catch (err: any) {
      if (generation !== requestGeneration.current) return;
      if (err instanceof ApiError && err.status === 403) {
        setError("Access Denied: You do not have permission to access User Management.");
      } else {
        setError(err.message || "Failed to load users. Please try again.");
      }
    } finally {
      if (generation === requestGeneration.current) setLoading(false);
    }
  }, [search, roleFilter]);

  useEffect(() => {
    if (authUser?.role === "ADMINISTRATOR") {
      fetchUsers();
    }
    return () => { requestGeneration.current++; };
  }, [authUser, fetchUsers]);

  // Non-administrator access guard
  if (!authUser || authUser.role !== "ADMINISTRATOR") {
    return (
      <div className="zen-card text-center py-5" role="alert">
        <h1 className="h4 fw-bold text-danger mb-2">Access Denied</h1>
        <p className="text-muted">You do not have permission to access Administrator User Management.</p>
      </div>
    );
  }

  // Open Create Modal
  const handleOpenCreate = () => {
    setCreateName("");
    setCreateEmail("");
    setCreateRole("REQUESTER");
    setCreateActive(true);
    setCreatePassword("");
    setShowCreatePassword(false);
    setCreateErrors({});
    setShowCreateModal(true);
  };

  // Submit Create User
  const handleSubmitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateErrors({});

    const errors: Record<string, string> = {};
    if (!createName.trim()) {
      errors.name = "Name is required (1–100 characters).";
    } else if (createName.trim().length > 100) {
      errors.name = "Name must be at most 100 characters.";
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!createEmail.trim()) {
      errors.email = "Email is required.";
    } else if (!emailRegex.test(createEmail.trim()) || createEmail.trim().length > 254) {
      errors.email = "Please enter a valid email address (max 254 characters).";
    }

    if (!createPassword || createPassword.length < 15 || createPassword.length > 128) {
      errors.password = "Initial password must be 15–128 characters.";
    }

    if (Object.keys(errors).length > 0) {
      setCreateErrors(errors);
      return;
    }

    setSavingCreate(true);
    try {
      const created = await createAdminUser({
        name: createName.trim(),
        email: createEmail.trim(),
        role: createRole,
        isActive: createActive,
        initialPassword: createPassword,
      });

      setShowCreateModal(false);
      setActionNotice(`User "${created.name}" created successfully.`);
      fetchUsers();
    } catch (err: any) {
      if (err instanceof ApiError && err.code === "DUPLICATE_EMAIL") {
        setCreateErrors({ email: "A user with this email address already exists." });
      } else {
        setCreateErrors({ general: err.message || "Failed to create user." });
      }
    } finally {
      setSavingCreate(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (user: AdminUser) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditRole(user.role);
    setEditActive(user.isActive);
    setEditErrors({});
  };

  // Submit Edit User
  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditErrors({});

    const errors: Record<string, string> = {};
    if (!editName.trim()) {
      errors.name = "Name is required (1–100 characters).";
    } else if (editName.trim().length > 100) {
      errors.name = "Name must be at most 100 characters.";
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!editEmail.trim()) {
      errors.email = "Email is required.";
    } else if (!emailRegex.test(editEmail.trim()) || editEmail.trim().length > 254) {
      errors.email = "Please enter a valid email address (max 254 characters).";
    }

    if (Object.keys(errors).length > 0) {
      setEditErrors(errors);
      return;
    }

    // Only send fields that changed
    const payload: UpdateAdminUserData = {};
    if (editName.trim() !== editingUser.name) payload.name = editName.trim();
    if (editEmail.trim() !== editingUser.email) payload.email = editEmail.trim();
    if (editRole !== editingUser.role) payload.role = editRole;
    if (editActive !== editingUser.isActive) payload.isActive = editActive;

    if (Object.keys(payload).length === 0) {
      setEditingUser(null);
      return;
    }

    setSavingEdit(true);
    try {
      const updated = await updateAdminUser(editingUser.id, payload);
      setEditingUser(null);
      setActionNotice(`User "${updated.name}" updated successfully.`);

      // If edited own role or email, session may be revoked
      if (editingUser.id === authUser.id && (payload.role || payload.email)) {
        reloadAuth?.();
      } else {
        fetchUsers();
      }
    } catch (err: any) {
      if (err instanceof ApiError && err.code === "DUPLICATE_EMAIL") {
        setEditErrors({ email: "A user with this email address already exists." });
      } else if (err instanceof ApiError && err.code === "SELF_DEACTIVATION") {
        setEditErrors({ active: "Administrators cannot deactivate their own account." });
      } else if (err instanceof ApiError && err.code === "LAST_ADMIN") {
        setEditErrors({ general: "Cannot deactivate or demote the last active Administrator." });
      } else {
        setEditErrors({ general: err.message || "Failed to update user." });
      }
    } finally {
      setSavingEdit(false);
    }
  };

  // Open Reset Password Modal
  const handleOpenResetPassword = (user: AdminUser) => {
    setResettingUser(user);
    setResetPassword("");
    setShowResetPassword(false);
    setResetPasswordError(null);
  };

  // Submit Reset Initial Password
  const handleSubmitResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resettingUser) return;
    setResetPasswordError(null);

    if (!resetPassword || resetPassword.length < 15 || resetPassword.length > 128) {
      setResetPasswordError("Initial password must be 15–128 characters.");
      return;
    }

    setSavingReset(true);
    try {
      await resetAdminUserInitialPassword(resettingUser.id, resetPassword);
      const targetName = resettingUser.name;
      const targetId = resettingUser.id;
      setResettingUser(null);
      setActionNotice(`New initial password set for "${targetName}". User must change password upon next login.`);

      // If resetting own password, session is revoked
      if (targetId === authUser.id) {
        reloadAuth?.();
      } else {
        fetchUsers();
      }
    } catch (err: any) {
      setResetPasswordError(err.message || "Failed to reset initial password.");
    } finally {
      setSavingReset(false);
    }
  };

  const isEditingSelf = editingUser?.id === authUser.id;
  const isDemotingOrDeactivatingOwner =
    editingUser &&
    (editingUser.role === "IT_STAFF" || editingUser.role === "ADMINISTRATOR") &&
    (editRole === "REQUESTER" || !editActive);

  return (
    <div className="user-management" aria-label="User Management">
      {/* Screen Title & Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
        <div>
          <h1 className="h4 fw-bold mb-1">User Management</h1>
          <p className="text-muted small mb-0">
            Manage user accounts, roles, activation status, and initial passwords.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-zen-primary d-inline-flex align-items-center gap-2"
          onClick={handleOpenCreate}
        >
          <span>+</span>
          <span>Create User</span>
        </button>
      </div>

      {/* Notifications */}
      {actionNotice && (
        <div className="alert alert-success alert-dismissible fade show mb-3" role="alert">
          {actionNotice}
          <button
            type="button"
            className="btn-close"
            onClick={() => setActionNotice(null)}
            aria-label="Close"
          ></button>
        </div>
      )}

      {error && (
        <div className="alert alert-danger mb-3" role="alert">
          {error}
        </div>
      )}

      {/* Search and Role Filter Bar */}
      <div className="zen-card mb-4 p-3">
        <div className="row g-2 align-items-center">
          <div className="col-12 col-md-6">
            <input
              type="text"
              className="form-control form-control-sm"
              placeholder="Search name or email..."
              aria-label="Search users"
              value={search}
              maxLength={200}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="col-8 col-md-4">
            <select
              className="form-select form-select-sm"
              aria-label="Filter by role"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="">All Roles</option>
              <option value="REQUESTER">Requester</option>
              <option value="IT_STAFF">IT Staff</option>
              <option value="ADMINISTRATOR">Administrator</option>
            </select>
          </div>
          <div className="col-4 col-md-2 text-end">
            {(search || roleFilter) && (
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm w-100"
                onClick={() => {
                  setSearch("");
                  setRoleFilter("");
                }}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* User Table / Cards */}
      {loading ? (
        <div className="text-center py-5" role="status">
          <div className="spinner-border text-zen-primary mb-2" role="status"></div>
          <p className="text-muted small">Loading user directory...</p>
        </div>
      ) : error ? null : users.length === 0 ? (
        <div className="zen-card text-center py-5">
          <p className="text-muted mb-2">No users match the current search and filter criteria.</p>
          {(search || roleFilter) && (
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={() => {
                setSearch("");
                setRoleFilter("");
              }}
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <div className="zen-card p-0 overflow-hidden">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0" aria-label="Users Directory">
              <thead className="table-light">
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Email</th>
                  <th scope="col">Role</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="fw-medium" data-label="Name">
                      {u.name}
                      {u.id === authUser.id && (
                        <span className="badge bg-secondary ms-2 small">You</span>
                      )}
                    </td>
                    <td className="text-muted" data-label="Email">{u.email}</td>
                    <td data-label="Role">
                      <span className={`badge ${
                        u.role === "ADMINISTRATOR" ? "bg-dark text-white"
                        : u.role === "IT_STAFF" ? "bg-primary text-white"
                        : "bg-light text-dark border"
                      }`}>
                        {roleLabel(u.role)}
                      </span>
                    </td>
                    <td data-label="Status">
                      {u.isActive ? (
                        <span className="badge bg-success">Active</span>
                      ) : (
                        <span className="badge bg-secondary">Inactive</span>
                      )}
                      {u.mustChangePassword && (
                        <span className="badge bg-warning text-dark ms-1" title="Must change password upon next login">
                          Password Change Req
                        </span>
                      )}
                    </td>
                    <td className="text-end" data-label="Actions">
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm"
                        onClick={() => handleOpenEdit(u)}
                        aria-label={`Edit user ${u.name}`}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE USER MODAL */}
      {showCreateModal && (
        <div className="modal show d-block" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="create-user-title" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-dialog-centered" role="document">
            <div className="modal-content">
              <form onSubmit={handleSubmitCreate}>
                <div className="modal-header">
                  <h2 className="modal-title h5 mb-0" id="create-user-title">Create New User</h2>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setShowCreateModal(false)}
                    aria-label="Close"
                  ></button>
                </div>
                <div className="modal-body">
                  {createErrors.general && (
                    <div className="alert alert-danger mb-3" role="alert">
                      {createErrors.general}
                    </div>
                  )}

                  <div className="mb-3">
                    <label htmlFor="create-name" className="form-label small fw-bold">Full Name *</label>
                    <input
                      id="create-name"
                      type="text"
                      className={`form-control form-control-sm ${createErrors.name ? "is-invalid" : ""}`}
                      value={createName}
                      maxLength={100}
                      onChange={(e) => setCreateName(e.target.value)}
                      required
                    />
                    {createErrors.name && <div className="invalid-feedback">{createErrors.name}</div>}
                  </div>

                  <div className="mb-3">
                    <label htmlFor="create-email" className="form-label small fw-bold">Email Address *</label>
                    <input
                      id="create-email"
                      type="email"
                      className={`form-control form-control-sm ${createErrors.email ? "is-invalid" : ""}`}
                      value={createEmail}
                      maxLength={254}
                      onChange={(e) => setCreateEmail(e.target.value)}
                      required
                    />
                    {createErrors.email && <div className="invalid-feedback">{createErrors.email}</div>}
                  </div>

                  <div className="mb-3">
                    <label htmlFor="create-role" className="form-label small fw-bold">Role *</label>
                    <select
                      id="create-role"
                      className="form-select form-select-sm"
                      value={createRole}
                      onChange={(e) => setCreateRole(e.target.value as UserRole)}
                    >
                      <option value="REQUESTER">Requester</option>
                      <option value="IT_STAFF">IT Staff</option>
                      <option value="ADMINISTRATOR">Administrator</option>
                    </select>
                  </div>

                  <div className="mb-3 form-check">
                    <input
                      id="create-active"
                      type="checkbox"
                      className="form-check-input"
                      checked={createActive}
                      onChange={(e) => setCreateActive(e.target.checked)}
                    />
                    <label htmlFor="create-active" className="form-check-label small">Active Account</label>
                  </div>

                  <div className="mb-3">
                    <label htmlFor="create-password" className="form-label small fw-bold">Initial Password *</label>
                    <div className="input-group input-group-sm">
                      <input
                        id="create-password"
                        type={showCreatePassword ? "text" : "password"}
                        className={`form-control ${createErrors.password ? "is-invalid" : ""}`}
                        value={createPassword}
                        maxLength={128}
                        onChange={(e) => setCreatePassword(e.target.value)}
                        placeholder="15–128 characters"
                        required
                      />
                      <button
                        type="button"
                        className="btn btn-outline-secondary"
                        onClick={() => setShowCreatePassword(!showCreatePassword)}
                      >
                        {showCreatePassword ? "Hide" : "Reveal"}
                      </button>
                    </div>
                    {createErrors.password && (
                      <div className="text-danger small mt-1">{createErrors.password}</div>
                    )}
                    <div className="form-text small text-muted">
                      Initial password must be securely communicated to the user outside TokTickIT; they will be required to change it upon first login.
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => setShowCreateModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-zen-primary btn-sm"
                    disabled={savingCreate}
                  >
                    {savingCreate ? "Saving..." : "Create User"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {editingUser && (
        <div className="modal show d-block" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="edit-user-title" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-dialog-centered" role="document">
            <div className="modal-content">
              <form onSubmit={handleSubmitEdit}>
                <div className="modal-header">
                  <h2 className="modal-title h5 mb-0" id="edit-user-title">Edit User: {editingUser.name}</h2>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setEditingUser(null)}
                    aria-label="Close"
                  ></button>
                </div>
                <div className="modal-body">
                  {editErrors.general && (
                    <div className="alert alert-danger mb-3" role="alert">
                      {editErrors.general}
                    </div>
                  )}

                  {isDemotingOrDeactivatingOwner && (
                    <div className="alert alert-warning small mb-3" role="alert">
                      <strong>Warning:</strong> Deactivating this user or changing their role to Requester will automatically unassign any tickets currently assigned to them.
                    </div>
                  )}

                  <div className="mb-3">
                    <label htmlFor="edit-name" className="form-label small fw-bold">Full Name *</label>
                    <input
                      id="edit-name"
                      type="text"
                      className={`form-control form-control-sm ${editErrors.name ? "is-invalid" : ""}`}
                      value={editName}
                      maxLength={100}
                      onChange={(e) => setEditName(e.target.value)}
                      required
                    />
                    {editErrors.name && <div className="invalid-feedback">{editErrors.name}</div>}
                  </div>

                  <div className="mb-3">
                    <label htmlFor="edit-email" className="form-label small fw-bold">Email Address *</label>
                    <input
                      id="edit-email"
                      type="email"
                      className={`form-control form-control-sm ${editErrors.email ? "is-invalid" : ""}`}
                      value={editEmail}
                      maxLength={254}
                      onChange={(e) => setEditEmail(e.target.value)}
                      required
                    />
                    {editErrors.email && <div className="invalid-feedback">{editErrors.email}</div>}
                  </div>

                  <div className="mb-3">
                    <label htmlFor="edit-role" className="form-label small fw-bold">Role *</label>
                    <select
                      id="edit-role"
                      className="form-select form-select-sm"
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value as UserRole)}
                    >
                      <option value="REQUESTER">Requester</option>
                      <option value="IT_STAFF">IT Staff</option>
                      <option value="ADMINISTRATOR">Administrator</option>
                    </select>
                  </div>

                  <div className="mb-3 form-check">
                    <input
                      id="edit-active"
                      type="checkbox"
                      className={`form-check-input ${editErrors.active ? "is-invalid" : ""}`}
                      checked={editActive}
                      disabled={isEditingSelf}
                      onChange={(e) => setEditActive(e.target.checked)}
                    />
                    <label htmlFor="edit-active" className="form-check-label small">Active Account</label>
                    {isEditingSelf && (
                      <div className="form-text small text-muted">
                        You cannot deactivate your own Administrator account.
                      </div>
                    )}
                    {editErrors.active && (
                      <div className="text-danger small mt-1">{editErrors.active}</div>
                    )}
                  </div>

                  <hr />

                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <div className="fw-bold small">Credential Management</div>
                      <div className="text-muted small">Generate a new initial password and require change.</div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-outline-warning btn-sm"
                      onClick={() => {
                        const target = editingUser;
                        setEditingUser(null);
                        handleOpenResetPassword(target);
                      }}
                    >
                      Set New Initial Password
                    </button>
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => setEditingUser(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-zen-primary btn-sm"
                    disabled={savingEdit}
                  >
                    {savingEdit ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* RESET INITIAL PASSWORD MODAL */}
      {resettingUser && (
        <div className="modal show d-block" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="reset-user-title" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-dialog-centered" role="document">
            <div className="modal-content">
              <form onSubmit={handleSubmitResetPassword}>
                <div className="modal-header">
                  <h2 className="modal-title h5 mb-0" id="reset-user-title">Set New Initial Password</h2>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setResettingUser(null)}
                    aria-label="Close"
                  ></button>
                </div>
                <div className="modal-body">
                  <div className="alert alert-warning small mb-3" role="alert">
                    <strong>Important:</strong> Setting a new initial password will immediately revoke all active sessions for <strong>{resettingUser.name}</strong>. The user will be required to change their password upon their next login.
                  </div>

                  {resetPasswordError && (
                    <div className="alert alert-danger small mb-3" role="alert">
                      {resetPasswordError}
                    </div>
                  )}

                  <div className="mb-3">
                    <label htmlFor="reset-password-input" className="form-label small fw-bold">New Initial Password *</label>
                    <div className="input-group input-group-sm">
                      <input
                        id="reset-password-input"
                        type={showResetPassword ? "text" : "password"}
                        className="form-control"
                        value={resetPassword}
                        maxLength={128}
                        onChange={(e) => setResetPassword(e.target.value)}
                        placeholder="15–128 characters"
                        required
                      />
                      <button
                        type="button"
                        className="btn btn-outline-secondary"
                        onClick={() => setShowResetPassword(!showResetPassword)}
                      >
                        {showResetPassword ? "Hide" : "Reveal"}
                      </button>
                    </div>
                    <div className="form-text small text-muted">
                      Remember to securely hand over this password to the user.
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => setResettingUser(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-warning btn-sm"
                    disabled={savingReset}
                  >
                    {savingReset ? "Resetting..." : "Set Initial Password"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
