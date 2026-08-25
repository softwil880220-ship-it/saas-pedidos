import { formatearMoneda } from './pedidosShared';

function formatearCalleConNumero(direccion) {
  const calle = (direccion.calle || '').trim();
  const numero = (direccion.numero || '').trim();
  if (calle && numero) return `${calle} #${numero}`;
  return calle || (numero ? `#${numero}` : '');
}

export function formatearDireccionResumen(direccion) {
  if (!direccion) return '—';

  const partes = [
    formatearCalleConNumero(direccion) || null,
    direccion.entre_calles ? `Entre ${direccion.entre_calles}` : null,
    direccion.colonia,
    direccion.municipio,
    direccion.estado,
    direccion.codigo_postal,
    direccion.pais,
  ]
    .map((parte) => (parte || '').trim())
    .filter(Boolean);

  const base = partes.length > 0 ? partes.join(', ') : 'Sin detalle';
  const referencia = (direccion.referencia || '').trim();
  const conReferencia = referencia ? `${base} — Ref: ${referencia}` : base;
  const etiqueta = direccion.etiqueta?.trim();
  return etiqueta ? `${etiqueta}: ${conReferencia}` : conReferencia;
}

export function formatearZonaConTarifa(zona) {
  if (!zona?.nombre) return '—';
  const tarifa = Number(zona.tarifa_flete);
  if (!Number.isFinite(tarifa)) return zona.nombre;
  return `${zona.nombre} (${formatearMoneda(tarifa)})`;
}

export function marcarPrincipalUnico(items, indicePrincipal) {
  const indice =
    indicePrincipal >= 0 && indicePrincipal < (items || []).length ? indicePrincipal : 0;
  return (items || []).map((item, i) => ({
    ...item,
    es_principal: i === indice,
  }));
}

export function telefonoPrincipal(cliente) {
  const lista = cliente?.telefonos || [];
  const principal = lista.find((t) => t.es_principal);
  return (principal || lista[0])?.telefono?.trim() || '—';
}

export function direccionVacia() {
  return {
    id: null,
    etiqueta: '',
    calle: '',
    numero: '',
    entre_calles: '',
    referencia: '',
    colonia: '',
    municipio: '',
    estado: '',
    codigo_postal: '',
    pais: '',
    zona_id: '',
    es_principal: true,
  };
}

export function telefonoVacio(esPrincipal = false) {
  return {
    id: null,
    telefono: '',
    es_principal: esPrincipal,
  };
}
