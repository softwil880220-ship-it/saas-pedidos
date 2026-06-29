import './App.css';
import DashboardHeaderReservaMovil from './DashboardHeaderReservaMovil';
import DashboardNav from './DashboardNav';
import PanelCajeros from './PanelCajeros';
import { useAuth } from './AuthContext';

export default function VistaEquipo() {
  const { negocioId, rol } = useAuth();

  return (
    <div className="dashboard">
      <DashboardHeaderReservaMovil />

      <main className="dashboard-main">
        <DashboardNav activo="equipo" rol={rol} />
        <PanelCajeros negocioId={negocioId} />
      </main>
    </div>
  );
}
