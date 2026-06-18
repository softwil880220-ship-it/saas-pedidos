import './App.css';
import DashboardNav from './DashboardNav';

export default function VistaReportes() {
  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-top">
          <h1>Reportes</h1>
        </div>
      </header>

      <main className="dashboard-main">
        <DashboardNav activo="reportes" />
        <section className="reportes-vista">
          <p className="dashboard-vacio">Vista de reportes en construcción.</p>
        </section>
      </main>
    </div>
  );
}
