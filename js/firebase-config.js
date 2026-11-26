:root {
  --bg: #f1f5f9;
  --surface: #ffffff;
  --text: #0f172a;
  --muted: #64748b;
  --border: #e2e8f0;
  --primary: #0f172a;
  --accent: #2563eb;
  --danger: #dc2626;
  --success: #15803d;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background: var(--bg);
  color: var(--text);
}

.hidden {
  display: none !important;
}

.muted-text {
  color: var(--muted);
  font-size: 14px;
}

.error-text {
  color: var(--danger);
  font-size: 13px;
  min-height: 18px;
  margin: 6px 0 0;
}

.helper-msg {
  font-size: 13px;
  min-height: 18px;
  margin: 8px 0;
}

.code-pill {
  display: inline-block;
  background: #f8fafc;
  border: 1px solid var(--border);
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 13px;
}

/* AUTH SCREEN */
.auth-screen {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.auth-card {
  width: 100%;
  max-width: 960px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 28px;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
}

.auth-brand {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 20px;
}

.auth-brand h1 {
  margin: 0;
  font-size: 22px;
}

.auth-brand p {
  margin: 2px 0 0;
  color: var(--muted);
  font-size: 14px;
}

.brand-logo {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: var(--primary);
  color: #fff;
  display: grid;
  place-items: center;
  font-weight: 800;
  flex-shrink: 0;
}

.brand-logo.small {
  width: 36px;
  height: 36px;
  border-radius: 9px;
  font-size: 14px;
}

.auth-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 18px;
  border-bottom: 1px solid var(--border);
  padding-bottom: 10px;
}

.auth-tab {
  border: none;
  background: transparent;
  padding: 8px 14px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  color: var(--muted);
}

.auth-tab.active {
  background: var(--primary);
  color: #fff;
}

.auth-form {
  max-width: 420px;
  display: grid;
  gap: 14px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 13px;
  font-weight: 600;
}

input, select {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 14px;
  background: #fff;
  color: var(--text);
}

.btn {
  padding: 10px 16px;
  border-radius: 8px;
  border: 1px solid transparent;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 13px;
}

.btn-primary {
  background: var(--primary);
  color: #fff;
}

.btn-secondary {
  background: var(--accent);
  color: #fff;
}

.btn-outline {
  background: transparent;
  border-color: #cbd5e1;
  color: var(--text);
}

.full-width {
  width: 100%;
}

/* APP SHELL */
.app-shell {
  display: flex;
  min-height: 100vh;
}

.sidebar {
  width: 245px;
  background: var(--primary);
  color: #fff;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 18px 14px;
  flex-shrink: 0;
}

.sidebar-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}

.sidebar-header strong {
  display: block;
  font-size: 15px;
}

.sidebar-header small {
  color: #94a3b8;
  font-size: 12px;
}

.nav-menu {
  display: grid;
  gap: 4px;
  margin: 16px 0;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #cbd5e1;
  text-align: left;
  font-size: 14px;
  cursor: pointer;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

.nav-item.active {
  background: var(--accent);
  color: #fff;
}

.sidebar-footer .btn-outline {
  color: #fff;
  border-color: rgba(255, 255, 255, 0.25);
}

.main-column {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.topbar {
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  padding: 12px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.topbar-left, .topbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.topbar h2 {
  margin: 0;
  font-size: 18px;
}

.icon-btn {
  display: none;
  border: 1px solid var(--border);
  background: #fff;
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 16px;
  cursor: pointer;
}

.operador-badge {
  background: #eff6ff;
  color: #1d4ed8;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
}

.content-area {
  padding: 20px;
  display: grid;
  gap: 18px;
}

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;
}

.card h3 {
  margin: 0 0 12px;
  font-size: 16px;
}

.grid-form {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 14px;
  margin-bottom: 16px;
}

.kpi-grid.compact {
  margin-bottom: 0;
}

.kpi-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
}

.kpi-card span {
  display: block;
  font-size: 13px;
  color: var(--muted);
}

.kpi-card strong {
  display: block;
  font-size: 22px;
  margin-top: 6px;
}

.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
}

.mini-card {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 14px;
  background: #f8fafc;
}

.table-wrap {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

th, td {
  padding: 10px 8px;
  border-bottom: 1px solid var(--border);
  text-align: left;
}

/* PLANOS */
.planos-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 14px;
  margin-top: 12px;
}

.plano-card {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 18px;
  background: #fff;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.plano-card.destaque {
  border: 2px solid var(--accent);
}

.plano-badge {
  display: inline-block;
  background: #eff6ff;
  color: var(--accent);
  font-size: 11px;
  font-weight: 700;
  padding: 4px 8px;
  border-radius: 999px;
  margin-bottom: 8px;
}

.plano-nome {
  margin: 0 0 6px;
  font-size: 18px;
}

.plano-preco {
  font-size: 24px;
  font-weight: 800;
  margin-bottom: 8px;
}

.plano-preco span {
  font-size: 13px;
  font-weight: 400;
  color: var(--muted);
}

.plano-usuarios {
  font-size: 12.5px;
  font-weight: 600;
  background: #f8fafc;
  border: 1px solid var(--border);
  padding: 6px 8px;
  border-radius: 8px;
  margin-bottom: 6px;
}

.plano-perfis {
  font-size: 12px;
  color: var(--muted);
  margin-bottom: 10px;
}

.plano-lista {
  list-style: none;
  padding: 0;
  margin: 0 0 14px;
  font-size: 13px;
}

.plano-lista li {
  margin-bottom: 5px;
}

/* MODAL OPERADORES */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  z-index: 999;
}

.modal-card {
  width: 100%;
  max-width: 440px;
  background: #fff;
  border-radius: 14px;
  padding: 24px;
}

.operadores-list {
  display: grid;
  gap: 10px;
  margin: 14px 0;
}

.op-card-btn {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 12px 14px;
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  background: #f8fafc;
  cursor: pointer;
  text-align: left;
}

.op-card-btn:hover {
  border-color: var(--accent);
  background: #eff6ff;
}

.pin-row {
  display: flex;
  gap: 8px;
  margin-top: 6px;
}

@media (max-width: 820px) {
  .icon-btn {
    display: inline-block;
  }
  .sidebar {
    position: fixed;
    top: 0;
    bottom: 0;
    left: -260px;
    z-index: 500;
    transition: left 0.2s ease;
  }
  .sidebar.open {
    left: 0;
  }
}
