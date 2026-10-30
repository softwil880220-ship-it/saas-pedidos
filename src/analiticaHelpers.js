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

const NOMBRES_MES_CORTO = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
];

const NOMBRES_MES_COMPLETO = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

export const ALTURA_BARRA_MAX = 160;
export const ALTURA_BARRA_MIN = 2;

function pasosBonitos(valor) {
  const crudo = valor / 4;
  const exponente = Math.floor(Math.log10(crudo));
  const pasos = new Set();

  for (let decada = exponente - 1; decada <= exponente + 2; decada += 1) {
    const potencia = 10 ** decada;
    for (const factor of [1, 2, 5]) {
      const paso = factor * potencia;
      if (paso > 0 && Number.isFinite(paso)) pasos.add(paso);
    }
  }

  return [...pasos];
}

function marcaRedonda(paso, indice) {
  const cruda = paso * indice;
  return paso >= 1 ? Math.round(cruda) : Number(cruda.toFixed(6));
}

export function calcularEscalaEjeY(maximo) {
  const numero = Number(maximo);
  const valor = Number.isFinite(numero) && numero > 0 ? numero : 0;
  if (valor <= 0) {
    return { tope: 1000, marcas: [0, 1000] };
  }

  const opciones = [];
  for (const paso of pasosBonitos(valor)) {
    const intervalos = Math.ceil(valor / paso - 1e-9);
    if (intervalos < 1 || intervalos > 6) continue;

    const tope = marcaRedonda(paso, intervalos);
    const marcas = intervalos + 1;
    opciones.push({ paso, tope, marcas, intervalos });
  }

  opciones.sort((a, b) => {
    const aEnRango = a.marcas >= 4 && a.marcas <= 5 ? 0 : 1;
    const bEnRango = b.marcas >= 4 && b.marcas <= 5 ? 0 : 1;
    if (aEnRango !== bEnRango) return aEnRango - bEnRango;
    if (a.tope !== b.tope) return a.tope - b.tope;
    const distancia = Math.abs(a.marcas - 4.5) - Math.abs(b.marcas - 4.5);
    if (distancia !== 0) return distancia;
    return a.marcas - b.marcas;
  });

  const elegida = opciones[0];
  if (!elegida) {
    return { tope: 1000, marcas: [0, 1000] };
  }

  const marcas = [];
  for (let indice = 0; indice <= elegida.intervalos; indice += 1) {
    marcas.push(marcaRedonda(elegida.paso, indice));
  }

  return { tope: elegida.tope, marcas };
}

function indiceMesTexto(textoFecha) {
  const partes = String(textoFecha ?? '').trim().split('-');
  if (partes.length < 2) return -1;

  const anio = partes[0];
  const mes = partes[1];
  if (!/^\d{4}$/.test(anio) || !/^\d{2}$/.test(mes)) return -1;

  const indice = Number(mes) - 1;
  if (indice < 0 || indice > 11) return -1;
  return indice;
}

export function nombreCortoMes(textoFecha) {
  const indice = indiceMesTexto(textoFecha);
  return indice < 0 ? '' : NOMBRES_MES_CORTO[indice];
}

export function nombreCompletoMes(textoFecha) {
  const indice = indiceMesTexto(textoFecha);
  return indice < 0 ? '' : NOMBRES_MES_COMPLETO[indice];
}

function escalaCompacta(valor) {
  const redondeado = Math.round((valor + Number.EPSILON) * 10) / 10;
  return Number.isInteger(redondeado) ? String(redondeado) : redondeado.toFixed(1);
}

export function formatearMontoCompacto(valor) {
  if (valor == null || valor === '') return '';

  const numero = Number(valor);
  if (!Number.isFinite(numero)) return '';

  const signo = numero < 0 ? '-' : '';
  const absoluto = Math.abs(numero);

  if (absoluto >= 1000000) {
    return `${signo}$${escalaCompacta(absoluto / 1000000)} M`;
  }
  if (absoluto >= 1000) {
    return `${signo}$${escalaCompacta(absoluto / 1000)} mil`;
  }
  return `${signo}$${escalaCompacta(absoluto)}`;
}

export function calcularAlturasBarras(totales, tope) {
  const lista = Array.isArray(totales) ? totales : [];
  const seguros = lista.map((valor) => {
    const numero = Number(valor);
    return Number.isFinite(numero) && numero > 0 ? numero : 0;
  });

  if (seguros.length === 0) return [];

  const topeNumero = Number(tope);
  const techo = Number.isFinite(topeNumero) && topeNumero > 0
    ? topeNumero
    : seguros.reduce((mayor, valor) => (valor > mayor ? valor : mayor), 0);

  if (!(techo > 0)) {
    return seguros.map(() => ALTURA_BARRA_MIN);
  }

  return seguros.map((valor) => (
    valor <= 0
      ? ALTURA_BARRA_MIN
      : Math.max(ALTURA_BARRA_MIN, Math.round((valor / techo) * ALTURA_BARRA_MAX))
  ));
}

const INICIALES_DIA_SEMANA = ['', 'L', 'M', 'M', 'J', 'V', 'S', 'D'];

const NOMBRES_DIA_SEMANA = [
  '',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo',
];

const DIAS_ETIQUETA_CLAVE = new Set([1, 5, 10, 15, 20, 25, 30]);

function dowIsoValido(dow) {
  const numero = Number(dow);
  if (!Number.isInteger(numero) || numero < 1 || numero > 7) return null;
  return numero;
}

export function inicialDiaSemana(dow) {
  const iso = dowIsoValido(dow);
  return iso == null ? '' : INICIALES_DIA_SEMANA[iso];
}

export function nombreCompletoDiaSemana(dow) {
  const iso = dowIsoValido(dow);
  return iso == null ? '' : NOMBRES_DIA_SEMANA[iso];
}

export function esFinDeSemana(dow) {
  const iso = dowIsoValido(dow);
  return iso === 6 || iso === 7;
}

export function esDiaEtiquetaClave(dia) {
  const numero = Number(dia);
  if (!Number.isInteger(numero) || numero < 1) return false;
  return DIAS_ETIQUETA_CLAVE.has(numero);
}

export function nombreMesMinuscula(textoFecha) {
  const indice = indiceMesTexto(textoFecha);
  return indice < 0 ? '' : NOMBRES_MES[indice];
}

export function calcularDowIsoDesdePartes(anio, mes, dia) {
  const y = Number(anio);
  const m = Number(mes);
  const d = Number(dia);
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;

  const js = new Date(y, m - 1, d).getDay();
  return js === 0 ? 7 : js;
}

export function fechaTextoDesdeMesYDia(mesTexto, diaNumero) {
  const indiceMes = indiceMesTexto(mesTexto);
  if (indiceMes < 0) return '';

  const dia = Number(diaNumero);
  if (!Number.isInteger(dia) || dia < 1 || dia > 31) return '';

  const partes = String(mesTexto ?? '').trim().slice(0, 10).split('-');
  const anio = partes[0];
  const mes = partes[1];
  const diaTexto = String(dia).padStart(2, '0');

  return `${anio}-${mes}-${diaTexto}`;
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
