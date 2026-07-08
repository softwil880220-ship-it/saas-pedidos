import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  TIPOS_ENTREGA,
  obtenerFlujoStatus,
} from './pedidosShared';
import {
  buscarProductoPorId,
  calcularDetalleLineasPedido,
  calcularTotalLineas,
  consolidarLineasPorProducto,
} from './pedidoCarritoCalculos';
import {
  cargarCarritoPedido,
  cargarCarritosMesasAbiertos,
  crearFormularioPedidoDefault,
  limpiarCarritoFolio,
  limpiarCarritoPedido,
  persistirCarritoPedido,
  persistirCarritosMesas,
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
  return modoCaptura === 'whatsapp' ? 'whatsapp' : 'presencial';
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

  if (modoCaptura === 'presencial') {
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

  const lineasPedidoActivas = useMemo(
    () => (form.lineas || []).filter((linea) => linea?.productoId),
    [form.lineas]
  );

  const lineasPedidoConProducto = useMemo(
    () => consolidarLineasPorProducto(lineasPedidoActivas, variantesCtx),
    [lineasPedidoActivas, variantesCtx]
  );

  const totalPedido = useMemo(
    () => calcularTotalLineas(lineasPedidoActivas, productos, variantesCtx),
    [lineasPedidoActivas, productos, variantesCtx]
  );

  const pagoValido =
    modoCaptura === 'presencial' &&
    pagoRecibido !== '' &&
    !Number.isNaN(parseFloat(pagoRecibido));

  const montoPago = parseFloat(pagoRecibido);
  const cambio =
    modoCaptura === 'presencial' && pagoValido ? montoPago - totalPedido : null;
  const pagoInsuficiente =
    modoCaptura === 'presencial' && pagoValido && cambio < 0;

  const estaVacio = useMemo(
    () => esCarritoVacioLocal({ form, pagoRecibido }, modoCaptura),
    [form, pagoRecibido, modoCaptura]
  );

  const persistirSnapshotActual = useCallback(() => {
    if (!persistir || persistenciaPausadaRef.current) return;

    if (folioId) {
      persistirCarritosMesas({
        [folioId]: {
          form,
          pagoRecibido,
          nextLineaId: nextLineaId.current,
        },
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
      if (limpiarStorage) {
        if (folioId) {
          limpiarCarritoFolio(folioId);
        } else {
          limpiarCarritoPedido(
            modoStorage,
            modoCaptura === 'presencial' ? TIPOS_ENTREGA.DOMICILIO : form.tipoEntrega
          );
        }
      }

      nextLineaId.current = 2;
      setPagoRecibido('');
      setCategoriaPedidoActiva(null);
      setForm(crearFormularioInicial(modoCaptura, variantesCtx, form.tipoEntrega));
    },
    [folioId, modoStorage, modoCaptura, variantesCtx, form.tipoEntrega]
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
        setForm({
          cliente: '',
          telefono: '',
          tipoEntrega: value,
          direccion: '',
          formaPago: '',
          referencia: '',
          lineas: [crearLineaPedido(1, variantesCtx)],
          status: flujo.includes(STATUS_DEFAULT_WHATSAPP_FORM)
            ? STATUS_DEFAULT_WHATSAPP_FORM
            : flujo[0],
        });
        setPagoRecibido('');
        nextLineaId.current = 2;
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
    },
    [modoCaptura, persistirSnapshotActual, aplicarSnapshot, variantesCtx]
  );

  const actualizarLinea = useCallback(
    (lineaId, campo, valor) => {
      setForm((prev) => ({
        ...prev,
        lineas: prev.lineas.map((linea) => {
          if (linea.id !== lineaId) return linea;
          if (campo === 'productoId') {
            return {
              ...linea,
              productoId: String(valor),
              variantes: crearVariantesLineaVacias(variantesCtx.categorias),
            };
          }
          return { ...linea, [campo]: valor };
        }),
      }));
    },
    [variantesCtx]
  );

  const ajustarCantidadLinea = useCallback(
    (lineaId, delta) => {
      setForm((prev) => ({
        ...prev,
        lineas: consolidarLineasPorProducto(
          prev.lineas.map((linea) => {
            if (linea.id !== lineaId) return linea;

            const cantidadActual = Math.max(1, parseInt(linea.cantidad, 10) || 1);
            const cantidadNueva = Math.max(1, cantidadActual + delta);

            return { ...linea, cantidad: String(cantidadNueva) };
          }),
          variantesCtx
        ),
      }));
    },
    [variantesCtx]
  );

  const cambiarVarianteLinea = useCallback((lineaId, categoria, itemId) => {
    setForm((prev) => ({
      ...prev,
      lineas: prev.lineas.map((linea) =>
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
    }));
  }, []);

  const agregarLinea = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      lineas: [...prev.lineas, crearLineaPedido(nextLineaId.current++, variantesCtx)],
    }));
  }, [variantesCtx]);

  const agregarProductoAlPedido = useCallback(
    (productoId) => {
      const idStr = String(productoId);

      setForm((prev) => {
        const lineasConsolidadas = consolidarLineasPorProducto(
          prev.lineas.filter((linea) => linea.productoId),
          variantesCtx
        );
        const indiceExistente = lineasConsolidadas.findIndex(
          (linea) => String(linea.productoId) === idStr
        );

        if (indiceExistente !== -1) {
          return {
            ...prev,
            lineas: lineasConsolidadas.map((linea, indice) =>
              indice === indiceExistente
                ? {
                    ...linea,
                    cantidad: String((parseInt(linea.cantidad, 10) || 1) + 1),
                  }
                : linea
            ),
          };
        }

        return {
          ...prev,
          lineas: [
            ...lineasConsolidadas,
            {
              ...crearLineaPedido(nextLineaId.current++, variantesCtx),
              productoId: idStr,
            },
          ],
        };
      });
    },
    [variantesCtx]
  );

  const eliminarLinea = useCallback((lineaId) => {
    setForm((prev) => ({
      ...prev,
      lineas: prev.lineas.filter((linea) => linea.id !== lineaId),
    }));
  }, []);

  const obtenerDetallePedido = useCallback(
    () => calcularDetalleLineasPedido(form.lineas, productos, variantesCtx),
    [form.lineas, productos, variantesCtx]
  );

  const obtenerResumenProductos = useCallback(
    () => resumenProductos(form.lineas, productos, variantesCtx),
    [form.lineas, productos, variantesCtx]
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
