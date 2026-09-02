import { useEffect, useMemo, useState } from 'react';
import './App.css';
import DashboardNav from './DashboardNav';
import DashboardHeaderReservaMovil from './DashboardHeaderReservaMovil';
import SelectorRepartidorPedido, {
  MODO_SELECTOR_REPARTIDOR_REPORTE,
} from './SelectorRepartidorPedido';
import {
  agruparEntregasPorJornada,
  agruparEntregasPorRepartidor,
  agruparPedidosPorJornada,
  agruparRetirosPorDia,
  agruparRetirosPorJornadaId,
  calcularReportePorCategoria,
  calcularReportePorProducto,
  enriquecerEntregasPorJornada,
  enriquecerEntregasPorJornadaConCobros,
  calcularResumenReporte,
  sufijoRepartidorInlineEntregasJornada,
  sufijoFormaPagoInlineEntregasJornada,
  consultarPedidosEntregadosEnVentana,
  descripcionPeriodoTarjeta,
  deriveModoFiltroEntregas,
  entregasReportePeriodoActivo,
  etiquetaFiltroVentaReporte,
  ESTADOS_VISTA_ENTREGAS_REPORTE,
  resolverEstadoVistaEntregasReporte,
  etiquetaRepartidorEntrega,
  etiquetaTipoEntregaReporte,
  exportarArqueosPdf,
  exportarEntregasPdf,
  exportarFondosFijosPdf,
  exportarReportePdf,
  exportarRetirosPdf,
  fechasPeriodoTarjeta,
  filtrarPedidosEntregadosPorRepartidor,
  filtrarPedidosEntregadosReporte,
  formatearEtiquetaJornadaFocoReporte,
  FILTROS_VENTA_REPORTE,
  filtrarArqueosReporte,
  filtrarPedidosReporte,
  formatearClienteReporte,
  formatearFechaPedidoReporte,
  formatearFormaPagoReporte,
  formatearHoraPedidoLista,
  formatearProductosReporte,
  obtenerRangoReporte,
  ORIGEN_JORNADA_FOCO_ABIERTA,
  ORIGEN_JORNADA_FOCO_ULTIMA_CERRADA,
  PERIODOS_REPORTE,
  periodoMultiplesDias,
  rangoFechasInvalido,
  rangoPersonalizadoActivo,
  resolverJornadaActualParaReporte,
  resolverRetirosParaArqueo,
} from './reportesHelpers';
import { formatearMoneda } from './pedidosShared';
import { concentradoCobrosPorFormaPago } from './repartidorHelpers';
import useRepartidoresNegocio from './useRepartidoresNegocio';
import { supabase } from './supabase';
import { useAuth } from './AuthContext';
import { queryConNegocio } from './tenantHelpers';
import { JORNADA_ESTADO_CERRADA } from './jornadaHelpers';
import {
  cargarFiltrosReportes,
  persistirFiltrosReportes,
} from './reportesFiltrosStorage';

const REPORTES_TABS = [
  { value: 'ventas', label: 'Ventas' },
  { value: 'entregas', label: 'Entregas' },
  { value: 'arqueos', label: 'Arqueos de caja' },
  { value: 'retiros', label: 'Retiros de efectivo' },
  { value: 'fondos-fijos', label: 'Fondos fijos' },
];

const STORAGE_KEY_TAB_REPORTES = 'pos_tab_reportes';

function valoresTabReportesValidos() {
  return new Set(REPORTES_TABS.map(({ value }) => value));
}

function persistirTabReportes(tab) {
  if (typeof window === 'undefined' || !valoresTabReportesValidos().has(tab)) return;

  try {
    window.localStorage.setItem(STORAGE_KEY_TAB_REPORTES, tab);
  } catch {
    // Ignorar errores de almacenamiento local.
  }
}

function cargarTabReportes() {
  const validos = valoresTabReportesValidos();
  if (typeof window === 'undefined') return 'ventas';

  try {
    const tab = window.localStorage.getItem(STORAGE_KEY_TAB_REPORTES);
    return validos.has(tab) ? tab : 'ventas';
  } catch {
    return 'ventas';
  }
}

const MENSAJE_RETIRO_JORNADA_CERRADA =
  'No puedes eliminar este retiro de efectivo porque la jornada a la que pertenece ya está cerrada.';

const FORMAS_PAGO_ARQUEO = [
  { label: 'Efectivo', sistema: 'efectivo_sistema', contado: 'efectivo_contado' },
  { label: 'Tarjeta', sistema: 'tarjeta_sistema', contado: 'tarjeta_contado' },
  {
    label: 'Transferencia',
    sistema: 'transferencia_sistema',
    contado: 'transferencia_contado',
  },
  { label: 'Link de pago', sistema: 'link_sistema', contado: 'link_contado' },
];

function claseDiferenciaArqueoReporte(valor) {
  const diferencia = Number(valor) || 0;
  if (diferencia < 0) {
    return 'reportes-arqueo-diferencia reportes-arqueo-diferencia-negativa';
  }
  if (diferencia > 0) {
    return 'reportes-arqueo-diferencia reportes-arqueo-diferencia-positiva';
  }
  return 'reportes-arqueo-diferencia';
}

function formatearDiferenciaArqueoReporte(valor) {
  const diferencia = Number(valor) || 0;
  const prefijo = diferencia > 0 ? '+' : '';
  return `${prefijo}${formatearMoneda(diferencia)}`;
}

function formatearFechaSoloReporte(createdAt) {
  if (!createdAt) return '—';

  return new Date(createdAt).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function VistaReportes() {
  const { negocioId, rol } = useAuth();
  const [tabReportes, setTabReportes] = useState(() => cargarTabReportes());
  const [periodo, setPeriodo] = useState(
    () => cargarFiltrosReportes(negocioId).periodo
  );
  const [fechaDesde, setFechaDesde] = useState(
    () => cargarFiltrosReportes(negocioId).fechaDesde
  );
  const [fechaHasta, setFechaHasta] = useState(
    () => cargarFiltrosReportes(negocioId).fechaHasta
  );
  const [filtroVenta, setFiltroVenta] = useState(
    () => cargarFiltrosReportes(negocioId).filtroVenta
  );
  const [pedidos, setPedidos] = useState([]);
  const [productos, setProductos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [arqueos, setArqueos] = useState([]);
  const [retiros, setRetiros] = useState([]);
  const [cargandoArqueos, setCargandoArqueos] = useState(false);
  const [errorArqueos, setErrorArqueos] = useState(null);
  const [arqueoConfirmarEliminar, setArqueoConfirmarEliminar] = useState(null);
  const [eliminandoArqueoId, setEliminandoArqueoId] = useState(null);
  const [retirosHistorial, setRetirosHistorial] = useState([]);
  const [cargandoRetiros, setCargandoRetiros] = useState(false);
  const [errorRetiros, setErrorRetiros] = useState(null);
  const [retiroConfirmarEliminar, setRetiroConfirmarEliminar] = useState(null);
  const [eliminandoRetiroId, setEliminandoRetiroId] = useState(null);
  const [jornadaEstadoPorId, setJornadaEstadoPorId] = useState({});
  const [jornadasPorId, setJornadasPorId] = useState({});
  const [retiroMensajeBloqueo, setRetiroMensajeBloqueo] = useState(null);
  const [fondosFijosArqueos, setFondosFijosArqueos] = useState([]);
  const [cargandoFondosFijos, setCargandoFondosFijos] = useState(false);
  const [errorFondosFijos, setErrorFondosFijos] = useState(null);
  const [pedidosEntregados, setPedidosEntregados] = useState([]);
  const [cargandoEntregas, setCargandoEntregas] = useState(false);
  const [errorEntregas, setErrorEntregas] = useState(null);
  const [jornadaFocoId, setJornadaFocoId] = useState(null);
  const [jornadaFocoOrigen, setJornadaFocoOrigen] = useState(null);
  const [filtroRepartidorEntregas, setFiltroRepartidorEntregas] = useState('');
  const [activandoJornadaActual, setActivandoJornadaActual] = useState(false);

  const { repartidores } = useRepartidoresNegocio(
    tabReportes === 'entregas' ? negocioId : null
  );

  const configPeriodo = useMemo(
    () => ({ periodo, fechaDesde, fechaHasta }),
    [periodo, fechaDesde, fechaHasta]
  );

  const usaRangoPersonalizado = rangoPersonalizadoActivo(fechaDesde, fechaHasta);
  const rangoInvalido = rangoFechasInvalido(fechaDesde, fechaHasta);
  const reporteDeshabilitado = rangoInvalido;

  useEffect(() => {
    persistirTabReportes(tabReportes);
  }, [tabReportes]);

  useEffect(() => {
    if (!negocioId) return;

    persistirFiltrosReportes(negocioId, {
      periodo,
      fechaDesde,
      fechaHasta,
      filtroVenta,
    });
  }, [negocioId, periodo, fechaDesde, fechaHasta, filtroVenta]);

  useEffect(() => {
    let activo = true;

    if (
      !negocioId ||
      (tabReportes !== 'ventas' &&
        tabReportes !== 'entregas' &&
        tabReportes !== 'arqueos' &&
        tabReportes !== 'retiros')
    ) {
      return undefined;
    }

    const cargarJornadasReporte = async () => {
      const { data, error } = await queryConNegocio(
        supabase
          .from('jornadas')
          .select('id, estado, abierta_en, cerrada_en')
          .order('abierta_en', { ascending: false }),
        negocioId
      );

      if (!activo) return;

      if (error) {
        setJornadasPorId({});
        if (tabReportes === 'retiros') {
          setJornadaEstadoPorId({});
        }
        return;
      }

      const mapaJornadas = {};
      const mapaEstados = {};

      (data || []).forEach((jornada) => {
        mapaJornadas[jornada.id] = jornada;
        mapaEstados[jornada.id] = jornada.estado;
      });

      setJornadasPorId(mapaJornadas);

      if (tabReportes === 'retiros') {
        setJornadaEstadoPorId(mapaEstados);
      }
    };

    void cargarJornadasReporte();

    return () => {
      activo = false;
    };
  }, [tabReportes, negocioId]);

  useEffect(() => {
    let activo = true;

    if (!negocioId) {
      setPedidos([]);
      setCargando(false);
      return undefined;
    }

    if (rangoInvalido) {
      setCargando(false);
      setError(null);
      setPedidos([]);
      return undefined;
    }

    const cargarPedidos = async () => {
      setCargando(true);
      setError(null);

      const { inicio, fin } = obtenerRangoReporte(configPeriodo);
      const { data, error: errorConsulta } = await queryConNegocio(
        supabase
          .from('pedidos')
          .select('*')
          .is('deleted_at', null)
          .gte('created_at', inicio.toISOString())
          .lte('created_at', fin.toISOString()),
        negocioId
      ).order('created_at', { ascending: false });

      if (!activo) return;

      if (errorConsulta) {
        setError('No se pudieron cargar los pedidos.');
        setPedidos([]);
      } else {
        setPedidos(data || []);
      }

      setCargando(false);
    };

    cargarPedidos();

    return () => {
      activo = false;
    };
  }, [configPeriodo, rangoInvalido, negocioId]);

  useEffect(() => {
    let activo = true;

    if (!negocioId) {
      setProductos([]);
      return undefined;
    }

    const cargarProductos = async () => {
      const { data, error: errorConsulta } = await queryConNegocio(
        supabase.from('productos').select('id, nombre, categoria'),
        negocioId
      );

      if (!activo) return;

      if (errorConsulta) {
        setProductos([]);
      } else {
        setProductos(data || []);
      }
    };

    cargarProductos();

    return () => {
      activo = false;
    };
  }, [negocioId]);

  useEffect(() => {
    let activo = true;

    if (tabReportes !== 'arqueos' || !negocioId) {
      return undefined;
    }

    const cargarArqueos = async () => {
      setCargandoArqueos(true);
      setErrorArqueos(null);

      const [arqueosRes, retirosRes] = await Promise.all([
        queryConNegocio(
          supabase.from('arqueos').select('*').order('created_at', { ascending: false }),
          negocioId
        ),
        queryConNegocio(
          supabase.from('retiros').select('*').order('created_at', { ascending: false }),
          negocioId
        ),
      ]);

      if (!activo) return;

      if (arqueosRes.error || retirosRes.error) {
        setErrorArqueos('No se pudo cargar el historial de arqueos.');
        setArqueos([]);
        setRetiros([]);
      } else {
        setArqueos(arqueosRes.data || []);
        setRetiros(retirosRes.data || []);
      }

      setCargandoArqueos(false);
    };

    cargarArqueos();

    return () => {
      activo = false;
    };
  }, [tabReportes, negocioId]);

  useEffect(() => {
    let activo = true;

    if (tabReportes !== 'retiros' || !negocioId) {
      return undefined;
    }

    const cargarRetiros = async () => {
      setCargandoRetiros(true);
      setErrorRetiros(null);
      setRetiroMensajeBloqueo(null);
      setRetiroConfirmarEliminar(null);

      const { data, error: errorConsulta } = await queryConNegocio(
        supabase.from('retiros').select('*').order('created_at', { ascending: false }),
        negocioId
      );

      if (!activo) return;

      if (errorConsulta) {
        setErrorRetiros('No se pudo cargar el historial de retiros.');
        setRetirosHistorial([]);
      } else {
        setRetirosHistorial(data || []);
      }

      setCargandoRetiros(false);
    };

    cargarRetiros();

    return () => {
      activo = false;
    };
  }, [tabReportes, negocioId]);

  useEffect(() => {
    let activo = true;

    if (tabReportes !== 'fondos-fijos' || !negocioId) {
      return undefined;
    }

    const cargarFondosFijos = async () => {
      setCargandoFondosFijos(true);
      setErrorFondosFijos(null);

      const { data, error: errorConsulta } = await queryConNegocio(
        supabase.from('arqueos').select('*').order('created_at', { ascending: false }),
        negocioId
      );

      if (!activo) return;

      if (errorConsulta) {
        setErrorFondosFijos('No se pudo cargar el historial de fondos fijos.');
        setFondosFijosArqueos([]);
      } else {
        setFondosFijosArqueos(data || []);
      }

      setCargandoFondosFijos(false);
    };

    cargarFondosFijos();

    return () => {
      activo = false;
    };
  }, [tabReportes, negocioId]);

  useEffect(() => {
    let activo = true;

    if (tabReportes !== 'entregas' || !negocioId) {
      return undefined;
    }

    if (!entregasReportePeriodoActivo({ jornadaFocoId, usaRangoPersonalizado })) {
      setCargandoEntregas(false);
      setErrorEntregas(null);
      setPedidosEntregados([]);
      return undefined;
    }

    if (rangoInvalido && !jornadaFocoId) {
      setCargandoEntregas(false);
      setErrorEntregas(null);
      setPedidosEntregados([]);
      return undefined;
    }

    const jornadaFoco = jornadaFocoId ? jornadasPorId[jornadaFocoId] : null;

    if (jornadaFocoId && !jornadaFoco) {
      return undefined;
    }

    const cargarPedidosEntregados = async () => {
      setCargandoEntregas(true);
      setErrorEntregas(null);

      let inicio;
      let fin;

      if (jornadaFoco?.abierta_en) {
        inicio = new Date(jornadaFoco.abierta_en);
        fin = jornadaFoco.cerrada_en ? new Date(jornadaFoco.cerrada_en) : new Date();
      } else if (usaRangoPersonalizado) {
        const rango = obtenerRangoReporte(configPeriodo);
        inicio = rango.inicio;
        fin = rango.fin;
      } else {
        inicio = null;
        fin = null;
      }

      if (!inicio || !fin) {
        if (activo) {
          setPedidosEntregados([]);
          setCargandoEntregas(false);
        }
        return;
      }

      const { data, error: errorConsulta } = await consultarPedidosEntregadosEnVentana(
        supabase,
        negocioId,
        inicio,
        fin
      );

      if (!activo) return;

      if (errorConsulta) {
        setErrorEntregas('No se pudieron cargar las entregas.');
        setPedidosEntregados([]);
      } else {
        setPedidosEntregados(data || []);
      }

      setCargandoEntregas(false);
    };

    void cargarPedidosEntregados();

    return () => {
      activo = false;
    };
  }, [
    tabReportes,
    negocioId,
    configPeriodo,
    rangoInvalido,
    jornadaFocoId,
    jornadasPorId,
    usaRangoPersonalizado,
  ]);

  const retirosPorDia = useMemo(() => agruparRetirosPorDia(retiros), [retiros]);
  const retirosPorJornadaId = useMemo(
    () => agruparRetirosPorJornadaId(retiros),
    [retiros]
  );

  const arqueosFiltrados = useMemo(
    () => filtrarArqueosReporte(arqueos, configPeriodo),
    [arqueos, configPeriodo]
  );

  const retirosFiltrados = useMemo(
    () => filtrarArqueosReporte(retirosHistorial, configPeriodo),
    [retirosHistorial, configPeriodo]
  );

  const fondosFijosFiltrados = useMemo(
    () => filtrarArqueosReporte(fondosFijosArqueos, configPeriodo),
    [fondosFijosArqueos, configPeriodo]
  );

  const pedidosFiltrados = useMemo(
    () => filtrarPedidosReporte(pedidos, configPeriodo, filtroVenta),
    [pedidos, configPeriodo, filtroVenta]
  );

  const resumen = useMemo(
    () => calcularResumenReporte(pedidosFiltrados),
    [pedidosFiltrados]
  );

  const reportePorProducto = useMemo(
    () => calcularReportePorProducto(pedidosFiltrados),
    [pedidosFiltrados]
  );

  const reportePorCategoria = useMemo(
    () => calcularReportePorCategoria(pedidosFiltrados, productos),
    [pedidosFiltrados, productos]
  );

  const multiplesDias = periodoMultiplesDias(configPeriodo);
  const pedidosAgrupados = useMemo(
    () =>
      multiplesDias
        ? agruparPedidosPorJornada(pedidosFiltrados, jornadasPorId)
        : [],
    [multiplesDias, pedidosFiltrados, jornadasPorId]
  );

  const repartidoresPorId = useMemo(() => {
    const mapa = {};
    (repartidores || []).forEach((repartidor) => {
      mapa[repartidor.id] = repartidor;
    });
    return mapa;
  }, [repartidores]);

  const jornadaFoco = jornadaFocoId ? jornadasPorId[jornadaFocoId] : null;

  const pedidosEntregadosFiltrados = useMemo(
    () =>
      filtrarPedidosEntregadosReporte(
        pedidosEntregados,
        configPeriodo,
        jornadaFocoId,
        jornadasPorId
      ),
    [pedidosEntregados, configPeriodo, jornadaFocoId, jornadasPorId]
  );

  const pedidosEntregasVisibles = useMemo(
    () =>
      filtrarPedidosEntregadosPorRepartidor(
        pedidosEntregadosFiltrados,
        filtroRepartidorEntregas
      ),
    [pedidosEntregadosFiltrados, filtroRepartidorEntregas]
  );

  const repartidorEntregasEtiqueta = useMemo(() => {
    if (!filtroRepartidorEntregas) return null;
    return etiquetaRepartidorEntrega(filtroRepartidorEntregas, repartidoresPorId);
  }, [filtroRepartidorEntregas, repartidoresPorId]);

  const resumenEntregas = useMemo(
    () => calcularResumenReporte(pedidosEntregasVisibles),
    [pedidosEntregasVisibles]
  );

  const entregasPorRepartidor = useMemo(
    () => agruparEntregasPorRepartidor(pedidosEntregadosFiltrados, repartidoresPorId),
    [pedidosEntregadosFiltrados, repartidoresPorId]
  );

  const cobrosEntregasPorFormaPago = useMemo(
    () => concentradoCobrosPorFormaPago(pedidosEntregasVisibles),
    [pedidosEntregasVisibles]
  );

  const multiplesDiasEntregas =
    !jornadaFocoId && usaRangoPersonalizado && periodoMultiplesDias(configPeriodo);

  const entregasPeriodoActivo = entregasReportePeriodoActivo({
    jornadaFocoId,
    usaRangoPersonalizado,
  });

  const estadoVistaEntregas = resolverEstadoVistaEntregasReporte({
    entregasPeriodoActivo,
    rangoInvalido,
    cargandoEntregas,
    errorEntregas,
    cantidadPedidosVisibles: pedidosEntregasVisibles.length,
  });

  const modoFiltroEntregas = useMemo(
    () =>
      deriveModoFiltroEntregas({
        jornadaFocoId,
        usaRangoPersonalizado,
      }),
    [jornadaFocoId, usaRangoPersonalizado]
  );

  const entregasAgrupadasPorJornada = useMemo(
    () =>
      multiplesDiasEntregas
        ? enriquecerEntregasPorJornada(
            agruparEntregasPorJornada(pedidosEntregasVisibles, jornadasPorId),
            repartidoresPorId,
            { incluirRepartidor: !filtroRepartidorEntregas }
          )
        : [],
    [
      multiplesDiasEntregas,
      pedidosEntregasVisibles,
      jornadasPorId,
      repartidoresPorId,
      filtroRepartidorEntregas,
    ]
  );

  const etiquetaJornadaFocoEntregas = jornadaFoco
    ? formatearEtiquetaJornadaFocoReporte(jornadaFoco, jornadaFocoOrigen)
    : null;

  const etiquetaBotonJornadaEntregas =
    jornadaFocoOrigen === ORIGEN_JORNADA_FOCO_ULTIMA_CERRADA
      ? 'Última jornada'
      : 'Jornada actual';

  const etiquetaBannerJornadaEntregas =
    jornadaFocoOrigen === ORIGEN_JORNADA_FOCO_ULTIMA_CERRADA
      ? 'Última jornada cerrada:'
      : 'Jornada en curso:';

  const seleccionarSemana = () => {
    setPeriodo(PERIODOS_REPORTE.SEMANA);
    setFechaDesde('');
    setFechaHasta('');
    setJornadaFocoId(null);
    setJornadaFocoOrigen(null);
  };

  const seleccionarMes = () => {
    setPeriodo(PERIODOS_REPORTE.MES);
    setFechaDesde('');
    setFechaHasta('');
    setJornadaFocoId(null);
    setJornadaFocoOrigen(null);
  };

  const exportarPdf = () => {
    exportarReportePdf({
      configPeriodo,
      filtroVenta,
      resumen,
      pedidos: pedidosFiltrados,
      jornadasPorId,
    });
  };

  const exportarPdfArqueos = () => {
    exportarArqueosPdf({
      configPeriodo,
      arqueos,
      retiros,
    });
  };

  const exportarPdfRetiros = () => {
    exportarRetirosPdf({
      configPeriodo,
      retiros: retirosHistorial,
    });
  };

  const exportarPdfFondosFijos = () => {
    exportarFondosFijosPdf({
      configPeriodo,
      arqueos: fondosFijosArqueos,
    });
  };

  const exportarPdfEntregas = () => {
    exportarEntregasPdf({
      configPeriodo,
      resumen: resumenEntregas,
      porRepartidor: entregasPorRepartidor,
      porFormaPago: cobrosEntregasPorFormaPago,
      porJornada: entregasAgrupadasPorJornada,
      jornadaFoco,
      jornadaFocoOrigen,
      repartidorEtiqueta: repartidorEntregasEtiqueta,
    });
  };

  const activarJornadaActualEntregas = async () => {
    if (!negocioId || activandoJornadaActual) return;

    setActivandoJornadaActual(true);

    const { jornada, origen, error: errorJornada } = await resolverJornadaActualParaReporte(
      supabase,
      negocioId
    );

    setActivandoJornadaActual(false);

    if (errorJornada) {
      setErrorEntregas('No se pudo cargar la jornada actual.');
      return;
    }

    if (jornada?.id) {
      setJornadasPorId((prev) => ({
        ...prev,
        [jornada.id]: {
          ...(prev[jornada.id] || {}),
          ...jornada,
        },
      }));
      setFechaDesde('');
      setFechaHasta('');
      setJornadaFocoId(jornada.id);
      setJornadaFocoOrigen(origen);
    } else {
      setJornadaFocoId(null);
      setJornadaFocoOrigen(null);
      setErrorEntregas('No hay jornadas registradas.');
    }
  };

  const confirmarEliminarArqueo = async (arqueoId) => {
    if (!negocioId || eliminandoArqueoId) return;

    setEliminandoArqueoId(arqueoId);
    setErrorArqueos(null);

    const { error } = await queryConNegocio(
      supabase.from('arqueos').delete().eq('id', arqueoId),
      negocioId
    );

    setEliminandoArqueoId(null);
    setArqueoConfirmarEliminar(null);

    if (error) {
      setErrorArqueos('No se pudo eliminar el arqueo.');
      return;
    }

    setArqueos((prev) => prev.filter((item) => item.id !== arqueoId));
  };

  const jornadaDelRetiroEstaCerrada = (retiro) => {
    if (!retiro?.jornada_id) return false;
    return jornadaEstadoPorId[retiro.jornada_id] === JORNADA_ESTADO_CERRADA;
  };

  const intentarEliminarRetiro = (retiro) => {
    setRetiroConfirmarEliminar(null);

    if (jornadaDelRetiroEstaCerrada(retiro)) {
      setRetiroMensajeBloqueo(retiro.id);
      return;
    }

    setRetiroMensajeBloqueo(null);
    setRetiroConfirmarEliminar(retiro.id);
  };

  const confirmarEliminarRetiro = async (retiroId) => {
    if (!negocioId || eliminandoRetiroId) return;

    const retiro = retirosHistorial.find((item) => item.id === retiroId);

    if (retiro && jornadaDelRetiroEstaCerrada(retiro)) {
      setRetiroConfirmarEliminar(null);
      setRetiroMensajeBloqueo(retiroId);
      return;
    }

    setEliminandoRetiroId(retiroId);
    setErrorRetiros(null);

    const { error } = await queryConNegocio(
      supabase.from('retiros').delete().eq('id', retiroId),
      negocioId
    );

    setEliminandoRetiroId(null);
    setRetiroConfirmarEliminar(null);

    if (error) {
      setErrorRetiros('No se pudo eliminar el retiro.');
      return;
    }

    setRetirosHistorial((prev) => prev.filter((item) => item.id !== retiroId));
  };

  const renderTarjetaArqueo = (arqueo) => {
    const retirosDelArqueo = resolverRetirosParaArqueo(
      arqueo,
      retirosPorJornadaId,
      retirosPorDia
    );

    return (
      <article key={arqueo.id} className="reportes-arqueo-card">
        <header className="reportes-arqueo-cabecera">
          <div className="reportes-arqueo-cabecera-info">
            <time className="reportes-arqueo-fecha">
              {formatearFechaPedidoReporte(arqueo.created_at)}
            </time>
            <span className="reportes-arqueo-usuario">
              {arqueo.usuario?.trim() || '—'}
            </span>
          </div>
          <div className="reportes-arqueo-cabecera-acciones">
            {arqueoConfirmarEliminar === arqueo.id ? (
              <div className="reportes-arqueo-confirmar-eliminar">
                <span>¿Eliminar este arqueo?</span>
                <button
                  type="button"
                  className="reportes-arqueo-confirmar-btn reportes-arqueo-confirmar-cancelar"
                  onClick={() => setArqueoConfirmarEliminar(null)}
                  disabled={eliminandoArqueoId === arqueo.id}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="reportes-arqueo-confirmar-btn reportes-arqueo-confirmar-aceptar"
                  onClick={() => confirmarEliminarArqueo(arqueo.id)}
                  disabled={eliminandoArqueoId === arqueo.id}
                >
                  {eliminandoArqueoId === arqueo.id ? 'Eliminando...' : 'Confirmar'}
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="reportes-arqueo-eliminar-btn"
                onClick={() => setArqueoConfirmarEliminar(arqueo.id)}
                disabled={
                  eliminandoArqueoId !== null ||
                  (arqueoConfirmarEliminar !== null && arqueoConfirmarEliminar !== arqueo.id)
                }
              >
                Eliminar
              </button>
            )}
          </div>
        </header>

        <div className="reportes-arqueo-desglose">
          <div className="reportes-arqueo-desglose-encabezado">
            <span>Forma de pago</span>
            <span>Sistema</span>
            <span>Contado</span>
          </div>
          {FORMAS_PAGO_ARQUEO.map(({ label, sistema, contado }) => (
            <div key={sistema} className="reportes-arqueo-desglose-fila">
              <span>{label}</span>
              <span>{formatearMoneda(arqueo[sistema])}</span>
              <span>{formatearMoneda(arqueo[contado])}</span>
            </div>
          ))}
        </div>

        <div className="reportes-arqueo-retiros">
          <p className="reportes-arqueo-retiros-resumen">
            Ventas totales del día:{' '}
            {formatearMoneda(
              (Number(arqueo.total_sistema) || 0) -
                (Number(arqueo.fondo_fijo_del_dia) || 0) +
                (Number(arqueo.retiros_del_dia) || 0)
            )}
          </p>
          {Number(arqueo.fondo_fijo_del_dia) > 0 ? (
            <p className="reportes-arqueo-retiros-resumen">
              Fondo fijo del día: {formatearMoneda(arqueo.fondo_fijo_del_dia)}
            </p>
          ) : null}
          <p className="reportes-arqueo-retiros-resumen">
            Retiros del día: {formatearMoneda(arqueo.retiros_del_dia)}
          </p>
          {retirosDelArqueo.length > 0 ? (
            <ul className="reportes-arqueo-retiros-lista">
              {retirosDelArqueo.map((retiro) => (
                <li key={retiro.id}>
                  {formatearHoraPedidoLista(retiro.created_at)} —{' '}
                  {retiro.motivo?.trim() || 'Sin motivo'} —{' '}
                  {formatearMoneda(retiro.monto)}
                  {retiro.usuario ? ` (${retiro.usuario})` : ''}
                </li>
              ))}
            </ul>
          ) : (
            <p className="reportes-arqueo-retiros-vacio">
              Sin retiros registrados ese día.
            </p>
          )}
        </div>

        <div className="reportes-arqueo-totales">
          <div className="reportes-arqueo-total-fila">
            <span>Total sistema</span>
            <strong>{formatearMoneda(arqueo.total_sistema)}</strong>
          </div>
          <div className="reportes-arqueo-total-fila">
            <span>Total contado</span>
            <strong>{formatearMoneda(arqueo.total_contado)}</strong>
          </div>
          <div className="reportes-arqueo-total-fila">
            <span>Diferencia</span>
            <strong className={claseDiferenciaArqueoReporte(arqueo.diferencia)}>
              {formatearDiferenciaArqueoReporte(arqueo.diferencia)}
            </strong>
          </div>
        </div>
      </article>
    );
  };

  const renderTarjetaRetiro = (retiro) => (
    <article key={retiro.id} className="reportes-arqueo-card">
      <header className="reportes-arqueo-cabecera">
        <div className="reportes-arqueo-cabecera-info">
          <time className="reportes-arqueo-fecha">
            {formatearFechaPedidoReporte(retiro.created_at)}
          </time>
          <span className="reportes-arqueo-usuario">
            {retiro.usuario?.trim() || '—'}
          </span>
        </div>
        <div className="reportes-arqueo-cabecera-acciones">
          {retiroMensajeBloqueo === retiro.id ? (
            <div className="reportes-arqueo-confirmar-eliminar">
              <p
                className="retiro-modal-error"
                role="alert"
                style={{ margin: 0, flexBasis: '100%', textAlign: 'left' }}
              >
                {MENSAJE_RETIRO_JORNADA_CERRADA}
              </p>
              <button
                type="button"
                className="reportes-arqueo-confirmar-btn reportes-arqueo-confirmar-cancelar"
                onClick={() => setRetiroMensajeBloqueo(null)}
              >
                Cancelar
              </button>
            </div>
          ) : retiroConfirmarEliminar === retiro.id ? (
            <div className="reportes-arqueo-confirmar-eliminar">
              <span>¿Eliminar este retiro?</span>
              <button
                type="button"
                className="reportes-arqueo-confirmar-btn reportes-arqueo-confirmar-cancelar"
                onClick={() => setRetiroConfirmarEliminar(null)}
                disabled={eliminandoRetiroId === retiro.id}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="reportes-arqueo-confirmar-btn reportes-arqueo-confirmar-aceptar"
                onClick={() => confirmarEliminarRetiro(retiro.id)}
                disabled={eliminandoRetiroId === retiro.id}
              >
                {eliminandoRetiroId === retiro.id ? 'Eliminando...' : 'Confirmar'}
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="reportes-arqueo-eliminar-btn"
              onClick={() => intentarEliminarRetiro(retiro)}
              disabled={
                eliminandoRetiroId !== null ||
                (retiroConfirmarEliminar !== null && retiroConfirmarEliminar !== retiro.id) ||
                (retiroMensajeBloqueo !== null && retiroMensajeBloqueo !== retiro.id)
              }
            >
              Eliminar
            </button>
          )}
        </div>
      </header>

      <div className="reportes-arqueo-retiros">
        <p className="reportes-arqueo-retiros-resumen">
          Motivo: {retiro.motivo?.trim() || 'Sin motivo'}
        </p>
        <p className="reportes-arqueo-retiros-resumen">
          Monto: {formatearMoneda(retiro.monto)}
        </p>
      </div>
    </article>
  );

  return (
    <div className="dashboard">
      <DashboardHeaderReservaMovil />

      <main className="dashboard-main">
        <DashboardNav activo="reportes" rol={rol} />

        <section className="reportes-vista">
          <nav className="reportes-seccion-nav" aria-label="Secciones de reportes">
            {REPORTES_TABS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                className={`reportes-seccion-tab${tabReportes === value ? ' activo' : ''}`}
                onClick={() => setTabReportes(value)}
              >
                {label}
              </button>
            ))}
          </nav>

          {tabReportes === 'ventas' ? (
            <>
          <div className="reportes-controles">
            <div className="reportes-control-grupo reportes-control-grupo-periodo">
              <span className="reportes-control-etiqueta">Período</span>
              <nav className="reportes-periodo-nav" aria-label="Período del reporte">
                <button
                  type="button"
                  className={`reportes-periodo-btn${
                    !usaRangoPersonalizado && periodo === PERIODOS_REPORTE.SEMANA
                      ? ' activo'
                      : ''
                  }${usaRangoPersonalizado ? ' desactivado' : ''}`}
                  onClick={seleccionarSemana}
                >
                  Semana
                </button>
                <button
                  type="button"
                  className={`reportes-periodo-btn${
                    !usaRangoPersonalizado && periodo === PERIODOS_REPORTE.MES ? ' activo' : ''
                  }${usaRangoPersonalizado ? ' desactivado' : ''}`}
                  onClick={seleccionarMes}
                >
                  Mes
                </button>
              </nav>

              <div className="reportes-rango-personalizado">
                <label className="reportes-fecha-campo" htmlFor="reportes-fecha-desde">
                  <span className="reportes-fecha-etiqueta">De:</span>
                  <input
                    id="reportes-fecha-desde"
                    type="date"
                    className="reportes-fecha-input"
                    value={fechaDesde}
                    onChange={(e) => setFechaDesde(e.target.value)}
                  />
                </label>
                <label className="reportes-fecha-campo" htmlFor="reportes-fecha-hasta">
                  <span className="reportes-fecha-etiqueta">Hasta:</span>
                  <input
                    id="reportes-fecha-hasta"
                    type="date"
                    className="reportes-fecha-input"
                    value={fechaHasta}
                    onChange={(e) => setFechaHasta(e.target.value)}
                  />
                </label>
              </div>
              {rangoInvalido ? (
                <p className="reportes-rango-error" role="alert">
                  La fecha inicial no puede ser mayor a la fecha final
                </p>
              ) : null}
            </div>

            <div className="reportes-control-grupo reportes-control-grupo-filtro">
              <label className="reportes-control-etiqueta" htmlFor="reportes-filtro-venta">
                Tipo de venta
              </label>
              <select
                id="reportes-filtro-venta"
                className="reportes-filtro-select"
                value={filtroVenta}
                onChange={(e) => setFiltroVenta(e.target.value)}
              >
                {FILTROS_VENTA_REPORTE.map((opcion) => (
                  <option key={opcion.value} value={opcion.value}>
                    {opcion.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="reportes-exportar-btn"
              onClick={exportarPdf}
              disabled={cargando || reporteDeshabilitado}
            >
              Exportar PDF
            </button>
          </div>

          <p className="reportes-filtro-activo">
            Filtro activo: <strong>{etiquetaFiltroVentaReporte(filtroVenta)}</strong>
          </p>

          <div className="reportes-resumen">
            <article className="reportes-resumen-card">
              <span className="reportes-resumen-label">Período activo</span>
              <div className="reportes-resumen-valor reportes-resumen-valor-periodo">
                <span className="reportes-periodo-descripcion">
                  {descripcionPeriodoTarjeta(configPeriodo)}
                </span>
                <span className="reportes-periodo-fechas">
                  {fechasPeriodoTarjeta(configPeriodo)}
                </span>
              </div>
            </article>
            <article className="reportes-resumen-card">
              <span className="reportes-resumen-label">Total de pedidos</span>
              <span className="reportes-resumen-valor">{resumen.totalPedidos}</span>
            </article>
            <article className="reportes-resumen-card">
              <span className="reportes-resumen-label">Monto acumulado</span>
              <span className="reportes-resumen-valor reportes-resumen-valor-monto">
                {formatearMoneda(resumen.montoAcumulado)}
              </span>
            </article>
          </div>

          {!reporteDeshabilitado && !cargando && !error ? (
            <section
              className="reportes-por-categoria"
              aria-labelledby="reportes-por-categoria-titulo"
            >
              <h3 id="reportes-por-categoria-titulo" className="reportes-por-categoria-titulo">
                Reporte por categoría
              </h3>
              {reportePorCategoria.length === 0 ? (
                <p className="dashboard-vacio reportes-por-categoria-vacio">
                  No hay categorías para el período y tipo de venta seleccionados.
                </p>
              ) : (
                <div className="reportes-tabla reportes-por-categoria-tabla">
                  <div className="reportes-tabla-header reportes-por-categoria-header">
                    <span>Categoría</span>
                    <span>Cantidad vendida</span>
                    <span>Total facturado</span>
                  </div>
                  {reportePorCategoria.map((fila, indice) => (
                    <div
                      key={`${fila.nombre}-${indice}`}
                      className="reportes-tabla-fila reportes-por-categoria-fila"
                    >
                      <span className="reporte-categoria-nombre">{fila.nombre}</span>
                      <span className="reporte-categoria-cantidad">{fila.cantidadVendida}</span>
                      <span className="reporte-categoria-total">
                        {formatearMoneda(fila.totalFacturado)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ) : null}

          {!reporteDeshabilitado && !cargando && !error ? (
            <section
              className="reportes-por-producto"
              aria-labelledby="reportes-por-producto-titulo"
            >
              <h3 id="reportes-por-producto-titulo" className="reportes-por-producto-titulo">
                Reporte por producto
              </h3>
              {reportePorProducto.length === 0 ? (
                <p className="dashboard-vacio reportes-por-producto-vacio">
                  No hay productos para el período y tipo de venta seleccionados.
                </p>
              ) : (
                <div className="reportes-tabla reportes-por-producto-tabla">
                  <div className="reportes-tabla-header reportes-por-producto-header">
                    <span>Producto</span>
                    <span>Cantidad vendida</span>
                    <span>Total facturado</span>
                  </div>
                  {reportePorProducto.map((fila, indice) => (
                    <div
                      key={`${fila.nombre}-${indice}`}
                      className="reportes-tabla-fila reportes-por-producto-fila"
                    >
                      <span className="reporte-producto-nombre">{fila.nombre}</span>
                      <span className="reporte-producto-cantidad">{fila.cantidadVendida}</span>
                      <span className="reporte-producto-total">
                        {formatearMoneda(fila.totalFacturado)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ) : null}

          {reporteDeshabilitado ? (
            <p className="dashboard-vacio reportes-error">
              Corrige el rango de fechas para ver el reporte.
            </p>
          ) : cargando ? (
            <p className="dashboard-vacio">Cargando pedidos...</p>
          ) : error ? (
            <p className="dashboard-vacio reportes-error">{error}</p>
          ) : pedidosFiltrados.length === 0 ? (
            <p className="dashboard-vacio">
              No hay pedidos para el período y tipo de venta seleccionados.
            </p>
          ) : (
            <>
              {multiplesDias ? (
                pedidosAgrupados.map((grupo) => (
                  <div key={grupo.clave} className="pedidos-grupo pedidos-grupo-separado">
                    <div className="pedidos-grupo-encabezado">
                      <span className="pedidos-grupo-encabezado-linea">
                        <span className="pedidos-grupo-encabezado-separador" aria-hidden="true">
                          ──
                        </span>
                        {grupo.etiqueta}
                        <span className="pedidos-grupo-encabezado-separador" aria-hidden="true">
                          ──
                        </span>
                      </span>
                      <span className="pedidos-grupo-encabezado-total">
                        {grupo.etiquetaTotal}: {formatearMoneda(grupo.totalDelDia)}
                      </span>
                    </div>
                    <div className="reportes-tabla pedidos-reporte">
                      <div className="reportes-tabla-header pedidos-reporte-header">
                        <span>Hora</span>
                        <span>Folio</span>
                        <span>Cliente</span>
                        <span>Forma de pago</span>
                        <span>Productos</span>
                        <span>Tipo de entrega</span>
                        <span>Total</span>
                      </div>
                      {grupo.pedidos.map((pedido) => (
                        <div key={pedido.id} className="reportes-tabla-fila pedidos-reporte-fila">
                          <span className="reporte-hora">
                            {formatearHoraPedidoLista(pedido.created_at)}
                          </span>
                          <span className="reporte-folio">{pedido.folio ?? '—'}</span>
                          <span className="reporte-cliente">
                            {formatearClienteReporte(pedido)}
                          </span>
                          <span className="reporte-forma-pago">
                            {formatearFormaPagoReporte(pedido)}
                          </span>
                          <span className="reporte-productos">
                            {formatearProductosReporte(pedido)}
                          </span>
                          <span className="reporte-tipo-entrega">
                            {etiquetaTipoEntregaReporte(pedido)}
                          </span>
                          <span className="reporte-total">
                            {formatearMoneda(pedido.total)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="reportes-tabla pedidos-reporte">
                  <div className="reportes-tabla-header pedidos-reporte-header">
                    <span>Fecha</span>
                    <span>Folio</span>
                    <span>Cliente</span>
                    <span>Forma de pago</span>
                    <span>Productos</span>
                    <span>Tipo de entrega</span>
                    <span>Total</span>
                  </div>
                  {pedidosFiltrados.map((pedido) => (
                    <div key={pedido.id} className="reportes-tabla-fila pedidos-reporte-fila">
                      <span className="reporte-fecha">
                        {formatearFechaPedidoReporte(pedido.created_at)}
                      </span>
                      <span className="reporte-folio">{pedido.folio ?? '—'}</span>
                      <span className="reporte-cliente">
                        {formatearClienteReporte(pedido)}
                      </span>
                      <span className="reporte-forma-pago">
                        {formatearFormaPagoReporte(pedido)}
                      </span>
                      <span className="reporte-productos">
                        {formatearProductosReporte(pedido)}
                      </span>
                      <span className="reporte-tipo-entrega">
                        {etiquetaTipoEntregaReporte(pedido)}
                      </span>
                      <span className="reporte-total">
                        {formatearMoneda(pedido.total)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
            </>
          ) : null}

          {tabReportes === 'entregas' ? (
            <>
              <div className="reportes-controles">
                <div className="reportes-control-grupo reportes-control-grupo-periodo">
                  <span className="reportes-control-etiqueta">Período</span>

                  <div
                    className={`reportes-rango-personalizado${
                      modoFiltroEntregas === 'rango' ? ' activo' : ' desactivado'
                    }`}
                  >
                    <label className="reportes-fecha-campo" htmlFor="reportes-entregas-fecha-desde">
                      <span className="reportes-fecha-etiqueta">De:</span>
                      <input
                        id="reportes-entregas-fecha-desde"
                        type="date"
                        className="reportes-fecha-input"
                        value={fechaDesde}
                        onChange={(e) => {
                          setFechaDesde(e.target.value);
                          setJornadaFocoId(null);
                          setJornadaFocoOrigen(null);
                        }}
                      />
                    </label>
                    <label className="reportes-fecha-campo" htmlFor="reportes-entregas-fecha-hasta">
                      <span className="reportes-fecha-etiqueta">Hasta:</span>
                      <input
                        id="reportes-entregas-fecha-hasta"
                        type="date"
                        className="reportes-fecha-input"
                        value={fechaHasta}
                        onChange={(e) => {
                          setFechaHasta(e.target.value);
                          setJornadaFocoId(null);
                          setJornadaFocoOrigen(null);
                        }}
                      />
                    </label>
                  </div>
                  {rangoInvalido ? (
                    <p className="reportes-rango-error" role="alert">
                      La fecha inicial no puede ser mayor a la fecha final
                    </p>
                  ) : null}
                </div>

                <div className="reportes-control-grupo reportes-control-grupo-filtro">
                  <SelectorRepartidorPedido
                    id="reportes-entregas-repartidor"
                    modo={MODO_SELECTOR_REPARTIDOR_REPORTE}
                    repartidores={repartidores}
                    value={filtroRepartidorEntregas}
                    onChange={setFiltroRepartidorEntregas}
                    disabled={cargandoEntregas}
                  />
                </div>

                <button
                  type="button"
                  className={`reportes-periodo-btn reportes-jornada-actual-btn${
                    modoFiltroEntregas === 'jornada' ? ' activo' : ' desactivado'
                  }`}
                  onClick={activarJornadaActualEntregas}
                  disabled={activandoJornadaActual || cargandoEntregas}
                >
                  {activandoJornadaActual ? 'Cargando jornada...' : etiquetaBotonJornadaEntregas}
                </button>

                <button
                  type="button"
                  className="reportes-exportar-btn"
                  onClick={exportarPdfEntregas}
                  disabled={cargandoEntregas || !entregasPeriodoActivo || rangoInvalido}
                >
                  Exportar PDF
                </button>
              </div>

              {jornadaFoco ? (
                <p className="reportes-filtro-activo">
                  {etiquetaBannerJornadaEntregas}{' '}
                  <strong>{etiquetaJornadaFocoEntregas}</strong>
                </p>
              ) : null}

              {repartidorEntregasEtiqueta ? (
                <p className="reportes-filtro-activo">
                  Repartidor: <strong>{repartidorEntregasEtiqueta}</strong>
                </p>
              ) : null}

              <div className="reportes-resumen">
                <article className="reportes-resumen-card">
                  <span className="reportes-resumen-label">Período activo</span>
                  <div className="reportes-resumen-valor reportes-resumen-valor-periodo">
                    {jornadaFoco ? (
                      <span className="reportes-periodo-descripcion">
                        {etiquetaJornadaFocoEntregas}
                      </span>
                    ) : usaRangoPersonalizado ? (
                      <>
                        <span className="reportes-periodo-descripcion">
                          {descripcionPeriodoTarjeta(configPeriodo)}
                        </span>
                        <span className="reportes-periodo-fechas">
                          {fechasPeriodoTarjeta(configPeriodo)}
                        </span>
                      </>
                    ) : (
                      <span className="reportes-periodo-descripcion">
                        Selecciona Jornada actual o un rango De/Hasta
                      </span>
                    )}
                  </div>
                </article>
                <article className="reportes-resumen-card">
                  <span className="reportes-resumen-label">Pedidos entregados</span>
                  <span className="reportes-resumen-valor">{resumenEntregas.totalPedidos}</span>
                </article>
                <article className="reportes-resumen-card">
                  <span className="reportes-resumen-label">Total cobrado</span>
                  <span className="reportes-resumen-valor reportes-resumen-valor-monto">
                    {formatearMoneda(resumenEntregas.montoAcumulado)}
                  </span>
                </article>
              </div>

              {estadoVistaEntregas === ESTADOS_VISTA_ENTREGAS_REPORTE.PENDIENTE_MODO ? (
                <p className="dashboard-vacio">
                  Selecciona Jornada actual o completa un rango De/Hasta para ver entregas.
                </p>
              ) : estadoVistaEntregas === ESTADOS_VISTA_ENTREGAS_REPORTE.RANGO_INVALIDO ? (
                <p className="dashboard-vacio reportes-error">
                  Corrige el rango de fechas para ver el reporte.
                </p>
              ) : estadoVistaEntregas === ESTADOS_VISTA_ENTREGAS_REPORTE.CARGANDO ? (
                <p className="dashboard-vacio">Cargando entregas...</p>
              ) : estadoVistaEntregas === ESTADOS_VISTA_ENTREGAS_REPORTE.ERROR ? (
                <p className="dashboard-vacio reportes-error">{errorEntregas}</p>
              ) : estadoVistaEntregas === ESTADOS_VISTA_ENTREGAS_REPORTE.SIN_RESULTADOS ? (
                <p className="dashboard-vacio">
                  {filtroRepartidorEntregas
                    ? `No hay entregas para ${repartidorEntregasEtiqueta} en el período seleccionado.`
                    : jornadaFocoId
                      ? 'No hay entregas a domicilio en la jornada seleccionada.'
                      : 'No hay entregas a domicilio para el rango seleccionado.'}
                </p>
              ) : (
                <>
                  {!filtroRepartidorEntregas ? (
                    <section
                      className="reportes-por-repartidor"
                      aria-labelledby="reportes-por-repartidor-titulo"
                    >
                      <h3
                        id="reportes-por-repartidor-titulo"
                        className="reportes-por-producto-titulo"
                      >
                        Entregas por repartidor
                      </h3>
                      {entregasPorRepartidor.length === 0 ? (
                        <p className="dashboard-vacio reportes-por-producto-vacio">
                          No hay entregas por repartidor en el período seleccionado.
                        </p>
                      ) : (
                        <div className="reportes-tabla reportes-por-producto-tabla">
                          <div className="reportes-tabla-header reportes-por-producto-header">
                            <span>Repartidor</span>
                            <span>Pedidos</span>
                            <span>Total cobrado</span>
                          </div>
                          {entregasPorRepartidor.map((fila) => (
                            <div
                              key={fila.claveRepartidor}
                              className="reportes-tabla-fila reportes-por-producto-fila"
                            >
                              <span className="reporte-producto-nombre">{fila.etiqueta}</span>
                              <span className="reporte-producto-cantidad">
                                {fila.resumen.totalPedidos}
                              </span>
                              <span className="reporte-producto-total">
                                {formatearMoneda(fila.resumen.montoAcumulado)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  ) : null}

                  {cobrosEntregasPorFormaPago.length > 0 ? (
                    <section
                      className="reportes-por-producto"
                      aria-labelledby="reportes-entregas-cobros-titulo"
                    >
                      <h3
                        id="reportes-entregas-cobros-titulo"
                        className="reportes-por-producto-titulo"
                      >
                        Cobros por forma de pago
                      </h3>
                      <div className="reportes-tabla reportes-por-producto-tabla">
                        <div className="reportes-tabla-header reportes-por-producto-header">
                          <span>Forma de pago</span>
                          <span>Pedidos</span>
                          <span>Total cobrado</span>
                        </div>
                        {cobrosEntregasPorFormaPago.map((fila) => (
                          <div
                            key={fila.forma}
                            className="reportes-tabla-fila reportes-por-producto-fila"
                          >
                            <span className="reporte-producto-nombre">{fila.etiqueta}</span>
                            <span className="reporte-producto-cantidad">{fila.cantidad}</span>
                            <span className="reporte-producto-total">
                              {formatearMoneda(fila.total)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </section>
                  ) : null}

                  {multiplesDiasEntregas && entregasAgrupadasPorJornada.length > 0 ? (
                    <section
                      className="reportes-por-jornada"
                      aria-labelledby="reportes-entregas-jornada-titulo"
                    >
                      <h3
                        id="reportes-entregas-jornada-titulo"
                        className="reportes-por-producto-titulo"
                      >
                        Entregas por jornada
                      </h3>
                      {entregasAgrupadasPorJornada.map((grupo) => (
                        <div key={grupo.clave} className="pedidos-grupo pedidos-grupo-separado">
                          <div className="pedidos-grupo-encabezado">
                            <span className="pedidos-grupo-encabezado-linea">
                              <span
                                className="pedidos-grupo-encabezado-separador"
                                aria-hidden="true"
                              >
                                ──
                              </span>
                              {grupo.etiqueta}
                              <span
                                className="pedidos-grupo-encabezado-separador"
                                aria-hidden="true"
                              >
                                ──
                              </span>
                            </span>
                            <span className="pedidos-grupo-encabezado-total">
                              {grupo.etiquetaTotal}: {formatearMoneda(grupo.totalDelDia)} ·{' '}
                              {grupo.pedidos.length} pedido
                              {grupo.pedidos.length === 1 ? '' : 's'}
                              {sufijoRepartidorInlineEntregasJornada(grupo.entregasPorRepartidor)}
                              {sufijoFormaPagoInlineEntregasJornada(grupo.cobrosPorFormaPago)}
                            </span>
                          </div>
                          {grupo.entregasPorRepartidor?.length > 1 ? (
                            <div className="reportes-tabla reportes-jornada-desglose">
                              <div className="reportes-tabla-header reportes-por-producto-header">
                                <span>Repartidor</span>
                                <span>Pedidos</span>
                                <span>Total cobrado</span>
                              </div>
                              {grupo.entregasPorRepartidor.map((fila) => (
                                <div
                                  key={fila.claveRepartidor}
                                  className="reportes-tabla-fila reportes-por-producto-fila reportes-jornada-desglose-fila"
                                >
                                  <span className="reporte-producto-nombre">{fila.etiqueta}</span>
                                  <span className="reporte-producto-cantidad">
                                    {fila.resumen.totalPedidos}
                                  </span>
                                  <span className="reporte-producto-total">
                                    {formatearMoneda(fila.resumen.montoAcumulado)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : null}
                          {grupo.cobrosPorFormaPago?.length > 1 ? (
                            <div className="reportes-tabla reportes-jornada-desglose">
                              <div className="reportes-tabla-header reportes-por-producto-header">
                                <span>Forma de pago</span>
                                <span>Pedidos</span>
                                <span>Total cobrado</span>
                              </div>
                              {grupo.cobrosPorFormaPago.map((fila) => (
                                <div
                                  key={fila.forma}
                                  className="reportes-tabla-fila reportes-por-producto-fila reportes-jornada-desglose-fila"
                                >
                                  <span className="reporte-producto-nombre">{fila.etiqueta}</span>
                                  <span className="reporte-producto-cantidad">{fila.cantidad}</span>
                                  <span className="reporte-producto-total">
                                    {formatearMoneda(fila.total)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </section>
                  ) : null}
                </>
              )}
            </>
          ) : null}

          {tabReportes === 'arqueos' ? (
            <>
              <div className="reportes-controles">
                <div className="reportes-control-grupo reportes-control-grupo-periodo">
                  <span className="reportes-control-etiqueta">Período</span>
                  <nav className="reportes-periodo-nav" aria-label="Período de arqueos">
                    <button
                      type="button"
                      className={`reportes-periodo-btn${
                        !usaRangoPersonalizado && periodo === PERIODOS_REPORTE.SEMANA
                          ? ' activo'
                          : ''
                      }${usaRangoPersonalizado ? ' desactivado' : ''}`}
                      onClick={seleccionarSemana}
                    >
                      Semana
                    </button>
                    <button
                      type="button"
                      className={`reportes-periodo-btn${
                        !usaRangoPersonalizado && periodo === PERIODOS_REPORTE.MES
                          ? ' activo'
                          : ''
                      }${usaRangoPersonalizado ? ' desactivado' : ''}`}
                      onClick={seleccionarMes}
                    >
                      Mes
                    </button>
                  </nav>

                  <div className="reportes-rango-personalizado">
                    <label className="reportes-fecha-campo" htmlFor="reportes-arqueos-fecha-desde">
                      <span className="reportes-fecha-etiqueta">De:</span>
                      <input
                        id="reportes-arqueos-fecha-desde"
                        type="date"
                        className="reportes-fecha-input"
                        value={fechaDesde}
                        onChange={(e) => setFechaDesde(e.target.value)}
                      />
                    </label>
                    <label className="reportes-fecha-campo" htmlFor="reportes-arqueos-fecha-hasta">
                      <span className="reportes-fecha-etiqueta">Hasta:</span>
                      <input
                        id="reportes-arqueos-fecha-hasta"
                        type="date"
                        className="reportes-fecha-input"
                        value={fechaHasta}
                        onChange={(e) => setFechaHasta(e.target.value)}
                      />
                    </label>
                  </div>
                  {rangoInvalido ? (
                    <p className="reportes-rango-error" role="alert">
                      La fecha inicial no puede ser mayor a la fecha final
                    </p>
                  ) : null}
                </div>

                <button
                  type="button"
                  className="reportes-exportar-btn"
                  onClick={exportarPdfArqueos}
                  disabled={cargandoArqueos || reporteDeshabilitado}
                >
                  Exportar PDF
                </button>
              </div>

              {reporteDeshabilitado ? (
                <p className="dashboard-vacio reportes-error">
                  Corrige el rango de fechas para ver el reporte.
                </p>
              ) : cargandoArqueos ? (
                <p className="dashboard-vacio">Cargando arqueos...</p>
              ) : errorArqueos ? (
                <p className="dashboard-vacio reportes-error">{errorArqueos}</p>
              ) : arqueos.length === 0 ? (
                <p className="dashboard-vacio">No hay arqueos registrados.</p>
              ) : arqueosFiltrados.length === 0 ? (
                <p className="dashboard-vacio">
                  No hay arqueos para el período seleccionado.
                </p>
              ) : (
                <div className="reportes-arqueos-lista">
                  {arqueosFiltrados.map((arqueo) => renderTarjetaArqueo(arqueo))}
                </div>
              )}
            </>
          ) : null}

          {tabReportes === 'retiros' ? (
            <>
              <div className="reportes-controles">
                <div className="reportes-control-grupo reportes-control-grupo-periodo">
                  <span className="reportes-control-etiqueta">Período</span>
                  <nav className="reportes-periodo-nav" aria-label="Período de retiros">
                    <button
                      type="button"
                      className={`reportes-periodo-btn${
                        !usaRangoPersonalizado && periodo === PERIODOS_REPORTE.SEMANA
                          ? ' activo'
                          : ''
                      }${usaRangoPersonalizado ? ' desactivado' : ''}`}
                      onClick={seleccionarSemana}
                    >
                      Semana
                    </button>
                    <button
                      type="button"
                      className={`reportes-periodo-btn${
                        !usaRangoPersonalizado && periodo === PERIODOS_REPORTE.MES
                          ? ' activo'
                          : ''
                      }${usaRangoPersonalizado ? ' desactivado' : ''}`}
                      onClick={seleccionarMes}
                    >
                      Mes
                    </button>
                  </nav>

                  <div className="reportes-rango-personalizado">
                    <label className="reportes-fecha-campo" htmlFor="reportes-retiros-fecha-desde">
                      <span className="reportes-fecha-etiqueta">De:</span>
                      <input
                        id="reportes-retiros-fecha-desde"
                        type="date"
                        className="reportes-fecha-input"
                        value={fechaDesde}
                        onChange={(e) => setFechaDesde(e.target.value)}
                      />
                    </label>
                    <label className="reportes-fecha-campo" htmlFor="reportes-retiros-fecha-hasta">
                      <span className="reportes-fecha-etiqueta">Hasta:</span>
                      <input
                        id="reportes-retiros-fecha-hasta"
                        type="date"
                        className="reportes-fecha-input"
                        value={fechaHasta}
                        onChange={(e) => setFechaHasta(e.target.value)}
                      />
                    </label>
                  </div>
                  {rangoInvalido ? (
                    <p className="reportes-rango-error" role="alert">
                      La fecha inicial no puede ser mayor a la fecha final
                    </p>
                  ) : null}
                </div>

                <button
                  type="button"
                  className="reportes-exportar-btn"
                  onClick={exportarPdfRetiros}
                  disabled={cargandoRetiros || reporteDeshabilitado}
                >
                  Exportar PDF
                </button>
              </div>

              {reporteDeshabilitado ? (
                <p className="dashboard-vacio reportes-error">
                  Corrige el rango de fechas para ver el reporte.
                </p>
              ) : cargandoRetiros ? (
                <p className="dashboard-vacio">Cargando retiros...</p>
              ) : errorRetiros ? (
                <p className="dashboard-vacio reportes-error">{errorRetiros}</p>
              ) : retirosHistorial.length === 0 ? (
                <p className="dashboard-vacio">No hay retiros registrados.</p>
              ) : retirosFiltrados.length === 0 ? (
                <p className="dashboard-vacio">
                  No hay retiros para el período seleccionado.
                </p>
              ) : (
                <div className="reportes-arqueos-lista">
                  {retirosFiltrados.map((retiro) => renderTarjetaRetiro(retiro))}
                </div>
              )}
            </>
          ) : null}

          {tabReportes === 'fondos-fijos' ? (
            <>
              <div className="reportes-controles">
                <div className="reportes-control-grupo reportes-control-grupo-periodo">
                  <span className="reportes-control-etiqueta">Período</span>
                  <nav className="reportes-periodo-nav" aria-label="Período de fondos fijos">
                    <button
                      type="button"
                      className={`reportes-periodo-btn${
                        !usaRangoPersonalizado && periodo === PERIODOS_REPORTE.SEMANA
                          ? ' activo'
                          : ''
                      }${usaRangoPersonalizado ? ' desactivado' : ''}`}
                      onClick={seleccionarSemana}
                    >
                      Semana
                    </button>
                    <button
                      type="button"
                      className={`reportes-periodo-btn${
                        !usaRangoPersonalizado && periodo === PERIODOS_REPORTE.MES
                          ? ' activo'
                          : ''
                      }${usaRangoPersonalizado ? ' desactivado' : ''}`}
                      onClick={seleccionarMes}
                    >
                      Mes
                    </button>
                  </nav>

                  <div className="reportes-rango-personalizado">
                    <label
                      className="reportes-fecha-campo"
                      htmlFor="reportes-fondos-fijos-fecha-desde"
                    >
                      <span className="reportes-fecha-etiqueta">De:</span>
                      <input
                        id="reportes-fondos-fijos-fecha-desde"
                        type="date"
                        className="reportes-fecha-input"
                        value={fechaDesde}
                        onChange={(e) => setFechaDesde(e.target.value)}
                      />
                    </label>
                    <label
                      className="reportes-fecha-campo"
                      htmlFor="reportes-fondos-fijos-fecha-hasta"
                    >
                      <span className="reportes-fecha-etiqueta">Hasta:</span>
                      <input
                        id="reportes-fondos-fijos-fecha-hasta"
                        type="date"
                        className="reportes-fecha-input"
                        value={fechaHasta}
                        onChange={(e) => setFechaHasta(e.target.value)}
                      />
                    </label>
                  </div>
                  {rangoInvalido ? (
                    <p className="reportes-rango-error" role="alert">
                      La fecha inicial no puede ser mayor a la fecha final
                    </p>
                  ) : null}
                </div>

                <button
                  type="button"
                  className="reportes-exportar-btn"
                  onClick={exportarPdfFondosFijos}
                  disabled={cargandoFondosFijos || reporteDeshabilitado}
                >
                  Exportar PDF
                </button>
              </div>

              {reporteDeshabilitado ? (
                <p className="dashboard-vacio reportes-error">
                  Corrige el rango de fechas para ver el reporte.
                </p>
              ) : cargandoFondosFijos ? (
                <p className="dashboard-vacio">Cargando fondos fijos...</p>
              ) : errorFondosFijos ? (
                <p className="dashboard-vacio reportes-error">{errorFondosFijos}</p>
              ) : fondosFijosArqueos.length === 0 ? (
                <p className="dashboard-vacio">No hay fondos registrados.</p>
              ) : fondosFijosFiltrados.length === 0 ? (
                <p className="dashboard-vacio">
                  No hay fondos fijos para el período seleccionado.
                </p>
              ) : (
                <div className="fondos-fijos-reporte">
                  <div className="fondos-fijos-reporte-header">
                    <span>Fecha</span>
                    <span>Hora</span>
                    <span>Usuario</span>
                    <span>Fondo fijo</span>
                  </div>
                  {fondosFijosFiltrados.map((arqueo) => (
                    <div key={arqueo.id} className="fondos-fijos-reporte-fila">
                      <span className="reporte-fecha">
                        {formatearFechaSoloReporte(arqueo.created_at)}
                      </span>
                      <span className="reporte-hora">
                        {formatearHoraPedidoLista(arqueo.created_at)}
                      </span>
                      <span className="reporte-cliente">
                        {arqueo.usuario?.trim() || '—'}
                      </span>
                      <span className="reporte-total">
                        {formatearMoneda(arqueo.fondo_fijo_del_dia)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : null}
        </section>
      </main>
    </div>
  );
}
