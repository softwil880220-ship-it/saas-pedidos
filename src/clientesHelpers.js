import { TIPOS_ENTREGA, formatearMoneda } from './pedidosShared';

function formatearCalleConNumero(direccion) {
  const calle = (direccion.calle || '').trim();
  const numero = (direccion.numero || '').trim();
  if (calle && numero) return `${calle} #${numero}`;
  return calle || (numero ? `#${numero}` : '');
}

function etiquetaVisibleEnResumen(etiqueta) {
  const valor = (etiqueta || '').trim();
  if (!valor || valor.toLowerCase() === 'sin etiqueta') return '';
  return valor;
}

function quitarPrefijoEtiquetaSinValor(texto) {
  const valor = (texto || '').trim();
  if (!valor) return '';

  const indice = valor.indexOf(':');
  if (indice <= 0) return valor;

  const posibleEtiqueta = valor.slice(0, indice).trim();
  if (posibleEtiqueta.toLowerCase() === 'sin etiqueta') {
    return valor.slice(indice + 1).trim();
  }

  return valor;
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
  const etiqueta = etiquetaVisibleEnResumen(direccion.etiqueta);
  return etiqueta ? `${etiqueta}: ${conReferencia}` : conReferencia;
}

export function formatearDireccionPedido(pedido) {
  if (!pedido) return 'Sin dirección registrada';

  const hayEstructurada = [
    pedido.calle,
    pedido.numero,
    pedido.entre_calles,
    pedido.direccion_referencia,
    pedido.colonia,
    pedido.municipio,
  ].some((valor) => (valor || '').trim());

  if (hayEstructurada) {
    const resumen = formatearDireccionResumen({
      etiqueta: pedido.etiqueta || '',
      calle: pedido.calle || '',
      numero: pedido.numero || '',
      entre_calles: pedido.entre_calles || '',
      referencia: pedido.direccion_referencia || '',
      colonia: pedido.colonia || '',
      municipio: pedido.municipio || '',
    });
    return resumen === '—' ? 'Sin dirección registrada' : resumen;
  }

  const direccion = quitarPrefijoEtiquetaSinValor(pedido.direccion);
  return direccion || 'Sin dirección registrada';
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

const CAMPOS_DIRECCION_DOMCILIO_VACIOS = {
  direccion: null,
  etiqueta: null,
  calle: null,
  numero: null,
  entre_calles: null,
  direccion_referencia: null,
  colonia: null,
  municipio: null,
  zona_id: null,
};

function telefonoPrincipalFormulario(cliente) {
  const valor = telefonoPrincipal(cliente);
  return valor === '—' ? '' : valor;
}

export function direccionClienteADireccionForm(direccion) {
  return {
    etiqueta: direccion?.etiqueta?.trim() || '',
    calle: direccion?.calle || '',
    numero: direccion?.numero || '',
    entre_calles: direccion?.entre_calles || '',
    direccion_referencia: direccion?.referencia || '',
    colonia: direccion?.colonia || '',
    municipio: direccion?.municipio || '',
    zona_id: direccion?.zona_id || '',
  };
}

export function seleccionClienteBasicaAForm(cliente) {
  return {
    cliente: cliente?.nombre?.trim() || '',
    telefono: telefonoPrincipalFormulario(cliente),
  };
}

export function seleccionClienteAForm(cliente, direccion) {
  return {
    ...seleccionClienteBasicaAForm(cliente),
    ...direccionClienteADireccionForm(direccion),
  };
}

export function payloadDireccionDomicilioDesdeForm(form) {
  if (form?.tipoEntrega !== TIPOS_ENTREGA.DOMICILIO) {
    return { ...CAMPOS_DIRECCION_DOMCILIO_VACIOS };
  }

  const etiqueta = etiquetaVisibleEnResumen(form.etiqueta);
  const calle = form.calle?.trim() || null;
  const numero = form.numero?.trim() || null;
  const entre_calles = form.entre_calles?.trim() || null;
  const direccion_referencia = form.direccion_referencia?.trim() || null;
  const colonia = form.colonia?.trim() || null;
  const municipio = form.municipio?.trim() || null;
  const zona_id = form.zona_id?.trim?.() ? form.zona_id.trim() : form.zona_id || null;

  const hayContenido = [
    calle,
    numero,
    entre_calles,
    direccion_referencia,
    colonia,
    municipio,
  ].some(Boolean);

  const direccion = hayContenido
    ? formatearDireccionResumen({
        etiqueta,
        calle: calle || '',
        numero: numero || '',
        entre_calles: entre_calles || '',
        referencia: direccion_referencia || '',
        colonia: colonia || '',
        municipio: municipio || '',
      })
    : null;

  return {
    direccion,
    etiqueta: etiqueta || null,
    calle,
    numero,
    entre_calles,
    direccion_referencia,
    colonia,
    municipio,
    zona_id: zona_id || null,
  };
}
