import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import {
  calcularCargaInicialPorInsumos,
  calcularConsumoEmpleados,
  calcularConsumoVenta,
  calcularDiferencia,
  calcularTeorico,
} from './inventarioSnapshotHelpers';
import { cargarJornadaAbierta } from './jornadaHelpers';
import ModalAutorizacionPin from './ModalAutorizacionPin';
import { formatearClaveFecha, obtenerRangoFechaClave } from './pedidosShared';
import { supabase } from './supabase';
import { payloadConNegocio, queryConNegocio } from './tenantHelpers';

const MENSAJE_SNAPSHOT_SIN_JORNADA_ABIERTA =
  'Debes abrir una jornada antes de registrar un corte de inventario.';

const ROLES_CAPTURA_SNAPSHOT_DIRECTA = ['dueno', 'administrador'];

const CAMPOS_PEDIDO_SNAPSHOT =
  'id, jornada_id, created_at, deleted_at, lineas_detalle, tipo';

function formatearFechaHoraSnapshot(createdAt) {
  if (!createdAt) return '—';

  return new Date(createdAt).toLocaleString('es-MX', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function crearCapturaVaciaPorInsumos(insumos) {
  return Object.fromEntries(
    (insumos || []).map((insumo) => [
      String(insumo.id),
      { contado_fisico: '', merma_explicada: '' },
    ])
  );
}

function cantidadCapturaValida(valor) {
  if (valor === '' || valor == null) {
    return false;
  }

  const cantidad = Number.parseFloat(valor);
  return Number.isFinite(cantidad) && cantidad >= 0;
}

function cantidadCapturaNumerica(valor) {
  const cantidad = Number.parseFloat(valor);
  return Number.isFinite(cantidad) && cantidad >= 0 ? cantidad : 0;
}

function formatearCantidadInventario(valor, unidadMedida) {
  const cantidad = Number(valor);

  if (!Number.isFinite(cantidad)) {
    return '—';
  }

  const texto = Number.isInteger(cantidad) ? String(cantidad) : cantidad.toFixed(2);
  return unidadMedida ? `${texto} ${unidadMedida}` : texto;
}

function claseDiferenciaSnapshot(diferencia) {
  if (!Number.isFinite(diferencia) || diferencia === 0) {
    return 'arqueo-modal-diferencia';
  }

  return diferencia < 0
    ? 'arqueo-modal-diferencia arqueo-modal-diferencia-negativa'
    : 'arqueo-modal-diferencia arqueo-modal-diferencia-positiva';
}

function formatearDiferenciaSnapshot(diferencia) {
  if (!Number.isFinite(diferencia)) {
    return '—';
  }

  const signo = diferencia > 0 ? '+' : '';
  return `${signo}${diferencia}`;
}

function normalizarDetalleSnapshot(detalle) {
  if (Array.isArray(detalle)) {
    return detalle;
  }

  if (detalle && Array.isArray(detalle.insumos)) {
    return detalle.insumos;
  }

  return [];
}

function claseDiferenciaCorteHistorial(diferencia) {
  if (!Number.isFinite(diferencia) || diferencia === 0) {
    return 'reportes-arqueo-diferencia';
  }

  return diferencia < 0
    ? 'reportes-arqueo-diferencia reportes-arqueo-diferencia-negativa'
    : 'reportes-arqueo-diferencia reportes-arqueo-diferencia-positiva';
}

function sumarCargasPorTipo(cargas, tipo) {
  const mapa = {};

  (cargas || []).forEach((carga) => {
    if (carga?.deleted_at != null || carga?.tipo !== tipo || carga?.insumo_id == null) {
      return;
    }

    const cantidad = Number(carga.cantidad);

    if (!Number.isFinite(cantidad)) {
      return;
    }

    const clave = String(carga.insumo_id);
    mapa[clave] = (mapa[clave] || 0) + cantidad;
  });

  return mapa;
}

async function cargarPedidosJornada(negocioId, jornada) {
  if (!negocioId || !jornada?.id || !jornada?.abierta_en) {
    return [];
  }

  const hoyClave = formatearClaveFecha(new Date());
  const { fin } = obtenerRangoFechaClave(hoyClave);

  const [resultadoJornada, resultadoLegacy] = await Promise.all([
    queryConNegocio(
      supabase
        .from('pedidos')
        .select(CAMPOS_PEDIDO_SNAPSHOT)
        .eq('jornada_id', jornada.id)
        .is('deleted_at', null),
      negocioId
    ),
    queryConNegocio(
      supabase
        .from('pedidos')
        .select(CAMPOS_PEDIDO_SNAPSHOT)
        .is('jornada_id', null)
        .is('deleted_at', null)
        .gte('created_at', jornada.abierta_en)
        .lte('created_at', fin.toISOString()),
      negocioId
    ),
  ]);

  if (resultadoJornada.error) {
    throw new Error(resultadoJornada.error.message);
  }

  if (resultadoLegacy.error) {
    throw new Error(resultadoLegacy.error.message);
  }

  const pedidosPorId = new Map();

  [...(resultadoJornada.data || []), ...(resultadoLegacy.data || [])].forEach((pedido) => {
    pedidosPorId.set(pedido.id, pedido);
  });

  return Array.from(pedidosPorId.values());
}

export default function PanelSnapshot({ negocioId, rol }) {
  const { usuario } = useAuth();
  const [insumos, setInsumos] = useState([]);
  const [cargas, setCargas] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [consumosInternos, setConsumosInternos] = useState([]);
  const [insumoRecetas, setInsumoRecetas] = useState([]);
  const [insumoRecetasVariantes, setInsumoRecetasVariantes] = useState([]);
  const [snapshots, setSnapshots] = useState([]);
  const [capturaPorInsumo, setCapturaPorInsumo] = useState({});
  const [nombresUsuariosPorId, setNombresUsuariosPorId] = useState({});
  const [cargandoInsumos, setCargandoInsumos] = useState(true);
  const [cargandoDatos, setCargandoDatos] = useState(true);
  const [cargandoSnapshots, setCargandoSnapshots] = useState(true);
  const [cargandoJornada, setCargandoJornada] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [errorFormulario, setErrorFormulario] = useState(null);
  const [errorJornada, setErrorJornada] = useState(null);
  const [errorDatos, setErrorDatos] = useState(null);
  const [jornadaAbierta, setJornadaAbierta] = useState(null);
  const [modalPinAbierto, setModalPinAbierto] = useState(false);

  const requierePinSnapshot = rol === 'cajero';
  const capturaBloqueada = !jornadaAbierta?.id;

  const insumosOrdenados = useMemo(
    () =>
      [...insumos].sort((a, b) =>
        String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es')
      ),
    [insumos]
  );

  const insumosPorId = useMemo(
    () => Object.fromEntries(insumos.map((insumo) => [String(insumo.id), insumo])),
    [insumos]
  );

  const cargaTotalPorInsumo = useMemo(
    () => calcularCargaInicialPorInsumos(cargas),
    [cargas]
  );

  const cargaInicialTipoPorInsumo = useMemo(
    () => sumarCargasPorTipo(cargas, 'carga_inicial'),
    [cargas]
  );

  const compraAdicionalPorInsumo = useMemo(
    () => sumarCargasPorTipo(cargas, 'compra_adicional'),
    [cargas]
  );

  const consumoVentaPorInsumo = useMemo(
    () =>
      calcularConsumoVenta(
        pedidos,
        jornadaAbierta,
        insumoRecetas,
        insumoRecetasVariantes
      ),
    [pedidos, jornadaAbierta, insumoRecetas, insumoRecetasVariantes]
  );

  const consumoEmpleadosPorInsumo = useMemo(
    () =>
      calcularConsumoEmpleados(
        consumosInternos,
        insumoRecetas,
        insumoRecetasVariantes
      ),
    [consumosInternos, insumoRecetas, insumoRecetasVariantes]
  );

  const mermaPorInsumo = useMemo(() => {
    const mapa = {};

    insumosOrdenados.forEach((insumo) => {
      const clave = String(insumo.id);
      mapa[clave] = cantidadCapturaNumerica(capturaPorInsumo[clave]?.merma_explicada);
    });

    return mapa;
  }, [insumosOrdenados, capturaPorInsumo]);

  const teoricoPorInsumo = useMemo(
    () =>
      calcularTeorico(
        cargaTotalPorInsumo,
        consumoVentaPorInsumo,
        consumoEmpleadosPorInsumo
      ),
    [cargaTotalPorInsumo, consumoVentaPorInsumo, consumoEmpleadosPorInsumo]
  );

  const contadoFisicoPorInsumo = useMemo(() => {
    const mapa = {};

    insumosOrdenados.forEach((insumo) => {
      const clave = String(insumo.id);
      const captura = capturaPorInsumo[clave];

      if (!cantidadCapturaValida(captura?.contado_fisico)) {
        return;
      }

      mapa[clave] = cantidadCapturaNumerica(captura.contado_fisico);
    });

    return mapa;
  }, [insumosOrdenados, capturaPorInsumo]);

  const diferenciaPorInsumo = useMemo(
    () => calcularDiferencia(contadoFisicoPorInsumo, mermaPorInsumo, teoricoPorInsumo),
    [contadoFisicoPorInsumo, mermaPorInsumo, teoricoPorInsumo]
  );

  const formularioValido = useMemo(() => {
    if (insumosOrdenados.length === 0) {
      return false;
    }

    return insumosOrdenados.every((insumo) =>
      cantidadCapturaValida(capturaPorInsumo[String(insumo.id)]?.contado_fisico)
    );
  }, [insumosOrdenados, capturaPorInsumo]);

  const recargarJornada = useCallback(async () => {
    if (!negocioId) {
      setJornadaAbierta(null);
      setErrorJornada(null);
      setCargandoJornada(false);
      return;
    }

    setCargandoJornada(true);

    const { data, error } = await cargarJornadaAbierta(supabase, negocioId);

    if (error) {
      setErrorJornada(error.message);
      setJornadaAbierta(null);
    } else {
      setErrorJornada(null);
      setJornadaAbierta(data);
    }

    setCargandoJornada(false);
  }, [negocioId]);

  const cargarInsumosActivos = useCallback(async () => {
    if (!negocioId) {
      setInsumos([]);
      setCargandoInsumos(false);
      return;
    }

    setCargandoInsumos(true);

    const { data, error } = await queryConNegocio(
      supabase
        .from('insumos')
        .select('id, nombre, unidad_medida')
        .eq('activo', true)
        .order('nombre'),
      negocioId
    );

    if (error) {
      console.error('[inventario_snapshots] error al cargar insumos activos', error);
      setInsumos([]);
    } else {
      setInsumos(data || []);
    }

    setCargandoInsumos(false);
  }, [negocioId]);

  const cargarNombresUsuarios = useCallback(async () => {
    if (!negocioId) {
      setNombresUsuariosPorId({});
      return;
    }

    const { data, error } = await queryConNegocio(
      supabase.from('usuarios_negocio').select('id, nombre'),
      negocioId
    );

    if (error) {
      console.error('[inventario_snapshots] error al cargar usuarios', error);
      setNombresUsuariosPorId({});
      return;
    }

    setNombresUsuariosPorId(
      Object.fromEntries((data || []).map((entry) => [String(entry.id), entry.nombre]))
    );
  }, [negocioId]);

  const cargarDatosCalculo = useCallback(async () => {
    if (!negocioId || !jornadaAbierta?.id) {
      setCargas([]);
      setPedidos([]);
      setConsumosInternos([]);
      setInsumoRecetas([]);
      setInsumoRecetasVariantes([]);
      setErrorDatos(null);
      setCargandoDatos(false);
      return;
    }

    setCargandoDatos(true);
    setErrorDatos(null);

    try {
      const [
        cargasResult,
        pedidosData,
        consumosResult,
        recetasResult,
        recetasVariantesResult,
      ] = await Promise.all([
        queryConNegocio(
          supabase
            .from('inventario_cargas')
            .select('id, insumo_id, cantidad, tipo, deleted_at')
            .eq('jornada_id', jornadaAbierta.id),
          negocioId
        ),
        cargarPedidosJornada(negocioId, jornadaAbierta),
        queryConNegocio(
          supabase
            .from('inventario_consumo_interno')
            .select(
              'id, producto_id, cantidad, variantes, deleted_at, productos(id, unidad_venta)'
            )
            .eq('jornada_id', jornadaAbierta.id),
          negocioId
        ),
        queryConNegocio(
          supabase
            .from('insumo_recetas')
            .select('producto_id, insumo_id, cantidad_por_producto'),
          negocioId
        ),
        queryConNegocio(
          supabase
            .from('insumo_recetas_variantes')
            .select('item_variante_id, insumo_id, cantidad_por_extra'),
          negocioId
        ),
      ]);

      if (cargasResult.error) {
        throw new Error(cargasResult.error.message);
      }

      if (consumosResult.error) {
        throw new Error(consumosResult.error.message);
      }

      if (recetasResult.error) {
        throw new Error(recetasResult.error.message);
      }

      if (recetasVariantesResult.error) {
        throw new Error(recetasVariantesResult.error.message);
      }

      setCargas(cargasResult.data || []);
      setPedidos(pedidosData);
      setConsumosInternos(consumosResult.data || []);
      setInsumoRecetas(recetasResult.data || []);
      setInsumoRecetasVariantes(recetasVariantesResult.data || []);
    } catch (error) {
      console.error('[inventario_snapshots] error al cargar datos de cálculo', error);
      setCargas([]);
      setPedidos([]);
      setConsumosInternos([]);
      setInsumoRecetas([]);
      setInsumoRecetasVariantes([]);
      setErrorDatos(error.message || 'No se pudieron cargar los datos del corte.');
    } finally {
      setCargandoDatos(false);
    }
  }, [negocioId, jornadaAbierta]);

  const cargarSnapshotsJornada = useCallback(async () => {
    if (!negocioId || !jornadaAbierta?.id) {
      setSnapshots([]);
      setCargandoSnapshots(false);
      return;
    }

    setCargandoSnapshots(true);

    const { data, error } = await queryConNegocio(
      supabase
        .from('inventario_snapshots')
        .select('id, created_at, autorizado_por, creado_por, detalle')
        .eq('jornada_id', jornadaAbierta.id)
        .order('created_at', { ascending: false }),
      negocioId
    );

    if (error) {
      console.error('[inventario_snapshots] error al cargar snapshots de la jornada', error);
      setSnapshots([]);
    } else {
      setSnapshots(data || []);
    }

    setCargandoSnapshots(false);
  }, [negocioId, jornadaAbierta?.id]);

  useEffect(() => {
    void recargarJornada();
  }, [recargarJornada]);

  useEffect(() => {
    void cargarInsumosActivos();
  }, [cargarInsumosActivos]);

  useEffect(() => {
    void cargarNombresUsuarios();
  }, [cargarNombresUsuarios]);

  useEffect(() => {
    void cargarDatosCalculo();
  }, [cargarDatosCalculo]);

  useEffect(() => {
    void cargarSnapshotsJornada();
  }, [cargarSnapshotsJornada]);

  useEffect(() => {
    setCapturaPorInsumo(crearCapturaVaciaPorInsumos(insumosOrdenados));
  }, [insumosOrdenados]);

  const resolverNombreUsuario = (usuarioId) => {
    if (!usuarioId) return '—';
    return nombresUsuariosPorId[String(usuarioId)] || 'Usuario desconocido';
  };

  const handleCapturaChange = (insumoId, campo, value) => {
    const clave = String(insumoId);

    setCapturaPorInsumo((prev) => ({
      ...prev,
      [clave]: {
        contado_fisico: prev[clave]?.contado_fisico ?? '',
        merma_explicada: prev[clave]?.merma_explicada ?? '',
        [campo]: value,
      },
    }));
    setErrorFormulario(null);
  };

  const construirDetalleSnapshot = () =>
    insumosOrdenados.map((insumo) => {
      const clave = String(insumo.id);
      const captura = capturaPorInsumo[clave] || {};
      const cargaInicial = Number(cargaInicialTipoPorInsumo[clave]) || 0;
      const compraAdicional = Number(compraAdicionalPorInsumo[clave]) || 0;
      const consumoVenta = Number(consumoVentaPorInsumo[clave]) || 0;
      const consumoEmpleados = Number(consumoEmpleadosPorInsumo[clave]) || 0;
      const mermaExplicada = cantidadCapturaNumerica(captura.merma_explicada);
      const teorico = Number(teoricoPorInsumo[clave]) || 0;
      const contadoFisico = cantidadCapturaNumerica(captura.contado_fisico);
      const diferencia = Number(diferenciaPorInsumo[clave]) || 0;

      return {
        insumo_id: insumo.id,
        carga_inicial: cargaInicial,
        compra_adicional: compraAdicional,
        consumo_venta: consumoVenta,
        consumo_empleados: consumoEmpleados,
        merma_explicada: mermaExplicada,
        teorico,
        contado_fisico: contadoFisico,
        diferencia,
      };
    });

  const guardarSnapshot = async (autorizadoPor = null) => {
    if (!negocioId || !usuario?.id || !formularioValido || guardando || !jornadaAbierta?.id) {
      return;
    }

    setGuardando(true);
    setErrorFormulario(null);

    try {
      const payload = {
        jornada_id: jornadaAbierta.id,
        detalle: construirDetalleSnapshot(),
        creado_por: usuario.id,
        autorizado_por: autorizadoPor,
      };

      if (ROLES_CAPTURA_SNAPSHOT_DIRECTA.includes(rol)) {
        payload.autorizado_por = null;
      }

      const { data, error } = await supabase
        .from('inventario_snapshots')
        .insert(payloadConNegocio(payload, negocioId))
        .select('id, created_at, autorizado_por, creado_por, detalle')
        .single();

      if (error || !data) {
        setErrorFormulario(error?.message || 'No se pudo registrar el corte.');
        return;
      }

      setSnapshots((prev) => [data, ...prev]);
      setCapturaPorInsumo(crearCapturaVaciaPorInsumos(insumosOrdenados));
    } finally {
      setGuardando(false);
    }
  };

  const solicitarAutorizacionGuardar = (event) => {
    event.preventDefault();

    if (!formularioValido || guardando || capturaBloqueada) {
      return;
    }

    if (requierePinSnapshot) {
      setModalPinAbierto(true);
      return;
    }

    void guardarSnapshot(null);
  };

  const cerrarPin = () => {
    setModalPinAbierto(false);
  };

  const onAutorizadoPin = ({ autorizado_por }) => {
    void guardarSnapshot(autorizado_por ?? null);
  };

  const capturaFormularioDeshabilitada =
    capturaBloqueada || guardando || cargandoDatos || cargandoInsumos;

  return (
    <>
      <section className="pedido-formulario inventario-snapshot-panel">
        <h2 className="formulario-titulo">Corte / diferencias del día</h2>

        {cargandoJornada ? (
          <p className="formulario-aviso" role="status">
            Verificando jornada…
          </p>
        ) : null}

        {!cargandoJornada && errorJornada ? (
          <p className="formulario-error-guardar" role="alert">
            {errorJornada}
          </p>
        ) : null}

        {!cargandoJornada && !errorJornada && capturaBloqueada ? (
          <p className="header-jornada-cerrada-mensaje" role="status">
            {MENSAJE_SNAPSHOT_SIN_JORNADA_ABIERTA}
          </p>
        ) : null}

        {errorDatos ? (
          <p className="formulario-error-guardar" role="alert">
            {errorDatos}
          </p>
        ) : null}

        <form className="formulario-pedido" onSubmit={solicitarAutorizacionGuardar}>
          <fieldset
            className="consumo-interno-captura-campos inventario-snapshot-captura"
            disabled={capturaFormularioDeshabilitada}
          >
            {cargandoDatos || cargandoInsumos ? (
              <p className="arqueo-modal-cargando" role="status">
                Calculando datos del día…
              </p>
            ) : insumosOrdenados.length === 0 ? (
              <p className="formulario-aviso" role="status">
                No hay insumos activos para capturar el corte.
              </p>
            ) : (
              <div className="inventario-snapshot-tabla-scroll">
                <div className="arqueo-modal-tabla inventario-snapshot-tabla">
                <div className="arqueo-modal-tabla-encabezado inventario-snapshot-tabla-encabezado">
                  <span>Insumo</span>
                  <span>Carga inicial</span>
                  <span>Compra adicional</span>
                  <span>Consumido</span>
                  <span>Conteo físico</span>
                  <span>Merma explicada</span>
                  <span>Diferencia</span>
                </div>

                {insumosOrdenados.map((insumo) => {
                  const clave = String(insumo.id);
                  const captura = capturaPorInsumo[clave] || {};
                  const cargaInicial = Number(cargaInicialTipoPorInsumo[clave]) || 0;
                  const compraAdicional = Number(compraAdicionalPorInsumo[clave]) || 0;
                  const consumoVenta = Number(consumoVentaPorInsumo[clave]) || 0;
                  const consumoEmpleados = Number(consumoEmpleadosPorInsumo[clave]) || 0;
                  const consumido = consumoVenta + consumoEmpleados;
                  const contadoValido = cantidadCapturaValida(captura.contado_fisico);
                  const diferencia = contadoValido ? diferenciaPorInsumo[clave] ?? 0 : null;

                  return (
                    <div key={insumo.id} className="arqueo-modal-fila inventario-snapshot-fila">
                      <div className="inventario-snapshot-insumo">
                        <strong>{insumo.nombre}</strong>
                        <span className="inventario-snapshot-unidad">{insumo.unidad_medida}</span>
                      </div>
                      <span className="arqueo-modal-sistema">
                        {formatearCantidadInventario(cargaInicial, insumo.unidad_medida)}
                      </span>
                      <span className="arqueo-modal-sistema">
                        {formatearCantidadInventario(compraAdicional, insumo.unidad_medida)}
                      </span>
                      <span className="arqueo-modal-sistema">
                        {formatearCantidadInventario(consumido, insumo.unidad_medida)}
                      </span>
                      <div className="arqueo-modal-contado">
                        <input
                          id={`snapshot-contado-${clave}`}
                          type="number"
                          min="0"
                          step="any"
                          value={captura.contado_fisico ?? ''}
                          onChange={(event) =>
                            handleCapturaChange(clave, 'contado_fisico', event.target.value)
                          }
                          required
                          aria-label={`Conteo físico de ${insumo.nombre}`}
                        />
                      </div>
                      <div className="arqueo-modal-contado">
                        <input
                          id={`snapshot-merma-${clave}`}
                          type="number"
                          min="0"
                          step="any"
                          value={captura.merma_explicada ?? ''}
                          onChange={(event) =>
                            handleCapturaChange(clave, 'merma_explicada', event.target.value)
                          }
                          aria-label={`Merma explicada de ${insumo.nombre}`}
                        />
                      </div>
                      <span className={claseDiferenciaSnapshot(diferencia)}>
                        {diferencia == null
                          ? '—'
                          : formatearDiferenciaSnapshot(diferencia) +
                            (insumo.unidad_medida ? ` ${insumo.unidad_medida}` : '')}
                      </span>
                    </div>
                  );
                })}
                </div>
              </div>
            )}

            {errorFormulario ? (
              <p className="formulario-error-guardar" role="alert">
                {errorFormulario}
              </p>
            ) : null}

            <button
              type="submit"
              className="guardar-btn"
              disabled={
                !formularioValido ||
                guardando ||
                capturaBloqueada ||
                cargandoDatos ||
                cargandoInsumos ||
                cargandoJornada ||
                insumosOrdenados.length === 0 ||
                !usuario?.id
              }
            >
              {guardando ? 'Guardando…' : 'Registrar corte'}
            </button>
          </fieldset>
        </form>
      </section>

      <section className="dashboard-lista">
        <h2 className="formulario-titulo">Cortes de la jornada</h2>

        {cargandoJornada || cargandoSnapshots ? (
          <p className="dashboard-vacio">Cargando cortes…</p>
        ) : capturaBloqueada ? (
          <p className="dashboard-vacio">No hay jornada abierta.</p>
        ) : snapshots.length === 0 ? (
          <p className="dashboard-vacio">No hay cortes registrados en esta jornada.</p>
        ) : (
          <div className="reportes-arqueos-lista">
            {snapshots.map((snapshot) => {
              const autorizadoId = snapshot.autorizado_por || snapshot.creado_por;
              const etiquetaAutor =
                snapshot.autorizado_por != null
                  ? `Autorizado por ${resolverNombreUsuario(autorizadoId)}`
                  : `Registrado por ${resolverNombreUsuario(autorizadoId)}`;
              const filasDetalle = [...normalizarDetalleSnapshot(snapshot.detalle)].sort(
                (a, b) => {
                  const nombreA =
                    insumosPorId[String(a?.insumo_id)]?.nombre || String(a?.insumo_id || '');
                  const nombreB =
                    insumosPorId[String(b?.insumo_id)]?.nombre || String(b?.insumo_id || '');
                  return nombreA.localeCompare(nombreB, 'es');
                }
              );

              return (
                <article key={snapshot.id} className="reportes-arqueo-card">
                  <header className="reportes-arqueo-cabecera">
                    <div className="reportes-arqueo-cabecera-info">
                      <span className="inventario-corte-card-titulo">Corte de inventario</span>
                      <time className="reportes-arqueo-fecha">
                        {formatearFechaHoraSnapshot(snapshot.created_at)}
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
                            (Number(fila?.consumo_venta) || 0) +
                            (Number(fila?.consumo_empleados) || 0);
                          const diferencia = Number(fila?.diferencia);

                          return (
                            <div
                              key={`${snapshot.id}-${fila?.insumo_id}`}
                              className="reportes-arqueo-desglose-fila inventario-corte-desglose-fila"
                            >
                              <span>{nombreInsumo}</span>
                              <span>
                                {formatearCantidadInventario(fila?.carga_inicial, unidad)}
                              </span>
                              <span>
                                {formatearCantidadInventario(fila?.compra_adicional, unidad)}
                              </span>
                              <span>{formatearCantidadInventario(consumido, unidad)}</span>
                              <span>
                                {formatearCantidadInventario(fila?.contado_fisico, unidad)}
                              </span>
                              <span>
                                {formatearCantidadInventario(fila?.merma_explicada, unidad)}
                              </span>
                              <span className={claseDiferenciaCorteHistorial(diferencia)}>
                                {formatearDiferenciaSnapshot(diferencia)}
                                {Number.isFinite(diferencia) && unidad ? ` ${unidad}` : ''}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <p className="reportes-arqueo-retiros-vacio">
                      Sin detalle de insumos guardado.
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <ModalAutorizacionPin
        visible={modalPinAbierto}
        titulo="Autoriza el corte de inventario"
        onClose={cerrarPin}
        onAutorizado={onAutorizadoPin}
      />
    </>
  );
}
