export default function DashboardHeaderReservaMovil() {
  return (
    <header className="dashboard-header">
      <div className="dashboard-header-reserva-movil" aria-hidden="true">
        <div className="header-top">
          <h1>Modo WhatsApp — Pedidos</h1>
        </div>
        <div className="header-stats">
          <div className="header-stat header-stat-principal">
            <span className="header-stat-label">Ventas totales hoy</span>
            <span className="header-stat-fecha">Miércoles 15 de junio de 2026 • 12:00</span>
            <span className="header-stat-value header-stat-value-total">$9,999.00</span>
            <p className="header-stat-desglose">Caja: $9,999.00 | WhatsApp: $9,999.00</p>
            <p className="header-stat-desglose header-stat-desglose-whatsapp">
              🛵 Domicilio: $9,999.00 | 🏪 Para recoger: $9,999.00
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
