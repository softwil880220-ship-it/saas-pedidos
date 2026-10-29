import { Component, useEffect, useMemo, useRef, useState } from 'react';
import DashboardHeaderReservaMovil from './DashboardHeaderReservaMovil';
import DashboardNav from './DashboardNav';
import { useAuth } from './AuthContext';
import { canalModuloHabilitado } from './pedidosQueryHelpers';
import { formatearMoneda } from './pedidosShared';
import { FILTROS_VENTA_REPORTE } from './reportesHelpers';
import { supabase } from './supabase';
import {
  ALTURA_BARRA_MAX,
  ALTURA_BARRA_MIN,
  calcularAlturasBarras,
  calcularAvance,
  calcularEscalaEjeY,
  calcularParticipacion,
  etiquetaMes,
  formatearMontoCompacto,
  nombreCompletoMes,
  nombreCortoMes,
  ordenarPorVentas,
  validarMonto,
} from './analiticaHelpers';
import './VistaAnalitica.css';

const MODO_POR_CANAL_ANALITICA = {
  caja: 'presencial',
  mostrador: 'mostrador',
  whatsapp_domicilio: 'whatsapp',
  whatsapp_sucursal: 'whatsapp',
  mesas: 'mesas',
};

function esErrorAccesoDenegadoAnalitica(error) {
  if (!error) return false;

  const codigo = String(error.code ?? '').trim();
  if (codigo === '42501') return true;

  const mensaje = String(error.message ?? '').toLowerCase();
  return mensaje.includes('acceso denegado al negocio solicitado');
}

function numeroOCero(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
}

function numeroONull(valor) {
  if (valor == null || valor === '') return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

function normalizarAnalitica(data) {
  const porCanal = Array.isArray(data?.por_canal)
    ? data.por_canal.map((fila) => ({
        canal: String(fila?.canal ?? ''),
        total: numeroOCero(fila?.total),
        pedidos: numeroOCero(fila?.pedidos),
      }))
    : [];

  const mesTexto = String(data?.mes ?? '').slice(0, 10);

  return {
    mes: mesTexto,
    diasEnMes: numeroOCero(data?.dias_en_mes),
    diaActual: numeroONull(data?.dia_actual),
    meta: numeroONull(data?.meta),
    totalVendido: numeroOCero(data?.total_vendido),
    totalPedidos: numeroOCero(data?.total_pedidos),
    porCanal,
  };
}

function etiquetaCanal(canal) {
  const opcion = FILTROS_VENTA_REPORTE.find((item) => item.value === canal);
  return opcion?.label ?? canal;
}

function canalVisible(canal, total, modulosNegocio) {
  const modo = MODO_POR_CANAL_ANALITICA[canal];
  const habilitado = modo ? canalModuloHabilitado(modo, modulosNegocio) : false;
  return habilitado || total > 0;
}

const COLOR_POR_CANAL = {
  caja: '#14532d',
  mostrador: '#06b6d4',
  whatsapp_domicilio: '#b45309',
  whatsapp_sucursal: '#eab308',
  mesas: '#6d28d9',
};

const COLOR_CANAL_FALLBACK = '#334155';

function colorCanal(canal) {
  return COLOR_POR_CANAL[canal] ?? COLOR_CANAL_FALLBACK;
}

function fondoDona(filas) {
  const activos = filas.filter((fila) => fila.total > 0);
  if (activos.length === 0) return 'transparent';

  let cursor = 0;
  const paradas = activos.map((fila, indice) => {
    const inicio = cursor;
    const esUltimo = indice === activos.length - 1;
    cursor = esUltimo ? 100 : Math.round((cursor + fila.porcentaje) * 10) / 10;
    return `${colorCanal(fila.canal)} ${inicio}% ${cursor}%`;
  });

  return `conic-gradient(${paradas.join(', ')})`;
}

function textoDesdeMeta(monto) {
  const numero = Number(monto);
  if (!Number.isFinite(numero)) return '';
  return (Math.round((numero + Number.EPSILON) * 100) / 100).toFixed(2);
}

function mesGuardable(mes) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(mes ?? ''));
}

function textoMes(valor) {
  if (valor == null || valor === '') return null;
  const texto = String(valor).trim().slice(0, 10);
  return texto || null;
}

function normalizarAnio(data) {
  const anioNumero = Number(data?.anio);
  const meses = Array.isArray(data?.meses)
    ? data.meses.map((fila) => ({
        mes: textoMes(fila?.mes) ?? '',
        total: numeroOCero(fila?.total),
      }))
    : [];

  return {
    anio: Number.isInteger(anioNumero) ? anioNumero : null,
    mesActual: textoMes(data?.mes_actual),
    meses,
  };
}

function mesSeleccionadoInicial(datos) {
  const meses = datos?.meses ?? [];
  if (meses.length === 0) return null;
  if (datos.mesActual && meses.some((fila) => fila.mes === datos.mesActual)) {
    return datos.mesActual;
  }
  return meses[meses.length - 1].mes;
}

function anioDeTextoMes(texto) {
  const anio = String(texto ?? '').split('-')[0] ?? '';
  return /^\d{4}$/.test(anio) ? anio : '';
}

function etiquetaAccesibleMes(fila, enCurso) {
  const nombre = nombreCompletoMes(fila.mes) || fila.mes || 'Mes';
  const anio = anioDeTextoMes(fila.mes);
  const base = `${nombre}${anio ? ` ${anio}` : ''}: ${formatearMoneda(fila.total)}`;
  return enCurso ? `${base}, en curso` : base;
}

function lineaMesSeleccionado(fila) {
  const nombre = nombreCompletoMes(fila.mes) || fila.mes;
  const anio = anioDeTextoMes(fila.mes);
  const titulo = [nombre, anio].filter(Boolean).join(' ');
  return `${titulo} · ${formatearMoneda(fila.total)}`;
}

class LimiteErrorGraficaAnio extends Component {
  constructor(props) {
    super(props);
    this.state = { tieneError: false };
  }

  static getDerivedStateFromError() {
    return { tieneError: true };
  }

  componentDidCatch(error) {
    console.error(error);
  }

  render() {
    if (this.state.tieneError) {
      return (
        <article className="analitica-anio" aria-label="Ventas por mes">
          <p className="analitica-anio-titulo">Ventas por mes</p>
          <p className="analitica-anio-vacio">No se pudo mostrar la gráfica</p>
        </article>
      );
    }

    return this.props.children;
  }
}

export function AnaliticaAnio({ negocioId }) {
  const [cargandoAnio, setCargandoAnio] = useState(() => Boolean(negocioId));
  const [errorAnio, setErrorAnio] = useState(null);
  const [anio, setAnio] = useState(null);
  const [mesSeleccionado, setMesSeleccionado] = useState(null);
  const [intentoAnio, setIntentoAnio] = useState(0);

  useEffect(() => {
    let activo = true;

    if (!negocioId) {
      setAnio(null);
      setMesSeleccionado(null);
      setCargandoAnio(false);
      setErrorAnio(null);
      return undefined;
    }

    const cargarAnio = async () => {
      setCargandoAnio(true);
      setErrorAnio(null);

      const { data, error: errorRpc } = await supabase.rpc('obtener_analitica_ventas_anio', {
        p_negocio_id: negocioId,
        p_anio: null,
      });

      if (!activo) return;

      if (errorRpc) {
        if (esErrorAccesoDenegadoAnalitica(errorRpc)) {
          console.error(
            '[Analítica > Básica] Acceso denegado al negocio solicitado (42501). ' +
              'Verifica que negocioId de la sesión coincide con usuario_negocio_id() en Supabase.',
            { negocioId, error: errorRpc }
          );
        }

        setErrorAnio('No se pudieron cargar las ventas del año. Intenta de nuevo.');
        setAnio(null);
        setMesSeleccionado(null);
      } else {
        const normalizado = normalizarAnio(data);
        setAnio(normalizado);
        setMesSeleccionado(mesSeleccionadoInicial(normalizado));
      }

      setCargandoAnio(false);
    };

    void cargarAnio();

    return () => {
      activo = false;
    };
  }, [negocioId, intentoAnio]);

  if (!negocioId && !cargandoAnio) return null;

  const mesesAnio = anio?.meses ?? [];
  const titulo = anio?.anio != null ? `Ventas por mes · ${anio.anio}` : 'Ventas por mes';
  const seleccionado = mesesAnio.find((fila) => fila.mes === mesSeleccionado)
    ?? mesesAnio[mesesAnio.length - 1]
    ?? null;
  const maximoAnio = mesesAnio.reduce((mayor, fila) => Math.max(mayor, fila.total), 0);
  const escalaAnio = calcularEscalaEjeY(maximoAnio);
  const alturas = calcularAlturasBarras(
    mesesAnio.map((fila) => fila.total),
    escalaAnio.tope
  );

  let cuerpo = null;
  if (cargandoAnio) {
    cuerpo = <p className="analitica-estado">Cargando...</p>;
  } else if (errorAnio) {
    cuerpo = (
      <div className="analitica-error" role="alert">
        <p className="analitica-error-texto">{errorAnio}</p>
        <button
          type="button"
          className="analitica-reintentar"
          onClick={() => {
            setCargandoAnio(true);
            setErrorAnio(null);
            setIntentoAnio((valor) => valor + 1);
          }}
        >
          Reintentar
        </button>
      </div>
    );
  } else if (anio && anio.meses.length === 0) {
    cuerpo = <p className="analitica-anio-vacio">Aún no hay ventas este año</p>;
  } else if (anio) {
    cuerpo = (
      <>
        {seleccionado ? (
          <p className="analitica-anio-detalle" aria-live="polite">
            {lineaMesSeleccionado(seleccionado)}
          </p>
        ) : null}
        <div className="analitica-anio-grafica">
          <div className="analitica-anio-eje" aria-hidden="true">
            <div className="analitica-anio-eje-valor" />
            <div className="analitica-anio-eje-marcas">
              {escalaAnio.marcas.map((marca) => (
                <span
                  key={marca}
                  className="analitica-anio-eje-marca"
                  style={{ bottom: `${(marca / escalaAnio.tope) * 100}%` }}
                >
                  {formatearMontoCompacto(marca)}
                </span>
              ))}
            </div>
            <div className="analitica-anio-eje-meses" />
          </div>
          <div className="analitica-anio-plot">
            <div className="analitica-anio-guias" aria-hidden="true">
              {escalaAnio.marcas.map((marca) => (
                <span
                  key={marca}
                  className={`analitica-anio-guia${marca === 0 ? ' base' : ''}`}
                  style={{ bottom: `${(marca / escalaAnio.tope) * 100}%` }}
                />
              ))}
            </div>
            <div className="analitica-anio-barras" role="group" aria-label={titulo}>
              {anio.meses.map((fila, indice) => {
                const enCurso = anio.mesActual != null && fila.mes === anio.mesActual;
                const activo = seleccionado?.mes === fila.mes;
                const altura = alturas[indice];
                const esMinima = altura <= ALTURA_BARRA_MIN;
                const porcentaje = (altura / ALTURA_BARRA_MAX) * 100;
                return (
                  <button
                    key={`${fila.mes}-${indice}`}
                    type="button"
                    className={`analitica-anio-boton${activo ? ' activo' : ''}`}
                    aria-pressed={activo}
                    aria-label={etiquetaAccesibleMes(fila, enCurso)}
                    onClick={() => setMesSeleccionado(fila.mes)}
                  >
                    <span className="analitica-anio-pista">
                      <span className="analitica-anio-columna">
                        <span
                          className="analitica-anio-valor"
                          style={{
                            bottom: esMinima ? '6px' : `calc(${porcentaje}% + 4px)`,
                          }}
                        >
                          {formatearMontoCompacto(fila.total)}
                        </span>
                        <span
                          className={`analitica-anio-relleno${enCurso ? ' en-curso' : ''}`}
                          style={{ height: esMinima ? ALTURA_BARRA_MIN : `${porcentaje}%` }}
                        />
                      </span>
                    </span>
                    <span className="analitica-anio-nombre">{nombreCortoMes(fila.mes)}</span>
                    <span className="analitica-anio-curso">{enCurso ? 'en curso' : ''}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <article className="analitica-anio" aria-label={titulo}>
      <p className="analitica-anio-titulo">{titulo}</p>
      {cuerpo}
    </article>
  );
}

function AnaliticaBasica({ negocioId, modulosNegocio, sessionUserId }) {
  const [cargando, setCargando] = useState(() => Boolean(negocioId));
  const [errorCarga, setErrorCarga] = useState(null);
  const [analitica, setAnalitica] = useState(null);
  const [intento, setIntento] = useState(0);
  const [editandoMeta, setEditandoMeta] = useState(false);
  const [textoMeta, setTextoMeta] = useState('');
  const [errorMeta, setErrorMeta] = useState(null);
  const [errorGuardado, setErrorGuardado] = useState(null);
  const [guardandoMeta, setGuardandoMeta] = useState(false);
  const montadoRef = useRef(true);
  const guardadoRef = useRef(0);
  const guardadoEnVueloRef = useRef(false);

  useEffect(() => {
    montadoRef.current = true;
    return () => {
      montadoRef.current = false;
    };
  }, []);

  useEffect(() => {
    let activo = true;

    if (!negocioId) {
      setAnalitica(null);
      setCargando(false);
      setErrorCarga(null);
      return undefined;
    }

    const cargarAnalitica = async () => {
      setCargando(true);
      setErrorCarga(null);

      const { data, error: errorRpc } = await supabase.rpc('obtener_analitica_ventas_mes', {
        p_negocio_id: negocioId,
        p_mes: null,
      });

      if (!activo) return;

      if (errorRpc) {
        if (esErrorAccesoDenegadoAnalitica(errorRpc)) {
          console.error(
            '[Analítica > Básica] Acceso denegado al negocio solicitado (42501). ' +
              'Verifica que negocioId de la sesión coincide con usuario_negocio_id() en Supabase.',
            { negocioId, error: errorRpc }
          );
        }

        setErrorCarga('No se pudo cargar la analítica. Intenta de nuevo.');
        setAnalitica(null);
      } else {
        setAnalitica(normalizarAnalitica(data));
      }

      setCargando(false);
    };

    void cargarAnalitica();

    return () => {
      activo = false;
    };
  }, [negocioId, intento]);

  const canalesVisibles = useMemo(() => {
    if (!analitica) return [];
    return analitica.porCanal.filter((fila) =>
      canalVisible(fila.canal, fila.total, modulosNegocio)
    );
  }, [analitica, modulosNegocio]);

  const participacion = useMemo(
    () => ordenarPorVentas(calcularParticipacion(canalesVisibles)),
    [canalesVisibles]
  );

  const abrirMeta = () => {
    setTextoMeta(analitica?.meta == null ? '' : textoDesdeMeta(analitica.meta));
    setErrorMeta(null);
    setErrorGuardado(null);
    setEditandoMeta(true);
  };

  const cancelarMeta = () => {
    if (guardandoMeta) return;
    setEditandoMeta(false);
    setErrorMeta(null);
    setErrorGuardado(null);
  };

  const guardarMeta = async (evento) => {
    evento.preventDefault();
    if (guardandoMeta || guardadoEnVueloRef.current) return;

    const validacion = validarMonto(textoMeta);
    if (!validacion.valido) {
      setErrorMeta(validacion.error);
      setErrorGuardado(null);
      return;
    }

    const mes = analitica?.mes;
    if (!negocioId || !sessionUserId || !mesGuardable(mes)) {
      setErrorMeta(null);
      setErrorGuardado('No se pudo guardar la meta. Intenta de nuevo.');
      return;
    }

    const marca = guardadoRef.current + 1;
    guardadoRef.current = marca;
    guardadoEnVueloRef.current = true;
    setGuardandoMeta(true);
    setErrorMeta(null);
    setErrorGuardado(null);

    let error;
    try {
      const resultado = await supabase.from('metas_ventas').upsert(
        {
          negocio_id: negocioId,
          mes,
          monto: validacion.monto,
          actualizado_por: sessionUserId,
        },
        { onConflict: 'negocio_id,mes' }
      );
      error = resultado.error;
    } catch (errorInesperado) {
      error = errorInesperado;
    }

    if (!montadoRef.current || marca !== guardadoRef.current) {
      guardadoEnVueloRef.current = false;
      return;
    }

    guardadoEnVueloRef.current = false;

    if (error) {
      if (esErrorAccesoDenegadoAnalitica(error)) {
        console.error(
          '[Analítica > Básica] Acceso denegado al guardar la meta (42501).',
          { negocioId, error }
        );
      }
      setGuardandoMeta(false);
      setErrorGuardado('No se pudo guardar la meta. Intenta de nuevo.');
      return;
    }

    setGuardandoMeta(false);
    setEditandoMeta(false);
    setTextoMeta('');
    setCargando(true);
    setIntento((valor) => valor + 1);
  };

  const formularioMeta = editandoMeta ? (
    <form className="analitica-meta-form" onSubmit={guardarMeta}>
      <label className="analitica-meta-label" htmlFor="analitica-meta-monto">
        Monto de la meta
      </label>
      <input
        id="analitica-meta-monto"
        className="analitica-meta-input"
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={textoMeta}
        onChange={(evento) => {
          setTextoMeta(evento.target.value);
          setErrorMeta(null);
          setErrorGuardado(null);
        }}
        disabled={guardandoMeta}
        aria-invalid={errorMeta || errorGuardado ? true : undefined}
        aria-describedby={errorMeta || errorGuardado ? 'analitica-meta-error' : undefined}
      />
      {errorMeta || errorGuardado ? (
        <p id="analitica-meta-error" className="analitica-meta-error" role="alert">
          {errorMeta || errorGuardado}
        </p>
      ) : null}
      <div className="analitica-meta-botones">
        <button type="submit" className="analitica-meta-guardar" disabled={guardandoMeta}>
          {guardandoMeta ? 'Guardando…' : 'Guardar'}
        </button>
        <button
          type="button"
          className="analitica-meta-cancelar"
          onClick={cancelarMeta}
          disabled={guardandoMeta}
        >
          Cancelar
        </button>
      </div>
    </form>
  ) : null;

  const avance = analitica
    ? calcularAvance({
        vendido: analitica.totalVendido,
        meta: analitica.meta,
        diaActual: analitica.diaActual,
        diasEnMes: analitica.diasEnMes,
      })
    : null;
  const etiqueta = analitica ? etiquetaMes(analitica.mes) : '';
  const lineaMes = analitica && analitica.diaActual != null
    ? `${etiqueta} · Día ${analitica.diaActual} de ${analitica.diasEnMes}`
    : etiqueta;
  const hayMeta = Boolean(analitica && analitica.meta != null && avance?.porcentaje != null);
  const exceso = hayMeta && avance.superada
    ? analitica.totalVendido - analitica.meta
    : 0;

  return (
    <div className="analitica-basica">
      {cargando ? (
        <p className="analitica-estado">Cargando...</p>
      ) : errorCarga ? (
        <div className="analitica-error" role="alert">
          <p className="analitica-error-texto">{errorCarga}</p>
          <button
            type="button"
            className="analitica-reintentar"
            onClick={() => {
              setCargando(true);
              setErrorCarga(null);
              setIntento((valor) => valor + 1);
            }}
          >
            Reintentar
          </button>
        </div>
      ) : analitica ? (
        <>
      {lineaMes ? <p className="analitica-periodo">{lineaMes}</p> : null}

      {analitica.totalPedidos === 0 ? (
        <p className="analitica-vacio">Todavía no hay ventas registradas este mes</p>
      ) : null}

      {analitica.meta == null ? (
        <div className="analitica-sin-meta-bloque">
          <div className="analitica-sin-meta-fila">
            <p className="analitica-sin-meta">Aún no hay meta definida para este mes</p>
            <p className="analitica-vendidos">{formatearMoneda(analitica.totalVendido)} vendidos</p>
            {editandoMeta ? null : (
              <button type="button" className="analitica-meta-accion" onClick={abrirMeta}>
                Definir meta
              </button>
            )}
          </div>
          {formularioMeta}
        </div>
      ) : hayMeta ? (
        <article className="analitica-meta">
          <p className="analitica-objetivo">
            Objetivo mensual: {formatearMoneda(analitica.meta)}
          </p>
          <div className="analitica-barra-fila">
            <div
              className="analitica-barra"
              role="progressbar"
              aria-valuenow={avance.anchoBarra}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Avance de la meta del mes"
            >
              <div
                className="analitica-barra-relleno"
                style={{ width: `${avance.anchoBarra}%` }}
              />
              <div className="analitica-barra-segmentos" aria-hidden="true" />
            </div>
            <span className="analitica-barra-porcentaje">{avance.porcentaje.toFixed(1)} %</span>
          </div>
          <p className="analitica-vendidos">{formatearMoneda(analitica.totalVendido)} vendidos</p>
          {avance.superada ? (
            <p className="analitica-meta-detalle">
              Meta superada por {formatearMoneda(exceso)}
            </p>
          ) : avance.faltante > 0 ? (
            <ul className="analitica-meta-lista">
              <li>Falta: {formatearMoneda(avance.faltante)}</li>
              {avance.diasRestantes != null ? (
                <li>Días restantes: {avance.diasRestantes}</li>
              ) : null}
            </ul>
          ) : null}
          {editandoMeta ? null : (
            <button type="button" className="analitica-meta-accion" onClick={abrirMeta}>
              Editar meta
            </button>
          )}
          {formularioMeta}
        </article>
      ) : null}

      {participacion.some((fila) => fila.total > 0) ? (
        <section className="analitica-canales" aria-label="Ventas por canal">
          <div className="analitica-dona-bloque">
            <div
              className="analitica-dona"
              role="img"
              aria-label={`Ventas por canal: ${participacion
                .map((fila) => `${etiquetaCanal(fila.canal)} ${fila.porcentaje.toFixed(1)} %`)
                .join(', ')}`}
              style={{ background: fondoDona(participacion) }}
            >
              <div className="analitica-dona-hueco">Ventas por canal</div>
            </div>
            <ul className="analitica-leyenda">
              {participacion.map((fila) => (
                <li key={fila.canal} className="analitica-leyenda-item">
                  <span
                    className="analitica-leyenda-punto"
                    style={{ background: colorCanal(fila.canal) }}
                    aria-hidden="true"
                  />
                  <span className="analitica-leyenda-nombre">{etiquetaCanal(fila.canal)}</span>
                  <span className="analitica-leyenda-porcentaje">{fila.porcentaje.toFixed(1)} %</span>
                  <span className="analitica-leyenda-monto">{formatearMoneda(fila.total)}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : analitica.totalPedidos !== 0 ? (
        <p className="analitica-vacio">Todavía no hay ventas registradas este mes</p>
      ) : null}
        </>
      ) : null}
      <LimiteErrorGraficaAnio>
        <AnaliticaAnio negocioId={negocioId} />
      </LimiteErrorGraficaAnio>
    </div>
  );
}

export default function VistaAnalitica() {
  const { negocioId, rol, modulosNegocio, session } = useAuth();
  const [tabAnalitica, setTabAnalitica] = useState('basica');

  const tabsAnalitica = useMemo(() => {
    const tabs = [{ value: 'basica', label: 'Básica' }];
    return tabs;
  }, []);

  const tabActivo = tabsAnalitica.some((tab) => tab.value === tabAnalitica)
    ? tabAnalitica
    : 'basica';

  return (
    <div className="dashboard">
      <DashboardHeaderReservaMovil />

      <main className="dashboard-main">
        <DashboardNav activo="analitica" rol={rol} />

        <section className="analitica-vista" aria-label="Analítica">
          <nav className="analitica-seccion-nav" role="tablist" aria-label="Secciones de analítica">
            {tabsAnalitica.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                role="tab"
                id={`analitica-tab-${value}`}
                aria-selected={tabActivo === value}
                aria-controls={`analitica-panel-${value}`}
                className={`analitica-seccion-tab${tabActivo === value ? ' activo' : ''}`}
                onClick={() => setTabAnalitica(value)}
              >
                {label}
              </button>
            ))}
          </nav>

          {tabActivo === 'basica' ? (
            <section
              key={negocioId ?? 'sin-negocio'}
              id="analitica-panel-basica"
              role="tabpanel"
              aria-labelledby="analitica-tab-basica"
              className="analitica-panel"
            >
              <AnaliticaBasica
                negocioId={negocioId}
                modulosNegocio={modulosNegocio}
                sessionUserId={session?.user?.id ?? null}
              />
            </section>
          ) : null}
        </section>
      </main>
    </div>
  );
}
