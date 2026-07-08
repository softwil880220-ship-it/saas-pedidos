import { useEffect } from 'react';
import useCarritoPedido from './useCarritoPedido';

const FOLIO_TEST = 'mesa-test-1';
const STORAGE_MESAS = 'pos_carritos_mesas';
const CLAVES_WHATSAPP = [
  'pos_carrito_whatsapp_domicilio',
  'pos_carrito_whatsapp_sucursal',
  'pos_carrito_whatsapp_borrador',
];

function leerMesasAlmacenadas() {
  try {
    const raw = localStorage.getItem(STORAGE_MESAS);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function lineasConProducto(snapshot) {
  return (snapshot?.form?.lineas || []).filter((linea) => linea?.productoId);
}

export default function TestMesaCarrito({ productos, variantesCtx }) {
  const carrito = useCarritoPedido({
    variantesCtx,
    productos,
    modoCaptura: 'mesa',
    folioId: FOLIO_TEST,
    persistir: true,
  });

  useEffect(() => {
    window.__carritoTest = carrito;

    return () => {
      if (window.__carritoTest === carrito) {
        delete window.__carritoTest;
      }
    };
  });

  const correrValidaciones = () => {
    console.group('TestMesaCarrito — validaciones');

    const mesasAntesReset = leerMesasAlmacenadas();
    const folioAntesReset = mesasAntesReset?.carritos?.[FOLIO_TEST];
    const lineasMesa = lineasConProducto(folioAntesReset);
    const test1Ok = lineasMesa.length >= 1;

    if (test1Ok) {
      console.log('✅ Test 1 PASÓ: pos_carritos_mesas contiene mesa-test-1 con líneas.');
    } else {
      console.log(
        `❌ Test 1 FALLÓ: mesa-test-1 sin líneas con producto (encontradas: ${lineasMesa.length}). Agrega un producto antes de validar.`
      );
    }
    console.assert(test1Ok, 'Test 1 — persistencia en pos_carritos_mesas');

    const lineasActivas = carrito.lineasPedidoActivas.length;
    console.log(
      `ℹ️ Test 2 — Recuperación: carrito.lineasPedidoActivas.length = ${lineasActivas} (compara antes/después de recargar la página).`
    );

    const cajaRaw = localStorage.getItem('pos_carrito_caja');
    const cajaSinCruce = !cajaRaw || !cajaRaw.includes(FOLIO_TEST);
    const whatsappSinCruce = CLAVES_WHATSAPP.every((clave) => {
      const raw = localStorage.getItem(clave);
      return !raw || !raw.includes(FOLIO_TEST);
    });
    const test3Ok = cajaSinCruce && whatsappSinCruce;

    if (test3Ok) {
      console.log('✅ Test 3 PASÓ: Caja y WhatsApp no contienen mesa-test-1.');
    } else {
      const detalles = [];
      if (!cajaSinCruce) detalles.push('pos_carrito_caja');
      CLAVES_WHATSAPP.forEach((clave) => {
        const raw = localStorage.getItem(clave);
        if (raw?.includes(FOLIO_TEST)) detalles.push(clave);
      });
      console.log(`❌ Test 3 FALLÓ: datos cruzados en ${detalles.join(', ')}.`);
    }
    console.assert(test3Ok, 'Test 3 — aislamiento Caja/WhatsApp vs mesas');

    carrito.resetCarrito();

    const mesasDespuesReset = leerMesasAlmacenadas();
    const folioDespuesReset = mesasDespuesReset?.carritos?.[FOLIO_TEST];
    const test4Ok = folioDespuesReset === undefined;

    if (test4Ok) {
      console.log('✅ Test 4 PASÓ: mesa-test-1 eliminado tras resetCarrito().');
    } else {
      console.log('❌ Test 4 FALLÓ: mesa-test-1 sigue presente después de resetCarrito().');
    }
    console.assert(test4Ok, 'Test 4 — resetCarrito limpia el folio en storage');

    console.groupEnd();
  };

  const primerProductoId = productos[0]?.id;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 12,
        right: 12,
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: 12,
        background: '#1e293b',
        color: '#f8fafc',
        borderRadius: 8,
        fontSize: 13,
        boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
      }}
    >
      <strong>TestMesaCarrito ({FOLIO_TEST})</strong>
      <span>Líneas activas: {carrito.lineasPedidoActivas.length}</span>
      <button
        type="button"
        onClick={() => {
          if (primerProductoId == null) {
            console.warn('TestMesaCarrito: no hay productos en catálogo.');
            return;
          }
          carrito.agregarProductoAlPedido(primerProductoId);
        }}
        disabled={primerProductoId == null}
      >
        Agregar producto
      </button>
      <button type="button" onClick={correrValidaciones}>
        Correr validaciones
      </button>
    </div>
  );
}
