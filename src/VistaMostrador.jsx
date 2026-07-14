import { useCallback, useEffect, useRef, useState } from 'react';
import './VistaMostrador.css';
import SelectorProductosPedido from './SelectorProductosPedido.jsx';
import PedidoLineasCarrito from './PedidoLineasCarrito.jsx';
import CajaPagoEfectivo from './CajaPagoEfectivo.jsx';
import MostradorPendienteRecibo from './MostradorPendienteRecibo.jsx';
import useCarritoPedido from './useCarritoPedido';
import { supabase } from './supabase';
import { queryConNegocio } from './tenantHelpers';
import { usePedidosRealtime } from './usePedidosRealtime';
import {
  CLIENTE_MOSTRADOR,
  cargarCarritoMostradorDisponible,
  cargarTabMostrador,
  persistirTabMostrador,
} from './pedidoCarritoStorage';
import {
  construirUpdateEntregadoMostradorPendientes,
  formatearMoneda,
  pedidoPendienteEntregaMostrador,
} from './pedidosShared';
import { registrarPedidoMostrador } from './registrarPedidoMostrador';

const TABS_MOSTRADOR = [
  { value: 'nuevo', label: 'Nuevo pedido' },
  { value: 'pendientes', label: 'Pendientes de entrega' },
];

const FORMAS_PAGO = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'tarjeta', label: 'Tarjeta' },
  { value: 'transferencia', label: 'Transferencia' },
];

const DURACION_MENSAJE_EXITO_MS = 4500;

function obtenerFechaHoy() {
  const hoy = new Date();
  const year = hoy.getFullYear();
  const month = String(hoy.getMonth() + 1).padStart(2, '0');
  const day = String(hoy.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function obtenerRangoFechaClave(claveFecha) {
  const [year, month, day] = claveFecha.split('-').map(Number);
  return {
    inicio: new Date(year, month - 1, day, 0, 0, 0, 0),
    fin: new Date(year, month - 1, day, 23, 59, 59, 999),
  };
}

async function cargarArqueoDelDia(negocioId) {
  const hoyClave = obtenerFechaHoy();
  const { inicio, fin } = obtenerRangoFechaClave(hoyClave);
  const { data, error } = await queryConNegocio(
    supabase
      .from('arqueos')
      .select('id')
      .gte('created_at', inicio.toISOString())
      .lte('created_at', fin.toISOString())
      .order('created_at', { ascending: false })
      .limit(1),
    negocioId
  );

  if (error) {
    throw new Error(error.message);
  }

  return (data || [])[0] ?? null;
}

function etiquetaFormaPago(valor) {
  return FORMAS_PAGO.find((forma) => forma.value === valor)?.label || null;
}

export default function VistaMostrador({
  productos,
  productosOrdenados,
  frecuenciaCategorias,
  frecuenciaLista,
  variantesCtx,
  negocioId,
  usuarioId,
}) {
  const [tabActivo, setTabActivo] = useState(() => cargarTabMostrador());
  const [mostradorFlujoCocina, setMostradorFlujoCocina] = useState(0);
  const [mensajeExito, setMensajeExito] = useState(null);
  const [errorGuardar, setErrorGuardar] = useState(null);
  const [actualizandoEntregaId, setActualizandoEntregaId] = useState(null);
  const snapshotInicialRef = useRef(cargarCarritoMostradorDisponible() ?? undefined);
  const mensajeExitoTimerRef = useRef(null);

  const carrito = useCarritoPedido({
    variantesCtx,
    productos,
    modoCaptura: 'mostrador',
    persistir: true,
    snapshotInicial: snapshotInicialRef.current,
  });

  useEffect(() => {
    persistirTabMostrador(tabActivo);
  }, [tabActivo]);

  useEffect(() => {
    const restaurarTabAlMostrarPagina = (evento) => {
      if (!evento.persisted) return;
      setTabActivo(cargarTabMostrador());
    };

    window.addEventListener('pageshow', restaurarTabAlMostrarPagina);
    return () => window.removeEventListener('pageshow', restaurarTabAlMostrarPagina);
  }, []);

  useEffect(() => {
    if (!negocioId) {
      setMostradorFlujoCocina(0);
      return;
    }

    let activo = true;

    const cargarFlujo = async () => {
      const { data, error } = await supabase
        .from('negocios')
        .select('mostrador_flujo_cocina')
        .eq('id', negocioId)
        .maybeSingle();

      if (!activo || error) return;

      const flujo = Number(data?.mostrador_flujo_cocina);
      setMostradorFlujoCocina(
        Number.isFinite(flujo) && flujo >= 0 && flujo <= 3 ? flujo : 0
      );
    };

    void cargarFlujo();

    return () => {
      activo = false;
    };
  }, [negocioId]);

  useEffect(() => {
    if (!mensajeExito) return undefined;

    if (mensajeExitoTimerRef.current) {
      clearTimeout(mensajeExitoTimerRef.current);
    }

    mensajeExitoTimerRef.current = setTimeout(() => {
      setMensajeExito(null);
      mensajeExitoTimerRef.current = null;
    }, DURACION_MENSAJE_EXITO_MS);

    return () => {
      if (mensajeExitoTimerRef.current) {
        clearTimeout(mensajeExitoTimerRef.current);
        mensajeExitoTimerRef.current = null;
      }
    };
  }, [mensajeExito]);

  const filtrarPendientes = useCallback(
    (pedido) => pedidoPendienteEntregaMostrador(pedido),
    []
  );

  const compararPendientes = useCallback(
    (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0),
    []
  );

  const { pedidos: pedidosPendientes, setPedidos: setPedidosPendientes } =
    usePedidosRealtime({
      channelName: 'mostrador-pendientes',
      negocioId,
      filtrar: filtrarPendientes,
      comparar: compararPendientes,
    });

  const cerrarMensajeExito = () => {
    if (mensajeExitoTimerRef.current) {
      clearTimeout(mensajeExitoTimerRef.current);
      mensajeExitoTimerRef.current = null;
    }
    setMensajeExito(null);
  };

  const registrarVenta = async (event) => {
    event.preventDefault();
    setErrorGuardar(null);

    if (carrito.totalPedido <= 0) return;

    try {
      const arqueo = await cargarArqueoDelDia(negocioId);
      if (arqueo) {
        setErrorGuardar(
          'No se puede registrar la venta: el arqueo del día ya fue realizado.'
        );
        return;
      }
    } catch (err) {
      setErrorGuardar(err.message || 'No se pudo verificar el arqueo del día.');
      return;
    }

    const detallePedido = carrito.obtenerDetallePedido();
    const resumen = carrito.obtenerResumenProductos();
    const referenciaGuardada = carrito.form.referencia?.trim() || '';
    const formaPagoGuardada = carrito.form.formaPago;

    carrito.pausarPersistencia();

    const { data, error } = await registrarPedidoMostrador({
      negocioId,
      detallePedido,
      resumen,
      form: carrito.form,
      productos,
      mostradorFlujoCocina,
      usuarioId,
    });

    if (error || !data) {
      carrito.reanudarPersistencia();
      setErrorGuardar(
        'No se pudo registrar el pedido. Verifica tu conexión e intenta de nuevo.'
      );
      return;
    }

    carrito.resetCarrito({ limpiarStorage: true });
    carrito.reanudarPersistencia();

    setMensajeExito({
      folio: data.folio,
      total: detallePedido.total,
      referencia: referenciaGuardada,
      formaPago: formaPagoGuardada,
    });

    setPedidosPendientes((prev) => {
      const existe = prev.some((item) => item.id === data.id);
      return existe ? prev : [data, ...prev];
    });
  };

  const marcarEntregado = async (pedido) => {
    const update = construirUpdateEntregadoMostradorPendientes(pedido);
    if (!update) return;

    setActualizandoEntregaId(pedido.id);

    const { error } = await queryConNegocio(
      supabase.from('pedidos').update(update).eq('id', pedido.id),
      negocioId
    );

    if (!error) {
      setPedidosPendientes((prev) => prev.filter((item) => item.id !== pedido.id));
    }

    setActualizandoEntregaId(null);
  };

  return (
    <div className="vista-mostrador">
      <nav className="mostrador-seccion-nav" aria-label="Secciones de mostrador">
        {TABS_MOSTRADOR.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            className={`mostrador-seccion-tab${tabActivo === value ? ' activo' : ''}`}
            onClick={() => setTabActivo(value)}
          >
            {label}
          </button>
        ))}
      </nav>

      {tabActivo === 'nuevo' ? (
        <section className="pedido-formulario mostrador-nuevo-pedido">
          {mensajeExito ? (
            <div
              className="mostrador-exito-banner"
              role="status"
              aria-live="polite"
            >
              <p className="mostrador-exito-banner-texto">
                Pedido registrado y cobrado
                {mensajeExito.folio ? ` · ${mensajeExito.folio}` : ''}
                {' · '}
                {formatearMoneda(mensajeExito.total)}
                {mensajeExito.referencia
                  ? ` · ${mensajeExito.referencia}`
                  : ` · ${CLIENTE_MOSTRADOR}`}
                {etiquetaFormaPago(mensajeExito.formaPago)
                  ? ` · ${etiquetaFormaPago(mensajeExito.formaPago)}`
                  : ''}
              </p>
              <button
                type="button"
                className="mostrador-exito-banner-cerrar"
                aria-label="Cerrar mensaje de éxito"
                onClick={cerrarMensajeExito}
              >
                ×
              </button>
            </div>
          ) : null}

          <h2 className="formulario-titulo">Nuevo pedido de mostrador</h2>
          <form className="formulario-pedido" onSubmit={registrarVenta}>
            <div className="formulario formulario-cabecera">
              <div className="formulario-campo">
                <label htmlFor="mostrador-cliente">Cliente</label>
                <input
                  id="mostrador-cliente"
                  name="cliente"
                  type="text"
                  value={CLIENTE_MOSTRADOR}
                  readOnly
                />
              </div>
              <div className="formulario-campo">
                <label htmlFor="mostrador-referencia">Referencia / Nombre</label>
                <input
                  id="mostrador-referencia"
                  name="referencia"
                  type="text"
                  placeholder="Opcional"
                  value={carrito.form.referencia}
                  onChange={(e) =>
                    carrito.setCampoCaptura('referencia', e.target.value)
                  }
                />
              </div>
              <div className="formulario-campo">
                <label htmlFor="mostrador-forma-pago">Forma de pago</label>
                <select
                  id="mostrador-forma-pago"
                  name="formaPago"
                  value={carrito.form.formaPago}
                  onChange={(e) =>
                    carrito.setCampoCaptura('formaPago', e.target.value)
                  }
                >
                  {FORMAS_PAGO.map((forma) => (
                    <option key={forma.value} value={forma.value}>
                      {forma.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {productos.length > 0 ? (
              <SelectorProductosPedido
                productos={productosOrdenados}
                frecuenciaCategorias={frecuenciaCategorias}
                frecuenciaLista={frecuenciaLista}
                categoriaActiva={carrito.categoriaPedidoActiva}
                onCategoriaChange={carrito.setCategoriaPedidoActiva}
                onAgregarProducto={carrito.agregarProductoAlPedido}
              />
            ) : null}

            <PedidoLineasCarrito
              lineas={carrito.lineasPedidoConProducto}
              productos={productos}
              variantesCtx={variantesCtx}
              totalPedido={carrito.totalPedido}
              onAjustarCantidad={carrito.ajustarCantidadLinea}
              onActualizarCantidad={carrito.actualizarCantidadLinea}
              onEliminarLinea={carrito.eliminarLinea}
              onCambiarVariante={carrito.cambiarVarianteLinea}
            >
              <CajaPagoEfectivo
                formaPago={carrito.form.formaPago}
                pagoRecibido={carrito.pagoRecibido}
                onPagoRecibidoChange={carrito.setPagoRecibido}
                pagoValido={carrito.pagoValido}
                pagoInsuficiente={carrito.pagoInsuficiente}
                cambio={carrito.cambio}
                inputId="mostrador-pago-recibido"
              />
              <div className="pedido-acciones-principales">
                <button
                  type="button"
                  className="limpiar-pedido-btn"
                  onClick={() => {
                    setErrorGuardar(null);
                    carrito.resetCarrito({ limpiarStorage: true });
                  }}
                >
                  Limpiar pedido
                </button>
                <button
                  type="submit"
                  className="guardar-btn"
                  disabled={productos.length === 0 || carrito.totalPedido <= 0}
                >
                  Registrar y cobrar
                </button>
              </div>
              {errorGuardar ? (
                <p className="formulario-error-guardar" role="alert">
                  {errorGuardar}
                </p>
              ) : null}
            </PedidoLineasCarrito>
          </form>
          {productos.length === 0 ? (
            <p className="formulario-aviso">
              Agrega productos en la sección Catálogo de productos para crear pedidos.
            </p>
          ) : null}
        </section>
      ) : (
        <section className="mostrador-pendientes">
          <header className="mostrador-pendientes-cabecera">
            <h2 className="mostrador-pendientes-titulo">Pendientes de entrega</h2>
            <p className="mostrador-pendientes-subtitulo">
              Pedidos cobrados · estado en tiempo real
            </p>
            <span className="mostrador-pendientes-contador">
              {pedidosPendientes.length} pendiente
              {pedidosPendientes.length === 1 ? '' : 's'}
            </span>
          </header>

          {pedidosPendientes.length === 0 ? (
            <p className="mostrador-pendientes-vacio">
              No hay pedidos pendientes de entrega.
            </p>
          ) : (
            <div className="mostrador-pendientes-lista">
              {pedidosPendientes.map((pedido) => (
                <MostradorPendienteRecibo
                  key={pedido.id}
                  pedido={pedido}
                  productos={productos}
                  variantesCtx={variantesCtx}
                  actualizando={actualizandoEntregaId === pedido.id}
                  onEntregado={marcarEntregado}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
