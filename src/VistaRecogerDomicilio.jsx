import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './VistaRecogerDomicilio.css';
import './VistaMostrador.css';
import { useAuth } from './AuthContext';
import BuscadorPedidosRecogerDomicilio from './BuscadorPedidosRecogerDomicilio.jsx';
import ClienteBusquedaWhatsapp from './ClienteBusquedaWhatsapp';
import ListaPedidosRecogerDomicilio from './ListaPedidosRecogerDomicilio.jsx';
import ModalAutorizacionPin from './ModalAutorizacionPin.jsx';
import PedidoLineasCarrito from './PedidoLineasCarrito.jsx';
import SelectorProductosPedidoConModal from './SelectorProductosPedidoConModal.jsx';
import useCarritoPedido from './useCarritoPedido';
import useRepartidoresNegocio from './useRepartidoresNegocio';
import { formatearZonaConTarifa, payloadDireccionDomicilioDesdeForm } from './clientesHelpers';
import {
  cargarCarritoWhatsappDisponible,
  cargarTabRecogerDomicilio,
  persistirTabRecogerDomicilio,
} from './pedidoCarritoStorage';
import {
  eliminarPedidoPendienteSync,
  guardarPedidoPendienteSync,
} from './pedidoPendingSyncStorage';
import {
  CAMPOS_AUDITORIA_EDICION_RECOGER_DOMICILIO,
  construirPayloadEdicionRecogerDomicilio,
  construirRegistrosAuditoriaEdicionPedido,
  construirSnapshotCarritoDesdePedido,
  resumenProductosDesdeLineas,
  tituloAutorizacionPinPedido,
} from './pedidoEdicionHelpers';
import {
  TABS_RECOGER_DOMICILIO,
  TIPOS_ENTREGA_OPCIONES,
  construirPayloadAsignacionRepartidor,
  construirPayloadAvancePedidoRecogerDomicilio,
  construirPayloadRetrocesoPedidoRecogerDomicilio,
  crearIdOptimisticoPedidoRecogerDomicilio,
  filtrarPedidosRecogerDomicilioPorTab,
  normalizarFormaPagoRecogerDomicilio,
  ordenarPedidosRecogerDomicilioDesc,
  tipoEntregaRecogerDomicilioSeleccionado,
} from './recogerDomicilioHelpers';
import {
  TIPOS_ENTREGA,
  enriquecerLineasDetalleCocina,
  etiquetaStatusPedido,
  normalizarTipoEntrega,
  obtenerFlujoStatus,
} from './pedidosShared';
import {
  programadoParaDesdeForm,
  validarProgramadoParaFuturo,
} from './pedidosProgramadosHelpers';
import { supabase } from './supabase';
import { payloadConNegocio, queryConNegocio } from './tenantHelpers';

const FORMAS_PAGO = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'tarjeta', label: 'Tarjeta' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'link_pago', label: 'Link de pago' },
];

const MENSAJE_GUARDAR_PEDIDO_SIN_JORNADA =
  'Abre una jornada para registrar pedidos de recoger/domicilio.';
const MENSAJE_EDITAR_PEDIDO_SIN_JORNADA =
  'Abre una jornada para editar pedidos de recoger/domicilio.';
const MENSAJE_ELIMINAR_PEDIDO_SIN_JORNADA =
  'Abre una jornada para eliminar pedidos de recoger/domicilio.';
const MENSAJE_AVANZAR_PEDIDO_SIN_JORNADA =
  'Abre una jornada para avanzar pedidos de recoger/domicilio.';
const MENSAJE_RETROCEDER_PEDIDO_SIN_JORNADA =
  'Abre una jornada para retroceder pedidos de recoger/domicilio.';
const TITULO_MODAL_SIN_JORNADA = 'Jornada cerrada';

export default function VistaRecogerDomicilio({
  productos,
  productosOrdenados,
  frecuenciaCategorias,
  frecuenciaLista,
  variantesCtx,
  negocioId,
  usuarioId,
  jornadaAbierta,
  pedidos,
  setPedidos,
}) {
  const [tabActivo, setTabActivo] = useState(() => cargarTabRecogerDomicilio());
  const [errorGuardar, setErrorGuardar] = useState(null);
  const [editandoPedidoId, setEditandoPedidoId] = useState(null);
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  const [eliminandoPedidoId, setEliminandoPedidoId] = useState(null);
  const [asignandoRepartidorId, setAsignandoRepartidorId] = useState(null);
  const [pedidoResaltadoId, setPedidoResaltadoId] = useState(null);
  const [modalPinAbierto, setModalPinAbierto] = useState(false);
  const [pedidoPendienteAutorizacion, setPedidoPendienteAutorizacion] = useState(null);
  const [accionPendientePin, setAccionPendientePin] = useState(null);
  const [modalJornadaCerradaAbierto, setModalJornadaCerradaAbierto] = useState(false);
  const [mensajeModalJornadaCerrada, setMensajeModalJornadaCerrada] = useState(null);
  const [zonasActivas, setZonasActivas] = useState([]);
  const [mostrarFleteManual, setMostrarFleteManual] = useState(false);
  const [montoFleteManual, setMontoFleteManual] = useState('');

  const { modulosNegocio } = useAuth();
  const mostrarBuscadorClientes = modulosNegocio.habilitar_clientes === true;
  const mostrarSelectorZona = zonasActivas.length > 0;

  const snapshotInicialRef = useRef(cargarCarritoWhatsappDisponible() ?? undefined);
  const resaltadoTimerRef = useRef(null);

  const carrito = useCarritoPedido({
    variantesCtx,
    productos,
    modoCaptura: 'whatsapp',
    persistir: true,
    snapshotInicial: snapshotInicialRef.current,
    zonasActivas,
  });

  const { repartidores } = useRepartidoresNegocio(negocioId);

  useEffect(() => {
    if (!negocioId) {
      setZonasActivas([]);
      return;
    }

    const cargarZonas = async () => {
      const { data } = await queryConNegocio(
        supabase
          .from('zonas')
          .select('id, nombre, tarifa_flete, activa')
          .eq('activa', true)
          .order('nombre'),
        negocioId
      );

      setZonasActivas(data || []);
    };

    void cargarZonas();
  }, [negocioId]);

  const aplicarSeleccionCliente = useCallback(
    (seleccion) => {
      const formActualizado = { ...carrito.form };

      if (seleccion.cliente !== undefined) {
        formActualizado.cliente = seleccion.cliente;
      }
      if (seleccion.telefono !== undefined) {
        formActualizado.telefono = seleccion.telefono;
      }
      if (seleccion.etiqueta !== undefined) {
        formActualizado.etiqueta = seleccion.etiqueta;
      }
      if (seleccion.calle !== undefined) {
        formActualizado.calle = seleccion.calle || '';
      }
      if (seleccion.numero !== undefined) {
        formActualizado.numero = seleccion.numero || '';
      }
      if (seleccion.entre_calles !== undefined) {
        formActualizado.entre_calles = seleccion.entre_calles || '';
      }
      if (seleccion.direccion_referencia !== undefined) {
        formActualizado.direccion_referencia = seleccion.direccion_referencia || '';
      }
      if (seleccion.colonia !== undefined) {
        formActualizado.colonia = seleccion.colonia || '';
      }
      if (seleccion.municipio !== undefined) {
        formActualizado.municipio = seleccion.municipio || '';
      }
      if (seleccion.zona_id !== undefined && mostrarSelectorZona) {
        formActualizado.zona_id = seleccion.zona_id || '';
      }

      carrito.aplicarSnapshot({
        form: formActualizado,
        pagoRecibido: carrito.pagoRecibido,
      });
      carrito.sincronizarFleteAutomatico({ reemplazarManual: true });
    },
    [carrito, mostrarSelectorZona]
  );

  useEffect(() => {
    if (!zonasActivas.length) return;
    if (carrito.form.tipoEntrega !== TIPOS_ENTREGA.DOMICILIO) return;
    if (carrito.lineaFlete) return;
    if (!carrito.form.zona_id) return;
    carrito.sincronizarFleteAutomatico({ reemplazarManual: false });
  }, [zonasActivas]);

  useEffect(() => {
    persistirTabRecogerDomicilio(tabActivo);
  }, [tabActivo]);

  useEffect(() => {
    const restaurarTabAlMostrarPagina = (evento) => {
      if (!evento.persisted) return;
      setTabActivo(cargarTabRecogerDomicilio());
    };

    window.addEventListener('pageshow', restaurarTabAlMostrarPagina);
    return () => window.removeEventListener('pageshow', restaurarTabAlMostrarPagina);
  }, []);

  useEffect(
    () => () => {
      if (resaltadoTimerRef.current) {
        clearTimeout(resaltadoTimerRef.current);
      }
    },
    []
  );

  const bloqueadoPorJornada = !jornadaAbierta?.id;
  const claseBotonJornadaCerrada = bloqueadoPorJornada ? ' btn-accion-jornada-cerrada' : '';

  const pedidosCocina = useMemo(
    () => filtrarPedidosRecogerDomicilioPorTab(pedidos, 'cocina', jornadaAbierta),
    [pedidos, jornadaAbierta]
  );
  const pedidosPendientes = useMemo(
    () => filtrarPedidosRecogerDomicilioPorTab(pedidos, 'pendientes', jornadaAbierta),
    [pedidos, jornadaAbierta]
  );
  const pedidosEntregados = useMemo(
    () => filtrarPedidosRecogerDomicilioPorTab(pedidos, 'entregados', jornadaAbierta),
    [pedidos, jornadaAbierta]
  );

  const abrirModalJornadaCerrada = (mensaje) => {
    setMensajeModalJornadaCerrada(mensaje);
    setModalJornadaCerradaAbierto(true);
  };

  const cerrarModalJornadaCerrada = () => {
    setModalJornadaCerradaAbierto(false);
    setMensajeModalJornadaCerrada(null);
  };

  const verificarJornadaBloqueaAccion = (mensaje) => {
    if (!jornadaAbierta?.id) {
      abrirModalJornadaCerrada(mensaje);
      return true;
    }
    return false;
  };

  const actualizarPedidoLocal = useCallback(
    (id, payload) => {
      setPedidos((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...payload } : item))
      );
    },
    [setPedidos]
  );

  const guardarPedido = async (event) => {
    event.preventDefault();
    setErrorGuardar(null);

    if (carrito.totalPedido <= 0) return;

    if (verificarJornadaBloqueaAccion(MENSAJE_GUARDAR_PEDIDO_SIN_JORNADA)) {
      return;
    }

    if (!tipoEntregaRecogerDomicilioSeleccionado(carrito.form.tipoEntrega)) {
      return;
    }

    const form = carrito.form;

    if (form.programarPedido) {
      const validacionProgramado = validarProgramadoParaFuturo(form.programadoPara);
      if (!validacionProgramado.valido) {
        setErrorGuardar(validacionProgramado.mensaje);
        return;
      }
    }

    const detallePedido = carrito.obtenerDetallePedido();
    const resumen = carrito.obtenerResumenProductos();
    const direccionPayload = payloadDireccionDomicilioDesdeForm(form);

    const payload = {
      cliente: form.cliente.trim(),
      telefono: form.telefono.trim() || null,
      producto: resumen,
      lineas_detalle: Array.isArray(detallePedido.lineas) ? detallePedido.lineas : [],
      total: detallePedido.total,
      status: form.status,
      tipo: 'whatsapp',
      tipo_entrega: normalizarTipoEntrega(form.tipoEntrega),
      ...direccionPayload,
      forma_pago: normalizarFormaPagoRecogerDomicilio(form.formaPago),
      created_by: usuarioId ?? null,
      jornada_id: jornadaAbierta?.id ?? null,
      repartidor_usuario_id: null,
      repartidor_externo: false,
      programado_para: programadoParaDesdeForm(form.programarPedido, form.programadoPara),
    };

    const optimisticId = crearIdOptimisticoPedidoRecogerDomicilio();
    const ahora = new Date().toISOString();
    const payloadInsert = payloadConNegocio(payload, negocioId);
    const pedidoOptimista = {
      id: optimisticId,
      ...payloadInsert,
      created_at: ahora,
      updated_at: ahora,
    };

    guardarPedidoPendienteSync({
      localId: optimisticId,
      payload: payloadInsert,
      pedidoOptimista,
      negocioId,
    });

    setPedidos((prev) => ordenarPedidosRecogerDomicilioDesc([...prev, pedidoOptimista]));

    carrito.pausarPersistencia();
    carrito.resetCarrito({ limpiarStorage: true });

    const { data, error } = await supabase
      .from('pedidos')
      .insert(payloadInsert)
      .select()
      .single();

    if (error || !data) {
      setErrorGuardar(
        'Pedido guardado localmente. Se sincronizará cuando haya conexión.'
      );
      carrito.reanudarPersistencia();
      return;
    }

    eliminarPedidoPendienteSync(optimisticId);
    setErrorGuardar(null);
    carrito.reanudarPersistencia();

    setPedidos((prev) => {
      const sinOptimistico = prev.filter((pedido) => pedido.id !== optimisticId);
      const existe = sinOptimistico.some((pedido) => pedido.id === data.id);
      return existe
        ? ordenarPedidosRecogerDomicilioDesc(sinOptimistico)
        : ordenarPedidosRecogerDomicilioDesc([...sinOptimistico, data]);
    });

    setTabActivo('cocina');
  };

  const avanzarPedido = async (id) => {
    const pedido = pedidos.find((item) => item.id === id);
    if (!pedido) return;

    const pedidoConCocina = enriquecerLineasDetalleCocina(pedido, productos);
    const payload = construirPayloadAvancePedidoRecogerDomicilio(pedidoConCocina);
    if (!payload) return;

    if (pedidoConCocina.lineas_detalle !== pedido.lineas_detalle) {
      payload.lineas_detalle = pedidoConCocina.lineas_detalle;
    }

    const { error } = await queryConNegocio(
      supabase.from('pedidos').update(payload).eq('id', id),
      negocioId
    );

    if (!error) {
      actualizarPedidoLocal(id, payload);
    }
  };

  const retrocederPedido = async (id) => {
    const pedido = pedidos.find((item) => item.id === id);
    if (!pedido) return;

    const payload = construirPayloadRetrocesoPedidoRecogerDomicilio(pedido);
    if (!payload) return;

    const { error } = await queryConNegocio(
      supabase.from('pedidos').update(payload).eq('id', id),
      negocioId
    );

    if (!error) {
      actualizarPedidoLocal(id, payload);
    }
  };

  const asignarRepartidorYEnviar = async ({
    pedidoId,
    repartidorUsuarioId,
    repartidorExterno,
  }) => {
    const pedido = pedidos.find((item) => item.id === pedidoId);
    if (!pedido) return;

    const payload = construirPayloadAsignacionRepartidor(pedido, {
      repartidorUsuarioId,
      repartidorExterno,
    });

    if (!payload) return;

    setAsignandoRepartidorId(pedidoId);

    const { error } = await queryConNegocio(
      supabase.from('pedidos').update(payload).eq('id', pedidoId),
      negocioId
    );

    if (!error) {
      actualizarPedidoLocal(pedidoId, payload);
    }

    setAsignandoRepartidorId(null);
  };

  const intentarAvanzar = (id) => {
    if (verificarJornadaBloqueaAccion(MENSAJE_AVANZAR_PEDIDO_SIN_JORNADA)) return;
    void avanzarPedido(id);
  };

  const intentarRetroceder = (id) => {
    if (verificarJornadaBloqueaAccion(MENSAJE_RETROCEDER_PEDIDO_SIN_JORNADA)) return;
    void retrocederPedido(id);
  };

  const intentarAsignarRepartidor = (seleccion) => {
    if (verificarJornadaBloqueaAccion(MENSAJE_AVANZAR_PEDIDO_SIN_JORNADA)) return;
    void asignarRepartidorYEnviar(seleccion);
  };

  const iniciarEdicionPedido = async (pedido) => {
    let pedidoFuente = pedido;

    const { data, error } = await queryConNegocio(
      supabase.from('pedidos').select('*').eq('id', pedido.id).is('deleted_at', null),
      negocioId
    ).single();

    if (!error && data) {
      pedidoFuente = data;
      actualizarPedidoLocal(data.id, data);
    }

    const snapshot = construirSnapshotCarritoDesdePedido(
      pedidoFuente,
      productos,
      variantesCtx
    );

    carrito.pausarPersistencia();
    carrito.aplicarSnapshot(snapshot);
    setEditandoPedidoId(pedido.id);
    setTabActivo('nuevo');
    setErrorGuardar(null);
  };

  const cancelarEdicionPedido = () => {
    setEditandoPedidoId(null);
    setErrorGuardar(null);
    carrito.resetCarrito({ limpiarStorage: false });
    carrito.reanudarPersistencia();
    setTabActivo('pendientes');
  };

  const guardarEdicionPedido = async (event) => {
    event.preventDefault();
    if (!editandoPedidoId || guardandoEdicion) return;

    if (verificarJornadaBloqueaAccion(MENSAJE_EDITAR_PEDIDO_SIN_JORNADA)) {
      return;
    }

    if (!tipoEntregaRecogerDomicilioSeleccionado(carrito.form.tipoEntrega)) {
      return;
    }

    if (carrito.totalPedido <= 0) return;

    if (carrito.form.programarPedido) {
      const validacionProgramado = validarProgramadoParaFuturo(carrito.form.programadoPara);
      if (!validacionProgramado.valido) {
        setErrorGuardar(validacionProgramado.mensaje);
        return;
      }
    }

    const pedidoOriginal = pedidos.find((item) => item.id === editandoPedidoId);
    if (!pedidoOriginal) return;

    setGuardandoEdicion(true);

    const detallePedido = carrito.obtenerDetallePedido();
    const resumen = resumenProductosDesdeLineas(
      carrito.lineasPedidoActivas,
      productos,
      variantesCtx
    );

    const payload = construirPayloadEdicionRecogerDomicilio({
      pedidoOriginal,
      detallePedido,
      resumen,
      form: carrito.form,
    });

    const { data, error } = await queryConNegocio(
      supabase.from('pedidos').update(payload).eq('id', pedidoOriginal.id).select().single(),
      negocioId
    );

    if (error || !data) {
      setErrorGuardar('No se pudo guardar la edición. Intenta de nuevo.');
      setGuardandoEdicion(false);
      return;
    }

    const registrosAuditoria = construirRegistrosAuditoriaEdicionPedido({
      pedidoOriginal,
      payload,
      negocioId,
      editadoPor: usuarioId,
      campos: CAMPOS_AUDITORIA_EDICION_RECOGER_DOMICILIO,
    });

    if (registrosAuditoria.length > 0) {
      await queryConNegocio(
        supabase.from('pedidos_ediciones').insert(registrosAuditoria),
        negocioId
      );
    }

    actualizarPedidoLocal(data.id, data);
    setEditandoPedidoId(null);
    carrito.resetCarrito({ limpiarStorage: true });
    carrito.reanudarPersistencia();
    setGuardandoEdicion(false);
    setTabActivo('pendientes');
  };

  const eliminarPedido = async (pedido, autorizadoPor) => {
    setEliminandoPedidoId(pedido.id);

    const { error } = await queryConNegocio(
      supabase
        .from('pedidos')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: usuarioId ?? null,
          autorizado_por: autorizadoPor ?? null,
        })
        .eq('id', pedido.id),
      negocioId
    );

    if (!error) {
      setPedidos((prev) => prev.filter((item) => item.id !== pedido.id));
      if (editandoPedidoId === pedido.id) {
        cancelarEdicionPedido();
      }
    }

    setEliminandoPedidoId(null);
  };

  const cerrarPin = () => {
    setModalPinAbierto(false);
    setPedidoPendienteAutorizacion(null);
    setAccionPendientePin(null);
  };

  const solicitarAutorizacion = (pedido, accion) => {
    setErrorGuardar(null);

    const mensaje =
      accion === 'eliminar'
        ? MENSAJE_ELIMINAR_PEDIDO_SIN_JORNADA
        : MENSAJE_EDITAR_PEDIDO_SIN_JORNADA;

    if (verificarJornadaBloqueaAccion(mensaje)) return;

    setPedidoPendienteAutorizacion(pedido);
    setAccionPendientePin(accion);
    setModalPinAbierto(true);
  };

  const onAutorizadoPin = ({ autorizado_por }) => {
    const pedido = pedidoPendienteAutorizacion;
    const accion = accionPendientePin;
    cerrarPin();

    if (!pedido) return;

    if (accion === 'eliminar') {
      void eliminarPedido(pedido, autorizado_por ?? null);
      return;
    }

    if (accion === 'editar') {
      void iniciarEdicionPedido(pedido);
    }
  };

  const handleSeleccionBusqueda = ({ pedidoId, tab }) => {
    if (tab) {
      setTabActivo(tab);
    }

    setPedidoResaltadoId(pedidoId);

    if (resaltadoTimerRef.current) {
      clearTimeout(resaltadoTimerRef.current);
    }

    requestAnimationFrame(() => {
      document.getElementById(`pedido-card-${pedidoId}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    });

    resaltadoTimerRef.current = setTimeout(() => {
      setPedidoResaltadoId(null);
      resaltadoTimerRef.current = null;
    }, 2500);
  };

  const cambiarTab = (value) => {
    if (editandoPedidoId && value !== 'nuevo') {
      cancelarEdicionPedido();
      return;
    }

    setTabActivo(value);
  };

  const enModoEdicion = Boolean(editandoPedidoId);
  const tituloPin = tituloAutorizacionPinPedido(
    accionPendientePin,
    pedidoPendienteAutorizacion
  );

  return (
    <div className="vista-recoger-domicilio">
      <BuscadorPedidosRecogerDomicilio
        pedidos={pedidos}
        jornadaAbierta={jornadaAbierta}
        onSeleccionarPedido={handleSeleccionBusqueda}
      />

      <nav className="seccion-subtabs-nav" aria-label="Secciones de recoger/domicilio">
        {TABS_RECOGER_DOMICILIO.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            className={`seccion-subtabs-tab${tabActivo === value ? ' activo' : ''}`}
            onClick={() => cambiarTab(value)}
          >
            {label}
          </button>
        ))}
      </nav>

      {tabActivo === 'nuevo' ? (
        <section className="pedido-formulario recoger-domicilio-nuevo-pedido">
          <h2 className="formulario-titulo">
            {enModoEdicion ? 'Editar pedido' : 'Nuevo pedido'}
          </h2>
          <form
            className="formulario-pedido"
            onSubmit={enModoEdicion ? guardarEdicionPedido : guardarPedido}
          >
            <div className="formulario formulario-cabecera">
              <div className="recoger-domicilio-fila-tipo-programar">
                <div className="formulario-campo">
                  <label htmlFor="tipoEntrega">Tipo de entrega</label>
                  <select
                    id="tipoEntrega"
                    name="tipoEntrega"
                    value={carrito.form.tipoEntrega}
                    onChange={(evento) =>
                      carrito.setCampoCaptura('tipoEntrega', evento.target.value)
                    }
                    required
                  >
                    <option value="">Seleccionar tipo de entrega…</option>
                    {TIPOS_ENTREGA_OPCIONES.map((opcion) => (
                      <option key={opcion.value} value={opcion.value}>
                        {opcion.icono} {opcion.label}
                      </option>
                    ))}
                  </select>
                </div>
                <label className="recoger-domicilio-programar-check">
                  <input
                    type="checkbox"
                    checked={Boolean(carrito.form.programarPedido)}
                    onChange={(evento) => {
                      carrito.setCampoCaptura('programarPedido', evento.target.checked);
                      if (!evento.target.checked) {
                        carrito.setCampoCaptura('programadoPara', '');
                      }
                    }}
                  />
                  <span>Programar pedido</span>
                </label>
                {carrito.form.programarPedido ? (
                  <div className="formulario-campo recoger-domicilio-programado-campo">
                    <label htmlFor="programadoPara">Fecha y hora programada</label>
                    <input
                      id="programadoPara"
                      name="programadoPara"
                      type="datetime-local"
                      value={carrito.form.programadoPara || ''}
                      onChange={(evento) =>
                        carrito.setCampoCaptura('programadoPara', evento.target.value)
                      }
                      required
                    />
                  </div>
                ) : null}
              </div>

              <div className="recoger-domicilio-fila-cliente-buscador">
                <div className="recoger-domicilio-cliente-telefono">
                  <div className="formulario-campo">
                    <label htmlFor="cliente">Cliente</label>
                    <input
                      id="cliente"
                      name="cliente"
                      type="text"
                      value={carrito.form.cliente}
                      onChange={(evento) =>
                        carrito.setCampoCaptura('cliente', evento.target.value)
                      }
                      required
                    />
                  </div>
                  <div className="formulario-campo">
                    <label htmlFor="telefono">Teléfono</label>
                    <input
                      id="telefono"
                      name="telefono"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="10 dígitos o con lada"
                      value={carrito.form.telefono}
                      onChange={(evento) =>
                        carrito.setCampoCaptura('telefono', evento.target.value)
                      }
                    />
                  </div>
                </div>
                {mostrarBuscadorClientes ? (
                  <ClienteBusquedaWhatsapp
                    negocioId={negocioId}
                    onSeleccionarCliente={aplicarSeleccionCliente}
                  />
                ) : null}
              </div>
              {carrito.form.tipoEntrega === TIPOS_ENTREGA.DOMICILIO ? (
                <div className="formulario-direccion-domicilio">
                  <div className="formulario-campo">
                    <label htmlFor="etiqueta">Etiqueta</label>
                    <input
                      id="etiqueta"
                      name="etiqueta"
                      type="text"
                      placeholder="Casa, trabajo..."
                      autoComplete="off"
                      value={carrito.form.etiqueta}
                      onChange={(evento) =>
                        carrito.setCampoCaptura('etiqueta', evento.target.value)
                      }
                    />
                  </div>
                  <div className="formulario-campo">
                    <label htmlFor="calle">Calle</label>
                    <input
                      id="calle"
                      name="calle"
                      type="text"
                      value={carrito.form.calle}
                      onChange={(evento) =>
                        carrito.setCampoCaptura('calle', evento.target.value)
                      }
                    />
                  </div>
                  <div className="formulario-campo">
                    <label htmlFor="numero">Número</label>
                    <input
                      id="numero"
                      name="numero"
                      type="text"
                      value={carrito.form.numero}
                      onChange={(evento) =>
                        carrito.setCampoCaptura('numero', evento.target.value)
                      }
                    />
                  </div>
                  <div className="formulario-campo">
                    <label htmlFor="entre_calles">Entre calles</label>
                    <input
                      id="entre_calles"
                      name="entre_calles"
                      type="text"
                      value={carrito.form.entre_calles}
                      onChange={(evento) =>
                        carrito.setCampoCaptura('entre_calles', evento.target.value)
                      }
                    />
                  </div>
                  <div className="formulario-campo">
                    <label htmlFor="direccion_referencia">Referencia</label>
                    <input
                      id="direccion_referencia"
                      name="direccion_referencia"
                      type="text"
                      value={carrito.form.direccion_referencia}
                      onChange={(evento) =>
                        carrito.setCampoCaptura('direccion_referencia', evento.target.value)
                      }
                    />
                  </div>
                  <div className="formulario-campo">
                    <label htmlFor="colonia">Colonia</label>
                    <input
                      id="colonia"
                      name="colonia"
                      type="text"
                      value={carrito.form.colonia}
                      onChange={(evento) =>
                        carrito.setCampoCaptura('colonia', evento.target.value)
                      }
                    />
                  </div>
                  <div className="formulario-campo">
                    <label htmlFor="municipio">Municipio</label>
                    <input
                      id="municipio"
                      name="municipio"
                      type="text"
                      value={carrito.form.municipio}
                      onChange={(evento) =>
                        carrito.setCampoCaptura('municipio', evento.target.value)
                      }
                    />
                  </div>
                  {mostrarSelectorZona ? (
                    <div className="formulario-campo">
                      <label htmlFor="zona_id">Zona</label>
                      <select
                        id="zona_id"
                        name="zona_id"
                        value={carrito.form.zona_id || ''}
                        onChange={(evento) =>
                          carrito.setCampoCaptura('zona_id', evento.target.value)
                        }
                      >
                        <option value="">Sin zona</option>
                        {zonasActivas.map((zona) => (
                          <option key={zona.id} value={zona.id}>
                            {formatearZonaConTarifa(zona)}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                  <div className="formulario-campo formulario-campo-flete-manual">
                    <span className="formulario-campo-etiqueta-superior">Flete</span>
                    <div className="formulario-flete-manual-controles">
                      <button
                        type="button"
                        className="agregar-flete-manual-btn"
                        onClick={() => setMostrarFleteManual((valor) => !valor)}
                      >
                        + Agregar flete
                      </button>
                    </div>
                    {mostrarFleteManual ? (
                      <div className="formulario-flete-manual">
                        <label htmlFor="monto-flete-manual">Monto de flete</label>
                        <div className="formulario-flete-manual-aplicar">
                          <input
                            id="monto-flete-manual"
                            type="number"
                            min="0"
                            step="0.01"
                            value={montoFleteManual}
                            onChange={(evento) => setMontoFleteManual(evento.target.value)}
                            placeholder="0.00"
                          />
                          <button
                            type="button"
                            className="confirmar-flete-manual-btn"
                            onClick={() => {
                              carrito.agregarFleteManual(montoFleteManual);
                              setMostrarFleteManual(false);
                              setMontoFleteManual('');
                            }}
                          >
                            Aplicar
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
              {tipoEntregaRecogerDomicilioSeleccionado(carrito.form.tipoEntrega) ? (
                <div className="formulario-campo">
                  <label htmlFor="status">Estatus del pedido</label>
                  <select
                    id="status"
                    name="status"
                    value={carrito.form.status}
                    onChange={(evento) =>
                      carrito.setCampoCaptura('status', evento.target.value)
                    }
                  >
                    {obtenerFlujoStatus(carrito.form.tipoEntrega).map((status) => (
                      <option key={status} value={status}>
                        {etiquetaStatusPedido(status)}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              <div className="formulario-campo">
                <label htmlFor="formaPago">Forma de pago</label>
                <select
                  id="formaPago"
                  name="formaPago"
                  value={carrito.form.formaPago}
                  onChange={(evento) =>
                    carrito.setCampoCaptura('formaPago', evento.target.value)
                  }
                >
                  <option value="">Sin especificar</option>
                  {FORMAS_PAGO.map((forma) => (
                    <option key={forma.value} value={forma.value}>
                      {forma.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {productos.length > 0 ? (
              <SelectorProductosPedidoConModal
                productos={productosOrdenados}
                variantesCtx={variantesCtx}
                frecuenciaCategorias={frecuenciaCategorias}
                frecuenciaLista={frecuenciaLista}
                categoriaActiva={carrito.categoriaPedidoActiva}
                onCategoriaChange={carrito.setCategoriaPedidoActiva}
                onAgregarDirecto={carrito.agregarProductoAlPedido}
                onConfirmarLinea={carrito.agregarLineaConVariantes}
              />
            ) : null}

            <PedidoLineasCarrito
              lineas={carrito.lineasPedidoVisibles}
              productos={productos}
              variantesCtx={variantesCtx}
              totalPedido={carrito.totalPedido}
              colapsablePorDefecto
              onAjustarCantidad={carrito.ajustarCantidadLinea}
              onActualizarCantidad={carrito.actualizarCantidadLinea}
              onEliminarLinea={carrito.eliminarLinea}
              onCambiarVariante={carrito.cambiarVarianteLinea}
            >
              <div className="pedido-acciones-principales">
                {enModoEdicion ? (
                  <button
                    type="button"
                    className="limpiar-pedido-btn"
                    disabled={guardandoEdicion}
                    onClick={cancelarEdicionPedido}
                  >
                    Cancelar
                  </button>
                ) : (
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
                )}
                <button
                  type="submit"
                  className="guardar-btn"
                  disabled={
                    productos.length === 0 ||
                    carrito.totalPedido <= 0 ||
                    guardandoEdicion ||
                    bloqueadoPorJornada
                  }
                >
                  {enModoEdicion
                    ? guardandoEdicion
                      ? 'Guardando...'
                      : 'Guardar cambios'
                    : 'Guardar pedido'}
                </button>
              </div>
              {bloqueadoPorJornada ? (
                <p className="header-jornada-cerrada-mensaje" role="status">
                  {MENSAJE_GUARDAR_PEDIDO_SIN_JORNADA}
                </p>
              ) : null}
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
      ) : tabActivo === 'cocina' ? (
        <section className="recoger-domicilio-lista-seccion">
          <header className="mostrador-pendientes-cabecera">
            <h2 className="mostrador-pendientes-titulo">En cocina</h2>
            <span className="mostrador-pendientes-contador">
              {pedidosCocina.length} pedido{pedidosCocina.length === 1 ? '' : 's'}
            </span>
          </header>
          <ListaPedidosRecogerDomicilio
            pedidos={pedidosCocina}
            productos={productos}
            variantesCtx={variantesCtx}
            repartidores={repartidores}
            pedidoResaltadoId={pedidoResaltadoId}
            editandoPedidoId={editandoPedidoId}
            bloqueadoPorJornada={bloqueadoPorJornada}
            claseBotonJornadaCerrada={claseBotonJornadaCerrada}
            asignandoRepartidorId={asignandoRepartidorId}
            mensajeVacio="No hay pedidos en cocina en la jornada activa."
            onAvanzar={intentarAvanzar}
            onRetroceder={intentarRetroceder}
            onEditar={(pedido) => solicitarAutorizacion(pedido, 'editar')}
            onEliminar={(pedido) => solicitarAutorizacion(pedido, 'eliminar')}
            onAsignarRepartidor={intentarAsignarRepartidor}
          />
        </section>
      ) : tabActivo === 'pendientes' ? (
        <section className="recoger-domicilio-lista-seccion">
          <header className="mostrador-pendientes-cabecera">
            <h2 className="mostrador-pendientes-titulo">Pendientes de entrega</h2>
            <span className="mostrador-pendientes-contador">
              {pedidosPendientes.length} pedido{pedidosPendientes.length === 1 ? '' : 's'}
            </span>
          </header>
          <ListaPedidosRecogerDomicilio
            pedidos={pedidosPendientes}
            productos={productos}
            variantesCtx={variantesCtx}
            repartidores={repartidores}
            pedidoResaltadoId={pedidoResaltadoId}
            editandoPedidoId={editandoPedidoId}
            bloqueadoPorJornada={bloqueadoPorJornada}
            claseBotonJornadaCerrada={claseBotonJornadaCerrada}
            asignandoRepartidorId={asignandoRepartidorId}
            mensajeVacio="No hay pedidos pendientes de entrega en la jornada activa."
            onAvanzar={intentarAvanzar}
            onRetroceder={intentarRetroceder}
            onEditar={(pedido) => solicitarAutorizacion(pedido, 'editar')}
            onEliminar={(pedido) => solicitarAutorizacion(pedido, 'eliminar')}
            onAsignarRepartidor={intentarAsignarRepartidor}
          />
        </section>
      ) : (
        <section className="recoger-domicilio-lista-seccion">
          <header className="mostrador-pendientes-cabecera">
            <h2 className="mostrador-pendientes-titulo">Entregados hoy</h2>
            <span className="mostrador-pendientes-contador">
              {pedidosEntregados.length} pedido{pedidosEntregados.length === 1 ? '' : 's'}
            </span>
          </header>
          <ListaPedidosRecogerDomicilio
            pedidos={pedidosEntregados}
            productos={productos}
            variantesCtx={variantesCtx}
            repartidores={repartidores}
            pedidoResaltadoId={pedidoResaltadoId}
            editandoPedidoId={editandoPedidoId}
            bloqueadoPorJornada={bloqueadoPorJornada}
            claseBotonJornadaCerrada={claseBotonJornadaCerrada}
            asignandoRepartidorId={asignandoRepartidorId}
            mensajeVacio="No hay pedidos entregados en la jornada activa."
            onAvanzar={intentarAvanzar}
            onRetroceder={intentarRetroceder}
            onEditar={(pedido) => solicitarAutorizacion(pedido, 'editar')}
            onEliminar={(pedido) => solicitarAutorizacion(pedido, 'eliminar')}
            onAsignarRepartidor={intentarAsignarRepartidor}
          />
        </section>
      )}

      <ModalAutorizacionPin
        visible={modalPinAbierto}
        titulo={tituloPin}
        onClose={cerrarPin}
        onAutorizado={onAutorizadoPin}
      />

      {modalJornadaCerradaAbierto ? (
        <div
          className="retiro-modal-overlay"
          onClick={cerrarModalJornadaCerrada}
          role="presentation"
        >
          <div
            className="retiro-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="recoger-domicilio-jornada-cerrada-modal-titulo"
            onClick={(evento) => evento.stopPropagation()}
          >
            <h2
              id="recoger-domicilio-jornada-cerrada-modal-titulo"
              className="retiro-modal-titulo"
            >
              {TITULO_MODAL_SIN_JORNADA}
            </h2>
            <p className="retiro-modal-error" role="alert">
              {mensajeModalJornadaCerrada}
            </p>
            <div className="retiro-modal-acciones">
              <button
                type="button"
                className="retiro-modal-cancelar"
                onClick={cerrarModalJornadaCerrada}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
