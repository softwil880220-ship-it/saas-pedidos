export function normalizarDetalleCorte(detalle) {
  if (Array.isArray(detalle)) {
    return detalle;
  }

  if (detalle && Array.isArray(detalle.insumos)) {
    return detalle.insumos;
  }

  return [];
}

export function formatearCantidadInventarioHistorial(valor, unidadMedida) {
  const cantidad = Number(valor);

  if (!Number.isFinite(cantidad)) {
    return '—';
  }

  const texto = Number.isInteger(cantidad) ? String(cantidad) : cantidad.toFixed(2);
  return unidadMedida ? `${texto} ${unidadMedida}` : texto;
}

function formatearDiferenciaCorte(diferencia) {
  if (!Number.isFinite(diferencia)) {
    return '—';
  }

  const signo = diferencia > 0 ? '+' : '';
  return `${signo}${diferencia}`;
}

function claseDiferenciaCorteHistorial(diferencia) {
  if (!Number.isFinite(diferencia) || diferencia === 0) {
    return 'reportes-arqueo-diferencia';
  }

  return diferencia < 0
    ? 'reportes-arqueo-diferencia reportes-arqueo-diferencia-negativa'
    : 'reportes-arqueo-diferencia reportes-arqueo-diferencia-positiva';
}

function formatearFechaHoraCorte(createdAt) {
  if (!createdAt) return '—';

  return new Date(createdAt).toLocaleString('es-MX', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export function InventarioCorteCard({ snapshot, insumosPorId, resolverNombreUsuario }) {
  const autorizadoId = snapshot.autorizado_por || snapshot.creado_por;
  const etiquetaAutor =
    snapshot.autorizado_por != null
      ? `Autorizado por ${resolverNombreUsuario(autorizadoId)}`
      : `Registrado por ${resolverNombreUsuario(autorizadoId)}`;
  const filasDetalle = [...normalizarDetalleCorte(snapshot.detalle)].sort((a, b) => {
    const nombreA =
      insumosPorId[String(a?.insumo_id)]?.nombre || String(a?.insumo_id || '');
    const nombreB =
      insumosPorId[String(b?.insumo_id)]?.nombre || String(b?.insumo_id || '');
    return nombreA.localeCompare(nombreB, 'es');
  });

  return (
    <article className="reportes-arqueo-card">
      <header className="reportes-arqueo-cabecera">
        <div className="reportes-arqueo-cabecera-info">
          <span className="inventario-corte-card-titulo">Corte de inventario</span>
          <time className="reportes-arqueo-fecha">
            {formatearFechaHoraCorte(snapshot.created_at)}
          </time>
          <span className="reportes-arqueo-usuario">{etiquetaAutor}</span>
        </div>
      </header>

      {filasDetalle.length > 0 ? (
        <div className="inventario-corte-desglose-scroll">
          <div className="reportes-arqueo-desglose inventario-corte-desglose">
            <div className="reportes-arqueo-desglose-encabezado inventario-corte-desglose-encabezado">
              <span>Insumo</span>
              <span>Carga inicial</span>
              <span>Compra adicional</span>
              <span>Consumido</span>
              <span>Conteo físico</span>
              <span>Merma explicada</span>
              <span>Diferencia</span>
            </div>
            {filasDetalle.map((fila) => {
              const insumo = insumosPorId[String(fila?.insumo_id)];
              const unidad = insumo?.unidad_medida || '';
              const nombreInsumo = insumo?.nombre || 'Insumo desconocido';
              const consumido =
                (Number(fila?.consumo_venta) || 0) + (Number(fila?.consumo_empleados) || 0);
              const diferencia = Number(fila?.diferencia);

              return (
                <div
                  key={`${snapshot.id}-${fila?.insumo_id}`}
                  className="reportes-arqueo-desglose-fila inventario-corte-desglose-fila"
                >
                  <span>{nombreInsumo}</span>
                  <span>
                    {formatearCantidadInventarioHistorial(fila?.carga_inicial, unidad)}
                  </span>
                  <span>
                    {formatearCantidadInventarioHistorial(fila?.compra_adicional, unidad)}
                  </span>
                  <span>{formatearCantidadInventarioHistorial(consumido, unidad)}</span>
                  <span>
                    {formatearCantidadInventarioHistorial(fila?.contado_fisico, unidad)}
                  </span>
                  <span>
                    {formatearCantidadInventarioHistorial(fila?.merma_explicada, unidad)}
                  </span>
                  <span className={claseDiferenciaCorteHistorial(diferencia)}>
                    {formatearDiferenciaCorte(diferencia)}
                    {Number.isFinite(diferencia) && unidad ? ` ${unidad}` : ''}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="reportes-arqueo-retiros-vacio">Sin detalle de insumos guardado.</p>
      )}
    </article>
  );
}

export function InventarioCorteHistorialLista({
  snapshots,
  insumosPorId,
  resolverNombreUsuario,
}) {
  if (!snapshots?.length) {
    return null;
  }

  return (
    <div className="reportes-arqueos-lista">
      {snapshots.map((snapshot) => (
        <InventarioCorteCard
          key={snapshot.id}
          snapshot={snapshot}
          insumosPorId={insumosPorId}
          resolverNombreUsuario={resolverNombreUsuario}
        />
      ))}
    </div>
  );
}
