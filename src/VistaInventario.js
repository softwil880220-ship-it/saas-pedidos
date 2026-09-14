import './App.css';
import DashboardHeaderReservaMovil from './DashboardHeaderReservaMovil';
import DashboardNav from './DashboardNav';
import { useAuth } from './AuthContext';

export default function VistaInventario() {
  const { rol } = useAuth();

  return (
    <div className="dashboard">
      <DashboardHeaderReservaMovil />

      <main className="dashboard-main">
        <DashboardNav activo="inventario" rol={rol} />

        <p>Módulo Inventario — en construcción</p>
      </main>
    </div>
  );
}
