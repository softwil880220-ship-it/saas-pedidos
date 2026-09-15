import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { cargarJornadaAbierta } from './jornadaHelpers';
import ModalAutorizacionPin from './ModalAutorizacionPin';
import PedidoLineasCarrito from './PedidoLineasCarrito';
import SelectorProductosPedidoConModal from './SelectorProductosPedidoConModal';
import { buscarProductoPorId } from './pedidoCarritoCalculos';
import { supabase } from './supabase';
import { payloadConNegocio, queryConNegocio } from './tenantHelpers';
import {
  esProductoPorPeso,
  parseCantidadPieza,
  parseGramosLinea,
} from './productoUnidadVenta';
import useCarritoPedido from './useCarritoPedido';
import { useProductosRealtime } from './usePedidosRealtime';
import useVariantesCtx from './useVariantesCtx';
import { formatearLineaResumen } from './variantesDinamicas';

const MENSAJE_CONSUMO_SIN_JORNADA_ABIERTA =
  'Debes abrir una jornada antes de registrar consumo de empleados.';

const ROLES_CAPTURA_CONSUMO_DIRECTA = ['dueno', 'administrador'];

function formatearFechaHoraConsumo(createdAt) {
  if (!createdAt) return '—';

  return new Date(createdAt).toLocaleString('es-MX', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function variantesParaPersistir(variantes) {
  if (!variantes || typeof variantes !== 'object') return null;

  const normalizado = Object.fromEntries(
    Object.entries(variantes).filter(([, ids]) => Array.isArray(ids) && ids.length > 0)
  );

  return Object.keys(normalizado).length > 0 ? normalizado : null;
}

function cantidadNumericaLinea(linea, productos) {
  const producto = buscarProductoPorId(productos, linea.productoId);

  if (esProductoPorPeso(producto)) {
    return parseGramosLinea(linea.cantidad);
  }

  return parseCantidadPieza(linea.cantidad);
}

function lineaConsumoValida(linea, productos) {
  if (!linea?.productoId) return false;
  return cantidadNumericaLinea(linea, productos) > 0;
}

function etiquetaCantidadConsumo(producto, cantidad) {
  if (esProductoPorPeso(producto)) {
    return `${cantidad} g`;
  }

  return cantidad === 1 ? '1 pieza' : `${cantidad} piezas`;
}

function resumenLineaConsumo(variantes, producto, variantesCtx) {
  if (!variantes || !producto) return null;

  const tieneSeleccion = Object.values(variantes).some(
    (ids) => Array.isArray(ids) && ids.length > 0
  );

  if (!tieneSeleccion) return null;

  return formatearLineaResumen(
    { productoId: String(producto.id), cantidad: '1', variantes },
    producto,
    variantesCtx
  );
}

export default function ConsumoInternoPanel({ negocioId, rol }) {
  const { usuario } = useAuth();
  const { productos, cargando: cargandoProductos } = useProductosRealtime({
    channelName: 'inventario-consumo-productos',
    negocioId,
  });
  const { variantesCtx } = useVariantesCtx(negocioId, productos);

  const carrito = useCarritoPedido({
    variantesCtx,
    productos,
    modoCaptura: 'mostrador',
    persistir: false,
  });

  const [empleados, setEmpleados] = useState([]);
  const [productoIdsConReceta, setProductoIdsConReceta] = useState(() => new Set());
  const [consumos, setConsumos] = useState([]);
  const [nombresUsuariosPorId, setNombresUsuariosPorId] = useState({});
  const [empleadoId, setEmpleadoId] = useState('');
  const [cargandoEmpleados, setCargandoEmpleados] = useState(true);
  const [cargandoRecetas, setCargandoRecetas] = useState(true);
  const [cargandoConsumos, setCargandoConsumos] = useState(true);
  const [cargandoJornada, setCargandoJornada] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [errorFormulario, setErrorFormulario] = useState(null);
  const [errorJornada, setErrorJornada] = useState(null);
  const [jornadaAbierta, setJornadaAbierta] = useState(null);
  const [modalPinAbierto, setModalPinAbierto] = useState(false);

  const requierePinConsumo = rol === 'cajero';
  const capturaBloqueada = !jornadaAbierta?.id;

  const productosOrdenados = useMemo(
    () =>
      [...productos].sort((a, b) =>
        String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es')
      ),
    [productos]
  );

  const productosConReceta = useMemo(
    () => productosOrdenados.filter((producto) => productoIdsConReceta.has(String(producto.id))),
    [productosOrdenados, productoIdsConReceta]
  );

  const empleadosOrdenados = useMemo(
    () =>
      [...empleados].sort((a, b) =>
        String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es')
      ),
    [empleados]
  );

  const lineasValidas = useMemo(
    () =>
      carrito.lineasPedidoConProducto.filter((linea) =>
        lineaConsumoValida(linea, productos)
      ),
    [carrito.lineasPedidoConProducto, productos]
  );

  const formularioValido = Boolean(empleadoId) && lineasValidas.length > 0;

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

  const cargarEmpleadosActivos = useCallback(async () => {
    if (!negocioId) {
      setEmpleados([]);
      setCargandoEmpleados(false);
      return;
    }

    setCargandoEmpleados(true);

    const { data, error } = await queryConNegocio(
      supabase.from('empleados').select('id, nombre').eq('activo', true).order('nombre'),
      negocioId
    );

    if (error) {
      console.error('[inventario_consumo_interno] error al cargar empleados', error);
      setEmpleados([]);
    } else {
      setEmpleados(data || []);
    }

    setCargandoEmpleados(false);
  }, [negocioId]);

  const cargarProductoIdsConReceta = useCallback(async () => {
    if (!negocioId) {
      setProductoIdsConReceta(new Set());
      setCargandoRecetas(false);
      return;
    }

    setCargandoRecetas(true);

    const { data, error } = await queryConNegocio(
      supabase.from('insumo_recetas').select('producto_id'),
      negocioId
    );

    if (error) {
      console.error('[inventario_consumo_interno] error al cargar recetas de producto', error);
      setProductoIdsConReceta(new Set());
    } else {
      setProductoIdsConReceta(
        new Set((data || []).map((fila) => String(fila.producto_id)))
      );
    }

    setCargandoRecetas(false);
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
      console.error('[inventario_consumo_interno] error al cargar usuarios', error);
      setNombresUsuariosPorId({});
      return;
    }

    setNombresUsuariosPorId(
      Object.fromEntries((data || []).map((entry) => [String(entry.id), entry.nombre]))
    );
  }, [negocioId]);

  const cargarConsumosJornada = useCallback(async () => {
    if (!negocioId || !jornadaAbierta?.id) {
      setConsumos([]);
      setCargandoConsumos(false);
      return;
    }

    setCargandoConsumos(true);

    const { data, error } = await queryConNegocio(
      supabase
        .from('inventario_consumo_interno')
        .select(
          'id, empleado_id, producto_id, cantidad, variantes, created_at, autorizado_por, creado_por, productos(id, nombre, unidad_venta), empleados(id, nombre)'
        )
        .eq('jornada_id', jornadaAbierta.id)
        .order('created_at', { ascending: false }),
      negocioId
    );

    if (error) {
      console.error('[inventario_consumo_interno] error al cargar consumos de la jornada', error);
      setConsumos([]);
    } else {
      setConsumos(data || []);
    }

    setCargandoConsumos(false);
  }, [negocioId, jornadaAbierta?.id]);

  useEffect(() => {
    void recargarJornada();
  }, [recargarJornada]);

  useEffect(() => {
    void cargarEmpleadosActivos();
  }, [cargarEmpleadosActivos]);

  useEffect(() => {
    void cargarProductoIdsConReceta();
  }, [cargarProductoIdsConReceta]);

  useEffect(() => {
    void cargarNombresUsuarios();
  }, [cargarNombresUsuarios]);

  useEffect(() => {
    void cargarConsumosJornada();
  }, [cargarConsumosJornada]);

  const resolverNombreUsuario = (usuarioId) => {
    if (!usuarioId) return '—';
    return nombresUsuariosPorId[String(usuarioId)] || 'Usuario desconocido';
  };

  const guardarConsumo = async (autorizadoPor = null) => {
    if (!negocioId || !usuario?.id || !formularioValido || guardando) return;

    if (!jornadaAbierta?.id) {
      setErrorFormulario(MENSAJE_CONSUMO_SIN_JORNADA_ABIERTA);
      return;
    }

    setGuardando(true);
    setErrorFormulario(null);

    try {
      const filas = lineasValidas.map((linea) => {
        const payload = {
          jornada_id: jornadaAbierta.id,
          empleado_id: empleadoId,
          producto_id: Number(linea.productoId),
          cantidad: cantidadNumericaLinea(linea, productos),
          variantes: variantesParaPersistir(linea.variantes),
          creado_por: usuario.id,
          autorizado_por: autorizadoPor,
        };

        if (ROLES_CAPTURA_CONSUMO_DIRECTA.includes(rol)) {
          payload.autorizado_por = null;
        }

        return payloadConNegocio(payload, negocioId);
      });

      const { data, error } = await supabase
        .from('inventario_consumo_interno')
        .insert(filas)
        .select(
          'id, empleado_id, producto_id, cantidad, variantes, created_at, autorizado_por, creado_por, productos(id, nombre, unidad_venta), empleados(id, nombre)'
        );

      if (error || !data?.length) {
        setErrorFormulario(error?.message || 'No se pudo registrar el consumo.');
        return;
      }

      setConsumos((prev) => [...data, ...prev]);
      carrito.resetCarrito({ limpiarStorage: false });
      setEmpleadoId('');
    } finally {
      setGuardando(false);
    }
  };

  const solicitarAutorizacionGuardar = (event) => {
    event.preventDefault();

    if (!formularioValido || guardando || capturaBloqueada) return;

    if (requierePinConsumo) {
      setModalPinAbierto(true);
      return;
    }

    void guardarConsumo(null);
  };

  const cerrarPin = () => {
    setModalPinAbierto(false);
  };

  const onAutorizadoPin = ({ autorizado_por }) => {
    void guardarConsumo(autorizado_por ?? null);
  };

  const capturaFormularioDeshabilitada = capturaBloqueada || guardando;

  return (
    <>
      <section className="pedido-formulario">
        <h2 className="formulario-titulo">Registrar consumo de empleado</h2>

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
            {MENSAJE_CONSUMO_SIN_JORNADA_ABIERTA}
          </p>
        ) : null}

        <form className="formulario-pedido" onSubmit={solicitarAutorizacionGuardar}>
          <fieldset
            className="consumo-interno-captura-campos"
            disabled={capturaFormularioDeshabilitada}
          >
            <div className="formulario formulario-cabecera">
              <div className="formulario-campo">
                <label htmlFor="consumo-empleado_id">Empleado</label>
                <select
                  id="consumo-empleado_id"
                  name="empleado_id"
                  value={empleadoId}
                  onChange={(event) => {
                    setEmpleadoId(event.target.value);
                    setErrorFormulario(null);
                  }}
                  required
                  disabled={capturaBloqueada || cargandoEmpleados || guardando}
                >
                  <option value="">Seleccionar empleado…</option>
                  {empleadosOrdenados.map((empleado) => (
                    <option key={empleado.id} value={empleado.id}>
                      {empleado.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div
              className={
                capturaFormularioDeshabilitada ? 'mesa-selector-jornada-cerrada' : undefined
              }
            >
              {cargandoProductos || cargandoRecetas ? (
                <p className="formulario-aviso" role="status">
                  Cargando productos con receta…
                </p>
              ) : productosConReceta.length === 0 ? (
                <p className="formulario-aviso" role="status">
                  No hay productos con receta de insumos. Configúralos en Catálogo de productos.
                </p>
              ) : (
                <SelectorProductosPedidoConModal
                  productos={productosConReceta}
                  variantesCtx={variantesCtx}
                  categoriaActiva={carrito.categoriaPedidoActiva}
                  onCategoriaChange={carrito.setCategoriaPedidoActiva}
                  onAgregarDirecto={carrito.agregarProductoAlPedido}
                  onConfirmarLinea={carrito.agregarLineaConVariantes}
                />
              )}
            </div>

            {carrito.lineasPedidoConProducto.length > 0 ? (
              <div
                className={
                  capturaFormularioDeshabilitada ? 'mesa-selector-jornada-cerrada' : undefined
                }
              >
                <PedidoLineasCarrito
                  lineas={carrito.lineasPedidoConProducto}
                  productos={productos}
                  variantesCtx={variantesCtx}
                  totalPedido={carrito.totalPedido}
                  colapsablePorDefecto
                  ocultarPrecios
                  etiquetaEncabezado="Productos del consumo"
                  onAjustarCantidad={carrito.ajustarCantidadLinea}
                  onActualizarCantidad={carrito.actualizarCantidadLinea}
                  onEliminarLinea={carrito.eliminarLinea}
                  onCambiarVariante={carrito.cambiarVarianteLinea}
                />
              </div>
            ) : null}

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
                cargandoEmpleados ||
                cargandoProductos ||
                cargandoRecetas ||
                cargandoJornada ||
                productosConReceta.length === 0 ||
                !usuario?.id
              }
            >
              {guardando ? 'Guardando…' : 'Registrar consumo'}
            </button>
          </fieldset>
        </form>
      </section>

      <section className="dashboard-lista">
        <h2 className="formulario-titulo">Consumos de la jornada</h2>

        {cargandoJornada || cargandoConsumos ? (
          <p className="dashboard-vacio">Cargando consumos…</p>
        ) : capturaBloqueada ? (
          <p className="dashboard-vacio">No hay jornada abierta.</p>
        ) : consumos.length === 0 ? (
          <p className="dashboard-vacio">No hay consumos registrados en esta jornada.</p>
        ) : (
          <div className="pedidos-grid">
            {consumos.map((consumo) => {
              const producto = consumo.productos;
              const empleado = consumo.empleados;
              const nombreProducto = producto?.nombre || 'Producto desconocido';
              const resumenVariantes = resumenLineaConsumo(
                consumo.variantes,
                producto,
                variantesCtx
              );

              return (
                <article key={consumo.id} className="pedido-tarjeta">
                  <h2 className="pedido-cliente">{nombreProducto}</h2>
                  <p className="pedido-producto">
                    Empleado: {empleado?.nombre || '—'}
                  </p>
                  <p className="pedido-producto">
                    Cantidad: {etiquetaCantidadConsumo(producto, consumo.cantidad)}
                  </p>
                  {resumenVariantes ? (
                    <p className="pedido-producto">Detalle: {resumenVariantes}</p>
                  ) : null}
                  <p className="pedido-producto">
                    Registrado: {formatearFechaHoraConsumo(consumo.created_at)}
                  </p>
                  <p className="pedido-producto">
                    Autorizado por: {resolverNombreUsuario(consumo.autorizado_por)}
                  </p>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <ModalAutorizacionPin
        visible={modalPinAbierto}
        titulo="Autoriza el registro de consumo de empleado"
        onClose={cerrarPin}
        onAutorizado={onAutorizadoPin}
      />
    </>
  );
}
