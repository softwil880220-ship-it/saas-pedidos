import { useEffect, useMemo, useState } from 'react';
import {
  TIPOS_AJUSTE_MONETARIO,
  calcularMontoDescuentoMesa,
  calcularMontoPropinaMesa,
  calcularTotalCobroMesa,
  puedeAplicarDescuentoMesaCobro,
} from './mesaCobroCalculos';
import { formatearMoneda } from './pedidosShared';
import { usePedidosFolioMesa } from './usePedidosFolioMesa';

const PORCENTAJES_PROPINA_RAPIDOS = [5, 10, 15, 20];

function parsearEntradaNumerica(valor) {
  if (valor === '' || valor == null) {
    return null;
  }

  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

export default function MesaCobroModal({
  abierto,
  numeroMesa,
  negocioId,
  abiertaEn,
  usuarioId,
  rol,
  onCancelar,
  onConfirmar,
}) {
  const puedeAplicarDescuento = puedeAplicarDescuentoMesaCobro(rol);
  const { productosConsolidados, subtotal, cargando } = usePedidosFolioMesa({
    negocioId,
    numeroMesa,
    abiertaEn,
    activo: abierto,
  });

  const [descuentoTipo, setDescuentoTipo] = useState(TIPOS_AJUSTE_MONETARIO.PORCENTAJE);
  const [descuentoValor, setDescuentoValor] = useState('');
  const [descuentoRazon, setDescuentoRazon] = useState('');
  const [propinaPorcentajeSeleccionado, setPropinaPorcentajeSeleccionado] = useState(null);
  const [propinaMontoExacto, setPropinaMontoExacto] = useState('');
  const [propinaMontoExactoActivo, setPropinaMontoExactoActivo] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [errorConfirmacion, setErrorConfirmacion] = useState(null);

  useEffect(() => {
    if (!abierto) {
      return;
    }

    setDescuentoTipo(TIPOS_AJUSTE_MONETARIO.PORCENTAJE);
    setDescuentoValor('');
    setDescuentoRazon('');
    setPropinaPorcentajeSeleccionado(null);
    setPropinaMontoExacto('');
    setPropinaMontoExactoActivo(false);
    setConfirmando(false);
    setErrorConfirmacion(null);
  }, [abierto, numeroMesa, abiertaEn]);

  const descuentoMontoAplicado = useMemo(
    () =>
      calcularMontoDescuentoMesa({
        subtotal,
        tipo: puedeAplicarDescuento ? descuentoTipo : null,
        valor: descuentoValor,
        puedeAplicarDescuento,
      }),
    [subtotal, descuentoTipo, descuentoValor, puedeAplicarDescuento]
  );

  const propinaMontoAplicado = useMemo(
    () =>
      calcularMontoPropinaMesa({
        subtotal,
        tipo: propinaMontoExactoActivo
          ? TIPOS_AJUSTE_MONETARIO.MONTO_FIJO
          : TIPOS_AJUSTE_MONETARIO.PORCENTAJE,
        valor: propinaPorcentajeSeleccionado,
        montoExactoActivo: propinaMontoExactoActivo,
        montoExacto: propinaMontoExacto,
      }),
    [
      subtotal,
      propinaMontoExactoActivo,
      propinaMontoExacto,
      propinaPorcentajeSeleccionado,
    ]
  );

  const totalCobrado = useMemo(
    () =>
      calcularTotalCobroMesa({
        subtotal,
        descuentoMontoAplicado,
        propinaMontoAplicado,
      }),
    [subtotal, descuentoMontoAplicado, propinaMontoAplicado]
  );

  const propinaTipo =
    propinaMontoAplicado > 0
      ? propinaMontoExactoActivo
        ? TIPOS_AJUSTE_MONETARIO.MONTO_FIJO
        : TIPOS_AJUSTE_MONETARIO.PORCENTAJE
      : null;

  const propinaValor =
    propinaMontoAplicado > 0
      ? propinaMontoExactoActivo
        ? parsearEntradaNumerica(propinaMontoExacto) ?? 0
        : propinaPorcentajeSeleccionado ?? 0
      : null;

  const descuentoTipoFinal =
    puedeAplicarDescuento && descuentoMontoAplicado > 0 ? descuentoTipo : null;
  const descuentoValorFinal =
    puedeAplicarDescuento && descuentoMontoAplicado > 0
      ? parsearEntradaNumerica(descuentoValor) ?? 0
      : null;

  const seleccionarPropinaPorcentaje = (porcentaje) => {
    setPropinaMontoExactoActivo(false);
    setPropinaMontoExacto('');
    setPropinaPorcentajeSeleccionado(porcentaje);
  };

  const activarPropinaMontoExacto = () => {
    setPropinaMontoExactoActivo(true);
    setPropinaPorcentajeSeleccionado(null);
  };

  const handleConfirmar = async () => {
    if (confirmando || cargando || subtotal <= 0) {
      return;
    }

    setConfirmando(true);
    setErrorConfirmacion(null);

    try {
      await onConfirmar({
        subtotal,
        descuentoTipo: descuentoTipoFinal,
        descuentoValor: descuentoValorFinal,
        descuentoMontoAplicado,
        descuentoRazon:
          puedeAplicarDescuento && descuentoMontoAplicado > 0
            ? descuentoRazon.trim() || null
            : null,
        descuentoAutorizadoPor:
          puedeAplicarDescuento && descuentoMontoAplicado > 0 ? usuarioId : null,
        propinaTipo,
        propinaValor,
        propinaMontoAplicado,
        totalCobrado,
        cerradoPor: usuarioId,
      });
    } catch {
      setErrorConfirmacion('No se pudo confirmar el cobro. Intenta de nuevo.');
      setConfirmando(false);
    }
  };

  if (!abierto) {
    return null;
  }

  return (
    <div
      className="mesa-cobro-modal-overlay"
      onClick={() => {
        if (!confirmando) {
          onCancelar();
        }
      }}
    >
      <div
        className="mesa-cobro-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mesa-cobro-modal-titulo"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="mesa-cobro-modal-titulo" className="mesa-cobro-modal-titulo">
          Cobro · Mesa {numeroMesa}
        </h3>

        <section className="mesa-cobro-modal-seccion" aria-label="Productos del folio">
          <h4 className="mesa-cobro-modal-seccion-titulo">Resumen de productos</h4>

          {cargando ? (
            <p className="mesa-cobro-modal-aviso">Cargando productos del folio...</p>
          ) : productosConsolidados.length === 0 ? (
            <p className="mesa-cobro-modal-aviso">No hay productos enviados en este folio.</p>
          ) : (
            <ul className="mesa-cobro-modal-productos">
              {productosConsolidados.map((producto) => (
                <li key={`${producto.productoId}|${producto.descripcion}`}>
                  <span className="mesa-cobro-modal-producto-cantidad">{producto.cantidad}</span>
                  <span className="mesa-cobro-modal-producto-nombre">{producto.descripcion}</span>
                  <span className="mesa-cobro-modal-producto-subtotal">
                    {formatearMoneda(producto.subtotal)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="mesa-cobro-modal-totales">
          <div className="mesa-cobro-modal-total-fila">
            <span>Subtotal</span>
            <strong>{formatearMoneda(subtotal)}</strong>
          </div>

          {puedeAplicarDescuento ? (
            <section className="mesa-cobro-modal-seccion mesa-cobro-modal-descuento">
              <h4 className="mesa-cobro-modal-seccion-titulo">Descuento</h4>
              <div className="mesa-cobro-modal-campos-fila">
                <label className="mesa-cobro-modal-campo">
                  <span>Tipo</span>
                  <select
                    value={descuentoTipo}
                    onChange={(event) => setDescuentoTipo(event.target.value)}
                    disabled={confirmando}
                  >
                    <option value={TIPOS_AJUSTE_MONETARIO.PORCENTAJE}>Porcentaje</option>
                    <option value={TIPOS_AJUSTE_MONETARIO.MONTO_FIJO}>Monto fijo</option>
                  </select>
                </label>
                <label className="mesa-cobro-modal-campo">
                  <span>Valor</span>
                  <input
                    type="number"
                    min="0"
                    step={descuentoTipo === TIPOS_AJUSTE_MONETARIO.PORCENTAJE ? '1' : '0.01'}
                    value={descuentoValor}
                    onChange={(event) => setDescuentoValor(event.target.value)}
                    placeholder={
                      descuentoTipo === TIPOS_AJUSTE_MONETARIO.PORCENTAJE ? '0' : '0.00'
                    }
                    disabled={confirmando}
                  />
                </label>
              </div>
              <label className="mesa-cobro-modal-campo">
                <span>Razón (opcional)</span>
                <input
                  type="text"
                  value={descuentoRazon}
                  onChange={(event) => setDescuentoRazon(event.target.value)}
                  placeholder="Motivo del descuento"
                  disabled={confirmando}
                />
              </label>
              {descuentoMontoAplicado > 0 ? (
                <p className="mesa-cobro-modal-ajuste-aplicado">
                  Descuento aplicado: -{formatearMoneda(descuentoMontoAplicado)}
                </p>
              ) : null}
            </section>
          ) : null}

          <section className="mesa-cobro-modal-seccion mesa-cobro-modal-propina">
            <h4 className="mesa-cobro-modal-seccion-titulo">Propina</h4>
            <div className="mesa-cobro-modal-propina-botones" role="group" aria-label="Propina rápida">
              {PORCENTAJES_PROPINA_RAPIDOS.map((porcentaje) => (
                <button
                  key={porcentaje}
                  type="button"
                  className={`mesa-cobro-modal-propina-btn${
                    !propinaMontoExactoActivo && propinaPorcentajeSeleccionado === porcentaje
                      ? ' activo'
                      : ''
                  }`}
                  onClick={() => seleccionarPropinaPorcentaje(porcentaje)}
                  disabled={confirmando || subtotal <= 0}
                >
                  {porcentaje}%
                </button>
              ))}
            </div>
            <label className="mesa-cobro-modal-campo">
              <span>Monto exacto</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={propinaMontoExacto}
                placeholder="0.00"
                onFocus={activarPropinaMontoExacto}
                onClick={activarPropinaMontoExacto}
                onChange={(event) => {
                  setPropinaMontoExactoActivo(true);
                  setPropinaPorcentajeSeleccionado(null);
                  setPropinaMontoExacto(event.target.value);
                }}
                disabled={confirmando || subtotal <= 0}
                className={propinaMontoExactoActivo ? 'activo' : ''}
              />
            </label>
            {propinaMontoAplicado > 0 ? (
              <p className="mesa-cobro-modal-ajuste-aplicado">
                Propina: +{formatearMoneda(propinaMontoAplicado)}
              </p>
            ) : null}
          </section>

          <div className="mesa-cobro-modal-total-fila mesa-cobro-modal-total-final">
            <span>Total a cobrar</span>
            <strong>{formatearMoneda(totalCobrado)}</strong>
          </div>
        </div>

        {errorConfirmacion ? (
          <p className="mesa-cobro-modal-error" role="alert">
            {errorConfirmacion}
          </p>
        ) : null}

        <div className="mesa-cobro-modal-acciones">
          <button
            type="button"
            className="mesa-cobro-modal-cancelar"
            onClick={onCancelar}
            disabled={confirmando}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="mesa-cobro-modal-confirmar"
            onClick={() => void handleConfirmar()}
            disabled={confirmando || cargando || subtotal <= 0}
          >
            {confirmando ? 'Confirmando...' : 'Confirmar cobro'}
          </button>
        </div>
      </div>
    </div>
  );
}
