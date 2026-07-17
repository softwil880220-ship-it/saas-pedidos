import { useEffect, useState } from 'react';
import { TIPOS_AJUSTE_MONETARIO } from './mesaCobroCalculos';
import MesaRondaDesglose from './MesaRondaDesglose.jsx';
import { supabase } from './supabase';
import { queryConNegocio } from './tenantHelpers';
import {
  clienteEtiquetaMesa,
  extraerNumeroRondaMesa,
  formatearEtiquetaFolioMesa,
  formatearFechaHoraCocina,
  formatearMoneda,
  obtenerFechaHoyClave,
  obtenerRangoFechaClave,
  pedidoEsRondaMesaEnviada,
} from './pedidosShared';

const FORMAS_PAGO_MESA = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'tarjeta', label: 'Tarjeta' },
  { value: 'transferencia', label: 'Transferencia' },
];

function etiquetaFormaPagoMesa(valor) {
  return FORMAS_PAGO_MESA.find((forma) => forma.value === valor)?.label || '—';
}

function etiquetaDescuentoFolio(tipo, valor) {
  if (tipo === TIPOS_AJUSTE_MONETARIO.PORCENTAJE) {
    return `Descuento (-${valor}%)`;
  }

  if (tipo === TIPOS_AJUSTE_MONETARIO.MONTO_FIJO) {
    return 'Descuento (monto)';
  }

  return 'Descuento';
}

function etiquetaPropinaFolio(tipo, valor) {
  if (tipo === TIPOS_AJUSTE_MONETARIO.PORCENTAJE) {
    return `Propina (+${valor}%)`;
  }

  if (tipo === TIPOS_AJUSTE_MONETARIO.MONTO_FIJO) {
    return 'Propina (monto)';
  }

  return 'Propina';
}

async function cargarRondasFolioMesa({ negocioId, numeroMesa, abiertaEn, cerradaEn }) {
  if (!negocioId || numeroMesa == null || !abiertaEn || !cerradaEn) {
    return [];
  }

  const { data, error } = await queryConNegocio(
    supabase
      .from('pedidos')
      .select('*')
      .eq('tipo', 'mesa')
      .eq('cliente', clienteEtiquetaMesa(numeroMesa))
      .gte('created_at', abiertaEn)
      .lte('created_at', cerradaEn)
      .is('deleted_at', null)
      .order('created_at', { ascending: true }),
    negocioId
  );

  if (error) {
    throw new Error(error.message);
  }

  return (data || []).filter(
    (pedido) =>
      pedidoEsRondaMesaEnviada(pedido, { numeroMesa, abiertaEn }) &&
      new Date(pedido.created_at || 0) <= new Date(cerradaEn)
  );
}

function MesaFolioReciboResumen({ folio }) {
  const descuentoMonto = Number(folio.descuento_monto_aplicado) || 0;
  const propinaMonto = Number(folio.propina_monto_aplicado) || 0;

  return (
    <section className="mesa-folio-cobrado-recibo" aria-label="Resumen de cobro">
      <div className="mesa-folio-cobrado-recibo-fila">
        <span>Subtotal</span>
        <span>{formatearMoneda(folio.subtotal)}</span>
      </div>
      {descuentoMonto > 0 ? (
        <div className="mesa-folio-cobrado-recibo-fila mesa-folio-cobrado-recibo-ajuste">
          <span>{etiquetaDescuentoFolio(folio.descuento_tipo, folio.descuento_valor)}</span>
          <span>-{formatearMoneda(descuentoMonto)}</span>
        </div>
      ) : null}
      {propinaMonto > 0 ? (
        <div className="mesa-folio-cobrado-recibo-fila mesa-folio-cobrado-recibo-ajuste">
          <span>{etiquetaPropinaFolio(folio.propina_tipo, folio.propina_valor)}</span>
          <span>+{formatearMoneda(propinaMonto)}</span>
        </div>
      ) : null}
      <div className="mesa-folio-cobrado-recibo-fila mesa-folio-cobrado-recibo-total">
        <span>Total cobrado</span>
        <span>{formatearMoneda(folio.total_cobrado)}</span>
      </div>
      <div className="mesa-folio-cobrado-recibo-fila">
        <span>Forma de pago</span>
        <span>{etiquetaFormaPagoMesa(folio.forma_pago)}</span>
      </div>
    </section>
  );
}

function MesaFolioCobradoTarjeta({ folio, negocioId, productos, variantesCtx }) {
  const [expandido, setExpandido] = useState(false);
  const [rondas, setRondas] = useState([]);
  const [cargandoRondas, setCargandoRondas] = useState(false);
  const [errorRondas, setErrorRondas] = useState(null);

  useEffect(() => {
    if (!expandido) {
      setRondas([]);
      setCargandoRondas(false);
      setErrorRondas(null);
      return undefined;
    }

    let activo = true;

    const cargarRondas = async () => {
      setCargandoRondas(true);
      setErrorRondas(null);

      try {
        const rondasCargadas = await cargarRondasFolioMesa({
          negocioId,
          numeroMesa: folio.numero_mesa,
          abiertaEn: folio.abierta_en,
          cerradaEn: folio.cerrada_en,
        });

        if (!activo) return;

        setRondas(rondasCargadas);
      } catch (err) {
        if (!activo) return;

        setRondas([]);
        setErrorRondas(err.message || 'No se pudieron cargar las rondas del folio.');
      } finally {
        if (activo) {
          setCargandoRondas(false);
        }
      }
    };

    void cargarRondas();

    return () => {
      activo = false;
    };
  }, [expandido, negocioId, folio.id, folio.numero_mesa, folio.abierta_en, folio.cerrada_en]);

  const etiquetaFolio = formatearEtiquetaFolioMesa(folio);

  return (
    <article className="mesa-folio-cobrado-card">
      <button
        type="button"
        className="mesa-folio-cobrado-resumen"
        aria-expanded={expandido}
        onClick={() => setExpandido((prev) => !prev)}
      >
        <div className="mesa-folio-cobrado-resumen-principal">
          <div className="mesa-folio-cobrado-resumen-identificadores">
            <strong>Mesa {folio.numero_mesa}</strong>
            {etiquetaFolio ? (
              <span className="mesa-folio-cobrado-folio">{etiquetaFolio}</span>
            ) : null}
          </div>
          <span className="mesa-folio-cobrado-total-resumen">
            {formatearMoneda(folio.total_cobrado)}
          </span>
        </div>
        <time className="mesa-folio-cobrado-fecha" dateTime={folio.cerrada_en}>
          {formatearFechaHoraCocina(folio.cerrada_en)}
        </time>
        <span className="mesa-folio-cobrado-chevron" aria-hidden="true">
          {expandido ? '▴' : '▾'}
        </span>
      </button>

      {expandido ? (
        <div className="mesa-folio-cobrado-detalle">
          {cargandoRondas ? (
            <p className="mesa-folio-cobrado-cargando">Cargando rondas...</p>
          ) : errorRondas ? (
            <p className="formulario-error-guardar" role="alert">
              {errorRondas}
            </p>
          ) : rondas.length === 0 ? (
            <p className="mesa-folio-cobrado-vacio-rondas">Sin rondas registradas.</p>
          ) : (
            <div className="mesa-folio-cobrado-rondas">
              {rondas.map((ronda, indice) => {
                const numeroRonda =
                  extraerNumeroRondaMesa(ronda.referencia) ?? indice + 1;

                return (
                  <section key={ronda.id} className="mesa-folio-cobrado-ronda">
                    <header className="mesa-folio-cobrado-ronda-cabecera">
                      <h4>Ronda {numeroRonda}</h4>
                      <time dateTime={ronda.created_at}>
                        {formatearFechaHoraCocina(ronda.created_at)}
                      </time>
                    </header>
                    <MesaRondaDesglose
                      pedido={ronda}
                      productos={productos}
                      variantesCtx={variantesCtx}
                      mostrarEstado={false}
                    />
                  </section>
                );
              })}
            </div>
          )}

          <MesaFolioReciboResumen folio={folio} />
        </div>
      ) : null}
    </article>
  );
}

export default function MesaFoliosCobradosConsulta({ negocioId, productos, variantesCtx }) {
  const [folios, setFolios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!negocioId) {
      setFolios([]);
      setCargando(false);
      return undefined;
    }

    let activo = true;

    const cargarFolios = async () => {
      setCargando(true);
      setError(null);

      try {
        const hoyClave = obtenerFechaHoyClave();
        const { inicio, fin } = obtenerRangoFechaClave(hoyClave);
        const { data, error: queryError } = await queryConNegocio(
          supabase
            .from('mesas_folios')
            .select(
              'id, folio, numero_mesa, estado, abierta_en, cerrada_en, subtotal, descuento_tipo, descuento_valor, descuento_monto_aplicado, propina_tipo, propina_valor, propina_monto_aplicado, total_cobrado, forma_pago'
            )
            .eq('estado', 'cerrada')
            .gte('cerrada_en', inicio.toISOString())
            .lte('cerrada_en', fin.toISOString())
            .order('cerrada_en', { ascending: false }),
          negocioId
        );

        if (!activo) return;

        if (queryError) {
          throw new Error(queryError.message);
        }

        setFolios(data || []);
      } catch (err) {
        if (!activo) return;
        setFolios([]);
        setError(err.message || 'No se pudieron cargar las mesas cobradas del día.');
      } finally {
        if (activo) {
          setCargando(false);
        }
      }
    };

    void cargarFolios();

    return () => {
      activo = false;
    };
  }, [negocioId]);

  return (
    <section className="mesa-folios-cobrados-consulta">
      <header className="mesa-folios-cobrados-cabecera">
        <h2 className="mesa-folios-cobrados-titulo">Mesas cobradas hoy</h2>
        <p className="mesa-folios-cobrados-subtitulo">
          Folios cerrados · solo consulta
        </p>
        <span className="mesa-folios-cobrados-contador">
          {folios.length} cobrada{folios.length === 1 ? '' : 's'}
        </span>
      </header>

      {cargando ? (
        <p className="mesa-folios-cobrados-cargando">Cargando mesas cobradas...</p>
      ) : error ? (
        <p className="formulario-error-guardar" role="alert">
          {error}
        </p>
      ) : folios.length === 0 ? (
        <p className="mesa-folios-cobrados-vacio">No hay mesas cobradas hoy.</p>
      ) : (
        <div className="mesa-folios-cobrados-lista">
          {folios.map((folio) => (
            <MesaFolioCobradoTarjeta
              key={folio.id}
              folio={folio}
              negocioId={negocioId}
              productos={productos}
              variantesCtx={variantesCtx}
            />
          ))}
        </div>
      )}
    </section>
  );
}
