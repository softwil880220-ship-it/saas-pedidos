import { useEffect, useMemo, useRef, useState } from 'react';
import {
  TIPOS_AJUSTE_MONETARIO,
  calcularMontoDescuentoMesa,
  calcularMontoPropinaMesa,
  calcularTotalCobroMesa,
  puedeAplicarDescuentoMesaCobro,
} from './mesaCobroCalculos';
import { formatearMoneda } from './pedidosShared';
import {
  ERROR_CODIGO_FOLIO_SIN_FILAS_AFECTADAS,
  MENSAJE_MESA_YA_COBRADA_POR_OTRO_USUARIO,
} from './pedidoCarritoStorage';
import { usePedidosFolioMesa } from './usePedidosFolioMesa';

const PORCENTAJES_PROPINA_RAPIDOS = [5, 10, 15, 20];

const FORMAS_PAGO_MESA = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'tarjeta', label: 'Tarjeta' },
  { value: 'transferencia', label: 'Transferencia' },
];

function parsearEntradaNumerica(valor) {
  if (valor === '' || valor == null) {
    return null;
  }

  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

function etiquetaDescuentoRecibo(tipo, valor) {
  if (tipo === TIPOS_AJUSTE_MONETARIO.PORCENTAJE) {
    return `Descuento (-${valor}%)`;
  }

  return 'Descuento (monto)';
}

function etiquetaPropinaRecibo(tipo, valor) {
  if (tipo === TIPOS_AJUSTE_MONETARIO.PORCENTAJE) {
    return `Propina (+${valor}%)`;
  }

  return 'Propina (monto)';
}

export default function MesaCobroModal({
  abierto,
  folioId,
  numeroMesa,
  negocioId,
  abiertaEn,
  usuarioId,
  rol,
  estadoPersistido = null,
  onPersistirEstado,
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
  const [formaPago, setFormaPago] = useState('');
  const [pagoRecibido, setPagoRecibido] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  const [errorConfirmacion, setErrorConfirmacion] = useState(null);
  const [sesionCobroLista, setSesionCobroLista] = useState(false);
  const hidratacionAplicadaRef = useRef(false);

  useEffect(() => {
    if (!abierto) {
      setSesionCobroLista(false);
      setConfirmando(false);
      setErrorConfirmacion(null);
      return;
    }

    if (!hidratacionAplicadaRef.current) {
      hidratacionAplicadaRef.current = true;

      if (estadoPersistido) {
        setDescuentoTipo(
          estadoPersistido.descuentoTipo === TIPOS_AJUSTE_MONETARIO.MONTO_FIJO
            ? TIPOS_AJUSTE_MONETARIO.MONTO_FIJO
            : TIPOS_AJUSTE_MONETARIO.PORCENTAJE
        );
        setDescuentoValor(estadoPersistido.descuentoValor ?? '');
        setDescuentoRazon(estadoPersistido.descuentoRazon ?? '');
        setPropinaPorcentajeSeleccionado(estadoPersistido.propinaPorcentajeSeleccionado ?? null);
        setPropinaMontoExacto(estadoPersistido.propinaMontoExacto ?? '');
        setPropinaMontoExactoActivo(Boolean(estadoPersistido.propinaMontoExactoActivo));
        setFormaPago(estadoPersistido.formaPago ?? '');
        setPagoRecibido(estadoPersistido.pagoRecibido ?? '');
      } else {
        setDescuentoTipo(TIPOS_AJUSTE_MONETARIO.PORCENTAJE);
        setDescuentoValor('');
        setDescuentoRazon('');
        setPropinaPorcentajeSeleccionado(null);
        setPropinaMontoExacto('');
        setPropinaMontoExactoActivo(false);
        setFormaPago('');
        setPagoRecibido('');
      }
    }

    setConfirmando(false);
    setErrorConfirmacion(null);
    setSesionCobroLista(true);
  }, [abierto, estadoPersistido, numeroMesa, abiertaEn]);

  useEffect(() => {
    if (!folioId || !onPersistirEstado) {
      return;
    }

    if (!abierto && !hidratacionAplicadaRef.current) {
      return;
    }

    if (abierto && !sesionCobroLista) {
      return;
    }

    onPersistirEstado({
      descuentoTipo,
      descuentoValor,
      descuentoRazon,
      propinaPorcentajeSeleccionado,
      propinaMontoExacto,
      propinaMontoExactoActivo,
      formaPago,
      pagoRecibido,
    });
  }, [
    folioId,
    abierto,
    sesionCobroLista,
    onPersistirEstado,
    descuentoTipo,
    descuentoValor,
    descuentoRazon,
    propinaPorcentajeSeleccionado,
    propinaMontoExacto,
    propinaMontoExactoActivo,
    formaPago,
    pagoRecibido,
  ]);

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

  const pagoRecibidoValido =
    formaPago === 'efectivo' &&
    pagoRecibido !== '' &&
    !Number.isNaN(parseFloat(pagoRecibido));

  const cambio = pagoRecibidoValido ? parseFloat(pagoRecibido) - totalCobrado : null;
  const pagoInsuficiente = pagoRecibidoValido && cambio < 0;

  const seleccionarPropinaPorcentaje = (porcentaje) => {
    if (!propinaMontoExactoActivo && propinaPorcentajeSeleccionado === porcentaje) {
      setPropinaPorcentajeSeleccionado(null);
      return;
    }

    setPropinaMontoExactoActivo(false);
    setPropinaMontoExacto('');
    setPropinaPorcentajeSeleccionado(porcentaje);
  };

  const activarPropinaMontoExacto = () => {
    setPropinaMontoExactoActivo(true);
    setPropinaPorcentajeSeleccionado(null);
  };

  const handleConfirmar = async () => {
    if (confirmando || cargando || subtotal <= 0 || !formaPago) {
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
        formaPago,
        cerradoPor: usuarioId,
      });
    } catch (error) {
      if (error?.code === ERROR_CODIGO_FOLIO_SIN_FILAS_AFECTADAS) {
        setErrorConfirmacion(MENSAJE_MESA_YA_COBRADA_POR_OTRO_USUARIO);
      } else {
        setErrorConfirmacion('No se pudo confirmar el cobro. Intenta de nuevo.');
      }
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
              {productosConsolidados.map((grupo) => (
                <li key={grupo.clave} className="mesa-cobro-modal-producto-grupo">
                  <div className="mesa-cobro-modal-producto-fila">
                    <span className="mesa-cobro-modal-producto-etiqueta">
                      {grupo.textoLinea
                        ? grupo.textoLinea
                        : `${grupo.cantidad}x ${grupo.nombre} (${formatearMoneda(grupo.precioUnitario)} c/u)`}
                    </span>
                    {!grupo.textoLinea ? (
                      <span className="mesa-cobro-modal-producto-subtotal">
                        {formatearMoneda(grupo.subtotalBase)}
                      </span>
                    ) : null}
                  </div>
                  {(grupo.extrasLineas || []).map((extra) => (
                    <div
                      key={`${grupo.clave}|${extra.etiqueta}`}
                      className="mesa-cobro-modal-producto-extra"
                    >
                      <span className="mesa-cobro-modal-producto-extra-etiqueta">
                        + {extra.etiqueta}
                      </span>
                      <span className="mesa-cobro-modal-producto-subtotal">
                        {formatearMoneda(extra.subtotal)}
                      </span>
                    </div>
                  ))}
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
                    <option value={TIPOS_AJUSTE_MONETARIO.MONTO_FIJO}>Monto</option>
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
                      descuentoTipo === TIPOS_AJUSTE_MONETARIO.PORCENTAJE ? '0' : '$0.00'
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
            <div className="mesa-cobro-modal-propina-controles">
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
              <label className="mesa-cobro-modal-campo mesa-cobro-modal-propina-otro-monto">
                <span>Otro monto</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={propinaMontoExacto}
                  placeholder="$0.00"
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
            </div>
            {propinaMontoAplicado > 0 ? (
              <p className="mesa-cobro-modal-ajuste-aplicado">
                Propina: +{formatearMoneda(propinaMontoAplicado)}
              </p>
            ) : null}
          </section>

          <label className="mesa-cobro-modal-campo mesa-cobro-modal-forma-pago">
            <span>Forma de pago</span>
            <select
              value={formaPago}
              onChange={(event) => {
                const siguienteFormaPago = event.target.value;
                setFormaPago(siguienteFormaPago);
                if (siguienteFormaPago !== 'efectivo') {
                  setPagoRecibido('');
                }
              }}
              disabled={confirmando}
              required
            >
              <option value="" disabled>
                Selecciona una opción
              </option>
              {FORMAS_PAGO_MESA.map((forma) => (
                <option key={forma.value} value={forma.value}>
                  {forma.label}
                </option>
              ))}
            </select>
          </label>

          {formaPago === 'efectivo' ? (
            <div className="caja-pago mesa-cobro-modal-pago-efectivo">
              <div className="formulario-campo caja-pago-campo">
                <label htmlFor="mesa-cobro-pago-recibido">Pago recibido</label>
                <input
                  id="mesa-cobro-pago-recibido"
                  type="number"
                  min="0"
                  step="0.01"
                  value={pagoRecibido}
                  onChange={(event) => setPagoRecibido(event.target.value)}
                  placeholder="$0.00"
                  disabled={confirmando}
                />
              </div>
              <div className="mesa-cobro-modal-pago-cambio-slot" aria-live="polite">
                {pagoRecibidoValido ? (
                  pagoInsuficiente ? (
                    <p className="caja-pago-alerta caja-pago-insuficiente">Pago insuficiente</p>
                  ) : (
                    <p className="caja-pago-alerta caja-pago-cambio">
                      Cambio: {formatearMoneda(cambio)}
                    </p>
                  )
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <section className="mesa-cobro-modal-recibo" aria-label="Resumen de cobro">
          <div className="mesa-cobro-modal-recibo-fila">
            <span>Subtotal</span>
            <span>{formatearMoneda(subtotal)}</span>
          </div>

          {descuentoMontoAplicado > 0 ? (
            <div className="mesa-cobro-modal-recibo-fila mesa-cobro-modal-recibo-ajuste">
              <span>
                {etiquetaDescuentoRecibo(descuentoTipoFinal, descuentoValorFinal)}
              </span>
              <span>-{formatearMoneda(descuentoMontoAplicado)}</span>
            </div>
          ) : null}

          {propinaMontoAplicado > 0 ? (
            <div className="mesa-cobro-modal-recibo-fila mesa-cobro-modal-recibo-ajuste">
              <span>{etiquetaPropinaRecibo(propinaTipo, propinaValor)}</span>
              <span>+{formatearMoneda(propinaMontoAplicado)}</span>
            </div>
          ) : null}

          <hr className="mesa-cobro-modal-recibo-separador" />

          <div className="mesa-cobro-modal-recibo-fila mesa-cobro-modal-recibo-total">
            <span>Total a cobrar</span>
            <span>{formatearMoneda(totalCobrado)}</span>
          </div>
        </section>

        <div className="mesa-cobro-modal-total-fila mesa-cobro-modal-total-final">
          <span>Total a cobrar</span>
          <strong>{formatearMoneda(totalCobrado)}</strong>
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
            disabled={confirmando || cargando || subtotal <= 0 || !formaPago}
          >
            {confirmando ? 'Confirmando...' : 'Confirmar cobro'}
          </button>
        </div>
      </div>
    </div>
  );
}
