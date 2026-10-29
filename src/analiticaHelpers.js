function redondearDosDecimales(valor) {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

function redondearUnDecimal(valor) {
  return Math.round((valor + Number.EPSILON) * 10) / 10;
}

function diasRestantesDe(diaActual, diasEnMes) {
  if (diaActual == null || diasEnMes == null || diaActual === '' || diasEnMes === '') {
    return null;
  }

  const dia = Number(diaActual);
  const dias = Number(diasEnMes);
  if (!Number.isInteger(dia) || !Number.isInteger(dias)) return null;
  if (dia < 1 || dias < 1 || dia > dias) return null;

  return dias - dia + 1;
}

const NOMBRES_MES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

export function etiquetaMes(textoFecha) {
  const coincidencia = /^(\d{4})-(\d{2})-\d{2}$/.exec(String(textoFecha ?? '').trim());
  if (!coincidencia) return '';

  const anio = coincidencia[1];
  const indiceMes = Number(coincidencia[2]) - 1;
  const nombre = NOMBRES_MES[indiceMes];
  if (!nombre) return '';

  return `${nombre} ${anio}`;
}

export function calcularAvance({ vendido, meta, diaActual = null, diasEnMes = null }) {
  const vendidoNumero = Number(vendido);
  const vendidoSeguro = Number.isFinite(vendidoNumero) ? vendidoNumero : 0;
  const metaNumero = meta == null || meta === '' ? null : Number(meta);
  const diasRestantes = diasRestantesDe(diaActual, diasEnMes);

  if (metaNumero == null || !Number.isFinite(metaNumero) || metaNumero <= 0) {
    return {
      porcentaje: null,
      anchoBarra: 0,
      faltante: null,
      superada: false,
      diasRestantes,
    };
  }

  const porcentaje = redondearUnDecimal((vendidoSeguro / metaNumero) * 100);
  const superada = vendidoSeguro > metaNumero;

  return {
    porcentaje,
    anchoBarra: Math.min(100, Math.max(0, porcentaje)),
    faltante: superada ? 0 : redondearDosDecimales(metaNumero - vendidoSeguro),
    superada,
    diasRestantes,
  };
}

const MONTO_META_MAXIMO = 9999999999.99;

function normalizarTextoMonto(limpio) {
  const tieneComa = limpio.includes(',');
  const tienePunto = limpio.includes('.');

  if (tieneComa && tienePunto) return null;

  let canonico = limpio;

  if (tieneComa) {
    const partes = limpio.split(',');
    if (partes.length !== 2) return null;

    const [entera, fraccion] = partes;
    if (!/^-?\d+$/.test(entera) || !/^\d+$/.test(fraccion) || fraccion.length === 0) {
      return null;
    }

    const enteraSinSigno = entera.replace(/^-/, '');
    const pareceMiles = fraccion.length === 3 && enteraSinSigno.length >= 1 && enteraSinSigno.length <= 3;
    if (pareceMiles) return null;

    canonico = `${entera}.${fraccion}`;
  }

  if (!/^-?\d+(\.\d+)?$/.test(canonico)) return null;

  const fraccion = canonico.includes('.') ? canonico.split('.')[1] : '';
  return { canonico, decimales: fraccion.length };
}

export function validarMonto(texto) {
  const limpio = String(texto ?? '').trim();
  if (!limpio) {
    return { valido: false, monto: null, error: 'Escribe el monto de la meta.' };
  }

  const normalizado = normalizarTextoMonto(limpio);
  if (!normalizado) {
    return { valido: false, monto: null, error: 'Escribe un monto válido.' };
  }

  const monto = Number(normalizado.canonico);
  if (!Number.isFinite(monto)) {
    return { valido: false, monto: null, error: 'Escribe un monto válido.' };
  }

  if (monto <= 0) {
    return { valido: false, monto: null, error: 'La meta debe ser mayor a 0.' };
  }

  if (monto > MONTO_META_MAXIMO) {
    return { valido: false, monto: null, error: 'El monto es demasiado grande.' };
  }

  if (normalizado.decimales > 2) {
    return { valido: false, monto: null, error: 'Usa máximo 2 decimales.' };
  }

  return { valido: true, monto, error: null };
}

export function calcularParticipacion(canales) {
  const filas = (Array.isArray(canales) ? canales : []).map((fila) => {
    const totalNumero = Number(fila?.total);
    const total = Number.isFinite(totalNumero) && totalNumero > 0 ? totalNumero : 0;
    return {
      canal: String(fila?.canal ?? ''),
      total,
    };
  });

  const suma = filas.reduce((acumulado, fila) => acumulado + fila.total, 0);
  if (suma <= 0) {
    return filas.map((fila) => ({
      canal: fila.canal,
      porcentaje: 0,
      total: fila.total,
    }));
  }

  const unidadesObjetivo = 1000;
  const partes = filas.map((fila, indice) => {
    if (fila.total <= 0) {
      return { ...fila, indice, unidades: 0, resto: -1 };
    }

    const exacto = (fila.total * unidadesObjetivo) / suma;
    const unidades = Math.floor(exacto);
    return { ...fila, indice, unidades, resto: exacto - unidades };
  });

  const faltan = unidadesObjetivo - partes.reduce((acumulado, parte) => acumulado + parte.unidades, 0);
  if (faltan > 0) {
    const candidatos = partes
      .filter((parte) => parte.total > 0)
      .sort((a, b) => b.resto - a.resto || a.indice - b.indice);
    for (let i = 0; i < faltan && i < candidatos.length; i += 1) {
      candidatos[i].unidades += 1;
    }
  }

  return partes.map((parte) => ({
    canal: parte.canal,
    porcentaje: parte.unidades / 10,
    total: parte.total,
  }));
}

export function ordenarPorVentas(participacion) {
  const filas = Array.isArray(participacion) ? participacion : [];
  return filas
    .map((fila, indice) => ({ fila, indice }))
    .sort((a, b) => {
      const totalA = Number(a.fila?.total);
      const totalB = Number(b.fila?.total);
      const ventasA = Number.isFinite(totalA) ? totalA : 0;
      const ventasB = Number.isFinite(totalB) ? totalB : 0;
      if (ventasB !== ventasA) return ventasB - ventasA;
      return a.indice - b.indice;
    })
    .map(({ fila }) => ({ ...fila }));
}
