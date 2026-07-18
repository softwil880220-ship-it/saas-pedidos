import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  TIPOS_ENTREGA,
  obtenerFlujoStatus,
} from './pedidosShared';
import {
  aplicarConsolidacionCarrito,
  buscarProductoPorId,
  calcularDetalleLineasPedido,
  calcularTotalLineas,
  consolidarLineasPorProducto,
} from './pedidoCarritoCalculos';
import {
  cantidadInicialLinea,
  esProductoPorPeso,
  parseCantidadPieza,
} from './productoUnidadVenta';
import {
  CLIENTE_MOSTRADOR,
  crearFormularioPedidoDefault,
  debeSuprimirPersistEco,
  limpiarCarritoFolio,
  limpiarCarritoPedido,
  persistirCarritoPedido,
  persistirCarritosMesas,
  cargarCarritoPedido,
  cargarCarritosMesasAbiertos,
} from './pedidoCarritoStorage';
import {
  crearVariantesLineaVacias,
  formatearLineaResumen,
} from './variantesDinamicas';

const FORMA_PAGO_DEFAULT_CAJA = 'efectivo';
const STATUS_DEFAULT_WHATSAPP_FORM = 'en-cocina';
const TIPO_ENTREGA_SIN_SELECCION = '';

function crearLineaPedido(id, ctx) {
  return {
    id,
    productoId: '',
    cantidad: '1',
    variantes: ctx ? crearVariantesLineaVacias(ctx.categorias) : {},
  };
}

function toggleIdEnLinea(ids, id) {
  const lista = ids || [];
  const idStr = String(id);
  if (lista.some((item) => String(item) === idStr)) {
    return lista.filter((item) => String(item) !== idStr);
  }
  return [...lista, idStr];
}

function modoCapturaAModoStorage(modoCaptura) {
  if (modoCaptura === 'whatsapp') return 'whatsapp';
  if (modoCaptura === 'mostrador') return 'mostrador';
  return 'presencial';
}

function crearFormularioInicial(modoCaptura, variantesCtx, tipoEntrega = TIPO_ENTREGA_SIN_SELECCION) {
  const modoStorage = modoCapturaAModoStorage(modoCaptura);
  const base = crearFormularioPedidoDefault(modoStorage, tipoEntrega);

  if (modoCaptura === 'mesa') {
    return {
      ...base,
      cliente: '',
      telefono: '',
      tipoEntrega: TIPOS_ENTREGA.DOMICILIO,
      direccion: '',
      formaPago: FORMA_PAGO_DEFAULT_CAJA,
      referencia: '',
      lineas: [crearLineaPedido(1, variantesCtx)],
      status: 'por-aceptar',
    };
  }

  if (modoCaptura === 'mostrador') {
    return {
      ...base,
      cliente: CLIENTE_MOSTRADOR,
      telefono: '',
      tipoEntrega: TIPOS_ENTREGA.SUCURSAL,
      direccion: '',
      formaPago: FORMA_PAGO_DEFAULT_CAJA,
      referencia: '',
      lineas: [crearLineaPedido(1, variantesCtx)],
      status: 'listo-para-recoger',
    };
  }

  return {
    ...base,
    lineas: [crearLineaPedido(1, variantesCtx)],
  };
}

function lineaEstaVacia(linea) {
  return !linea?.productoId;
}

function esCarritoVacioLocal({ form, pagoRecibido }, modoCaptura) {
  const lineas = Array.isArray(form?.lineas) ? form.lineas : [];
  const sinProductos =
    lineas.length === 0 || lineas.every(lineaEstaVacia);

  if (!sinProductos) {
    return false;
  }

  if (modoCaptura === 'presencial' || modoCaptura === 'mostrador') {
    return (
      !form?.referencia?.trim() &&
      (form?.formaPago || FORMA_PAGO_DEFAULT_CAJA) === FORMA_PAGO_DEFAULT_CAJA &&
      !String(pagoRecibido ?? '').trim()
    );
  }

  if (modoCaptura === 'mesa') {
    return (
      !form?.referencia?.trim() &&
      (form?.formaPago || FORMA_PAGO_DEFAULT_CAJA) === FORMA_PAGO_DEFAULT_CAJA
    );
  }

  const tipoEntrega = form?.tipoEntrega;

  if (tipoEntrega === TIPOS_ENTREGA.DOMICILIO) {
    return (
      !form?.cliente?.trim() &&
      !form?.telefono?.trim() &&
      !form?.direccion?.trim() &&
      !form?.formaPago?.trim() &&
      (form?.status || STATUS_DEFAULT_WHATSAPP_FORM) === STATUS_DEFAULT_WHATSAPP_FORM
    );
  }

  if (tipoEntrega === TIPOS_ENTREGA.SUCURSAL) {
    return (
      !form?.cliente?.trim() &&
      !form?.telefono?.trim() &&
      !form?.formaPago?.trim() &&
      (form?.status || STATUS_DEFAULT_WHATSAPP_FORM) === STATUS_DEFAULT_WHATSAPP_FORM
    );
  }

  return (
    !form?.cliente?.trim() &&
    !form?.telefono?.trim() &&
    !form?.direccion?.trim() &&
    !form?.formaPago?.trim() &&
    (form?.status || STATUS_DEFAULT_WHATSAPP_FORM) === STATUS_DEFAULT_WHATSAPP_FORM
  );
}

function resumenProductos(lineas, listaProductos, variantesCtx) {
  return lineas
    .map((linea) => {
      const producto = buscarProductoPorId(listaProductos, linea.productoId);
      if (!producto) return null;
      return formatearLineaResumen(linea, producto, variantesCtx);
    })
    .filter(Boolean)
    .join(', ');
}

function resolverEstadoInicial(snapshotInicial, modoCaptura, variantesCtx, folioId) {
  if (snapshotInicial?.form) {
    return {
      form: snapshotInicial.form,
      pagoRecibido: snapshotInicial.pagoRecibido ?? '',
      nextLineaId: snapshotInicial.nextLineaId ?? 2,
    };
  }

  if (folioId) {
    const restaurado = cargarCarritosMesasAbiertos()[folioId];
    if (restaurado?.form) {
      return {
        form: restaurado.form,
        pagoRecibido: restaurado.pagoRecibido ?? '',
        nextLineaId: restaurado.nextLineaId ?? 2,
      };
    }
  }

  return {
    form: crearFormularioInicial(modoCaptura, variantesCtx),
    pagoRecibido: '',
    nextLineaId: 2,
  };
}

export default function useCarritoPedido({
  variantesCtx,
  productos,
  modoCaptura,
  folioId,
  snapshotInicial,
  persistir = true,
}) {
  const estadoInicial = resolverEstadoInicial(
    snapshotInicial,
    modoCaptura,
    variantesCtx,
    folioId
  );
  const [form, setForm] = useState(estadoInicial.form);
  const [pagoRecibido, setPagoRecibido] = useState(estadoInicial.pagoRecibido);
  const [categoriaPedidoActiva, setCategoriaPedidoActiva] = useState(null);
  const nextLineaId = useRef(estadoInicial.nextLineaId);
  const persistenciaPausadaRef = useRef(false);

  const modoStorage = modoCapturaAModoStorage(modoCaptura);

  const snapshot = useMemo(
    () => ({
      form,
      pagoRecibido,
      nextLineaId: nextLineaId.current,
    }),
    [form, pagoRecibido]
  );

  const ctxConsolidacion = useMemo(
    () => ({ ...variantesCtx, productos }),
    [variantesCtx, productos]
  );

  const lineasPedidoActivas = useMemo(
    () => (form.lineas || []).filter((linea) => linea?.productoId),
    [form.lineas]
  );

  const lineasPedidoConProducto = useMemo(
    () => consolidarLineasPorProducto(lineasPedidoActivas, ctxConsolidacion),
    [lineasPedidoActivas, ctxConsolidacion]
  );

  const totalPedido = useMemo(
    () => calcularTotalLineas(lineasPedidoConProducto, productos, variantesCtx),
    [lineasPedidoConProducto, productos, variantesCtx]
  );

  const pagoEsEfectivo =
    (modoCaptura === 'presencial' || modoCaptura === 'mostrador') &&
    (form.formaPago || FORMA_PAGO_DEFAULT_CAJA) === FORMA_PAGO_DEFAULT_CAJA;

  const pagoValido =
    pagoEsEfectivo &&
    pagoRecibido !== '' &&
    !Number.isNaN(parseFloat(pagoRecibido));

  const montoPago = parseFloat(pagoRecibido);
  const cambio =
    pagoEsEfectivo && pagoValido ? montoPago - totalPedido : null;
  const pagoInsuficiente =
    pagoEsEfectivo && pagoValido && cambio < 0;

  const estaVacio = useMemo(
    () => esCarritoVacioLocal({ form, pagoRecibido }, modoCaptura),
    [form, pagoRecibido, modoCaptura]
  );

  const persistirSnapshotActual = useCallback(() => {
    if (!persistir || persistenciaPausadaRef.current) return;

    const snapshotActual = {
      form,
      pagoRecibido,
      nextLineaId: nextLineaId.current,
    };

    if (folioId && debeSuprimirPersistEco(snapshotActual)) {
      return;
    }

    if (folioId) {
      persistirCarritosMesas({
        [folioId]: snapshotActual,
      });
      return;
    }

    persistirCarritoPedido({
      modo: modoStorage,
      form,
      pagoRecibido,
      nextLineaId: nextLineaId.current,
    });
  }, [persistir, folioId, modoStorage, form, pagoRecibido]);

  useEffect(() => {
    persistirSnapshotActual();
  }, [persistirSnapshotActual]);

  const aplicarSnapshot = useCallback(({ form: formRestaurado, pagoRecibido: pagoRestaurado, nextLineaId: nextId }) => {
    setForm(formRestaurado);
    setPagoRecibido(pagoRestaurado ?? '');
    nextLineaId.current = nextId ?? 2;
  }, []);

  const pausarPersistencia = useCallback(() => {
    persistenciaPausadaRef.current = true;
  }, []);

  const reanudarPersistencia = useCallback(() => {
    persistenciaPausadaRef.current = false;
  }, []);

  const resetCarrito = useCallback(
    ({ limpiarStorage = true } = {}) => {
      const formVacio = crearFormularioInicial(modoCaptura, variantesCtx, form.tipoEntrega);

      if (limpiarStorage) {
        if (folioId) {
          limpiarCarritoFolio(folioId);
        } else {
          limpiarCarritoPedido(
            modoStorage,
            modoCaptura === 'presencial' || modoCaptura === 'mostrador'
              ? TIPOS_ENTREGA.DOMICILIO
              : form.tipoEntrega
          );
        }

        if (persistir && !folioId) {
          persistirCarritoPedido({
            modo: modoStorage,
            form: formVacio,
            pagoRecibido: '',
            nextLineaId: 2,
          });
        }
      }

      nextLineaId.current = 2;
      setPagoRecibido('');
      setCategoriaPedidoActiva(null);
      setForm(formVacio);
    },
    [folioId, modoStorage, modoCaptura, variantesCtx, form.tipoEntrega, persistir]
  );

  const setCampoCaptura = useCallback(
    (name, value) => {
      if (name === 'tipoEntrega' && modoCaptura === 'whatsapp') {
        persistirSnapshotActual();

        if (!value) {
          setForm((prev) => ({
            ...prev,
            tipoEntrega: TIPO_ENTREGA_SIN_SELECCION,
            direccion: '',
          }));
          return;
        }

        const restaurado = cargarCarritoPedido('whatsapp', value);
        if (restaurado) {
          aplicarSnapshot({
            ...restaurado,
            form: {
              ...restaurado.form,
              tipoEntrega: value,
            },
          });
          return;
        }

        const flujo = obtenerFlujoStatus(value);
        setForm((prev) => {
          const status = flujo.includes(prev.status)
            ? prev.status
            : STATUS_DEFAULT_WHATSAPP_FORM;
          const esDomicilio = value === TIPOS_ENTREGA.DOMICILIO;
          return {
            ...prev,
            tipoEntrega: value,
            status,
            direccion: esDomicilio ? prev.direccion : '',
          };
        });
        return;
      }

      setForm((prev) => {
        if (name === 'tipoEntrega') {
          if (!value) {
            return {
              ...prev,
              tipoEntrega: TIPO_ENTREGA_SIN_SELECCION,
              direccion: '',
            };
          }

          const flujo = obtenerFlujoStatus(value);
          const status = flujo.includes(prev.status)
            ? prev.status
            : STATUS_DEFAULT_WHATSAPP_FORM;
          const esDomicilio = value === TIPOS_ENTREGA.DOMICILIO;
          return {
            ...prev,
            tipoEntrega: value,
            status,
            direccion: esDomicilio ? prev.direccion : '',
          };
        }
        return { ...prev, [name]: value };
      });

      if (
        name === 'formaPago' &&
        (modoCaptura === 'presencial' || modoCaptura === 'mostrador') &&
        value !== FORMA_PAGO_DEFAULT_CAJA
      ) {
        setPagoRecibido('');
      }
    },
    [modoCaptura, persistirSnapshotActual, aplicarSnapshot, variantesCtx]
  );

  const actualizarLinea = useCallback(
    (lineaId, campo, valor) => {
      setForm((prev) => ({
        ...prev,
        lineas: aplicarConsolidacionCarrito(
          (prev.lineas || []).map((linea) => {
            if (linea.id !== lineaId) return linea;
            if (campo === 'productoId') {
              const producto = buscarProductoPorId(productos, valor);
              return {
                ...linea,
                productoId: String(valor),
                cantidad: cantidadInicialLinea(producto),
                variantes: crearVariantesLineaVacias(variantesCtx.categorias),
              };
            }
            return { ...linea, [campo]: valor };
          }),
          ctxConsolidacion
        ),
      }));
    },
    [ctxConsolidacion, variantesCtx, productos]
  );

  const actualizarCantidadLinea = useCallback(
    (lineaId, valor) => {
      setForm((prev) => ({
        ...prev,
        lineas: aplicarConsolidacionCarrito(
          (prev.lineas || []).map((linea) =>
            linea.id === lineaId ? { ...linea, cantidad: valor } : linea
          ),
          ctxConsolidacion
        ),
      }));
    },
    [ctxConsolidacion]
  );

  const ajustarCantidadLinea = useCallback(
    (lineaId, delta) => {
      setForm((prev) => ({
        ...prev,
        lineas: aplicarConsolidacionCarrito(
          (prev.lineas || []).map((linea) => {
            if (linea.id !== lineaId) return linea;

            const producto = buscarProductoPorId(productos, linea.productoId);
            if (esProductoPorPeso(producto)) {
              return linea;
            }

            const cantidadActual = parseCantidadPieza(linea.cantidad);
            const cantidadNueva = Math.max(1, cantidadActual + delta);

            return { ...linea, cantidad: String(cantidadNueva) };
          }),
          ctxConsolidacion
        ),
      }));
    },
    [ctxConsolidacion, productos]
  );

  const cambiarVarianteLinea = useCallback(
    (lineaId, categoria, itemId) => {
      setForm((prev) => ({
        ...prev,
        lineas: aplicarConsolidacionCarrito(
          (prev.lineas || []).map((linea) =>
            linea.id === lineaId
              ? {
                  ...linea,
                  variantes: {
                    ...linea.variantes,
                    [categoria]: toggleIdEnLinea(linea.variantes?.[categoria], itemId),
                  },
                }
              : linea
          ),
          ctxConsolidacion
        ),
      }));
    },
    [ctxConsolidacion]
  );

  const agregarLinea = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      lineas: [...prev.lineas, crearLineaPedido(nextLineaId.current++, variantesCtx)],
    }));
  }, [variantesCtx]);

  const agregarProductoAlPedido = useCallback(
    (productoId) => {
      const idStr = String(productoId);
      const producto = buscarProductoPorId(productos, productoId);

      setForm((prev) => ({
        ...prev,
        lineas: aplicarConsolidacionCarrito(
          [
            ...(prev.lineas || []),
            {
              ...crearLineaPedido(nextLineaId.current++, variantesCtx),
              productoId: idStr,
              cantidad: cantidadInicialLinea(producto),
            },
          ],
          ctxConsolidacion
        ),
      }));
    },
    [ctxConsolidacion, variantesCtx, productos]
  );

  const eliminarLinea = useCallback(
    (lineaId) => {
      setForm((prev) => ({
        ...prev,
        lineas: aplicarConsolidacionCarrito(
          (prev.lineas || []).filter((linea) => linea.id !== lineaId),
          ctxConsolidacion
        ),
      }));
    },
    [ctxConsolidacion]
  );

  const obtenerDetallePedido = useCallback(
    () => calcularDetalleLineasPedido(lineasPedidoConProducto, productos, variantesCtx),
    [lineasPedidoConProducto, productos, variantesCtx]
  );

  const obtenerResumenProductos = useCallback(
    () => resumenProductos(lineasPedidoConProducto, productos, variantesCtx),
    [lineasPedidoConProducto, productos, variantesCtx]
  );

  return {
    form,
    pagoRecibido,
    categoriaPedidoActiva,
    lineasPedidoActivas,
    lineasPedidoConProducto,
    totalPedido,
    pagoValido,
    cambio,
    pagoInsuficiente,
    estaVacio,
    snapshot,
    agregarProductoAlPedido,
    ajustarCantidadLinea,
    actualizarCantidadLinea,
    eliminarLinea,
    actualizarLinea,
    cambiarVarianteLinea,
    agregarLinea,
    setCampoCaptura,
    setPagoRecibido,
    setCategoriaPedidoActiva,
    resetCarrito,
    aplicarSnapshot,
    pausarPersistencia,
    reanudarPersistencia,
    obtenerDetallePedido,
    obtenerResumenProductos,
  };
}
